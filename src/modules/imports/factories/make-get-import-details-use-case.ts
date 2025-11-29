import { prisma } from "../../../shared/lib/prisma";
import { PrismaImportRepository } from "../repositories/prisma/ImportRepository";
import { GetImportDetailsUseCase } from "../useCases/GetImportDetailsUseCase";

export function makeGetImportDetailsUseCase() {
  const importRepository = new PrismaImportRepository(prisma);
  return new GetImportDetailsUseCase(importRepository);
}