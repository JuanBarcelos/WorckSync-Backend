import { IShiftRepository } from '../repositories/IShiftRepository';

interface ListShiftsDTO {
  page: number;
  limit: number;
  search?: string;
  isActive?: boolean;
}

export class ListShiftsUseCase {
  constructor(private shiftRepository: IShiftRepository) {}

  async execute(params: ListShiftsDTO) {
    const result = await this.shiftRepository.findMany(params);

    const shiftsWithParsedWorkDays = result.shifts.map(shift => ({
      ...shift,
      employeeCount: shift._count?.employees || 0,
    }));

    return {
      data: shiftsWithParsedWorkDays,
      meta: {
        total: result.total,
        pages: result.pages,
        page: params.page,
        limit: params.limit,
      },
    };
  }
}