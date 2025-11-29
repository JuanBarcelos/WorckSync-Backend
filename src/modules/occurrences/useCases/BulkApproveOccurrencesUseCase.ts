import { z } from 'zod';
import { IOccurrenceRepository } from '../repositories/IOccurrenceRepository';
import { OccurrenceStatus, UserRole } from '@prisma/client';
import { ForbiddenError } from '../../../shared/errors/AppError';
import { PrismaClient } from '@prisma/client';

const bulkApproveSchema = z.object({
  occurrenceIds: z.array(z.string().uuid()).min(1, 'Selecione pelo menos uma ocorrência'),
  action: z.enum(['APPROVE', 'REJECT']),
  comment: z.string().optional(),
});

export type BulkApproveDTO = z.infer<typeof bulkApproveSchema>;

export class BulkApproveOccurrencesUseCase {
  constructor(
    private occurrenceRepository: IOccurrenceRepository,
    private prisma: PrismaClient
  ) {}

  async execute(
    data: BulkApproveDTO,
    userId: string,
    userRole: UserRole
  ) {
    if (userRole === 'VIEWER') {
      throw new ForbiddenError('Sem permissão para aprovar/rejeitar ocorrências');
    }

    const validatedData = bulkApproveSchema.parse(data);

    const newStatus = validatedData.action === 'APPROVE'
      ? OccurrenceStatus.APPROVED
      : OccurrenceStatus.REJECTED;

    // Atualizar em lote
    const updated = await this.occurrenceRepository.bulkUpdateStatus(
      validatedData.occurrenceIds,
      newStatus,
      userId
    );

    // Registrar no log
    await this.prisma.systemLog.create({
      data: {
        action: `BULK_${validatedData.action}_OCCURRENCES`,
        module: 'OCCURRENCES',
        details: JSON.stringify({
          occurrenceIds: validatedData.occurrenceIds,
          count: updated,
          action: validatedData.action,
          comment: validatedData.comment,
        }),
        userId,
      },
    });

    return {
      updated,
      message: `${updated} ocorrência(s) ${validatedData.action === 'APPROVE' ? 'aprovada(s)' : 'rejeitada(s)'}`,
    };
  }
}