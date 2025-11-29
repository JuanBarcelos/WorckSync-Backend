import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../../shared/middlewares/auth';
import { ReportType, ReportFormat } from '@prisma/client';
import { ReportController } from './controllers/ReportController';

const reportController = new ReportController();

export async function reportRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();
  
  // Todas as rotas exigem autenticação
  typedApp.addHook('preHandler', authenticate);

  const generateSchema = z.object({
    type: z.nativeEnum(ReportType).optional(),
    format: z.nativeEnum(ReportFormat),
    month: z.number().min(1).max(12).optional(),
    year: z.number().min(2020).max(2050).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    employeeId: z.string().uuid().optional(),
    employeeIds: z.array(z.string()).optional(),
    departmentIds: z.array(z.string()).optional(),
    includeDetails: z.boolean().default(true),
    includeCharts: z.boolean().default(false),
  });

  // Gerar relatório genérico
  typedApp.post('/generate', {
      schema: {
          tags: ['Reports'],
          body: generateSchema
      }
  }, reportController.generate.bind(reportController));

  // Gerar relatório mensal específico
  typedApp.post('/monthly', {
      schema: {
          tags: ['Reports'],
          body: generateSchema
      }
  }, reportController.generateMonthly.bind(reportController));

  // Listar relatórios
  typedApp.get('/', {
      schema: {
          tags: ['Reports'],
          querystring: z.object({
              page: z.coerce.number().optional(),
              limit: z.coerce.number().optional()
          })
      }
  }, reportController.list.bind(reportController));

  // Status do relatório
  typedApp.get('/:id/status', {
      schema: {
          tags: ['Reports'],
          params: z.object({ id: z.string().uuid() })
      }
  }, reportController.getStatus.bind(reportController));

  // Download do relatório
  typedApp.get('/:id/download', {
      schema: {
          tags: ['Reports'],
          params: z.object({ id: z.string().uuid() })
      }
  }, reportController.download.bind(reportController));
}
