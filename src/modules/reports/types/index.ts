export interface ReportParameters {
  startDate: Date;
  endDate: Date;
  employeeIds?: string[];
  departmentIds?: string[];
  shiftIds?: string[];
  includeDetails?: boolean;
  includeCharts?: boolean;
  groupBy?: 'day' | 'week' | 'month' | 'employee' | 'department';
  month?: number;
  year?: number;
  type?: string;
  format?: string;
}

export interface ReportData {
  title: string;
  subtitle: string;
  period: {
    start: Date;
    end: Date;
  };
  generatedAt: Date;
  generatedBy: string;
  sections: ReportSection[];
  summary: ReportSummary;
}

export interface ReportSection {
  title: string;
  type: 'table' | 'chart' | 'text' | 'summary';
  data: any;
  columns?: TableColumn[];
  footer?: any;
}

export interface TableColumn {
  key: string;
  header: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  format?: 'text' | 'number' | 'currency' | 'date' | 'time' | 'percentage';
}

export interface ReportSummary {
  totalEmployees: number;
  totalWorkDays: number;
  totalHoursWorked: number;
  totalOvertime: number;
  totalAbsences: number;
  totalLateArrivals: number;
  averageWorkHours: number;
  [key: string]: any;
}

export interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string;
    borderColor?: string;
  }>;
}

export interface MonthlyReportRow {
  date: string;
  dayOfWeek: string;
  clockIn: string;
  lunchStart: string;
  lunchEnd: string;
  clockOut: string;
  totalWorked: string;
  overtime: string;
  late: string;
  observations: string;
}

export interface EmployeeMonthlyReport {
  employee: {
    id: string;
    sheetId: string;
    name: string;
    department: string;
    position: string;
    shift?: string;
  };
  month: string;
  year: number;
  rows: MonthlyReportRow[];
  summary: {
    totalDays: number;
    workedDays: number;
    absences: number;
    totalHours: string;
    totalOvertime: string;
    totalLate: string;
  };
}