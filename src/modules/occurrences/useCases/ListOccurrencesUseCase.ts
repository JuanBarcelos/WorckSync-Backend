import { z } from 'zod';
import { OccurrenceType, OccurrenceStatus } from '@prisma/client';
import { IOccurrenceRepository } from '../repositories/IOccurrenceRepository';

const listOccurrencesSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  employeeId: z.string().uuid().optional(),
  type: z.nativeEnum(OccurrenceType).optional(),
  status: z.nativeEnum(OccurrenceStatus).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  shiftId: z.string().uuid().optional(),
});

export type ListOccurrencesDTO = z.infer<typeof listOccurrencesSchema>;

export class ListOccurrencesUseCase {
  constructor(private occurrenceRepository: IOccurrenceRepository) {}

  async execute(params: ListOccurrencesDTO) {
    const validatedParams = listOccurrencesSchema.parse(params);
    
    const result = await this.occurrenceRepository.findMany(validatedParams);

    // Formatar os dados para apresentação
    const formattedOccurrences = result.occurrences.map(occ => ({
      id: occ.id,
      date: occ.date,
      employee: {
        id: occ.employee?.id,
        name: occ.employee?.name,
        sheetId: occ.employee?.sheetId,
        department: occ.employee?.department,
        shift: occ.employee?.shift?.name,
      },
      type: occ.type,
      typeLabel: this.getTypeLabel(occ.type),
      status: occ.status,
      statusLabel: this.getStatusLabel(occ.status),
      minutes: occ.minutes,
      hours: (occ.minutes / 60).toFixed(2),
      description: occ.description,
      justification: occ.justification,
      approver: occ.approver?.name,
      approvedAt: occ.approvedAt,
    }));

    return {
      data: formattedOccurrences,
      meta: {
        total: result.total,
        pages: result.pages,
        page: validatedParams.page,
        limit: validatedParams.limit,
      },
    };
  }

  private getTypeLabel(type: OccurrenceType): string {
    const labels = {
      LATE_ARRIVAL: 'Atraso',
      EARLY_DEPARTURE: 'Saída Antecipada',
      ABSENCE: 'Falta',
      INCOMPLETE_RECORD: 'Registro Incompleto',
      OVERTIME: 'Hora Extra',
      HOLIDAY_WORK: 'Trabalho em Feriado',
      WEEKEND_WORK: 'Trabalho em Fim de Semana',
      MISSING_CLOCK_IN: 'Falta de Entrada',
      MISSING_CLOCK_OUT: 'Falta de Saída',
      EXCESSIVE_LUNCH: 'Excesso de Almoço',
    };
    return labels[type] || type;
  }

  private getStatusLabel(status: OccurrenceStatus): string {
    const labels = {
      PENDING: 'Pendente',
      JUSTIFIED: 'Justificado',
      APPROVED: 'Aprovado',
      REJECTED: 'Rejeitado',
      CANCELLED: 'Cancelado',
    };
    return labels[status] || status;
  }
}