import { PrismaClient, Prisma, ImportStatus } from '@prisma/client';
import {
  IImportRepository,
  CreateImportDTO,
  UpdateImportDTO,
  CreateImportLogDTO,
  FindImportsParams,
  ImportWithRelations,
} from '../IImportRepository';

export class PrismaImportRepository implements IImportRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateImportDTO) {
    return this.prisma.import.create({
      data,
    });
  }

  async findById(id: string): Promise<ImportWithRelations | null> {
    return this.prisma.import.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            timeRecords: true,
            importLogs: true,
          },
        },
      },
    });
  }

  async update(id: string, data: UpdateImportDTO) {
    return this.prisma.import.update({
      where: { id },
      data,
    });
  }

  async findMany(params: FindImportsParams) {
    const { page, limit, status, userId, startDate, endDate } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.ImportWhereInput = {
      ...(status && { status }),
      ...(userId && { userId }),
      ...(startDate && endDate && {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      }),
    };

    const [imports, total] = await Promise.all([
      this.prisma.import.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              timeRecords: true,
              importLogs: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.import.count({ where }),
    ]);

    return {
      imports: imports as ImportWithRelations[],
      total,
      pages: Math.ceil(total / limit),
    };
  }

  async createLog(data: CreateImportLogDTO) {
    return this.prisma.importLog.create({
      data: {
        ...data,
        data: data.data ? JSON.stringify(data.data) : null,
      },
    });
  }

  async createManyLogs(data: CreateImportLogDTO[]) {
    const result = await this.prisma.importLog.createMany({
      data: data.map(log => ({
        ...log,
        data: log.data ? JSON.stringify(log.data) : null,
      })),
    });
    return result.count;
  }

  async findLogsByImport(importId: string, status?: string) {
    return this.prisma.importLog.findMany({
      where: {
        importId,
        ...(status && { status }),
      },
      orderBy: {
        row: 'asc',
      },
    });
  }

  async getImportStats(importId: string) {
    const [total, success, errors, warnings] = await Promise.all([
      this.prisma.importLog.count({
        where: { importId },
      }),
      this.prisma.importLog.count({
        where: { importId, status: 'SUCCESS' },
      }),
      this.prisma.importLog.count({
        where: { importId, status: 'ERROR' },
      }),
      this.prisma.importLog.count({
        where: { importId, status: 'WARNING' },
      }),
    ]);

    return { total, success, errors, warnings };
  }
}