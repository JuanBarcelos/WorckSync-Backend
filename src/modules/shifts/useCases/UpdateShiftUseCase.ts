import { IShiftRepository, UpdateShiftDTO } from '../repositories/IShiftRepository';
import { AppError, NotFoundError } from '../../../shared/errors/AppError';
import { calculateTimeDifference, timeToMinutes } from '../../../shared/utils/dateHelpers';
import { PrismaClient } from '@prisma/client';

export class UpdateShiftUseCase {
  constructor(
    private shiftRepository: IShiftRepository,
    private prisma: PrismaClient
  ) {}

  async execute(id: string, data: UpdateShiftDTO, userId: string) {
    const shift = await this.shiftRepository.findById(id);
    if (!shift) throw new NotFoundError('Turno não encontrado');

    // Verificar duplicidade de nome
    if (data.name && data.name !== shift.name) {
      const nameExists = await this.shiftRepository.findByName(data.name);
      if (nameExists) throw new AppError('Nome de turno já cadastrado', 409);
    }

    // Regra de inativação
    if (data.isActive === false && shift._count?.employees && shift._count.employees > 0) {
      throw new AppError(`Turno possui ${shift._count.employees} funcionário(s) vinculado(s) e não pode ser inativado`, 400);
    }

    // Validação de Horários (Merge com dados existentes)
    if (data.startTime || data.endTime || data.lunchStartTime || data.lunchEndTime) {
      const mergedData = {
        startTime: data.startTime || shift.startTime,
        endTime: data.endTime || shift.endTime,
        lunchStartTime: data.lunchStartTime || shift.lunchStartTime,
        lunchEndTime: data.lunchEndTime || shift.lunchEndTime,
      };
      this.validateShiftTimes(mergedData);
    }

    const updatedShift = await this.shiftRepository.update(id, data);

    await this.prisma.systemLog.create({
      data: {
        action: 'UPDATE_SHIFT',
        module: 'SHIFTS',
        details: JSON.stringify({ shiftId: id, changes: data }),
        userId,
      },
    });

    return updatedShift;
  }

  private validateShiftTimes(data: any) {
    const workDuration = calculateTimeDifference(data.startTime, data.endTime);
    const lunchDuration = calculateTimeDifference(data.lunchStartTime, data.lunchEndTime);

    if (workDuration < 240) throw new AppError('Turno deve ter no mínimo 4 horas de duração');
    if (workDuration > 720) throw new AppError('Turno não pode exceder 12 horas de duração');
    if (lunchDuration < 30) throw new AppError('Intervalo de almoço deve ter no mínimo 30 minutos');
    if (lunchDuration > 120) throw new AppError('Intervalo de almoço não pode exceder 2 horas');

    const startMinutes = timeToMinutes(data.startTime);
    const endMinutes = timeToMinutes(data.endTime);
    const lunchStartMinutes = timeToMinutes(data.lunchStartTime);
    const lunchEndMinutes = timeToMinutes(data.lunchEndTime);

    const adjustedEnd = endMinutes < startMinutes ? endMinutes + 1440 : endMinutes;
    const adjustedLunchStart = lunchStartMinutes < startMinutes ? lunchStartMinutes + 1440 : lunchStartMinutes;
    const adjustedLunchEnd = lunchEndMinutes < startMinutes ? lunchEndMinutes + 1440 : lunchEndMinutes;

    if (adjustedLunchStart < startMinutes || adjustedLunchStart > adjustedEnd) {
      throw new AppError('Almoço deve estar dentro do turno');
    }
  }
}