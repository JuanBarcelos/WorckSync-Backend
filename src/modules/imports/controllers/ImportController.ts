import { FastifyRequest, FastifyReply } from 'fastify';
import * as XLSX from 'xlsx';
import { AppError } from '../../../shared/errors/AppError';
import { makeUploadFileUseCase } from '../factories/make-upload-file-use-case';
import { makeProcessImportUseCase } from '../factories/make-process-import-use-case';
import { makeGetImportDetailsUseCase } from '../factories/make-get-import-details-use-case';
import { makeListImportsUseCase } from '../factories/make-list-import-use-case';
import { PrismaImportRepository } from '../repositories/prisma/ImportRepository';
import { prisma } from '../../../shared/lib/prisma';
import { MemoryStorageProvider } from '../../../shared/providers/StorageProvider/implementations/MemoryStorageProvider';

// Instância do Storage Provider
const storageProvider = new MemoryStorageProvider();

export class ImportController {
  
  /**
   * Upload do arquivo Excel e criação do registro de importação
   */
  async upload(request: FastifyRequest, reply: FastifyReply) {
    const data = await request.file();

    if (!data) {
      throw new AppError('Nenhum arquivo enviado', 400);
    }

    // Converte stream para buffer
    const buffer = await data.toBuffer();

    // Instancia o UseCase via Factory
    const uploadUseCase = makeUploadFileUseCase();
    
    const result = await uploadUseCase.execute({
      file: {
        filename: data.filename,
        mimetype: data.mimetype,
        buffer,
      },
      userId: request.user.sub,
    });

    // Salva o arquivo fisicamente na pasta temporária usando o ID da importação
    // Isso evita manter o arquivo em memória RAM (Map)
    await storageProvider.save(result.import.id, buffer);

    // Retorna 201 Created
    return reply.status(201).send(result);
  }

  /**
   * Processamento assíncrono da importação
   */
  async process(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    
    // Captura opções do body (Zod já validou os tipos nas rotas, mas garantimos defaults aqui)
    const body = (request.body as any) || {};
    const options = {
      autoCalculate: body.autoCalculate ?? true,
      generateOccurrences: body.generateOccurrences ?? true,
      analyzeRecords: body.analyzeRecords ?? true,
    };

    // Recupera o arquivo do disco
    const fileBuffer = await storageProvider.get(id);
    
    if (!fileBuffer) {
      throw new AppError('Arquivo expirado ou não encontrado. Por favor, faça o upload novamente.', 404);
    }

    console.log(`🚀 Iniciando processamento da importação ${id}...`);

    const processUseCase = makeProcessImportUseCase();
    
    // Executa o processamento
    const result = await processUseCase.execute(
      id,
      fileBuffer,
      request.user.sub,
      options
    );

    // Remove o arquivo temporário após o processamento para liberar espaço
    await storageProvider.delete(id);

    return reply.send({
      ...result,
      settings: {
        message: 'Processamento concluído com sucesso',
        appliedOptions: options
      }
    });
  }

  /**
   * Listar importações com paginação e filtros
   */
  async list(request: FastifyRequest, reply: FastifyReply) {
    // Query params já validados pelo Zod no routes.ts
    const listUseCase = makeListImportsUseCase();
    const result = await listUseCase.execute(request.query as any);

    return reply.send(result);
  }

  /**
   * Obter detalhes de uma importação específica
   */
  async getDetails(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    
    const getDetailsUseCase = makeGetImportDetailsUseCase();
    const details = await getDetailsUseCase.execute(id);

    return reply.send(details);
  }

  /**
   * Obter logs detalhados de uma importação
   * Uso direto do Repositório (Leitura simples)
   */
  async getImportLogs(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const { status } = request.query as { status?: string };

    const importRepository = new PrismaImportRepository(prisma);
    const logs = await importRepository.findLogsByImport(id, status);

    return reply.send({
      logs: logs.map(log => ({
        ...log,
        // Garante que o JSON armazenado no banco seja devolvido como objeto
        data: log.data ? JSON.parse(log.data) : null,
      })),
    });
  }

  /**
   * Obter resumo estatístico da importação
   * Uso de Agregações do Prisma (Leitura otimizada)
   */
  async getImportSummary(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    const importRepository = new PrismaImportRepository(prisma);
    const importRecord = await importRepository.findById(id);

    if (!importRecord) {
      throw new AppError('Importação não encontrada', 404);
    }

    // Agregação otimizada no banco de dados
    const stats = await prisma.timeRecord.aggregate({
      where: { importId: id },
      _count: true,
      _sum: {
        totalWorkedMinutes: true,
        overtimeMinutes: true,
        lateMinutes: true,
      },
      _avg: {
        totalWorkedMinutes: true,
      },
    });

    const recordsWithIssues = await prisma.timeRecord.count({
      where: {
        importId: id,
        hasIssues: true,
      },
    });

    const occurrences = await prisma.occurrence.count({
      where: {
        timeRecord: {
          importId: id,
        },
      },
    });

    return reply.send({
      import: {
        id: importRecord.id,
        status: importRecord.status,
        fileName: importRecord.fileName,
        processedAt: importRecord.processedAt,
      },
      statistics: {
        totalRecords: stats._count,
        totalWorkedHours: Number(((stats._sum.totalWorkedMinutes || 0) / 60).toFixed(2)),
        totalOvertimeHours: Number(((stats._sum.overtimeMinutes || 0) / 60).toFixed(2)),
        totalLateMinutes: stats._sum.lateMinutes || 0,
        averageWorkedHours: Number(((stats._avg.totalWorkedMinutes || 0) / 60).toFixed(2)),
        recordsWithIssues,
        occurrencesGenerated: occurrences,
      },
    });
  }

  /**
   * Download de Template XLSX padrão
   */
  async downloadTemplate(request: FastifyRequest, reply: FastifyReply) {
    // Criação do Workbook
    const wb = XLSX.utils.book_new();
    
    // Cabeçalho e Dados de Exemplo
    const templateData: any[][] = [
      ['RELATÓRIO DE PONTO - MODELO DE IMPORTAÇÃO'],
      [],
      ['INSTRUÇÕES:'],
      ['1. Não altere a estrutura das colunas de dias.'],
      ['2. Os horários devem estar no formato HH:MM.'],
      ['3. O ID do funcionário deve corresponder ao "sheetId" no cadastro.'],
      [],
      ['ID Usuário: 001', 'Nome: Exemplo Silva', 'Dep.: Geral'],
      [],
      // Cabeçalho dos dias (1 a 31)
      ['', ...Array.from({ length: 31 }, (_, i) => (i + 1).toString())],
      // Dados de exemplo
      ['Entrada 1', '08:00', '08:00', '08:00', '08:00', '08:00'],
      ['Saída 1',   '12:00', '12:00', '12:00', '12:00', '12:00'],
      ['Entrada 2', '13:00', '13:00', '13:00', '13:00', '13:00'],
      ['Saída 2',   '17:00', '17:00', '17:00', '17:00', '17:00'],
    ];

    const ws = XLSX.utils.aoa_to_sheet(templateData);
    
    // Ajuste de largura de colunas para melhor visualização
    ws['!cols'] = [
      { width: 20 }, // Label
      ...Array(31).fill({ width: 6 }) // Dias
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Modelo');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', 'attachment; filename="modelo_importacao_ponto.xlsx"')
      .send(buffer);
  }
}