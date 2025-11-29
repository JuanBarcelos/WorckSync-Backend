import { prisma } from '../../../shared/lib/prisma';
import { PrismaEmployeeRepository } from '../repositories/prisma/EmployeeRepository';
import { GetEmployeeUseCase } from '../useCases/GetEmployeeUseCase';

export function makeGetEmployeeUseCase() {
  const employeeRepository = new PrismaEmployeeRepository(prisma);
  return new GetEmployeeUseCase(employeeRepository);
}