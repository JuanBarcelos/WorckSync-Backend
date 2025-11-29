import { PrismaClient } from '@prisma/client';
import { TimeCalculationService } from '../services/TimeCalculationService';
import { NotFoundError } from '../../../shared/errors/AppError';

export class AnalyzeTimeRecordUseCase {
  private timeCalculationService: TimeCalculationService;

  constructor(private prisma: PrismaClient) {
    this.timeCalculationService = new TimeCalculationService();
  }

  async execute(employeeId: string, dateStr: string) {
    const date = new Date(dateStr);
    
    const timeRecord = await this.prisma.timeRecord.findUnique({
      where: {
        employeeId_date: { employeeId, date },
      },
      include: {
        employee: { include: { shift: true } },
      },
    });

    if (!timeRecord) {
      throw new NotFoundError('Registro não encontrado para esta data.');
    }

    const shift = timeRecord.employee.shift;
    
    // Executa lógica de domínio
    const calculation = this.timeCalculationService.calculateWorkTime(timeRecord, shift);
    const analysis = this.timeCalculationService.analyzeTimeRecord(timeRecord, shift);

    return {
      original: {
        clockIn1: timeRecord.clockIn1,
        clockOut1: timeRecord.clockOut1,
        clockIn2: timeRecord.clockIn2,
        clockOut2: timeRecord.clockOut2,
        clockIn3: timeRecord.clockIn3,
        clockOut3: timeRecord.clockOut3,
      },
      analysis,
      calculation: {
        ...calculation,
        totalWorkedHours: (calculation.totalWorkedMinutes / 60).toFixed(2),
      },
      shift: shift ? {
        name: shift.name,
        startTime: shift.startTime,
        endTime: shift.endTime,
        tolerance: shift.toleranceMinutes,
      } : null,
    };
  }
}