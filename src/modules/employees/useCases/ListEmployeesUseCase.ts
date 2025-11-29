import { z } from 'zod';
import { IEmployeeRepository } from '../repositories/IEmployeeRepository';

const listEmployeesSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  department: z.string().optional(),
  shiftId: z.string().uuid().optional(),
  isActive: z
    .string()
    .transform(val => val === 'true')
    .pipe(z.boolean())
    .optional(),
});

export type ListEmployeesDTO = z.infer<typeof listEmployeesSchema>;

export class ListEmployeesUseCase {
  constructor(private employeeRepository: IEmployeeRepository) {}

  async execute(params: ListEmployeesDTO) {
    const validatedParams = listEmployeesSchema.parse(params);
    
    const result = await this.employeeRepository.findMany(validatedParams);

    return {
      data: result.employees,
      meta: {
        total: result.total,
        pages: result.pages,
        page: validatedParams.page,
        limit: validatedParams.limit,
      },
    };
  }
}