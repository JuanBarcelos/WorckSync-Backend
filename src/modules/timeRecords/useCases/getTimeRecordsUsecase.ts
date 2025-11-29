import { ITimeRecordRepository } from "../repositories/ITimeRecordRepository";

export class GetTimeRecordsByEmployeeIdUseCase {
  constructor(private repo: ITimeRecordRepository) {}

  async execute(employeeId: string) {
    const records = await this.repo.findByEmployeeId(employeeId);
    // Retorna array vazio se não encontrar, padrão REST mais correto que erro
    return records;
  }
}