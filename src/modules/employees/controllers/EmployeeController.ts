import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { PrismaEmployeeRepository } from '../repositories/prisma/EmployeeRepository';
import { prisma } from '../../../shared/lib/prisma';
import { makeCreateEmployeeUseCase } from '../factories/make-create-employee-use-case';
import { makeDeleteEmployeeUseCase } from '../factories/make-delete-employee-use-case';
import { makeGetDepartmentStatsUseCase } from '../factories/make-get-department-stats-use-case';
import { makeGetEmployeeUseCase } from '../factories/make-get-employee-use-case';
import { makeListEmployeesUseCase } from '../factories/make-list-employees-use-case';
import { makeUpdateEmployeeUseCase } from '../factories/make-update-employee-use-case';


// Schema de validação de paginação (usado no list)
const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  department: z.string().optional(),
  shiftId: z.string().uuid().optional(),
  isActive: z.string().transform(val => val === 'true').pipe(z.boolean()).optional(),
});

export class EmployeeController {
  async create(request: FastifyRequest, reply: FastifyReply) {
    // O body já vem validado pelo Zod nas rotas, mas forçamos a tipagem aqui se necessário
    const body = request.body as any; 
    
    const createEmployeeUseCase = makeCreateEmployeeUseCase();
    const employee = await createEmployeeUseCase.execute(body, request.user.sub);

    return reply.status(201).send({ employee });
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const body = request.body as any;

    const updateEmployeeUseCase = makeUpdateEmployeeUseCase();
    const employee = await updateEmployeeUseCase.execute(id, body, request.user.sub);

    return reply.send({ employee });
  }

  async list(request: FastifyRequest, reply: FastifyReply) {
    const query = listQuerySchema.parse(request.query);
    
    const listEmployeesUseCase = makeListEmployeesUseCase();
    const result = await listEmployeesUseCase.execute(query);

    return reply.send(result);
  }

  async get(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const getEmployeeUseCase = makeGetEmployeeUseCase();
    const employee = await getEmployeeUseCase.execute(id);

    return reply.send({ employee });
  }

  async delete(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const deleteEmployeeUseCase = makeDeleteEmployeeUseCase();
    const result = await deleteEmployeeUseCase.execute(id, request.user.sub);

    return reply.send(result);
  }

  async getDepartmentStats(request: FastifyRequest, reply: FastifyReply) {
    const getDepartmentStatsUseCase = makeGetDepartmentStatsUseCase();
    const stats = await getDepartmentStatsUseCase.execute();

    return reply.send(stats);
  }

  async getByShift(request: FastifyRequest, reply: FastifyReply) {
    const { shiftId } = request.params as { shiftId: string };
    // Para queries simples sem regra de negócio complexa, chamar repo direto é aceitável (CQRS pragmático)
    // Mas idealmente, use um UseCase se precisar de validação
    const repo = new PrismaEmployeeRepository(prisma);
    const employees = await repo.findByShift(shiftId);

    return reply.send({ employees });
  }
}