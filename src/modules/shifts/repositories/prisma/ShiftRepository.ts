import { PrismaClient, Prisma } from '@prisma/client';
import {
  IShiftRepository,
  CreateShiftDTO,
  UpdateShiftDTO,
  FindShiftsParams,
  CreateShiftExceptionDTO,
  ShiftWithRelations,
} from '../IShiftRepository';

export class PrismaShiftRepository implements IShiftRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateShiftDTO) {
    return this.prisma.shift.create({
      data: {
        ...data,
      },
    });
  }

  async findById(id: string): Promise<ShiftWithRelations | null> {
    return this.prisma.shift.findUnique({
      where: { id },
      include: {
        _count: {
          select: { employees: true },
        },
        shiftExceptions: {
          orderBy: { date: 'desc' },
          take: 10,
        },
      },
    });
  }

  async findByName(name: string) {
    return this.prisma.shift.findUnique({
      where: { name },
    });
  }

  async update(id: string, data: UpdateShiftDTO) {
    const updateData: any = { ...data };

    return this.prisma.shift.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string) {
    await this.prisma.shift.delete({
      where: { id },
    });
  }

  async findMany(params: FindShiftsParams) {
    const { page, limit, search, isActive } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.ShiftWhereInput = {
      ...(search && {
        OR: [
          { name: { contains: search } }, // SQLite is case-insensitive by default in modern versions, but be aware for PG
        ],
      }),
      ...(isActive !== undefined && { isActive }),
    };

    const [shifts, total] = await Promise.all([
      this.prisma.shift.findMany({
        where,
        skip,
        take: limit,
        include: {
          _count: {
            select: { employees: true },
          },
        },
        orderBy: {
          name: 'asc',
        },
      }),
      this.prisma.shift.count({ where }),
    ]);

    return {
      shifts: shifts as ShiftWithRelations[],
      total,
      pages: Math.ceil(total / limit),
    };
  }

  async createException(data: CreateShiftExceptionDTO) {
    return this.prisma.shiftException.create({
      data,
    });
  }

  async deleteException(id: string) {
    await this.prisma.shiftException.delete({
      where: { id },
    });
  }

  async findExceptionsByShift(shiftId: string, startDate?: Date, endDate?: Date) {
    return this.prisma.shiftException.findMany({
      where: {
        shiftId,
        ...(startDate && endDate && {
          date: {
            gte: startDate,
            lte: endDate,
          },
        }),
      },
      orderBy: {
        date: 'asc',
      },
    });
  }
}