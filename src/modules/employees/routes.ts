import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate, authorize } from '../../shared/middlewares/auth';
import { EmployeeController } from './controllers/EmployeeController';

const employeeController = new EmployeeController();

export async function employeeRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.addHook('preHandler', authenticate);

  // Schemas Reutilizáveis
  const createEmployeeBodySchema = z.object({
    sheetId: z.string().min(1),
    name: z.string().min(3),
    position: z.string().min(2),
    department: z.string().min(2),
    shiftId: z.string().uuid().optional(),
  });

  const updateEmployeeBodySchema = z.object({
    name: z.string().min(3).optional(),
    position: z.string().min(2).optional(),
    department: z.string().min(2).optional(),
    shiftId: z.string().uuid().nullable().optional(),
    isActive: z.boolean().optional(),
  });

  // Listar
  typedApp.get('/', {
    schema: {
      summary: 'Listar funcionários',
      tags: ['Employees'],
      querystring: z.object({
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).max(100).default(20),
        search: z.string().optional(),
        department: z.string().optional(),
        shiftId: z.string().uuid().optional(),
        isActive: z.enum(['true', 'false']).optional(),
      }),
    }
  }, employeeController.list);

  // Obter stats
  typedApp.get('/stats/departments', {
    schema: { summary: 'Estatísticas por departamento', tags: ['Employees'] }
  }, employeeController.getDepartmentStats);

  // Por turno
  typedApp.get('/shift/:shiftId', {
    schema: { 
      summary: 'Funcionários por turno', 
      tags: ['Employees'],
      params: z.object({ shiftId: z.string().uuid() })
    }
  }, employeeController.getByShift);

  // Obter um
  typedApp.get('/:id', {
    schema: {
      summary: 'Obter funcionário',
      tags: ['Employees'],
      params: z.object({ id: z.string().uuid() })
    }
  }, employeeController.get);

  // Criar (Admin/RH)
  typedApp.post('/', {
    preHandler: [authorize('ADMIN', 'RH')],
    schema: {
      summary: 'Criar funcionário',
      tags: ['Employees'],
      body: createEmployeeBodySchema,
    }
  }, employeeController.create);

  // Atualizar (Admin/RH)
  typedApp.put('/:id', {
    preHandler: [authorize('ADMIN', 'RH')],
    schema: {
      summary: 'Atualizar funcionário',
      tags: ['Employees'],
      params: z.object({ id: z.string().uuid() }),
      body: updateEmployeeBodySchema,
    }
  }, employeeController.update);

  // Deletar (Admin)
  typedApp.delete('/:id', {
    preHandler: [authorize('ADMIN')],
    schema: {
      summary: 'Remover funcionário',
      tags: ['Employees'],
      params: z.object({ id: z.string().uuid() })
    }
  }, employeeController.delete);
}