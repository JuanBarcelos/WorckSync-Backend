import { IShiftRepository, CreateShiftDTO } from '../repositories/IShiftRepository';
import { AppError } from '../../../shared/errors/AppError';
import { 
  calculateTimeDifference,
  timeToMinutes 
} from '../../../shared/utils/dateHelpers';
import { PrismaClient } from '@prisma/client';

export class CreateShiftUseCase {
  constructor(
    private shiftRepository: IShiftRepository,
    private prisma: PrismaClient
  ) {}

  async execute(data: CreateShiftDTO, userId: string) {
    // Validações de Horário
    this.validateShiftTimes(data);

    // Verificar duplicidade
    const [nameExists] = await Promise.all([
      this.shiftRepository.findByName(data.name),
    ]);

    if (nameExists) throw new AppError('Nome de turno já cadastrado', 409);

    const shift = await this.shiftRepository.create(data);

    await this.prisma.systemLog.create({
      data: {
        action: 'CREATE_SHIFT',
        module: 'SHIFTS',
        details: JSON.stringify({ shiftId: shift.id, name: shift.name }),
        userId,
      },
    });

    return shift;
  }

  private validateShiftTimes(data: CreateShiftDTO) {
    const workDuration = calculateTimeDifference(data.startTime, data.endTime);
    const lunchDuration = calculateTimeDifference(data.lunchStartTime, data.lunchEndTime);

    if (workDuration < 240) throw new AppError('Turno deve ter no mínimo 4 horas de duração');
    if (workDuration > 720) throw new AppError('Turno não pode exceder 12 horas de duração');
    if (lunchDuration < 30) throw new AppError('Intervalo de almoço deve ter no mínimo 30 minutos');
    if (lunchDuration > 120) throw new AppError('Intervalo de almoço não pode exceder 2 horas');

    // Validação de intervalo dentro do turno
    const startMinutes = timeToMinutes(data.startTime);
    const endMinutes = timeToMinutes(data.endTime);
    const lunchStartMinutes = timeToMinutes(data.lunchStartTime);
    const lunchEndMinutes = timeToMinutes(data.lunchEndTime);

    // Ajuste para turno noturno (virada de dia)
    const adjustedEnd = endMinutes < startMinutes ? endMinutes + 1440 : endMinutes;
    const adjustedLunchStart = lunchStartMinutes < startMinutes ? lunchStartMinutes + 1440 : lunchStartMinutes;
    const adjustedLunchEnd = lunchEndMinutes < startMinutes ? lunchEndMinutes + 1440 : lunchEndMinutes;

    if (adjustedLunchStart < startMinutes || adjustedLunchStart > adjustedEnd) {
      throw new AppError('Início do almoço deve estar dentro do horário do turno');
    }
    if (adjustedLunchEnd < startMinutes || adjustedLunchEnd > adjustedEnd) {
      throw new AppError('Fim do almoço deve estar dentro do horário do turno');
    }
    if (adjustedLunchStart >= adjustedLunchEnd) {
      throw new AppError('Horário de fim do almoço deve ser maior que o início');
    }
  }
}