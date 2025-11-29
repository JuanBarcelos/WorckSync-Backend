import { FastifyReply, FastifyRequest } from "fastify";
import { makeGetTimeRecordsUseCase } from "../factories/make-get-time-records-use-case";
import { makeUpdateTimeRecordUseCase } from "../factories/make-update-time-record-use-case";
import { UpdateTimeRecordDTO } from "../repositories/ITimeRecordRepository";

export class TimeRecordController {
  async getByEmployeeId(request: FastifyRequest, reply: FastifyReply) {
    const { employeeId } = request.params as { employeeId: string };
    
    const useCase = makeGetTimeRecordsUseCase();
    const records = await useCase.execute(employeeId);
    
    return reply.status(200).send(records);
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    // O body já vem validado e tipado pelo Zod na rota
    const data = request.body as UpdateTimeRecordDTO;
    
    const useCase = makeUpdateTimeRecordUseCase();
    const updated = await useCase.execute(data);
    
    return reply.status(200).send(updated);
  }
}