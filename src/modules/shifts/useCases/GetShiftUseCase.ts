import { IShiftRepository } from '../repositories/IShiftRepository';
import { NotFoundError } from '../../../shared/errors/AppError';
import { minutesToTime, calculateTimeDifference } from '../../../shared/utils/dateHelpers';

export class GetShiftUseCase {
  constructor(private shiftRepository: IShiftRepository) {}

  async execute(id: string) {
    const shift = await this.shiftRepository.findById(id);

    if (!shift) {
      throw new NotFoundError('Turno não encontrado');
    }

    const workDuration = calculateTimeDifference(shift.startTime, shift.endTime);
    const lunchDuration = calculateTimeDifference(shift.lunchStartTime, shift.lunchEndTime);
    const effectiveWorkTime = workDuration - lunchDuration;

    return {
      ...shift,
      employeeCount: shift._count?.employees || 0,
      statistics: {
        workDuration: minutesToTime(workDuration),
        workDurationMinutes: workDuration,
        lunchDuration: minutesToTime(lunchDuration),
        lunchDurationMinutes: lunchDuration,
        effectiveWorkTime: minutesToTime(effectiveWorkTime),
        effectiveWorkTimeMinutes: effectiveWorkTime,
      },
    };
  }
}