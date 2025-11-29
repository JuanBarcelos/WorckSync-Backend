import { IShiftRepository } from '../repositories/IShiftRepository';
import { NotFoundError, AppError } from '../../../shared/errors/AppError';
import { PrismaClient } from '@prisma/client';

export class DeleteShiftUseCase {
  constructor(
    private shiftRepository: IShiftRepository,
    private prisma: PrismaClient
  ) {}

  async execute(id: string, userId: string) {
    const shift = await this.shiftRepository.findById(id);

    if (!shift) {
      throw new NotFoundError('Turno não encontrado');
    }

    if (shift._count?.employees && shift._count.employees > 0) {
      throw new AppError(
        `Turno possui ${shift._count.employees} funcionário(s) vinculado(s) e não pode ser excluído`,
        400
      );
    }

    await this.shiftRepository.delete(id);

    await this.prisma.systemLog.create({
      data: {
        action: 'DELETE_SHIFT',
        module: 'SHIFTS',
        details: JSON.stringify({
          shiftId: id,
          shiftName: shift.name,
        }),
        userId,
      },
    });

    return { message: 'Turno excluído com sucesso' };
  }
}