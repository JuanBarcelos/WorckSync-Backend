import { FastifyRequest, FastifyReply } from "fastify";
import { ReportType, ReportFormat } from "@prisma/client";
import { z } from "zod";
import path from "path";
import fs from "fs";
import { endOfMonth } from "date-fns"; // Using shared singleton
import { prisma } from "../../../shared/lib/prisma";
import { ExcelGeneratorService } from "../services/ExcelGeneratorService";
import { MonthlyReportService } from "../services/MonthlyReportService";
import { PDFGeneratorService } from "../services/PDFGeneratorService";
import { ReportDataService } from "../services/ReportDataService";
import { EmployeeMonthlyReport } from "../types";

const generateReportSchema = z.object({
  type: z.nativeEnum(ReportType).optional(),
  format: z.nativeEnum(ReportFormat),
  month: z.number().min(1).max(12).optional(),
  year: z.number().min(2020).max(2050).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  employeeId: z.string().uuid().optional(),
  employeeIds: z.array(z.string()).optional(),
  departmentIds: z.array(z.string()).optional(),
  includeDetails: z.boolean().default(true),
  includeCharts: z.boolean().default(false),
});

export class ReportController {
  // Factories for DI (can be moved to separate factory files if desired)
  private getReportDataService() {
    return new ReportDataService(prisma);
  }
  private getMonthlyReportService() {
    return new MonthlyReportService(prisma);
  }
  private getPDFGenerator() {
    return new PDFGeneratorService();
  }
  private getExcelGenerator() {
    return new ExcelGeneratorService();
  }

  async generate(request: FastifyRequest, reply: FastifyReply) {
    const params = generateReportSchema.parse(request.body);

    // Default type if not provided, though schema usually enforces or logic dictates it
    const reportType = params.type || "MONTHLY_SUMMARY";

    const report = await prisma.report.create({
      data: {
        name: `Relatório ${reportType}`,
        type: reportType,
        format: params.format,
        status: "PROCESSING",
        parameters: JSON.stringify(params),
        startDate: params.startDate || new Date(),
        endDate: params.endDate || new Date(),
        userId: request.user.sub,
      },
    });

    try {
      const reportDataService = this.getReportDataService();
      let reportData;

      switch (reportType) {
        case "MONTHLY_SUMMARY":
          reportData = await reportDataService.generateMonthlyReport(
            params as any
          );
          break;
        case "PAYROLL":
          reportData = await reportDataService.generatePayrollReport(
            params as any
          );
          break;
        default:
          reportData = await reportDataService.generateMonthlyReport(
            params as any
          );
      }

      const fileName = `report_${report.id}.${params.format.toLowerCase()}`;
      const outputPath = path.join(process.cwd(), "reports", fileName);
      let generatedPath: string;

      if (params.format === "PDF") {
        generatedPath = await this.getPDFGenerator().generatePDF(
          reportData,
          outputPath
        );
      } else {
        generatedPath = await this.getExcelGenerator().generateExcel(
          reportData,
          outputPath.replace(".excel", ".xlsx")
        );
      }

      await prisma.report.update({
        where: { id: report.id },
        data: {
          status: "COMPLETED",
          fileUrl: `/reports/${fileName}`,
          fileSize: fs.statSync(generatedPath).size,
          completedAt: new Date(),
        },
      });

      return reply.send({
        reportId: report.id,
        status: "completed",
        fileUrl: `/api/reports/${report.id}/download`,
        message: "Relatório gerado com sucesso",
      });
    } catch (error) {
      await prisma.report.update({
        where: { id: report.id },
        data: { status: "FAILED", error: String(error) },
      });
      throw error;
    }
  }

  async generateMonthly(request: FastifyRequest, reply: FastifyReply) {
    const params = generateReportSchema.parse(request.body);

    if (!params.month || !params.year) {
      return reply
        .status(400)
        .send({ message: "Mês e ano são obrigatórios para relatório mensal" });
    }

    const report = await prisma.report.create({
      data: {
        name: `Relatório Mensal - ${params.month}/${params.year}`,
        type: "MONTHLY_SUMMARY",
        format: params.format,
        status: "PROCESSING",
        parameters: JSON.stringify(params),
        startDate: new Date(params.year, params.month - 1, 1),
        endDate: endOfMonth(new Date(params.year, params.month - 1, 1)),
        userId: request.user.sub,
      },
    });

    try {
      const monthlyService = this.getMonthlyReportService();
      let reports: EmployeeMonthlyReport[];

      if (params.employeeId) {
        reports = [
          await monthlyService.generateEmployeeMonthlyReport(
            params.employeeId,
            params.month,
            params.year
          ),
        ];
      } else if (params.employeeIds && params.employeeIds.length > 0) {
        reports = await monthlyService.generateMultipleEmployeesMonthlyReport(
          params.employeeIds,
          params.month,
          params.year
        );
      } else {
        reports = await monthlyService.generateCompleteMonthlyReport(
          params.month,
          params.year
        );
      }

      const ext = params.format === "EXCEL" ? "xlsx" : "pdf";
      const fileName = `relatorio_mensal_${params.month}_${params.year}_${report.id}.${ext}`;
      const outputPath = path.join(process.cwd(), "reports", fileName);
      let generatedPath: string;

      if (params.format === "PDF") {
        generatedPath = await this.getPDFGenerator().generateMonthlyReportPDF(
          reports,
          outputPath
        );
      } else {
        generatedPath = await this.getExcelGenerator().generateMonthlyExcelFile(
          reports,
          outputPath
        );
      }

      await prisma.report.update({
        where: { id: report.id },
        data: {
          status: "COMPLETED",
          fileUrl: `/reports/${fileName}`,
          fileSize: fs.statSync(generatedPath).size,
          completedAt: new Date(),
        },
      });

      return reply.send({
        reportId: report.id,
        status: "completed",
        fileUrl: `/api/reports/${report.id}/download`,
        message: "Relatório mensal gerado com sucesso",
      });
    } catch (error) {
      await prisma.report.update({
        where: { id: report.id },
        data: { status: "FAILED", error: String(error) },
      });
      throw error;
    }
  }

  async download(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const report = await prisma.report.findUnique({ where: { id } });

    if (!report || !report.fileUrl)
      return reply.status(404).send({ message: "Relatório não encontrado" });

    const filePath = path.join(process.cwd(), report.fileUrl.substring(1));
    if (!fs.existsSync(filePath))
      return reply.status(404).send({ message: "Arquivo não encontrado" });

    const mimeTypes: any = {
      PDF: "application/pdf",
      EXCEL:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      CSV: "text/csv",
    };

    const ext = report.format === "EXCEL" ? "xlsx" : "pdf";

    return reply
      .header("Content-Type", mimeTypes[report.format])
      .header(
        "Content-Disposition",
        `attachment; filename="relatorio_${report.id}.${ext}"`
      )
      .send(fs.createReadStream(filePath));
  }

  async list(request: FastifyRequest, reply: FastifyReply) {
    const { page = 1, limit = 20 } = request.query as any;
    const skip = (page - 1) * limit;

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where: { userId: request.user.sub },
        skip,
        take: Number(limit),
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true, email: true } } },
      }),
      prisma.report.count({ where: { userId: request.user.sub } }),
    ]);

    return reply.send({
      data: reports,
      meta: {
        total,
        pages: Math.ceil(total / Number(limit)),
        page: Number(page),
        limit: Number(limit),
      },
    });
  }

  async getStatus(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const report = await prisma.report.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        type: true,
        format: true,
        status: true,
        fileUrl: true,
        error: true,
        createdAt: true,
        completedAt: true,
      },
    });

    if (!report)
      return reply.status(404).send({ message: "Relatório não encontrado" });
    return reply.send(report);
  }
}
