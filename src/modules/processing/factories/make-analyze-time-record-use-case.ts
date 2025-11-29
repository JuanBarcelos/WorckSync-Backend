import { prisma } from "../../../shared/lib/prisma";
import { AnalyzeTimeRecordUseCase } from "../useCases/AnalyzeTimeRecordUseCase";

export function makeAnalyzeTimeRecordUseCase() {
  return new AnalyzeTimeRecordUseCase(prisma);
}