import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { makeCreateShiftUseCase } from '../factories/make-create-shift-use-case';
import { makeUpdateShiftUseCase } from '../factories/make-update-shift-use-case';
import { makeListShiftsUseCase } from '../factories/make-list-shifts-use-case';
import { makeGetShiftUseCase } from '../factories/make-get-shift-use-case';
import { makeDeleteShiftUseCase } from '../factories/make-delete-shift-use-case';
import { makeManageShiftExceptionUseCase } from '../factories/make-manage-shift-exception-use-case';

const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  isActive: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
});

const exceptionQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export class ShiftController {
  async create(request: FastifyRequest, reply: FastifyReply) {
    const createShiftUseCase = makeCreateShiftUseCase();
    const shift = await createShiftUseCase.execute(
      request.body as any,
      request.user.sub
    );

    return reply.status(201).send({ shift });
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const updateShiftUseCase = makeUpdateShiftUseCase();
    const shift = await updateShiftUseCase.execute(
      id,
      request.body as any,
      request.user.sub
    );

    return reply.send({ shift });
  }

  async list(request: FastifyRequest, reply: FastifyReply) {
    const query = listQuerySchema.parse(request.query);
    const listShiftsUseCase = makeListShiftsUseCase();
    const result = await listShiftsUseCase.execute(query);

    return reply.send(result);
  }

  async get(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const getShiftUseCase = makeGetShiftUseCase();
    const shift = await getShiftUseCase.execute(id);

    return reply.send({ shift });
  }

  async delete(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const deleteShiftUseCase = makeDeleteShiftUseCase();
    const result = await deleteShiftUseCase.execute(id, request.user.sub);

    return reply.send(result);
  }

  // Exception management
  async createException(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const manageExceptionUseCase = makeManageShiftExceptionUseCase();
    const exception = await manageExceptionUseCase.createException(
      id,
      request.body as any,
      request.user.sub
    );

    return reply.status(201).send({ exception });
  }

  async deleteException(request: FastifyRequest, reply: FastifyReply) {
    const { exceptionId } = request.params as { exceptionId: string };
    const manageExceptionUseCase = makeManageShiftExceptionUseCase();
    const result = await manageExceptionUseCase.deleteException(
      exceptionId,
      request.user.sub
    );

    return reply.send(result);
  }

  async listExceptions(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const { startDate, endDate } = exceptionQuerySchema.parse(request.query);
    
    const manageExceptionUseCase = makeManageShiftExceptionUseCase();
    const exceptions = await manageExceptionUseCase.listExceptions(
      id,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );

    return reply.send({ exceptions });
  }
}