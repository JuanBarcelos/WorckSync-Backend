import { prisma } from "../../../shared/lib/prisma";
import { PrismaImportRepository } from "../repositories/prisma/ImportRepository";
import { ListImportsUseCase } from "../useCases/ListImportsUseCase";


export function makeListImportsUseCase() {
  const importRepository = new PrismaImportRepository(prisma);
  return new ListImportsUseCase(importRepository);
}