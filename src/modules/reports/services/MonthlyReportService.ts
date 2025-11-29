import { PrismaClient } from '@prisma/client';
import { format, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { EmployeeMonthlyReport, MonthlyReportRow } from '../types';
import { TimeCalculationService } from '../../processing/services/TimeCalculationService';
import { timeToMinutes } from '../../../shared/utils/dateHelpers';

export class MonthlyReportService {
  private timeCalculationService: TimeCalculationService;

  constructor(private prisma: PrismaClient) {
    this.timeCalculationService = new TimeCalculationService();
  }

  // Refactored to accept pre-fetched data to support batch processing
  async generateEmployeeMonthlyReport(
    employeeId: string,
    month: number,
    year: number,
    preFetchedEmployee?: any,
    preFetchedRecords?: any[]
  ): Promise<EmployeeMonthlyReport> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = endOfMonth(startDate);

    let employee = preFetchedEmployee;
    if (!employee) {
      employee = await this.prisma.employee.findUnique({
        where: { id: employeeId },
        include: { shift: true },
      });
    }

    if (!employee) {
      throw new Error(`Funcionário não encontrado: ${employeeId}`);
    }

    let timeRecords = preFetchedRecords;
    if (!timeRecords) {
      timeRecords = await this.prisma.timeRecord.findMany({
        where: {
          employeeId,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { date: 'asc' },
      });
    }

    const recordsMap = new Map();
    timeRecords?.forEach(record => {
      const dateKey = format(record.date, 'yyyy-MM-dd');
      recordsMap.set(dateKey, record);
    });

    const days = eachDayOfInterval({ start: startDate, end: endDate });
    const rows: MonthlyReportRow[] = [];
    
    let totalWorkedMinutes = 0;
    let totalOvertimeMinutes = 0;
    let totalLateMinutes = 0;
    let workedDays = 0;
    let absences = 0;

    for (const day of days) {
      const dateKey = format(day, 'yyyy-MM-dd');
      const record = recordsMap.get(dateKey);
      const dayOfWeek = this.getDayOfWeekName(getDay(day));
      const isWeekend = [0, 6].includes(getDay(day));

      if (record) {
        const analysis = this.timeCalculationService.analyzeTimeRecord(record, employee.shift);
        const adjustedTimes = this.getAdjustedTimes(record, employee.shift);
        
        const row: MonthlyReportRow = {
          date: format(day, 'dd/MM/yyyy'),
          dayOfWeek,
          clockIn: adjustedTimes.clockIn,
          lunchStart: adjustedTimes.lunchStart,
          lunchEnd: adjustedTimes.lunchEnd,
          clockOut: adjustedTimes.clockOut,
          totalWorked: this.formatMinutesToHours(record.totalWorkedMinutes),
          overtime: this.formatMinutesToHours(record.overtimeMinutes),
          late: record.lateMinutes > 0 ? this.formatMinutesToHours(record.lateMinutes) : '-',
          observations: this.generateObservationsWithAnalysis(record, analysis),
        };

        rows.push(row);
        
        if (record.totalWorkedMinutes > 0) {
          workedDays++;
          totalWorkedMinutes += record.totalWorkedMinutes;
          totalOvertimeMinutes += record.overtimeMinutes || 0;
          totalLateMinutes += record.lateMinutes || 0;
        } else if (!isWeekend && record.absentMinutes > 0) {
          absences++; // Only count absence if explicitly absent on a work day
        }
      } else {
        const row: MonthlyReportRow = {
          date: format(day, 'dd/MM/yyyy'),
          dayOfWeek,
          clockIn: '-',
          lunchStart: '-',
          lunchEnd: '-',
          clockOut: '-',
          totalWorked: '-',
          overtime: '-',
          late: '-',
          observations: isWeekend ? 'Fim de semana' : 'Falta', // Changed 'Sem registro' to 'Falta' for clarity on work days
        };

        rows.push(row);
        
        if (!isWeekend) {
          absences++;
        }
      }
    }

    return {
      employee: {
        id: employee.id,
        sheetId: employee.sheetId,
        name: employee.name,
        department: employee.department,
        position: employee.position,
        shift: employee.shift?.name,
      },
      month: format(startDate, 'MMMM', { locale: ptBR }),
      year,
      rows,
      summary: {
        totalDays: days.length,
        workedDays,
        absences,
        totalHours: this.formatMinutesToHours(totalWorkedMinutes),
        totalOvertime: this.formatMinutesToHours(totalOvertimeMinutes),
        totalLate: this.formatMinutesToHours(totalLateMinutes),
      },
    };
  }

  async generateMultipleEmployeesMonthlyReport(
    employeeIds: string[],
    month: number,
    year: number
  ): Promise<EmployeeMonthlyReport[]> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = endOfMonth(startDate);

    // Batch fetch employees
    const employees = await this.prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      include: { shift: true },
    });

    // Batch fetch time records
    const timeRecords = await this.prisma.timeRecord.findMany({
      where: {
        employeeId: { in: employeeIds },
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Group records by employee
    const recordsByEmployee = new Map<string, any[]>();
    timeRecords.forEach(record => {
      if (!recordsByEmployee.has(record.employeeId)) {
        recordsByEmployee.set(record.employeeId, []);
      }
      recordsByEmployee.get(record.employeeId)?.push(record);
    });

    const reports: EmployeeMonthlyReport[] = [];

    for (const employee of employees) {
      try {
        const employeeRecords = recordsByEmployee.get(employee.id) || [];
        // Pass pre-fetched data
        const report = await this.generateEmployeeMonthlyReport(
            employee.id, 
            month, 
            year, 
            employee, 
            employeeRecords
        );
        reports.push(report);
      } catch (error) {
        console.error(`Erro ao gerar relatório do funcionário ${employee.id}:`, error);
      }
    }

    return reports;
  }

  async generateDepartmentMonthlyReport(
    department: string,
    month: number,
    year: number
  ): Promise<EmployeeMonthlyReport[]> {
    const employees = await this.prisma.employee.findMany({
      where: {
        department,
        isActive: true,
      },
      select: { id: true },
    });

    const employeeIds = employees.map(e => e.id);
    return this.generateMultipleEmployeesMonthlyReport(employeeIds, month, year);
  }

  async generateCompleteMonthlyReport(month: number, year: number) {
    const employees = await this.prisma.employee.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    const employeeIds = employees.map(e => e.id);
    return this.generateMultipleEmployeesMonthlyReport(employeeIds, month, year);
  }

  private getAdjustedTimes(record: any, shift: any): {
    clockIn: string;
    lunchStart: string;
    lunchEnd: string;
    clockOut: string;
  } {
    // If no shift is assigned, return raw times
    if (!shift) {
      return {
        clockIn: this.formatTime(record.clockIn1),
        lunchStart: this.formatTime(record.clockOut1),
        lunchEnd: this.formatTime(record.clockIn2),
        clockOut: this.formatTime(record.clockOut2 || record.clockOut3),
      };
    }

    // Logic to consolidate records into standard 4 points
    let clockIn = record.clockIn1;
    let lunchStart = record.clockOut1;
    let lunchEnd = record.clockIn2;
    let clockOut = record.clockOut2 || record.clockOut3;

    // Apply adjustments for visual reporting (like asterisks for early arrivals)
    // The core calculation logic resides in TimeCalculationService, 
    // here we focus on presentation.

    return {
      clockIn: this.formatTimeWithAdjustment(clockIn, shift.startTime),
      lunchStart: this.formatTime(lunchStart),
      lunchEnd: this.formatTime(lunchEnd),
      clockOut: this.formatTime(clockOut),
    };
  }

  private formatTimeWithAdjustment(time: string | null, shiftStart: string | null): string {
    if (!time) return '-';
    if (!shiftStart) return time;

    const actualMinutes = timeToMinutes(time);
    const shiftMinutes = timeToMinutes(shiftStart);
    
    // Example visual cue: add asterisk if arrived significantly early (e.g., > 30 mins)
    if (actualMinutes < shiftMinutes - 30) {
      return `${time}*`;
    }
    
    return time;
  }

  private generateObservationsWithAnalysis(record: any, analysis: any): string {
    const obs: string[] = [];

    if (analysis.interpretation && analysis.interpretation !== 'Registro normal' && analysis.interpretation !== 'Registro completo') {
      if (analysis.interpretation.includes('Jornada contínua')) {
        obs.push('Jornada contínua');
      } else if (analysis.interpretation.includes('Entrada + Volta')) {
        obs.push('Registros incompletos');
      }
    }

    if (record.isHoliday) obs.push('Feriado');
    if (record.lateMinutes > 0) obs.push(`Atraso: ${record.lateMinutes}min`);
    if (record.earlyLeaveMinutes > 0) obs.push(`Saída ant.: ${record.earlyLeaveMinutes}min`);
    if (record.overtimeMinutes > 0) {
      const hours = (record.overtimeMinutes / 60).toFixed(1);
      obs.push(`H.Extra: ${hours}h`);
    }

    // Capture explicit notes from manual adjustments
    if (record.notes) {
        // Filter out auto-generated notes to avoid clutter if needed, 
        // or just append custom ones.
        if (!record.notes.includes('Total:')) {
             obs.push(record.notes);
        }
    }

    return obs.length > 0 ? obs.join(', ') : '';
  }

  private formatTime(time: string | null): string {
    return time || '-';
  }

  private formatMinutesToHours(minutes: number): string {
    if (!minutes || minutes === 0) return '00:00';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  private getDayOfWeekName(day: number): string {
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    return days[day];
  }
}