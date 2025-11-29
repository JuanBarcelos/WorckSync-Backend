import { prisma } from "../../../shared/lib/prisma";
import { PrismaShiftRepository } from "../repositories/prisma/ShiftRepository";
import { ManageShiftExceptionUseCase } from "../useCases/ManageShiftExceptionUseCase";


export function makeManageShiftExceptionUseCase() {
  const shiftRepository = new PrismaShiftRepository(prisma);
  return new ManageShiftExceptionUseCase(shiftRepository, prisma);
}