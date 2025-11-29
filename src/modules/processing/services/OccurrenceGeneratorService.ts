import { PrismaClient, OccurrenceType, TimeRecord, Shift, Prisma, OccurrenceStatus } from '@prisma/client';
import { TimeCalculation } from '../types';

export class OccurrenceGeneratorService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Calcula e retorna a lista de ocorrências em memória.
   * Refatorado para usar o tipo correto de entrada do Prisma (CreateManyInput).
   */
  public calculateOccurrences(
    timeRecord: TimeRecord,
    calculation: TimeCalculation,
    shift: Shift | null
  ): Prisma.OccurrenceCreateManyInput[] {
    const occurrences: Prisma.OccurrenceCreateManyInput[] = [];

    if (!shift) return [];

    const isComplete = this.isRecordComplete(timeRecord);

    // FALTA (Total 0 e Missing > 0)
    if (calculation.totalWorkedMinutes === 0 && calculation.missingMinutes > 0) {
      occurrences.push(this.createPayload(timeRecord, OccurrenceType.ABSENCE, calculation.missingMinutes, 'Falta — nenhum trabalho registrado.'));
    }

    // ATRASO
    if (calculation.lateMinutes > 0) {
      occurrences.push(this.createPayload(timeRecord, OccurrenceType.LATE_ARRIVAL, calculation.lateMinutes, `Atraso de ${calculation.lateMinutes} min`));
    }

    // SAÍDA ANTECIPADA
    if (calculation.earlyLeaveMinutes > 0) {
      occurrences.push(this.createPayload(timeRecord, OccurrenceType.EARLY_DEPARTURE, calculation.earlyLeaveMinutes, `Saída antecipada de ${calculation.earlyLeaveMinutes} min`));
    }

    // EXCESSO DE ALMOÇO
    if (calculation.excessiveLunchMinutes > 0) {
      occurrences.push(this.createPayload(timeRecord, OccurrenceType.EXCESSIVE_LUNCH, calculation.excessiveLunchMinutes, `Excesso de almoço: ${calculation.excessiveLunchMinutes} min`));
    }

    // HORA EXTRA (Apenas se permitido e registro completo)
    if (shift.overtimeAllowed && isComplete && calculation.overtimeMinutes > 0) {
      occurrences.push(this.createPayload(timeRecord, OccurrenceType.OVERTIME, calculation.overtimeMinutes, `${calculation.overtimeMinutes} min de hora extra`));
    }

    // REGISTRO INCOMPLETO
    if (!isComplete) {
      occurrences.push(this.createPayload(timeRecord, OccurrenceType.INCOMPLETE_RECORD, 0, this.getIncompleteDescription(timeRecord)));
    }

    // FIM DE SEMANA
    if (timeRecord.isWeekend && calculation.totalWorkedMinutes > 0) {
      occurrences.push(this.createPayload(timeRecord, OccurrenceType.WEEKEND_WORK, calculation.totalWorkedMinutes, `Trabalho fim de semana: ${calculation.totalWorkedMinutes} min`));
    }

    // FERIADO
    if ((timeRecord as any).isHoliday && calculation.totalWorkedMinutes > 0) {
      occurrences.push(this.createPayload(timeRecord, OccurrenceType.HOLIDAY_WORK, calculation.totalWorkedMinutes, `Trabalho em feriado: ${calculation.totalWorkedMinutes} min`));
    }

    return occurrences;
  }

  /**
   * Método legado: Calcula e salva imediatamente no banco.
   * Útil para processamento de dia único.
   */
  async generateOccurrences(timeRecord: TimeRecord, calculation: TimeCalculation, shift: Shift | null): Promise<void> {
    const occurrences = this.calculateOccurrences(timeRecord, calculation, shift);
    
    // Transação para garantir limpeza e inserção atômica
    await this.prisma.$transaction(async (tx) => {
      await tx.occurrence.deleteMany({ where: { timeRecordId: timeRecord.id } });
      if (occurrences.length > 0) {
        await tx.occurrence.createMany({ data: occurrences });
      }
    });
  }

  // Helper privado ajustado para retornar o tipo de Input do Prisma [cite: 16, 26]
  private createPayload(
    record: TimeRecord, 
    type: OccurrenceType, 
    minutes: number, 
    description: string
  ): Prisma.OccurrenceCreateManyInput {
    return {
      employeeId: record.employeeId,
      timeRecordId: record.id,
      date: record.date,
      type: type,
      status: OccurrenceStatus.PENDING, // Explicitando o default para clareza
      minutes: minutes,
      description: description,
      // Campos opcionais (justification, approvedBy, etc) não precisam ser passados
      // graças ao tipo Prisma.OccurrenceCreateManyInput
    };
  }

  private isRecordComplete(record: TimeRecord): boolean {
    const pairs = [
      [record.clockIn1, record.clockOut1],
      [record.clockIn2, record.clockOut2],
      [record.clockIn3, record.clockOut3],
    ];

    for (const [inTime, outTime] of pairs) {
      // Se tem entrada sem saída ou saída sem entrada
      if (!!inTime !== !!outTime) return false;
    }
    return true;
  }

  private getIncompleteDescription(record: TimeRecord): string {
    const missing = [];
    if (record.clockIn1 && !record.clockOut1) missing.push('Falta saída 1');
    if (!record.clockIn1 && record.clockOut1) missing.push('Falta entrada 1');
    if (record.clockIn2 && !record.clockOut2) missing.push('Falta saída 2');
    if (!record.clockIn2 && record.clockOut2) missing.push('Falta entrada 2');
    if (record.clockIn3 && !record.clockOut3) missing.push('Falta saída 3');
    if (!record.clockIn3 && record.clockOut3) missing.push('Falta entrada 3');
    return missing.join(', ');
  }
}