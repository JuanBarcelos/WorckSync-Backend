import { z } from 'zod';
import { IEmployeeRepository } from '../repositories/IEmployeeRepository';
import { AppError, NotFoundError } from '../../../shared/errors/AppError';
import { PrismaClient } from '@prisma/client';

const updateEmployeeSchema = z.object({
  name: z.string().min(3).optional(),
  position: z.string().min(2).optional(),
  department: z.string().min(2).optional(),
  shiftId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateEmployeeDTO = z.infer<typeof updateEmployeeSchema>;

export class UpdateEmployeeUseCase {
  constructor(
    private employeeRepository: IEmployeeRepository,
    private prisma: PrismaClient
  ) {}

  async execute(id: string, data: UpdateEmployeeDTO, userId: string) {
    const validatedData = updateEmployeeSchema.parse(data);

    const employee = await this.employeeRepository.findById(id);
    if (!employee) {
      throw new NotFoundError('Funcionário não encontrado');
    }
  
    // Verifica se o turno existe
    if (validatedData.shiftId !== undefined) {
      if (validatedData.shiftId) {
        const shift = await this.prisma.shift.findUnique({
          where: { id: validatedData.shiftId },
        });

        if (!shift) {
          throw new NotFoundError('Turno não encontrado');
        }

        if (!shift.isActive) {
          throw new AppError('Turno inativo', 400);
        }
      }
    }

    const updatedEmployee = await this.employeeRepository.update(id, validatedData);

    // Registra no log
    await this.prisma.systemLog.create({
      data: {
        action: 'UPDATE_EMPLOYEE',
        module: 'EMPLOYEES',
        details: JSON.stringify({
          employeeId: id,
          changes: validatedData,
        }),
        userId,
      },
    });

    return updatedEmployee;
  }
}
