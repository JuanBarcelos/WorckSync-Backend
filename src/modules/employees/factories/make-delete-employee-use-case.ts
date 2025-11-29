import { prisma } from "../../../shared/lib/prisma";
import {  PrismaEmployeeRepository } from "../repositories/prisma/EmployeeRepository";
import { DeleteEmployeeUseCase } from "../useCases/DeleteEmployeeUseCase";


export function makeDeleteEmployeeUseCase() {
  const employeeRepository = new PrismaEmployeeRepository(prisma);
  return new DeleteEmployeeUseCase(employeeRepository, prisma);
}