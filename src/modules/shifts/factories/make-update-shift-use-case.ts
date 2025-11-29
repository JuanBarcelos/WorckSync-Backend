import { prisma } from "../../../shared/lib/prisma";
import { PrismaShiftRepository } from "../repositories/prisma/ShiftRepository";
import { UpdateShiftUseCase } from "../useCases/UpdateShiftUseCase";

export function makeUpdateShiftUseCase() {
  const shiftRepository = new PrismaShiftRepository(prisma);
  return new UpdateShiftUseCase(shiftRepository, prisma);
}