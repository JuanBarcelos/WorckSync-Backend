import { prisma } from "../../../shared/lib/prisma";
import { ProcessSingleDayUseCase } from "../useCases/ProcessSingleDayUseCase";

export function makeProcessSingleDayUseCase() {
  return new ProcessSingleDayUseCase(prisma);
}