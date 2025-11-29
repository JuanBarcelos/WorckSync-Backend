import { PrismaClient, Prisma } from '@prisma/client';
import {
  IEmployeeRepository,
  CreateEmployeeDTO,
  UpdateEmployeeDTO,
  FindEmployeesParams,
} from '../IEmployeeRepository';

export class PrismaEmployeeRepository implements IEmployeeRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateEmployeeDTO) {
    return this.prisma.employee.create({
      data,
      include: {
        shift: true,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.employee.findUnique({
      where: { id },
      include: {
        shift: true,
      },
    });
  }

  async findBySheetId(sheetId: string) {
    return this.prisma.employee.findUnique({
      where: { sheetId },
      include: {
        shift: true,
      },
    });
  }

  async update(id: string, data: UpdateEmployeeDTO) {
    return this.prisma.employee.update({
      where: { id },
      data,
      include: {
        shift: true,
      },
    });
  }

  async delete(id: string) {
    await this.prisma.employee.delete({
      where: { id },
    });
  }

  async findMany(params: FindEmployeesParams) {
    const { page, limit, search, department, shiftId, isActive } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.EmployeeWhereInput = {
      ...(search && {
        OR: [
          { name: { contains: search } }, // SQLite: contains é case-insensitive por padrão em versões novas, mas verifique. Em Postgres use mode: 'insensitive'
          { sheetId: { contains: search } },
        ],
      }),
      ...(department && { department }),
      ...(shiftId && { shiftId }),
      ...(isActive !== undefined && { isActive }),
    };

    // Otimização: Promise.all para rodar count e findMany em paralelo
    const [employees, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        skip,
        take: limit,
        include: {
          shift: true,
        },
        orderBy: {
          name: 'asc',
        },
      }),
      this.prisma.employee.count({ where }),
    ]);

    return {
      employees,
      total,
      pages: Math.ceil(total / limit),
    };
  }

  async findByShift(shiftId: string) {
    return this.prisma.employee.findMany({
      where: {
        shiftId,
        isActive: true,
      },
      include: {
        shift: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async countByDepartment() {
    const result = await this.prisma.employee.groupBy({
      by: ['department'],
      where: {
        isActive: true,
      },
      _count: {
        department: true,
      },
    });

    return result.map(item => ({
      department: item.department,
      count: item._count.department,
    }));
  }
}