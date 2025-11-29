import { ITimeRecordRepository, UpdateTimeRecordDTO } from "../repositories/ITimeRecordRepository";
import { NotFoundError } from "../../../shared/errors/AppError";

export class UpdateTimeRecordUseCase {
  constructor(private repo: ITimeRecordRepository) {}

  async execute(data: UpdateTimeRecordDTO) {
    const record = await this.repo.findById(data.id);

    if (!record) {
      throw new NotFoundError("Registro de ponto não encontrado");
    }

    return await this.repo.updateTimeRecord(data);
  }
}