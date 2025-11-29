import { z } from 'zod';
import { IOccurrenceRepository } from '../repositories/IOccurrenceRepository';
import { NotFoundError, AppError, ForbiddenError } from '../../../shared/errors/AppError';
import { PrismaClient, OccurrenceStatus, UserRole } from '@prisma/client';

const approveRejectSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  comment: z.string().optional(),
});

export type ApproveRejectDTO = z.infer<typeof approveRejectSchema>;

export class ApproveRejectOccurrenceUseCase {
  constructor(
    private occurrenceRepository: IOccurrenceRepository,
    private prisma: PrismaClient
  ) {}

  async execute(
    id: string, 
    data: ApproveRejectDTO, 
    userId: string,
    userRole: UserRole
  ) {
    // Verificar permissão
    if (userRole === 'VIEWER') {
      throw new ForbiddenError('Sem permissão para aprovar/rejeitar ocorrências');
    }

    const validatedData = approveRejectSchema.parse(data);

    const occurrence = await this.occurrenceRepository.findById(id);
    if (!occurrence) {
      throw new NotFoundError('Ocorrência não encontrada');
    }

    if (occurrence.status !== 'JUSTIFIED' && occurrence.status !== 'PENDING') {
      throw new AppError('Esta ocorrência não pode ser aprovada/rejeitada', 400);
    }

    const newStatus = validatedData.action === 'APPROVE' 
      ? OccurrenceStatus.APPROVED 
      : OccurrenceStatus.REJECTED;

    // Atualizar ocorrência
    const updated = await this.occurrenceRepository.update(id, {
      status: newStatus,
      approvedBy: userId,
      approvedAt: new Date(),
    });

    // Registrar no log
    await this.prisma.systemLog.create({
      data: {
        action: `${validatedData.action}_OCCURRENCE`,
        module: 'OCCURRENCES',
        details: JSON.stringify({
          occurrenceId: id,
          employeeId: occurrence.employeeId,
          type: occurrence.type,
          action: validatedData.action,
          comment: validatedData.comment,
        }),
        userId,
      },
    });

    return {
      occurrence: updated,
      message: `Ocorrência ${validatedData.action === 'APPROVE' ? 'aprovada' : 'rejeitada'} com sucesso`,
    };
  }
}