import { TimeRecord } from "@prisma/client";

export interface UpdateTimeRecordDTO {
  id: string;
  clockIn1?: string | null;
  clockOut1?: string | null;
  clockIn2?: string | null;
  clockOut2?: string | null;
  clockIn3?: string | null;
  clockOut3?: string | null;
  notes?: string | null;
}

export interface ITimeRecordRepository {
  findByEmployeeId(employeeId: string): Promise<TimeRecord[]>;
  findById(id: string): Promise<TimeRecord | null>;
  updateTimeRecord(data: UpdateTimeRecordDTO): Promise<TimeRecord>;
}