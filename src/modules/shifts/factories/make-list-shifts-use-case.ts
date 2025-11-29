import { prisma } from "../../../shared/lib/prisma";
import { PrismaShiftRepository } from "../repositories/prisma/ShiftRepository";
import { ListShiftsUseCase } from "../useCases/ListShiftsUseCase";


export function makeListShiftsUseCase() {
  const shiftRepository = new PrismaShiftRepository(prisma);
  return new ListShiftsUseCase(shiftRepository);
}
