import { prisma } from "../../../shared/lib/prisma";
import { PrismaImportRepository } from "../repositories/prisma/ImportRepository";
import { ProcessImportUseCase } from "../useCases/ProcessImportUseCase";

export function makeProcessImportUseCase() {
  const importRepository = new PrismaImportRepository(prisma);
  return new ProcessImportUseCase(importRepository, prisma);
}