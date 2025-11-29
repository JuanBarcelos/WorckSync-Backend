import { PrismaClient } from '@prisma/client';
import { ReportParameters, ReportData, ReportSection } from '../types';
import { format, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export class ReportDataService {
  constructor(private prisma: PrismaClient) {}

  async generateMonthlyReport(params: ReportParameters): Promise<ReportData> {
    const { startDate, endDate, employeeIds, departmentIds } = params;

    const [employees, timeRecords, occurrences] = await Promise.all([
      this.getEmployees(employeeIds, departmentIds),
      this.getTimeRecords(startDate, endDate, employeeIds),
      this.getOccurrences(startDate, endDate, employeeIds),
    ]);

    const employeeData = employees.map(employee => {
      const empRecords = timeRecords.filter(r => r.employeeId === employee.id);
      const empOccurrences = occurrences.filter(o => o.employeeId === employee.id);

      const totalWorked = empRecords.reduce((sum, r) => sum + r.totalWorkedMinutes, 0);
      const totalOvertime = empRecords.reduce((sum, r) => sum + r.overtimeMinutes, 0);
      const totalLate = empOccurrences.filter(o => o.type === 'LATE_ARRIVAL').length;
      const totalAbsences = empOccurrences.filter(o => o.type === 'ABSENCE').length;

      return {
        id: employee.id,
        name: employee.name,
        department: employee.department,
        shift: employee.shift?.name || 'Sem turno',
        workDays: empRecords.length,
        totalHours: (totalWorked / 60).toFixed(2),
        overtimeHours: (totalOvertime / 60).toFixed(2),
        lateArrivals: totalLate,
        absences: totalAbsences,
        performance: this.calculatePerformance(empRecords, empOccurrences),
      };
    });

    const sections: ReportSection[] = [
      {
        title: 'Resumo Geral',
        type: 'summary',
        data: {
          totalEmployees: employees.length,
          totalRecords: timeRecords.length,
          totalHoursWorked: (timeRecords.reduce((sum, r) => sum + r.totalWorkedMinutes, 0) / 60).toFixed(2),
          totalOccurrences: occurrences.length,
        },
      },
      {
        title: 'Detalhamento por Funcionário',
        type: 'table',
        columns: [
          { key: 'name', header: 'Funcionário', width: 200 },
          { key: 'department', header: 'Departamento', width: 150 },
          { key: 'shift', header: 'Turno', width: 100 },
          { key: 'workDays', header: 'Dias Trab.', width: 80, align: 'center' },
          { key: 'totalHours', header: 'Horas Totais', width: 80, align: 'right' },
          { key: 'overtimeHours', header: 'Horas Extras', width: 80, align: 'right' },
          { key: 'lateArrivals', header: 'Atrasos', width: 60, align: 'center' },
          { key: 'absences', header: 'Faltas', width: 60, align: 'center' },
          { key: 'performance', header: 'Perf.', width: 80, align: 'center', format: 'percentage' },
        ],
        data: employeeData,
        footer: {
          totalHours: employeeData.reduce((sum, e) => sum + parseFloat(e.totalHours), 0).toFixed(2),
          overtimeHours: employeeData.reduce((sum, e) => sum + parseFloat(e.overtimeHours), 0).toFixed(2),
          lateArrivals: employeeData.reduce((sum, e) => sum + e.lateArrivals, 0),
          absences: employeeData.reduce((sum, e) => sum + e.absences, 0),
        },
      },
    ];

    if (params.includeCharts) {
      sections.push(
        {
          title: 'Distribuição de Horas por Departamento',
          type: 'chart',
          data: this.generateDepartmentChart(employeeData),
        },
        {
          title: 'Tendência de Ocorrências',
          type: 'chart',
          data: this.generateOccurrenceTrendChart(occurrences, startDate, endDate),
        }
      );
    }

    return {
      title: 'Relatório Mensal de Ponto',
      subtitle: `Período: ${format(startDate, 'dd/MM/yyyy', { locale: ptBR })} a ${format(endDate, 'dd/MM/yyyy', { locale: ptBR })}`,
      period: { start: startDate, end: endDate },
      generatedAt: new Date(),
      generatedBy: 'Sistema',
      sections,
      summary: {
        totalEmployees: employees.length,
        totalWorkDays: this.calculateWorkDays(startDate, endDate),
        totalHoursWorked: timeRecords.reduce((sum, r) => sum + r.totalWorkedMinutes, 0) / 60,
        totalOvertime: timeRecords.reduce((sum, r) => sum + r.overtimeMinutes, 0) / 60,
        totalAbsences: occurrences.filter(o => o.type === 'ABSENCE').length,
        totalLateArrivals: occurrences.filter(o => o.type === 'LATE_ARRIVAL').length,
        averageWorkHours: employees.length > 0 
          ? timeRecords.reduce((sum, r) => sum + r.totalWorkedMinutes, 0) / 60 / employees.length
          : 0,
      },
    };
  }

  async generatePayrollReport(params: ReportParameters): Promise<ReportData> {
    const { startDate, endDate, employeeIds } = params;

    const employees = await this.prisma.employee.findMany({
      where: {
        ...(employeeIds && { id: { in: employeeIds } }),
        isActive: true,
      },
      include: {
        shift: true,
        timeRecords: {
          where: {
            date: { gte: startDate, lte: endDate },
          },
        },
        occurrences: {
          where: {
            date: { gte: startDate, lte: endDate },
          },
        },
      },
    });

    const payrollData = employees.map(employee => {
      const totalWorked = employee.timeRecords.reduce((sum, r) => sum + r.totalWorkedMinutes, 0);
      const regularHours = employee.timeRecords.reduce((sum, r) => sum + r.regularMinutes, 0) / 60;
      const overtimeHours = employee.timeRecords.reduce((sum, r) => sum + r.overtimeMinutes, 0) / 60;
      const nightShiftHours = employee.timeRecords.reduce((sum, r) => sum + r.nightShiftMinutes, 0) / 60;
      const absences = employee.occurrences.filter(o => o.type === 'ABSENCE').length;
      const unjustifiedAbsences = employee.occurrences.filter(
        o => o.type === 'ABSENCE' && o.status === 'PENDING'
      ).length;

      return {
        employeeId: employee.sheetId,
        name: employee.name,
        department: employee.department,
        position: employee.position,
        regularHours: regularHours.toFixed(2),
        overtimeHours: overtimeHours.toFixed(2),
        nightShiftHours: nightShiftHours.toFixed(2),
        totalHours: (totalWorked / 60).toFixed(2),
        absences,
        unjustifiedAbsences,
        discounts: this.calculateDiscounts(employee.occurrences),
        additions: this.calculateAdditions(overtimeHours, nightShiftHours),
      };
    });

    return {
      title: 'Relatório de Folha de Pagamento',
      subtitle: `Competência: ${format(startDate, 'MMMM/yyyy', { locale: ptBR })}`,
      period: { start: startDate, end: endDate },
      generatedAt: new Date(),
      generatedBy: 'Sistema',
      sections: [
        {
          title: 'Dados para Folha de Pagamento',
          type: 'table',
          columns: [
            { key: 'employeeId', header: 'Matrícula', width: 80 },
            { key: 'name', header: 'Funcionário', width: 200 },
            { key: 'department', header: 'Departamento', width: 150 },
            { key: 'regularHours', header: 'Horas Normais', width: 100, align: 'right' },
            { key: 'overtimeHours', header: 'Horas Extras', width: 100, align: 'right' },
            { key: 'nightShiftHours', header: 'Adc. Noturno', width: 100, align: 'right' },
            { key: 'absences', header: 'Faltas', width: 60, align: 'center' },
            { key: 'discounts', header: 'Descontos', width: 100, align: 'right', format: 'currency' },
            { key: 'additions', header: 'Adicionais', width: 100, align: 'right', format: 'currency' },
          ],
          data: payrollData,
        },
      ],
      summary: {
        totalEmployees: employees.length,
        totalWorkDays: this.calculateWorkDays(startDate, endDate),
        totalHoursWorked: payrollData.reduce((sum, e) => sum + parseFloat(e.totalHours), 0),
        totalOvertime: payrollData.reduce((sum, e) => sum + parseFloat(e.overtimeHours), 0),
        totalAbsences: payrollData.reduce((sum, e) => sum + e.absences, 0),
        totalLateArrivals: 0,
        averageWorkHours: 0,
      },
    };
  }

  private async getEmployees(employeeIds?: string[], departmentIds?: string[]) {
    return this.prisma.employee.findMany({
      where: {
        ...(employeeIds && { id: { in: employeeIds } }),
        ...(departmentIds && { department: { in: departmentIds } }),
        isActive: true,
      },
      include: {
        shift: true,
      },
    });
  }

  private async getTimeRecords(startDate: Date, endDate: Date, employeeIds?: string[]) {
    return this.prisma.timeRecord.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        ...(employeeIds && { employeeId: { in: employeeIds } }),
      },
    });
  }

  private async getOccurrences(startDate: Date, endDate: Date, employeeIds?: string[]) {
    return this.prisma.occurrence.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        ...(employeeIds && { employeeId: { in: employeeIds } }),
      },
    });
  }

  private calculatePerformance(records: any[], occurrences: any[]): number {
    if (records.length === 0) return 0;
    
    const lateCount = occurrences.filter(o => o.type === 'LATE_ARRIVAL').length;
    const absenceCount = occurrences.filter(o => o.type === 'ABSENCE').length;
    
    let score = 100;
    score -= (lateCount * 2);
    score -= (absenceCount * 10);
    return Math.max(0, Math.min(100, score));
  }

  private calculateWorkDays(startDate: Date, endDate: Date): number {
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    return days.filter(day => {
      const dayOfWeek = day.getDay();
      return dayOfWeek !== 0 && dayOfWeek !== 6;
    }).length;
  }

  private generateDepartmentChart(employeeData: any[]): any {
    const departments = [...new Set(employeeData.map(e => e.department))];
    const data = departments.map(dept => {
      const deptEmployees = employeeData.filter(e => e.department === dept);
      return deptEmployees.reduce((sum, e) => sum + parseFloat(e.totalHours), 0);
    });

    return {
      labels: departments,
      datasets: [{
        label: 'Horas Trabalhadas',
        data,
        backgroundColor: '#3B82F6',
      }],
    };
  }

  private generateOccurrenceTrendChart(occurrences: any[], startDate: Date, endDate: Date): any {
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    const labels = days.map(day => format(day, 'dd/MM'));
    
    const lateData = days.map(day => {
      return occurrences.filter(o => 
        format(new Date(o.date), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd') &&
        o.type === 'LATE_ARRIVAL'
      ).length;
    });

    const absenceData = days.map(day => {
      return occurrences.filter(o => 
        format(new Date(o.date), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd') &&
        o.type === 'ABSENCE'
      ).length;
    });

    return {
      labels,
      datasets: [
        {
          label: 'Atrasos',
          data: lateData,
          borderColor: '#F59E0B',
          backgroundColor: '#FEF3C7',
        },
        {
          label: 'Faltas',
          data: absenceData,
          borderColor: '#EF4444',
          backgroundColor: '#FEE2E2',
        },
      ],
    };
  }

  private calculateDiscounts(occurrences: any[]): number {
    const unjustifiedAbsences = occurrences.filter(
      o => o.type === 'ABSENCE' && o.status === 'PENDING'
    ).length;
    return unjustifiedAbsences * 100; 
  }

  private calculateAdditions(overtimeHours: number, nightShiftHours: number): number {
    const overtimeValue = overtimeHours * 30;
    const nightShiftValue = nightShiftHours * 10;
    return overtimeValue + nightShiftValue;
  }
}