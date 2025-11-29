import { prisma } from "../../../shared/lib/prisma";
import { PrismaShiftRepository } from "../repositories/prisma/ShiftRepository";
import { GetShiftUseCase } from "../useCases/GetShiftUseCase";


export function makeGetShiftUseCase() {
  const shiftRepository = new PrismaShiftRepository(prisma);
  return new GetShiftUseCase(shiftRepository);
}