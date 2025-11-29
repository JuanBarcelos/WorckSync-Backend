import { prisma } from "../../../shared/lib/prisma";
import { PrismaEmployeeRepository } from "../repositories/prisma/EmployeeRepository";
import { CreateEmployeeUseCase } from "../useCases/CreateEmployeeUseCase";


export function makeCreateEmployeeUseCase() {
  const employeeRepository = new PrismaEmployeeRepository(prisma);
  return new CreateEmployeeUseCase(employeeRepository, prisma);
}