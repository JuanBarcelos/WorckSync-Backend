import { IShiftRepository } from '../repositories/IShiftRepository';
import { NotFoundError } from '../../../shared/errors/AppError';
import { PrismaClient } from '@prisma/client';

interface CreateExceptionDTO {
  date: Date;
  type: 'HOLIDAY' | 'COMPENSATION' | 'SPECIAL';
  description: string;
  isWorkDay: boolean;
}

export class ManageShiftExceptionUseCase {
  constructor(
    private shiftRepository: IShiftRepository,
    private prisma: PrismaClient
  ) {}

  async createException(shiftId: string, data: CreateExceptionDTO, userId: string) {
    const shift = await this.shiftRepository.findById(shiftId);
    if (!shift) {
      throw new NotFoundError('Turno não encontrado');
    }

    const exception = await this.shiftRepository.createException({
      shiftId,
      ...data,
    });

    await this.prisma.systemLog.create({
      data: {
        action: 'CREATE_SHIFT_EXCEPTION',
        module: 'SHIFTS',
        details: JSON.stringify({
          shiftId,
          exceptionId: exception.id,
          date: data.date,
          type: data.type,
        }),
        userId,
      },
    });

    return exception;
  }

  async deleteException(exceptionId: string, userId: string) {
    await this.shiftRepository.deleteException(exceptionId);

    await this.prisma.systemLog.create({
      data: {
        action: 'DELETE_SHIFT_EXCEPTION',
        module: 'SHIFTS',
        details: JSON.stringify({ exceptionId }),
        userId,
      },
    });

    return { message: 'Exceção removida com sucesso' };
  }

  async listExceptions(shiftId: string, startDate?: Date, endDate?: Date) {
    const shift = await this.shiftRepository.findById(shiftId);
    if (!shift) {
      throw new NotFoundError('Turno não encontrado');
    }

    return this.shiftRepository.findExceptionsByShift(shiftId, startDate, endDate);
  }
}