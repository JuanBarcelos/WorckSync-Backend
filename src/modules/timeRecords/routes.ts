import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate, authorize } from '../../shared/middlewares/auth';
import { isValidTimeFormat } from '../../shared/utils/dateHelpers'; // Assumindo que existe este utilitário do contexto anterior
import { TimeRecordController } from './controllers/timeRecordsController';

const timeRecordController = new TimeRecordController();

export async function timeRecordRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  // Todas as rotas requerem autenticação
  typedApp.addHook('preHandler', authenticate);

  // Schemas
  const paramsSchema = z.object({
    employeeId: z.string().uuid({ message: "ID do funcionário inválido" }),
  });

  const updateBodySchema = z.object({
    id: z.string().uuid(),
    clockIn1: z.string().refine(isValidTimeFormat).nullable().optional(),
    clockOut1: z.string().refine(isValidTimeFormat).nullable().optional(),
    clockIn2: z.string().refine(isValidTimeFormat).nullable().optional(),
    clockOut2: z.string().refine(isValidTimeFormat).nullable().optional(),
    clockIn3: z.string().refine(isValidTimeFormat).nullable().optional(),
    clockOut3: z.string().refine(isValidTimeFormat).nullable().optional(),
    notes: z.string().nullable().optional(),
  });

  // Rotas
  typedApp.get("/:employeeId", {
    preHandler: [authorize('ADMIN', 'RH')],
    schema: {
      tags: ['TimeRecords'],
      summary: 'Listar pontos por funcionário',
      params: paramsSchema
    }
  }, timeRecordController.getByEmployeeId);

  typedApp.put("/update", {
    preHandler: [authorize('ADMIN', 'RH')],
    schema: {
      tags: ['TimeRecords'],
      summary: 'Atualizar registro de ponto manualmente',
      body: updateBodySchema
    }
  }, timeRecordController.update);
}