import { Occurrence, OccurrenceType, OccurrenceStatus, Prisma } from '@prisma/client';

export interface CreateOccurrenceDTO {
  employeeId: string;
  timeRecordId?: string;
  date: Date;
  type: OccurrenceType;
  minutes: number;
  description?: string;
}

export interface UpdateOccurrenceDTO {
  status?: OccurrenceStatus;
  justification?: string;
  approvedBy?: string;
  approvedAt?: Date;
}

export interface FindOccurrencesParams {
  page: number;
  limit: number;
  employeeId?: string;
  type?: OccurrenceType;
  status?: OccurrenceStatus;
  startDate?: Date;
  endDate?: Date;
  departmentId?: string;
  shiftId?: string;
}

export type OccurrenceWithRelations = Prisma.OccurrenceGetPayload<{
  include: {
    employee: {
      select: {
        id: true;
        name: true;
        sheetId: true;
        department: true;
        shift: {
          select: {
            id: true;
            name: true;
          };
        };
      };
    };
    timeRecord: true;
    approver: {
      select: { id: true; name: true };
    };
  };
}>;


export interface OccurrenceStats {
  total: number;
  pending: number;
  justified: number;
  approved: number;
  rejected: number;
  byType: Array<{
    type: OccurrenceType;
    count: number;
    totalMinutes: number;
  }>;
}

export interface IOccurrenceRepository {
  create(data: CreateOccurrenceDTO): Promise<Occurrence>;
  findById(id: string): Promise<OccurrenceWithRelations | null>;
  update(id: string, data: UpdateOccurrenceDTO): Promise<Occurrence>;
  delete(id: string): Promise<void>;
  findMany(params: FindOccurrencesParams): Promise<{
    occurrences: OccurrenceWithRelations[];
    total: number;
    pages: number;
  }>;
  findByEmployee(employeeId: string, startDate?: Date, endDate?: Date): Promise<OccurrenceWithRelations[]>;
  getStats(filters: {
    employeeId?: string;
    startDate?: Date;
    endDate?: Date;
    departmentId?: string;
  }): Promise<OccurrenceStats>;
  bulkUpdateStatus(ids: string[], status: OccurrenceStatus, approvedBy?: string): Promise<number>;
}