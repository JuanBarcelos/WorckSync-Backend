import { prisma } from "../../../shared/lib/prisma";
import { PrismaShiftRepository } from "../repositories/prisma/ShiftRepository";
import { DeleteShiftUseCase } from "../useCases/DeleteShiftUseCase";


export function makeDeleteShiftUseCase() {
  const shiftRepository = new PrismaShiftRepository(prisma);
  return new DeleteShiftUseCase(shiftRepository, prisma);
}
