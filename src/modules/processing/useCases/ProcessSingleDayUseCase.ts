import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { TimeCalculationService } from '../services/TimeCalculationService';
import { OccurrenceGeneratorService } from '../services/OccurrenceGeneratorService';
import { NotFoundError } from '../../../shared/errors/AppError';

const processSingleDaySchema = z.object({
  employeeId: z.string().uuid(),
  date: z.coerce.date(),
  generateOccurrences: z.boolean().default(true),
});

export type ProcessSingleDayDTO = z.infer<typeof processSingleDaySchema>;

export class ProcessSingleDayUseCase {
  private timeCalculationService: TimeCalculationService;
  private occurrenceGenerator: OccurrenceGeneratorService;

  constructor(private prisma: PrismaClient) {
    this.timeCalculationService = new TimeCalculationService();
    this.occurrenceGenerator = new OccurrenceGeneratorService(prisma);
  }

  async execute(data: ProcessSingleDayDTO, userId: string) {
    const validatedData = processSingleDaySchema.parse(data);

    const employee = await this.prisma.employee.findUnique({
      where: { id: validatedData.employeeId },
      include: { shift: true },
    });

    if (!employee) {
      throw new NotFoundError('Funcionário não encontrado');
    }

    let timeRecord = await this.prisma.timeRecord.findUnique({
      where: {
        employeeId_date: {
          employeeId: validatedData.employeeId,
          date: validatedData.date,
        },
      },
    });

    // Cria registro vazio se não existir ("Lazy creation")
    if (!timeRecord) {
      timeRecord = await this.prisma.timeRecord.create({
        data: {
          employeeId: validatedData.employeeId,
          date: validatedData.date,
          dayOfWeek: validatedData.date.getDay() || 7,
          isWeekend: [0, 6].includes(validatedData.date.getDay()),
          totalWorkedMinutes: 0,
          hasIssues: true,
        },
      });
    }

    const calculation = this.timeCalculationService.calculateWorkTime(timeRecord, employee.shift);

    const updatedRecord = await this.prisma.timeRecord.update({
      where: { id: timeRecord.id },
      data: {
        totalWorkedMinutes: calculation.totalWorkedMinutes,
        regularMinutes: calculation.regularMinutes,
        overtimeMinutes: calculation.overtimeMinutes,
        nightShiftMinutes: calculation.nightShiftMinutes,
        lateMinutes: calculation.lateMinutes,
        earlyLeaveMinutes: calculation.earlyLeaveMinutes,
        absentMinutes: calculation.missingMinutes,
        hasIssues: calculation.lateMinutes > 0 || 
                  calculation.earlyLeaveMinutes > 0 || 
                  calculation.missingMinutes > 0,
      },
    });

    // Gerar ocorrências (método direto para single day)
    let occurrences: any[] = [];
    if (validatedData.generateOccurrences) {
      await this.occurrenceGenerator.generateOccurrences(updatedRecord, calculation, employee.shift);
      
      occurrences = await this.prisma.occurrence.findMany({
        where: { timeRecordId: updatedRecord.id },
      });
    }

    // Log
    await this.prisma.systemLog.create({
      data: {
        action: 'PROCESS_SINGLE_DAY',
        module: 'PROCESSING',
        details: JSON.stringify({ employeeId: validatedData.employeeId, date: validatedData.date }),
        userId,
      },
    });

    return {
      timeRecord: updatedRecord,
      calculation,
      occurrences,
      employee: {
        id: employee.id,
        name: employee.name,
        shift: employee.shift?.name || 'Sem turno',
      },
    };
  }
}