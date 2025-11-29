import { IImportRepository } from '../repositories/IImportRepository';
import { NotFoundError } from '../../../shared/errors/AppError';

export class GetImportDetailsUseCase {
  constructor(private importRepository: IImportRepository) {}

  async execute(importId: string) {
    const importRecord = await this.importRepository.findById(importId);
    
    if (!importRecord) {
      throw new NotFoundError('Importação não encontrada');
    }

    // Buscar estatísticas dos logs
    const stats = await this.importRepository.getImportStats(importId);
    
    // Buscar logs de erro (limitado a 50)
    const errorLogs = await this.importRepository.findLogsByImport(importId, 'ERROR');

    return {
      import: importRecord,
      statistics: {
        ...stats,
        successRate: stats.total > 0 
          ? ((stats.success / stats.total) * 100).toFixed(2) + '%'
          : '0%',
      },
      errors: errorLogs.slice(0, 50).map(log => ({
        row: log.row,
        message: log.message,
        data: log.data ? JSON.parse(log.data) : null,
      })),
      recordsCreated: importRecord._count?.timeRecords || 0,
    };
  }
}