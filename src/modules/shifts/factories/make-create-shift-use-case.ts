import { prisma } from "../../../shared/lib/prisma";
import { PrismaShiftRepository } from "../repositories/prisma/ShiftRepository";
import { CreateShiftUseCase } from "../useCases/CreateShiftUseCase";


export function makeCreateShiftUseCase() {
  const shiftRepository = new PrismaShiftRepository(prisma);
  return new CreateShiftUseCase(shiftRepository, prisma);
}