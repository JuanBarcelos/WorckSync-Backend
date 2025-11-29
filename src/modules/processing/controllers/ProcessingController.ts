import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

// Factories
import { makeProcessTimeRecordsUseCase } from '../factories/make-process-time-records-use-case';
import { makeProcessSingleDayUseCase } from '../factories/make-process-single-day-use-case';
import { makeAnalyzeTimeRecordUseCase } from '../factories/make-analyze-time-record-use-case';
import { prisma } from '../../../shared/lib/prisma';

const processRangeSchema = z.object({
  employeeId: z.string().uuid().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  shiftId: z.string().uuid().optional(),
  generateOccurrences: z.boolean().default(true),
  updateExisting: z.boolean().default(true),
});

export class ProcessingController {

  async analyzeRecord(request: FastifyRequest, reply: FastifyReply) {
    const { employeeId, date } = request.body as { employeeId: string; date: string };

    const useCase = makeAnalyzeTimeRecordUseCase();
    const result = await useCase.execute(employeeId, date);

    return reply.send(result);
  }

  async processRange(request: FastifyRequest, reply: FastifyReply) {
    const params = processRangeSchema.parse(request.body);
    
    const useCase = makeProcessTimeRecordsUseCase();
    const result = await useCase.execute(
      {
        employeeId: params.employeeId,
        startDate: params.startDate,
        endDate: params.endDate,
        shiftId: params.shiftId,
      },
      {
        generateOccurrences: params.generateOccurrences,
        updateExisting: params.updateExisting,
        considerHolidays: true, // Padrão do sistema
        considerWeekends: true,
      },
      request.user.sub
    );

    return reply.send(result);
  }

  async processSingleDay(request: FastifyRequest, reply: FastifyReply) {
    const useCase = makeProcessSingleDayUseCase();
    // O body já é validado parcialmente pelo Zod na rota, mas o UseCase valida novamente o DTO
    const result = await useCase.execute(request.body as any, request.user.sub);

    return reply.send(result);
  }

  async reprocessImport(request: FastifyRequest, reply: FastifyReply) {
    const { importId } = request.params as { importId: string };

    // 1. Descobre o range da importação (Consulta leve via Prisma Singleton)
    const aggregation = await prisma.timeRecord.aggregate({
      where: { importId },
      _min: { date: true },
      _max: { date: true },
      _count: true
    });

    if (aggregation._count === 0 || !aggregation._min.date || !aggregation._max.date) {
      return reply.status(404).send({ message: 'Nenhum registro encontrado para esta importação' });
    }

    // 2. Executa o reprocessamento em lote
    const useCase = makeProcessTimeRecordsUseCase();
    const result = await useCase.execute(
      {
        startDate: aggregation._min.date,
        endDate: aggregation._max.date,
        // Opcional: filtrar apenas employees da importação se necessário, 
        // mas por data é seguro pois reprocessa o período
      },
      {
        generateOccurrences: true,
        updateExisting: true,
        considerHolidays: true,
        considerWeekends: true,
      },
      request.user.sub
    );

    return reply.send(result);
  }

  async getProcessingStatus(request: FastifyRequest, reply: FastifyReply) {
    const { startDate, endDate } = request.query as { startDate: string; endDate: string };
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Consultas paralelas para dashboard
    const [total, processed, issues, occurrences] = await Promise.all([
      prisma.timeRecord.count({ where: { date: { gte: start, lte: end } } }),
      prisma.timeRecord.count({ where: { date: { gte: start, lte: end }, totalWorkedMinutes: { gt: 0 } } }),
      prisma.timeRecord.count({ where: { date: { gte: start, lte: end }, hasIssues: true } }),
      prisma.occurrence.count({ where: { date: { gte: start, lte: end } } }),
    ]);

    const occurrencesByType = await prisma.occurrence.groupBy({
      by: ['type'],
      where: { date: { gte: start, lte: end } },
      _count: true,
    });

    return reply.send({
      period: { start, end },
      statistics: {
        totalRecords: total,
        processedRecords: processed,
        pendingRecords: total - processed,
        recordsWithIssues: issues,
        totalOccurrences: occurrences,
      },
      occurrencesByType: occurrencesByType.map(o => ({
        type: o.type,
        count: o._count,
      })),
    });
  }
}