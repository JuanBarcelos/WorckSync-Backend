import { prisma } from "../../../shared/lib/prisma";
import { PrismaTimeRecordRepository } from "../repositories/prisma/TimeRecordRepository";
import { GetTimeRecordsByEmployeeIdUseCase } from "../useCases/getTimeRecordsUsecase";


export function makeGetTimeRecordsUseCase() {
  const repository = new PrismaTimeRecordRepository(prisma);
  return new GetTimeRecordsByEmployeeIdUseCase(repository);
}