import { prisma } from "../../../shared/lib/prisma";
import { PrismaEmployeeRepository } from "../repositories/prisma/EmployeeRepository";
import { GetDepartmentStatsUseCase } from "../useCases/GetDepartmentStatsUseCase";


export function makeGetDepartmentStatsUseCase() {
  const employeeRepository = new PrismaEmployeeRepository(prisma);
  return new GetDepartmentStatsUseCase(employeeRepository);
}