import { prisma } from "../../../shared/lib/prisma";
import { PrismaEmployeeRepository } from "../repositories/prisma/EmployeeRepository";
import { ListEmployeesUseCase } from "../useCases/ListEmployeesUseCase";


export function makeListEmployeesUseCase() {
  const employeeRepository = new PrismaEmployeeRepository(prisma);
  return new ListEmployeesUseCase(employeeRepository);
}