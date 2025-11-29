import { z } from 'zod';
import { IImportRepository } from '../repositories/IImportRepository';
import { ImportStatus } from '@prisma/client';

const listImportsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.nativeEnum(ImportStatus).optional(),
  userId: z.string().uuid().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export type ListImportsDTO = z.infer<typeof listImportsSchema>;

export class ListImportsUseCase {
  constructor(private importRepository: IImportRepository) {}

  async execute(params: ListImportsDTO) {
    const validatedParams = listImportsSchema.parse(params);
    
    const result = await this.importRepository.findMany(validatedParams);

    return {
      data: result.imports.map(imp => ({
        ...imp,
        errors: imp.errors ? JSON.parse(imp.errors) : null,
      })),
      meta: {
        total: result.total,
        pages: result.pages,
        page: validatedParams.page,
        limit: validatedParams.limit,
      },
    };
  }
}