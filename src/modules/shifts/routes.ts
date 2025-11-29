import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate, authorize } from '../../shared/middlewares/auth';
import { ShiftController } from './controllers/ShiftController';

const shiftController = new ShiftController();

export async function shiftRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  // Todas as rotas requerem autenticação
  typedApp.addHook('preHandler', authenticate);

  // Schemas
  const createShiftBodySchema = z.object({
    name: z.string().min(3),
    startTime: z.string().refine((val) => /^\d{2}:\d{2}$/.test(val), 'Formato HH:mm inválido'),
    endTime: z.string().refine((val) => /^\d{2}:\d{2}$/.test(val), 'Formato HH:mm inválido'),
    lunchStartTime: z.string().refine((val) => /^\d{2}:\d{2}$/.test(val), 'Formato HH:mm inválido'),
    lunchEndTime: z.string().refine((val) => /^\d{2}:\d{2}$/.test(val), 'Formato HH:mm inválido'),
    toleranceMinutes: z.number().min(0).max(60).default(10),
    overtimeAllowed: z.boolean().default(true),
  });

  const updateShiftBodySchema = z.object({
    name: z.string().min(3).optional(),
    startTime: z.string().refine((val) => /^\d{2}:\d{2}$/.test(val), 'Formato HH:mm inválido').optional(),
    endTime: z.string().refine((val) => /^\d{2}:\d{2}$/.test(val), 'Formato HH:mm inválido').optional(),
    lunchStartTime: z.string().refine((val) => /^\d{2}:\d{2}$/.test(val), 'Formato HH:mm inválido').optional(),
    lunchEndTime: z.string().refine((val) => /^\d{2}:\d{2}$/.test(val), 'Formato HH:mm inválido').optional(),
    toleranceMinutes: z.number().min(0).max(60).optional(),
    overtimeAllowed: z.boolean().optional(),
    isActive: z.boolean().optional(),
  });

  const createExceptionBodySchema = z.object({
    date: z.coerce.date(),
    type: z.enum(['HOLIDAY', 'COMPENSATION', 'SPECIAL']),
    description: z.string().min(3),
    isWorkDay: z.boolean().default(false),
  });

  // Rotas
  typedApp.get('/', {
    schema: {
      tags: ['Shifts'],
      summary: 'Listar turnos',
      querystring: z.object({
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).max(100).default(20),
        search: z.string().optional(),
        isActive: z.enum(['true', 'false']).optional(),
      })
    }
  }, shiftController.list);

  typedApp.get('/:id', {
    schema: {
      tags: ['Shifts'],
      summary: 'Obter detalhes do turno',
      params: z.object({ id: z.string().uuid() })
    }
  }, shiftController.get);

  typedApp.post('/', {
    preHandler: [authorize('ADMIN', 'RH')],
    schema: {
      tags: ['Shifts'],
      summary: 'Criar turno',
      body: createShiftBodySchema
    }
  }, shiftController.create);

  typedApp.put('/:id', {
    preHandler: [authorize('ADMIN', 'RH')],
    schema: {
      tags: ['Shifts'],
      summary: 'Atualizar turno',
      params: z.object({ id: z.string().uuid() }),
      body: updateShiftBodySchema
    }
  }, shiftController.update);

  typedApp.delete('/:id', {
    preHandler: [authorize('ADMIN')],
    schema: {
      tags: ['Shifts'],
      summary: 'Remover turno',
      params: z.object({ id: z.string().uuid() })
    }
  }, shiftController.delete);

  // Exceptions
  typedApp.post('/:id/exceptions', {
    preHandler: [authorize('ADMIN', 'RH')],
    schema: {
      tags: ['Shifts'],
      summary: 'Criar exceção de turno',
      params: z.object({ id: z.string().uuid() }),
      body: createExceptionBodySchema
    }
  }, shiftController.createException);

  typedApp.delete('/:id/exceptions/:exceptionId', {
    preHandler: [authorize('ADMIN', 'RH')],
    schema: {
      tags: ['Shifts'],
      summary: 'Remover exceção de turno',
      params: z.object({ id: z.string().uuid(), exceptionId: z.string().uuid() })
    }
  }, shiftController.deleteException);

  typedApp.get('/:id/exceptions', {
    schema: {
      tags: ['Shifts'],
      summary: 'Listar exceções do turno',
      params: z.object({ id: z.string().uuid() }),
      querystring: z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional()
      })
    }
  }, shiftController.listExceptions);
}