import { FastifyInstance } from 'fastify';
import { OccurrenceController } from './controllers/OccurrenceController';
import { authenticate, authorize } from '../../shared/middlewares/auth';

const occurrenceController = new OccurrenceController();

export async function occurrenceRoutes(app: FastifyInstance) {
  // Todas as rotas requerem autenticação
  app.addHook('preHandler', authenticate);

  // Listar ocorrências (todos podem ver)
  app.get('/', occurrenceController.list);

  // Obter ocorrência específica (todos podem ver)
  app.get('/:id', occurrenceController.getById);

  // Estatísticas (todos podem ver)
  app.get('/stats/summary', occurrenceController.getStats);

  // Ocorrências de um funcionário (todos podem ver)
  app.get('/employee/:employeeId', occurrenceController.getEmployeeOccurrences);

  // Exportar ocorrências (todos podem exportar)
  app.get('/export/csv', occurrenceController.exportOccurrences);

  // Justificar ocorrência (todos podem justificar suas próprias)
  app.post('/:id/justify', occurrenceController.justify);

  // Aprovar/Rejeitar ocorrência (ADMIN e RH)
  app.post('/:id/review', {
    preHandler: [authorize('ADMIN', 'RH')],
  }, occurrenceController.approveReject);

  // Aprovação em lote (ADMIN e RH)
  app.post('/bulk/review', {
    preHandler: [authorize('ADMIN', 'RH')],
  }, occurrenceController.bulkApprove);
}