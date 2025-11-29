import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate, authorize } from '../../shared/middlewares/auth';
import { ImportController } from './controllers/ImportController';

const importController = new ImportController();

export async function importRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  // Registrar multipart APENAS se ainda não foi registrado globalmente no app.ts
  // Se já estiver no app.ts, remova esta linha.
  if (!app.hasContentTypeParser('multipart')) {
    app.register(require('@fastify/multipart'), {
      limits: { fileSize: 15 * 1024 * 1024 },
    });
  }

  typedApp.addHook('preHandler', authenticate);

  // Schemas
  const listImportsQuerySchema = z.object({
    page: z.coerce.number().default(1),
    limit: z.coerce.number().default(20),
    status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'PARTIALLY_COMPLETED']).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  });

  const processBodySchema = z.object({
    autoCalculate: z.boolean().default(true),
    generateOccurrences: z.boolean().default(true),
    analyzeRecords: z.boolean().default(true),
  });

  // Rotas
  typedApp.get('/', {
    schema: {
      tags: ['Imports'],
      querystring: listImportsQuerySchema
    }
  }, importController.list);

  typedApp.get('/template', {
    schema: { tags: ['Imports'] }
  }, importController.downloadTemplate);

  typedApp.get('/:id', {
    schema: {
      tags: ['Imports'],
      params: z.object({ id: z.string().uuid() })
    }
  }, importController.getDetails);

  typedApp.get('/:id/logs', {
    schema: {
      tags: ['Imports'],
      params: z.object({ id: z.string().uuid() }),
      querystring: z.object({ status: z.string().optional() })
    }
  }, importController.getImportLogs);

  // Upload (Multipart não suporta schema de body Zod padrão facilmente no Fastify sem plugins extras, 
  // então validamos no controller ou usamos tratativa manual)
  typedApp.post('/upload', {
    preHandler: [authorize('ADMIN', 'RH')],
    schema: { tags: ['Imports'] }
  }, importController.upload);

  typedApp.post('/:id/process', {
    preHandler: [authorize('ADMIN', 'RH')],
    schema: {
      tags: ['Imports'],
      params: z.object({ id: z.string().uuid() }),
      body: processBodySchema
    }
  }, importController.process);

  typedApp.get('/:id/summary', {
    schema: {
      tags: ['Imports'],
      params: z.object({ id: z.string().uuid() })
    }
  }, importController.getImportSummary);
}