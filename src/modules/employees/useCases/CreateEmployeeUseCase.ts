import { IEmployeeRepository, CreateEmployeeDTO } from '../repositories/IEmployeeRepository';
import { PrismaClient } from '@prisma/client';
import { AppError } from '../../../shared/errors/AppError';
import { normalizeCPF } from '../../../shared/utils/validators';

export class CreateEmployeeUseCase {
  constructor(
    private employeeRepository: IEmployeeRepository,
    private prisma: PrismaClient // Singleton injetado
  ) {}

  async execute(data: CreateEmployeeDTO, userId: string) {

    // Verifica duplicidades em paralelo
    const [sheetIdExists] = await Promise.all([
      this.employeeRepository.findBySheetId(data.sheetId),
    ]);

    if (sheetIdExists) throw new AppError('ID da planilha já cadastrado', 409);

    // Valida Turno
    if (data.shiftId) {
      const shift = await this.prisma.shift.findUnique({ where: { id: data.shiftId } });
      if (!shift) throw new AppError('Turno não encontrado', 404);
      if (!shift.isActive) throw new AppError('Turno inativo', 400);
    }

    const employee = await this.employeeRepository.create(data);

    // Log
    await this.prisma.systemLog.create({
      data: {
        action: 'CREATE_EMPLOYEE',
        module: 'EMPLOYEES',
        details: JSON.stringify({
          employeeId: employee.id,
          name: employee.name,
          sheetId: employee.sheetId,
        }),
        userId,
      },
    });

    return employee;
  }
}