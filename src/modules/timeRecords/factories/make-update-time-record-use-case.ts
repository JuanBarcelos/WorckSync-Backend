import { prisma } from "../../../shared/lib/prisma";
import { PrismaTimeRecordRepository } from "../repositories/prisma/TimeRecordRepository";
import { UpdateTimeRecordUseCase } from "../useCases/UpdateTimeRecordUseCase";


export function makeUpdateTimeRecordUseCase() {
  const repository = new PrismaTimeRecordRepository(prisma);
  return new UpdateTimeRecordUseCase(repository);
}