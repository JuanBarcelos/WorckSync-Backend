import { prisma } from "../../../shared/lib/prisma";
import { PrismaEmployeeRepository } from "../repositories/prisma/EmployeeRepository";
import { UpdateEmployeeUseCase } from "../useCases/UpdateEmployeeUseCase";


export function makeUpdateEmployeeUseCase() {
  const employeeRepository = new PrismaEmployeeRepository(prisma);
  return new UpdateEmployeeUseCase(employeeRepository, prisma);
}