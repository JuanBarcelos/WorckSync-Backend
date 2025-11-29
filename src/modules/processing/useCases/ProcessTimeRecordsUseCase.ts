import { PrismaClient } from '@prisma/client';
import { TimeCalculationService } from '../services/TimeCalculationService';
import { OccurrenceGeneratorService } from '../services/OccurrenceGeneratorService';
import { ProcessingOptions, ProcessingResult } from '../types';
import { AppError } from '../../../shared/errors/AppError';

export class ProcessTimeRecordsUseCase {
  private timeCalculationService: TimeCalculationService;
  private occurrenceGenerator: OccurrenceGeneratorService;

  constructor(private prisma: PrismaClient) {
    this.timeCalculationService = new TimeCalculationService();
    this.occurrenceGenerator = new OccurrenceGeneratorService(prisma);
  }

  async execute(
    filters: { employeeId?: string; startDate: Date; endDate: Date; shiftId?: string },
    options: ProcessingOptions,
    userId: string
  ) {
    if (filters.endDate < filters.startDate) {
      throw new AppError('Data final deve ser maior que data inicial');
    }

    // 1. Busca Otimizada (Eager Loading necessário)
    const timeRecords = await this.prisma.timeRecord.findMany({
      where: {
        ...(filters.employeeId && { employeeId: filters.employeeId }),
        date: { gte: filters.startDate, lte: filters.endDate },
        ...(filters.shiftId && { employee: { shiftId: filters.shiftId } })
      },
      include: {
        employee: { include: { shift: true } },
      },
      orderBy: { date: 'asc' }
    });

    const results: ProcessingResult[] = [];
    let occurrencesGenerated = 0;
    let errors = 0;

    // Array para armazenar operações em lote
    const recordsToUpdate: { id: string; data: any; occurrences: any[] }[] = [];

    // 2. Processamento em Memória (Rápido)
    for (const record of timeRecords) {
      try {
        const shift = record.employee.shift;
        const calculation = this.timeCalculationService.calculateWorkTime(record, shift);

        const hasIssues = calculation.lateMinutes > 0 || 
                          calculation.earlyLeaveMinutes > 0 || 
                          calculation.missingMinutes > 0 ||
                          calculation.excessiveLunchMinutes > 15;

        // Calcula ocorrências em memória
        let occurrencesPayload: any[] = [];
        if (options.generateOccurrences) {
          occurrencesPayload = this.occurrenceGenerator.calculateOccurrences(record, calculation, shift);
          occurrencesGenerated += occurrencesPayload.length;
        }

        recordsToUpdate.push({
          id: record.id,
          data: {
            totalWorkedMinutes: calculation.totalWorkedMinutes,
            regularMinutes: calculation.regularMinutes,
            overtimeMinutes: calculation.overtimeMinutes,
            nightShiftMinutes: calculation.nightShiftMinutes,
            lateMinutes: calculation.lateMinutes,
            earlyLeaveMinutes: calculation.earlyLeaveMinutes,
            absentMinutes: calculation.missingMinutes,
            hasIssues,
          },
          occurrences: occurrencesPayload
        });

        results.push({
          timeRecordId: record.id,
          employeeId: record.employeeId,
          date: record.date,
          calculations: calculation,
          occurrences: occurrencesPayload, // simplificado para retorno visual
          hasIssues,
          isComplete: true 
        });

      } catch (error) {
        errors++;
        console.error(`Erro processando registro ID ${record.id}:`, error);
      }
    }

    // 3. Persistência em Lote (Batching com Transações)
    const CHUNK_SIZE = 50; // Tamanho do lote para não travar o banco
    
    for (let i = 0; i < recordsToUpdate.length; i += CHUNK_SIZE) {
      const chunk = recordsToUpdate.slice(i, i + CHUNK_SIZE);
      
      const transactions = chunk.map(item => {
        const ops: any[] = [
          // Atualiza o TimeRecord
          this.prisma.timeRecord.update({
            where: { id: item.id },
            data: item.data
          })
        ];

        // Atualiza Ocorrências (Estratégia: Limpar e Recriar)
        if (options.generateOccurrences) {
          ops.push(this.prisma.occurrence.deleteMany({ where: { timeRecordId: item.id } }));
          if (item.occurrences.length > 0) {
            ops.push(this.prisma.occurrence.createMany({ data: item.occurrences }));
          }
        }
        return ops;
      }).flat();

      // Executa o lote
      await this.prisma.$transaction(transactions);
    }

    // Log de Sistema
    await this.prisma.systemLog.create({
      data: {
        action: 'PROCESS_TIME_RECORDS',
        module: 'PROCESSING',
        details: JSON.stringify({ 
          filters, 
          totalProcessed: results.length, 
          occurrencesGenerated, 
          errors 
        }),
        userId,
      },
    });

    return {
      success: errors === 0,
      processed: results.length,
      occurrencesGenerated,
      errors,
      summary: this.generateSummary(results),
    };
  }

  private generateSummary(results: ProcessingResult[]) {
    const totalMinutes = results.reduce((sum, r) => sum + r.calculations.totalWorkedMinutes, 0);
    const overtimeMinutes = results.reduce((sum, r) => sum + r.calculations.overtimeMinutes, 0);
    const lateMinutes = results.reduce((sum, r) => sum + r.calculations.lateMinutes, 0);
    
    return {
      totalRecords: results.length,
      totalWorkedHours: (totalMinutes / 60).toFixed(2),
      totalOvertimeHours: (overtimeMinutes / 60).toFixed(2),
      totalLateMinutes: lateMinutes,
      recordsWithIssues: results.filter(r => r.hasIssues).length,
    };
  }
}