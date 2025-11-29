import { Import, ImportStatus, ImportLog, Prisma } from '@prisma/client';

export interface CreateImportDTO {
  fileName: string;
  fileSize: number;
  mimeType: string;
  userId: string;
  totalRecords?: number;
}

export interface UpdateImportDTO {
  status?: ImportStatus;
  processedRecords?: number;
  failedRecords?: number;
  errors?: any;
  startDate?: Date;
  endDate?: Date;
  processedAt?: Date;
  completedAt?: Date;
}

export interface CreateImportLogDTO {
  importId: string;
  row: number;
  status: 'SUCCESS' | 'ERROR' | 'WARNING';
  message: string;
  data?: any;
}

export interface FindImportsParams {
  page: number;
  limit: number;
  status?: ImportStatus;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface ImportWithRelations extends Import {
  user?: any;
  _count?: {
    timeRecords: number;
    importLogs: number;
  };
}

export interface IImportRepository {
  create(data: CreateImportDTO): Promise<Import>;
  findById(id: string): Promise<ImportWithRelations | null>;
  update(id: string, data: UpdateImportDTO): Promise<Import>;
  findMany(params: FindImportsParams): Promise<{
    imports: ImportWithRelations[];
    total: number;
    pages: number;
  }>;
  createLog(data: CreateImportLogDTO): Promise<ImportLog>;
  createManyLogs(data: CreateImportLogDTO[]): Promise<number>;
  findLogsByImport(importId: string, status?: string): Promise<ImportLog[]>;
  getImportStats(importId: string): Promise<{
    total: number;
    success: number;
    errors: number;
    warnings: number;
  }>;
}