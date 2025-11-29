import { AppError, NotFoundError } from '../../../shared/errors/AppError';
import { IEmployeeRepository } from '../repositories/IEmployeeRepository';
import { PrismaClient } from '@prisma/client';

export class DeleteEmployeeUseCase {
  constructor(
    private employeeRepository: IEmployeeRepository,
    private prisma: PrismaClient
  ) {}

  async execute(id: string, userId: string) {
    const employee = await this.employeeRepository.findById(id);

    if (!employee) {
      throw new NotFoundError('Funcionário não encontrado');
    }

    // Verifica registros de ponto (regra de integridade)
    const hasTimeRecords = await this.prisma.timeRecord.count({
      where: { employeeId: id },
    });

    if (hasTimeRecords > 0) {
      throw new AppError(
        'Funcionário possui registros de ponto. Inative-o em vez de excluir.',
        400
      );
    }

    await this.employeeRepository.delete(id);

    await this.prisma.systemLog.create({
      data: {
        action: 'DELETE_EMPLOYEE',
        module: 'EMPLOYEES',
        details: JSON.stringify({
          employeeId: id,
          employeeName: employee.name,
        }),
        userId,
      },
    });

    return { message: 'Funcionário excluído com sucesso' };
  }
}