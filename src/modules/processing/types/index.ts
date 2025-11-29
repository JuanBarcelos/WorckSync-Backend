export interface TimeCalculation {
  totalWorkedMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  nightShiftMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  missingMinutes: number;
  lunchDurationMinutes: number;
  excessiveLunchMinutes: number;
}

export interface ProcessingResult {
  timeRecordId: string;
  employeeId: string;
  date: Date;
  calculations: TimeCalculation;
  occurrences: Array<{
    type: string;
    minutes: number;
    description: string;
  }>;
  hasIssues: boolean;
  isComplete: boolean;
}

export interface ProcessingOptions {
  generateOccurrences: boolean;
  updateExisting: boolean;
  toleranceMinutes?: number;
  considerHolidays: boolean;
  considerWeekends: boolean;
}

export interface DailyProcessingReport {
  date: Date;
  totalEmployees: number;
  processedRecords: number;
  occurrencesGenerated: number;
  errors: number;
  warnings: string[];
}