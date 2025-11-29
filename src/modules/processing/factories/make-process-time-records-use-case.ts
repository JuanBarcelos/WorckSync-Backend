import { prisma } from "../../../shared/lib/prisma";
import { ProcessTimeRecordsUseCase } from "../useCases/ProcessTimeRecordsUseCase";

export function makeProcessTimeRecordsUseCase() {
  return new ProcessTimeRecordsUseCase(prisma);
}