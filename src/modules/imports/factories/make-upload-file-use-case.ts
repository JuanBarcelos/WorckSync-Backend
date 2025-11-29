import { prisma } from "../../../shared/lib/prisma";
import { PrismaImportRepository } from "../repositories/prisma/ImportRepository";
import { UploadFileUseCase } from "../useCases/UploadFileUseCase";

export function makeUploadFileUseCase() {
  const importRepository = new PrismaImportRepository(prisma);
  return new UploadFileUseCase(importRepository, prisma);
}