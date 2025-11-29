import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { OccurrenceRepository } from '../repositories/prisma/OccurrenceRepository';
import { ListOccurrencesUseCase } from '../useCases/ListOccurrencesUseCase';
import { JustifyOccurrenceUseCase } from '../useCases/JustifyOccurrenceUseCase';
import { ApproveRejectOccurrenceUseCase } from '../useCases/ApproveRejectOccurrenceUseCase';
import { GetOccurrenceStatsUseCase } from '../useCases/GetOccurrenceStatsUseCase';
import { BulkApproveOccurrencesUseCase } from '../useCases/BulkApproveOccurrencesUseCase';

const prisma = new PrismaClient();
const occurrenceRepository = new OccurrenceRepository(prisma);

export class OccurrenceController {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const listUseCase = new ListOccurrencesUseCase(occurrenceRepository);
    const result = await listUseCase.execute(request.query as any);

    return reply.send(result);
  }

  async getById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const occurrence = await occurrenceRepository.findById(id);

    if (!occurrence) {
      return reply.status(404).send({ message: 'Ocorrência não encontrada' });
    }

    return reply.send({ occurrence });
  }

  async justify(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const justifyUseCase = new JustifyOccurrenceUseCase(occurrenceRepository, prisma);
    const result = await justifyUseCase.execute(
      id,
      request.body as any,
      request.user.sub
    );

    return reply.send(result);
  }

  async approveReject(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const approveRejectUseCase = new ApproveRejectOccurrenceUseCase(
      occurrenceRepository,
      prisma
    );
    const result = await approveRejectUseCase.execute(
      id,
      request.body as any,
      request.user.sub,
      request.user.role as any
    );

    return reply.send(result);
  }

  async bulkApprove(request: FastifyRequest, reply: FastifyReply) {
    const bulkApproveUseCase = new BulkApproveOccurrencesUseCase(
      occurrenceRepository,
      prisma
    );
    const result = await bulkApproveUseCase.execute(
      request.body as any,
      request.user.sub,
      request.user.role as any
    );

    return reply.send(result);
  }

  async getStats(request: FastifyRequest, reply: FastifyReply) {
    const getStatsUseCase = new GetOccurrenceStatsUseCase(occurrenceRepository, prisma);
    const result = await getStatsUseCase.execute(request.query as any);

    return reply.send(result);
  }

  async getEmployeeOccurrences(request: FastifyRequest, reply: FastifyReply) {
    const { employeeId } = request.params as { employeeId: string };
    const { startDate, endDate } = request.query as { startDate?: string; endDate?: string };

    const occurrences = await occurrenceRepository.findByEmployee(
      employeeId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );

    return reply.send({ occurrences });
  }

  async exportOccurrences(request: FastifyRequest, reply: FastifyReply) {
    const listUseCase = new ListOccurrencesUseCase(occurrenceRepository);
    const result = await listUseCase.execute({
      ...request.query as any,
      limit: 10000, // Export all
    });

    // Criar CSV
    const headers = [
      'Data',
      'Funcionário',
      'Matrícula',
      'Departamento',
      'Turno',
      'Tipo',
      'Status',
      'Minutos',
      'Horas',
      'Descrição',
      'Justificativa',
      'Aprovador',
    ];

    const rows = result.data.map(occ => [
      new Date(occ.date).toLocaleDateString('pt-BR'),
      occ.employee.name,
      occ.employee.sheetId,
      occ.employee.department,
      occ.employee.shift || 'N/A',
      occ.typeLabel,
      occ.statusLabel,
      occ.minutes,
      occ.hours,
      occ.description || '',
      occ.justification || '',
      occ.approver || '',
    ]);

    const csv = [
      headers.join(';'),
      ...rows.map(row => row.join(';')),
    ].join('\n');

    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="ocorrencias.csv"')
      .send('\uFEFF' + csv); // BOM para UTF-8
  }
}