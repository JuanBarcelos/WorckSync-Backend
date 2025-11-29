import { z } from 'zod';
import { IOccurrenceRepository } from '../repositories/IOccurrenceRepository';
import { NotFoundError, AppError } from '../../../shared/errors/AppError';
import { PrismaClient, OccurrenceStatus } from '@prisma/client';

const justifyOccurrenceSchema = z.object({
  justification: z.string().min(10, 'Justificativa deve ter no mínimo 10 caracteres'),
  attachments: z.array(z.string()).optional(), // URLs de anexos
});

export type JustifyOccurrenceDTO = z.infer<typeof justifyOccurrenceSchema>;

export class JustifyOccurrenceUseCase {
  constructor(
    private occurrenceRepository: IOccurrenceRepository,
    private prisma: PrismaClient
  ) {}

  async execute(id: string, data: JustifyOccurrenceDTO, userId: string) {
    const validatedData = justifyOccurrenceSchema.parse(data);

    const occurrence = await this.occurrenceRepository.findById(id);
    if (!occurrence) {
      throw new NotFoundError('Ocorrência não encontrada');
    }

    if (occurrence.status !== 'PENDING') {
      throw new AppError('Apenas ocorrências pendentes podem ser justificadas', 400);
    }

    // Atualizar ocorrência
    const updated = await this.occurrenceRepository.update(id, {
      status: OccurrenceStatus.JUSTIFIED,
      justification: validatedData.justification,
    });

    // Registrar no log
    await this.prisma.systemLog.create({
      data: {
        action: 'JUSTIFY_OCCURRENCE',
        module: 'OCCURRENCES',
        details: JSON.stringify({
          occurrenceId: id,
          employeeId: occurrence.employeeId,
          type: occurrence.type,
          justification: validatedData.justification,
        }),
        userId,
      },
    });

    return {
      occurrence: updated,
      message: 'Ocorrência justificada com sucesso',
    };
  }
}