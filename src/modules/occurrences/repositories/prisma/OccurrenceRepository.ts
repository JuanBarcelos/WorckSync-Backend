import { PrismaClient, Prisma, OccurrenceStatus, OccurrenceType } from '@prisma/client';
import {
  IOccurrenceRepository,
  CreateOccurrenceDTO,
  UpdateOccurrenceDTO,
  FindOccurrencesParams,
  OccurrenceWithRelations,
  OccurrenceStats,
} from '../IOccurrenceRepository';

export class OccurrenceRepository implements IOccurrenceRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateOccurrenceDTO) {
    return this.prisma.occurrence.create({
      data,
    });
  }

  async findById(id: string): Promise<OccurrenceWithRelations | null> {
    return this.prisma.occurrence.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            sheetId: true,
            department: true,
            shift: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        timeRecord: true,
        approver: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async update(id: string, data: UpdateOccurrenceDTO) {
    return this.prisma.occurrence.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    await this.prisma.occurrence.delete({
      where: { id },
    });
  }

  async findMany(params: FindOccurrencesParams) {
    const { page, limit, employeeId, type, status, startDate, endDate, shiftId } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.OccurrenceWhereInput = {
      ...(employeeId && { employeeId }),
      ...(type && { type }),
      ...(status && { status }),
      ...(startDate && endDate && {
        date: {
          gte: startDate,
          lte: endDate,
        },
      }),
      ...(shiftId && {
        employee: {
          shiftId,
        },
      }),
    };

    const [occurrences, total] = await Promise.all([
      this.prisma.occurrence.findMany({
        where,
        skip,
        take: limit,
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              sheetId: true,
              department: true,
              shift: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          approver: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [
          { date: 'desc' },
          { createdAt: 'desc' },
        ],
      }),
      this.prisma.occurrence.count({ where }),
    ]);

    return {
      occurrences: occurrences as OccurrenceWithRelations[],
      total,
      pages: Math.ceil(total / limit),
    };
  }

  async findByEmployee(employeeId: string, startDate?: Date, endDate?: Date) {
    return this.prisma.occurrence.findMany({
      where: {
        employeeId,
        ...(startDate && endDate && {
          date: {
            gte: startDate,
            lte: endDate,
          },
        }),
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            sheetId: true,
            department: true,
            shift: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        timeRecord: true,
        approver: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    }) as Promise<OccurrenceWithRelations[]>;
  }

  async getStats(filters: {
    employeeId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<OccurrenceStats> {
    const where: Prisma.OccurrenceWhereInput = {
      ...(filters.employeeId && { employeeId: filters.employeeId }),
      ...(filters.startDate && filters.endDate && {
        date: {
          gte: filters.startDate,
          lte: filters.endDate,
        },
      }),
    };

    const [total, statusCounts, typeCounts] = await Promise.all([
      this.prisma.occurrence.count({ where }),
      this.prisma.occurrence.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
      this.prisma.occurrence.groupBy({
        by: ['type'],
        where,
        _sum: {
          minutes: true,
        },
        _count: true,
      }),
    ]);

    const statusMap = {
      pending: 0,
      justified: 0,
      approved: 0,
      rejected: 0,
    };

    statusCounts.forEach(item => {
      const status = item.status.toLowerCase();
      if (status in statusMap) {
        statusMap[status as keyof typeof statusMap] = item._count;
      }
    });

    return {
      total,
      ...statusMap,
      byType: typeCounts.map(item => ({
        type: item.type,
        count: item._count,
        totalMinutes: item._sum.minutes || 0,
      })),
    };
  }

  async bulkUpdateStatus(ids: string[], status: OccurrenceStatus, approvedBy?: string) {
    const result = await this.prisma.occurrence.updateMany({
      where: {
        id: { in: ids },
      },
      data: {
        status,
        ...(approvedBy && {
          approvedBy,
          approvedAt: new Date(),
        }),
      },
    });

    return result.count;
  }
}