import { Employee } from '@prisma/client';

export interface CreateEmployeeDTO {
  sheetId: string;
  name: string;
  position: string;
  department: string;
  shiftId?: string;
}

export interface UpdateEmployeeDTO {
  name?: string;
  position?: string;
  department?: string;
  shiftId?: string | null;
  isActive?: boolean;
}

export interface FindEmployeesParams {
  page: number;
  limit: number;
  search?: string;
  department?: string;
  shiftId?: string;
  timeRecords?: [];
  isActive?: boolean;
}

export interface IEmployeeRepository {
  create(data: CreateEmployeeDTO): Promise<Employee>;
  findById(id: string): Promise<Employee | null>;
  findBySheetId(sheetId: string): Promise<Employee | null>;
  update(id: string, data: UpdateEmployeeDTO): Promise<Employee>;
  delete(id: string): Promise<void>;
  findMany(params: FindEmployeesParams): Promise<{
    employees: Employee[];
    total: number;
    pages: number;
  }>;
  findByShift(shiftId: string): Promise<Employee[]>;
  countByDepartment(): Promise<Array<{ department: string; count: number }>>;
}