import { Shift, ShiftException, Prisma } from '@prisma/client';

export interface CreateShiftDTO {
  name: string;
  startTime: string;
  endTime: string;
  lunchStartTime: string;
  lunchEndTime: string;
  toleranceMinutes?: number;
  overtimeAllowed?: boolean;
}

export interface UpdateShiftDTO {
  name?: string;
  startTime?: string;
  endTime?: string;
  lunchStartTime?: string;
  lunchEndTime?: string;
  toleranceMinutes?: number;
  overtimeAllowed?: boolean;
  isActive?: boolean;
}

export interface FindShiftsParams {
  page: number;
  limit: number;
  search?: string;
  isActive?: boolean;
}

export interface CreateShiftExceptionDTO {
  shiftId: string;
  date: Date;
  type: string;
  description: string;
  isWorkDay?: boolean;
}

export interface ShiftWithRelations extends Shift {
  employees?: any[];
  shiftExceptions?: ShiftException[];
  _count?: {
    employees: number;
  };
}

export interface IShiftRepository {
  create(data: CreateShiftDTO): Promise<Shift>;
  findById(id: string): Promise<ShiftWithRelations | null>;
  findByName(name: string): Promise<Shift | null>;
  update(id: string, data: UpdateShiftDTO): Promise<Shift>;
  delete(id: string): Promise<void>;
  findMany(params: FindShiftsParams): Promise<{
    shifts: ShiftWithRelations[];
    total: number;
    pages: number;
  }>;
  createException(data: CreateShiftExceptionDTO): Promise<ShiftException>;
  deleteException(id: string): Promise<void>;
  findExceptionsByShift(shiftId: string, startDate?: Date, endDate?: Date): Promise<ShiftException[]>;
}