import { IImportRepository } from '../repositories/IImportRepository';
import { NotFoundError, AppError } from '../../../shared/errors/AppError';
import { PrismaClient } from '@prisma/client';
import { ExcelParser } from '../../../shared/utils/excelParser';
import { TimeCalculationService } from '../../../modules/processing/services/TimeCalculationService';
import { OccurrenceGeneratorService } from '../../../modules/processing/services/OccurrenceGeneratorService';
import { getDayOfWeek } from '../../../shared/utils/dateHelpers';

interface ProcessOptions {
  autoCalculate: boolean;
  generateOccurrences: boolean;
  analyzeRecords: boolean;
}

export class ProcessImportUseCase {
  private timeCalculationService: TimeCalculationService;
  private occurrenceGenerator: OccurrenceGeneratorService;

  constructor(
    private importRepository: IImportRepository,
    private prisma: PrismaClient
  ) {
    this.timeCalculationService = new TimeCalculationService();
    this.occurrenceGenerator = new OccurrenceGeneratorService(prisma);
  }

  async execute(
    importId: string, 
    fileBuffer: Buffer, 
    userId: string,
    options: ProcessOptions
  ) {
    const importRecord = await this.importRepository.findById(importId);
    
    if (!importRecord) throw new NotFoundError('Importação não encontrada');
    if (importRecord.status !== 'PENDING') throw new AppError('Esta importação já foi processada', 400);

    console.log(`📊 Iniciando importação ${importId}`);

    await this.importRepository.update(importId, {
      status: 'PROCESSING',
      processedAt: new Date(),
    });

    try {
      const parser = new ExcelParser(fileBuffer);
      const parseResult = parser.parse();
      const logs: any[] = [];

      // Contadores
      const stats = {
        processed: 0,
        failed: 0,
        skipped: 0,
        occurrences: 0,
        calculations: 0
      };

      // 1. Registrar Warnings iniciais
      parseResult.warnings.forEach(warning => {
        logs.push({ importId, row: 0, status: 'WARNING', message: warning });
      });

      // 2. Agrupamento e Otimização de Consultas (Eliminando N+1)
      const sheetIds = new Set<string>();
      parseResult.data.forEach(record => sheetIds.add(record.sheetId));

      // Busca TODOS os funcionários de uma vez
      const employees = await this.prisma.employee.findMany({
        where: { sheetId: { in: Array.from(sheetIds) } },
        include: { shift: true },
      });

      // Mapa para acesso rápido (O(1))
      const employeeMap = new Map(employees.map(e => [e.sheetId, e]));

      // Agrupar registros por SheetID para processamento ordenado
      const recordsByEmployee = new Map<string, typeof parseResult.data>();
      for (const record of parseResult.data) {
        if (!recordsByEmployee.has(record.sheetId)) {
          recordsByEmployee.set(record.sheetId, []);
        }
        recordsByEmployee.get(record.sheetId)!.push(record);
      }

      console.log(`📋 Processando registros de ${recordsByEmployee.size} funcionários mapeados`);

      // 3. Loop de Processamento
      for (const [sheetId, records] of recordsByEmployee) {
        const employee = employeeMap.get(sheetId);

        // Caso Funcionário não exista
        if (!employee) {
          stats.failed += records.length;
          const empData = parseResult.employees.find(e => e.id === sheetId);
          logs.push({
            importId,
            row: 0,
            status: 'ERROR',
            message: `Funcionário não cadastrado: ${sheetId}`,
            data: { sheetId, nome: empData?.nome },
          });
          continue;
        }

        // Otimização: Buscar registros existentes deste funcionário neste intervalo de datas
        // para evitar findUnique dentro do loop interno
        const recordDates = records.map(r => r.date);
        const existingTimeRecords = await this.prisma.timeRecord.findMany({
          where: {
            employeeId: employee.id,
            date: { in: recordDates }
          },
          select: { date: true }
        });
        
        const existingDatesSet = new Set(existingTimeRecords.map(r => r.date.toISOString().split('T')[0]));

        for (const record of records) {
          try {
            // Verifica duplicidade em memória
            const recordDateKey = record.date.toISOString().split('T')[0];
            if (existingDatesSet.has(recordDateKey)) {
              stats.skipped++;
              logs.push({
                importId,
                row: 0,
                status: 'WARNING',
                message: `Registro já existe: ${employee.name} - ${record.date.toLocaleDateString('pt-BR')}`,
              });
              continue;
            }

            // Criação e Cálculo
            const timeRecord = await this.processSingleRecord(record, employee, importId, options);
            
            stats.processed++;
            stats.calculations++;

            // Contagem de ocorrências geradas (se houver)
            if (options.generateOccurrences) {
              const occCount = await this.prisma.occurrence.count({ where: { timeRecordId: timeRecord.id } });
              stats.occurrences += occCount;
            }

            logs.push({
              importId,
              row: 0,
              status: 'SUCCESS',
              message: `✅ Sucesso: ${employee.name} - ${record.date.toLocaleDateString('pt-BR')}`,
              data: { calculated: { total: timeRecord.totalWorkedMinutes, issues: timeRecord.hasIssues } }
            });

          } catch (error) {
            stats.failed++;
            logs.push({
              importId,
              row: 0,
              status: 'ERROR',
              message: `Erro ao processar registro: ${error instanceof Error ? error.message : String(error)}`,
              data: record,
            });
          }
        }

        // Salva logs em lotes para não estourar a memória em arquivos grandes
        if (logs.length >= 200) {
          await this.importRepository.createManyLogs(logs);
          logs.length = 0;
        }
      }

      // Salva logs remanescentes
      if (logs.length > 0) await this.importRepository.createManyLogs(logs);

      // Status Final
      const finalStatus = (stats.failed === 0 && stats.skipped === 0) ? 'COMPLETED' : 
                          (stats.processed === 0) ? 'FAILED' : 'PARTIALLY_COMPLETED';

      await this.importRepository.update(importId, {
        status: finalStatus,
        processedRecords: stats.processed,
        failedRecords: stats.failed,
        completedAt: new Date(),
        errors: (stats.failed > 0 || parseResult.warnings.length > 0) ? JSON.stringify({
          failed: stats.failed,
          skipped: stats.skipped,
          errors: parseResult.errors.slice(0, 10),
          warnings: parseResult.warnings.slice(0, 10),
        }) : null,
      });

      // Log de Sistema
      await this.prisma.systemLog.create({
        data: {
          action: 'PROCESS_IMPORT',
          module: 'IMPORTS',
          details: JSON.stringify({ importId, status: finalStatus, ...stats }),
          userId,
        },
      });

      return {
        status: finalStatus,
        ...stats,
        total: parseResult.totalRecords,
        message: `Importação concluída. Processados: ${stats.processed}, Falhas: ${stats.failed}`
      };

    } catch (error) {
      await this.importRepository.update(importId, {
        status: 'FAILED',
        errors: JSON.stringify([error instanceof Error ? error.message : 'Erro desconhecido']),
        completedAt: new Date(),
      });
      throw error;
    }
  }

  private async processSingleRecord(record: any, employee: any, importId: string, options: ProcessOptions) {
    const dayOfWeek = getDayOfWeek(record.date);
    const isWeekend = dayOfWeek === 6 || dayOfWeek === 7;

    // 1. Criar Registro Base
    const timeRecord = await this.prisma.timeRecord.create({
      data: {
        employeeId: employee.id,
        importId,
        date: record.date,
        dayOfWeek,
        clockIn1: record.clockIn1, clockOut1: record.clockOut1,
        clockIn2: record.clockIn2, clockOut2: record.clockOut2,
        clockIn3: record.clockIn3, clockOut3: record.clockOut3,
        isWeekend,
        totalWorkedMinutes: 0, regularMinutes: 0, overtimeMinutes: 0, lateMinutes: 0, hasIssues: false,
      },
    });

    if (!options.autoCalculate) return timeRecord;

    // 2. Interpretação e Cálculo
    const interpreted = this.timeCalculationService.interpretTimeRecord(timeRecord, employee.shift);
    const calculation = this.timeCalculationService.calculateWorkTime(interpreted, employee.shift);
    const analysis = this.timeCalculationService.analyzeTimeRecord(interpreted, employee.shift);
    const notes = this.generateDetailedNotes(calculation, analysis);

    // 3. Atualização com Cálculos
    const updatedRecord = await this.prisma.timeRecord.update({
      where: { id: timeRecord.id },
      data: {
        // Atualiza horários interpretados
        clockIn1: interpreted.clockIn1, clockOut1: interpreted.clockOut1,
        clockIn2: interpreted.clockIn2, clockOut2: interpreted.clockOut2,
        clockIn3: interpreted.clockIn3, clockOut3: interpreted.clockOut3,
        
        // Métricas
        totalWorkedMinutes: calculation.totalWorkedMinutes,
        regularMinutes: calculation.regularMinutes,
        overtimeMinutes: calculation.overtimeMinutes,
        nightShiftMinutes: calculation.nightShiftMinutes,
        lateMinutes: calculation.lateMinutes,
        earlyLeaveMinutes: calculation.earlyLeaveMinutes,
        absentMinutes: calculation.missingMinutes,
        hasIssues: calculation.lateMinutes > 0 || calculation.earlyLeaveMinutes > 0 || 
                   calculation.missingMinutes > 0 || calculation.excessiveLunchMinutes > 15 || 
                   analysis.issues.length > 0,
        notes,
      },
    });

    // 4. Ocorrências
    if (options.generateOccurrences && employee.shift) {
      await this.occurrenceGenerator.generateOccurrences(updatedRecord, calculation, employee.shift);
    }

    return updatedRecord;
  }

  private generateDetailedNotes(calculation: any, analysis: any): string | null {
    const notes: string[] = [];
    if (analysis.interpretation !== 'Registro normal') notes.push(`[${analysis.interpretation}]`);
    if (calculation.lateMinutes > 0) notes.push(`Atraso: ${calculation.lateMinutes}m`);
    if (calculation.overtimeMinutes > 0) notes.push(`HE: ${(calculation.overtimeMinutes/60).toFixed(2)}h`);
    if (calculation.nightShiftMinutes > 0) notes.push(`ADN: ${(calculation.nightShiftMinutes/60).toFixed(2)}h`);
    if (analysis.issues.length > 0) notes.push(`⚠️ ${analysis.issues[0]}`);
    return notes.length > 0 ? notes.join(' | ') : null;
  }
}