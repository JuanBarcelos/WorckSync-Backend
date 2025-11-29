import { AppError } from '../../../shared/errors/AppError';
import { IImportRepository } from '../repositories/IImportRepository';
import { ExcelParser } from '../../../shared/utils/excelParser';
import { PrismaClient } from '@prisma/client';

interface UploadFileDTO {
  file: {
    filename: string;
    mimetype: string;
    buffer: Buffer;
  };
  userId: string;
}

const ALLOWED_MIMETYPES = [
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream', // Alguns browsers enviam xlsx assim
];

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB

export class UploadFileUseCase {
  constructor(
    private importRepository: IImportRepository,
    private prisma: PrismaClient
  ) {}

  async execute({ file, userId }: UploadFileDTO) {
    if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
      throw new AppError('Formato inválido. Envie um arquivo Excel (.xlsx).', 400);
    }

    if (file.buffer.length > MAX_FILE_SIZE) {
      throw new AppError('Arquivo muito grande. Limite: 15MB', 400);
    }

    // Validação Estrutural Rápida
    const validation = ExcelParser.validateStructure(file.buffer);
    if (!validation.valid) {
      throw new AppError(validation.message || 'Estrutura inválida', 400);
    }

    // Parse Completo
    const parser = new ExcelParser(file.buffer);
    const parseResult = parser.parse();

    if (parseResult.totalRecords === 0) {
      throw new AppError('O arquivo não contém registros válidos de ponto.', 400);
    }

    // Criar Import
    const importRecord = await this.importRepository.create({
      fileName: file.filename,
      fileSize: file.buffer.length,
      mimeType: file.mimetype,
      userId,
      totalRecords: parseResult.totalRecords,
    });

    // Atualizar datas se disponíveis
    if (parseResult.startDate && parseResult.endDate) {
      await this.importRepository.update(importRecord.id, {
        startDate: parseResult.startDate,
        endDate: parseResult.endDate,
        status: 'PENDING',
      });
    }

    // Log
    await this.prisma.systemLog.create({
      data: {
        action: 'UPLOAD_FILE',
        module: 'IMPORTS',
        details: JSON.stringify({
          importId: importRecord.id,
          records: parseResult.totalRecords,
          employees: parseResult.employees.length
        }),
        userId,
      },
    });

    // Verifica IDs desconhecidos (apenas IDs únicos para performance)
    const uniqueSheetIds = [...new Set(parseResult.employees.map(e => e.id))];
    const existingEmployees = await this.prisma.employee.findMany({
      where: { sheetId: { in: uniqueSheetIds } },
      select: { sheetId: true }
    });
    const existingIds = new Set(existingEmployees.map(e => e.sheetId));
    const missingEmployees = uniqueSheetIds.filter(id => !existingIds.has(id));

    return {
      import: importRecord,
      preview: {
        totalRecords: parseResult.totalRecords,
        validRecords: parseResult.validRecords,
        errors: parseResult.errors.slice(0, 10),
        warnings: parseResult.warnings.slice(0, 20),
        startDate: parseResult.startDate,
        endDate: parseResult.endDate,
        month: parseResult.month,
        year: parseResult.year,
        employeesFound: parseResult.employees.length,
        missingEmployeesCount: missingEmployees.length,
        missingEmployeesIds: missingEmployees.slice(0, 10), // Amostra
        sampleData: parseResult.data.slice(0, 3),
      },
    };
  }
}