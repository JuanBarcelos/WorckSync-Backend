import { IEmployeeRepository } from "../repositories/IEmployeeRepository";
import { NotFoundError } from "../../../shared/errors/AppError";

export class GetEmployeeUseCase {
  constructor(
    private employeeRepository: IEmployeeRepository,
    
  ) {}

  async execute(id: string) {
    const employee = await this.employeeRepository.findById(id);

    if (!employee) {
      throw new NotFoundError("Funcionário não encontrado");
    }

    return employee;
  }
}
