import { FastifyInstance } from 'fastify';
import { ProcessingController } from './controllers/ProcessingController';
import { authenticate, authorize } from '../../shared/middlewares/auth';

const processingController = new ProcessingController();

export async function processingRoutes(app: FastifyInstance) {
  // Todas as rotas requerem autenticação
  app.addHook('preHandler', authenticate);

  // Processar período (ADMIN e RH)
  app.post('/range', {
    preHandler: [authorize('ADMIN', 'RH')],
  }, processingController.processRange);

  // Processar dia específico (ADMIN e RH)
  app.post('/single-day', {
    preHandler: [authorize('ADMIN', 'RH')],
  }, processingController.processSingleDay);

  // Reprocessar importação (ADMIN e RH)
  app.post('/import/:importId/reprocess', {
    preHandler: [authorize('ADMIN', 'RH')],
  }, processingController.reprocessImport);

  // Status do processamento (todos podem ver)
  app.get('/status', processingController.getProcessingStatus);

  // Em processing
  app.post('/analyze', processingController.analyzeRecord);
}