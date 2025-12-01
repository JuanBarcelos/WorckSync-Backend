import ExcelJS from "exceljs";
import { EmployeeMonthlyReport, ReportData, ReportSection } from "../types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import path from "path";
import fs from "fs";

export class ExcelGeneratorService {
  private workbook!: ExcelJS.Workbook;

  async generateExcel(
    reportData: ReportData,
    outputPath: string
  ): Promise<string> {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.workbook = new ExcelJS.Workbook();
    this.workbook.creator = reportData.generatedBy;
    this.workbook.created = reportData.generatedAt;
    this.workbook.modified = new Date();

    const worksheet = this.workbook.addWorksheet("Relatório", {
      properties: { tabColor: { argb: "FF00FF00" } },
    });

    let currentRow = 1;

    // Header
    worksheet.mergeCells(`A${currentRow}:J${currentRow}`);
    const titleCell = worksheet.getCell(`A${currentRow}`);
    titleCell.value = reportData.title;
    titleCell.font = { name: "Arial", size: 16, bold: true };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    currentRow += 2;

    worksheet.mergeCells(`A${currentRow}:J${currentRow}`);
    const subtitleCell = worksheet.getCell(`A${currentRow}`);
    subtitleCell.value = reportData.subtitle;
    subtitleCell.font = { name: "Arial", size: 12 };
    subtitleCell.alignment = { horizontal: "center", vertical: "middle" };
    currentRow += 2;

    worksheet.getCell(`A${currentRow}`).value = "Data de Geração:";
    worksheet.getCell(`B${currentRow}`).value = format(
      reportData.generatedAt,
      "dd/MM/yyyy HH:mm",
      { locale: ptBR }
    );
    currentRow++;

    worksheet.getCell(`A${currentRow}`).value = "Gerado por:";
    worksheet.getCell(`B${currentRow}`).value = reportData.generatedBy;
    currentRow += 2;

    for (const section of reportData.sections) {
      currentRow = this.addSection(worksheet, section, currentRow);
      currentRow += 2;
    }

    if (reportData.summary) {
      this.addSummarySheet(reportData.summary);
    }

    await this.workbook.xlsx.writeFile(outputPath);
    return outputPath;
  }

  private addSection(
    worksheet: ExcelJS.Worksheet,
    section: ReportSection,
    startRow: number
  ): number {
    let currentRow = startRow;

    worksheet.mergeCells(`A${currentRow}:J${currentRow}`);
    const sectionTitle = worksheet.getCell(`A${currentRow}`);
    sectionTitle.value = section.title;
    sectionTitle.font = { name: "Arial", size: 12, bold: true };
    sectionTitle.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };
    currentRow += 2;

    if (section.type === "table" && section.columns && section.data) {
      currentRow = this.addTable(worksheet, section, currentRow);
    } else if (section.type === "summary") {
      currentRow = this.addSummaryData(worksheet, section.data, currentRow);
    }

    return currentRow;
  }

  private addTable(
    worksheet: ExcelJS.Worksheet,
    section: ReportSection,
    startRow: number
  ): number {
    let currentRow = startRow;
    let currentCol = 1;

    section.columns!.forEach((col) => {
      const cell = worksheet.getCell(currentRow, currentCol);
      cell.value = col.header;
      cell.font = { bold: true };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4472C4" },
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      worksheet.getColumn(currentCol).width = (col.width || 100) / 7;
      currentCol++;
    });
    currentRow++;

    section.data.forEach((row: any) => {
      currentCol = 1;
      section.columns!.forEach((col) => {
        const cell = worksheet.getCell(currentRow, currentCol);
        cell.value = this.formatCellValue(row[col.key], col.format);
        cell.alignment = {
          horizontal: col.align || "left",
          vertical: "middle",
        };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };

        if (col.format === "currency") cell.numFmt = "R$ #,##0.00";
        else if (col.format === "percentage") cell.numFmt = "0.00%";

        currentCol++;
      });
      currentRow++;
    });

    if (section.footer) {
      currentCol = 1;
      const footerCell = worksheet.getCell(currentRow, currentCol);
      footerCell.value = "Total:";
      footerCell.font = { bold: true };
      currentCol++;

      section.columns!.forEach((col) => {
        if (section.footer[col.key] !== undefined) {
          const cell = worksheet.getCell(currentRow, currentCol);
          cell.value = this.formatCellValue(
            section.footer[col.key],
            col.format
          );
          cell.font = { bold: true };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFE0E0E0" },
          };
        }
        currentCol++;
      });
      currentRow++;
    }

    return currentRow;
  }

  private addSummaryData(
    worksheet: ExcelJS.Worksheet,
    data: Record<string, any>,
    startRow: number
  ): number {
    let currentRow = startRow;
    Object.entries(data).forEach(([key, value]) => {
      worksheet.getCell(`A${currentRow}`).value = key;
      worksheet.getCell(`B${currentRow}`).value = value;
      currentRow++;
    });
    return currentRow;
  }

  private addSummarySheet(summary: Record<string, any>) {
    const summarySheet = this.workbook.addWorksheet("Resumo");
    summarySheet.getCell("A1").value = "Resumo Executivo";
    summarySheet.getCell("A1").font = { size: 14, bold: true };

    let row = 3;
    Object.entries(summary).forEach(([key, value]) => {
      summarySheet.getCell(`A${row}`).value = key;
      summarySheet.getCell(`B${row}`).value = value;
      row++;
    });

    summarySheet.getColumn(1).width = 30;
    summarySheet.getColumn(2).width = 20;
  }

  private formatCellValue(value: any, format?: string): any {
    if (value === null || value === undefined) return "";
    switch (format) {
      case "currency":
        return parseFloat(value);
      case "percentage":
        return parseFloat(value) / 100;
      case "date":
        return new Date(value);
      default:
        return value;
    }
  }

  // Conteúdo para substituir o método generateMonthlyExcelFile em ExcelGeneratorService.ts

  async generateMonthlyExcelFile(
    reports: EmployeeMonthlyReport[],
    outputPath: string
  ): Promise<string> {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.workbook = new ExcelJS.Workbook();
    this.workbook.creator = "Sistema de Ponto";
    this.workbook.created = new Date();
    this.workbook.modified = new Date();

    reports.forEach((report) => {
      const sheetName =
        report.employee.name.length > 31
          ? report.employee.name.substring(0, 28) + "..."
          : report.employee.name;

      const worksheet = this.workbook.addWorksheet(sheetName);

      worksheet.mergeCells("A1:J1");
      const titleCell = worksheet.getCell("A1");
      titleCell.value = `RELATÓRIO MENSAL - ${report.month.toUpperCase()}/${
        report.year
      }`;
      titleCell.font = { bold: true, size: 14 };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };

      // Informações do funcionário (já existia Matrícula e Nome)
      worksheet.getCell("A3").value = "Funcionário:";
      worksheet.getCell("A3").font = { bold: true };
      worksheet.getCell("B3").value = report.employee.name;
      worksheet.getCell("D3").value = "Matrícula:";
      worksheet.getCell("D3").font = { bold: true };
      worksheet.getCell("E3").value = report.employee.sheetId;

      // RESTAURADO: Exibir Departamento/Cargo
      worksheet.getCell("A4").value = "Departamento:";
      worksheet.getCell("A4").font = { bold: true };
      worksheet.getCell("B4").value = report.employee.department;
      worksheet.getCell("D4").value = "Cargo:";
      worksheet.getCell("D4").font = { bold: true };
      worksheet.getCell("E4").value = report.employee.position;

      // RESTAURADO: Exibir Turno (Shift)
      if (report.employee.shift) {
        worksheet.getCell("G3").value = "Turno:";
        worksheet.getCell("G3").font = { bold: true };
        worksheet.getCell("H3").value = report.employee.shift;
      }

      const headers = [
        "Data",
        "Dia",
        "Entrada",
        "Almoço Início",
        "Almoço Fim",
        "Saída",
        "Total",
        "H.Extra",
        "Atraso",
        "Observações",
      ];
      const headerRow = worksheet.getRow(6);
      headers.forEach((header, index) => {
        const cell = headerRow.getCell(index + 1);
        cell.value = header;
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF4472C4" },
        };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });

      report.rows.forEach((row, index) => {
        const rowNum = index + 7;
        const excelRow = worksheet.getRow(rowNum);

        excelRow.getCell(1).value = row.date;
        excelRow.getCell(2).value = row.dayOfWeek;
        excelRow.getCell(3).value = row.clockIn;
        excelRow.getCell(4).value = row.lunchStart;
        excelRow.getCell(5).value = row.lunchEnd;
        excelRow.getCell(6).value = row.clockOut;
        excelRow.getCell(7).value = row.totalWorked;
        excelRow.getCell(8).value = row.overtime;
        excelRow.getCell(9).value = row.late;
        excelRow.getCell(10).value = row.observations;

        if (row.clockIn && row.clockIn.includes("*")) {
          // Nota ajustada para o texto original
          excelRow.getCell(3).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFD700" },
          };
          excelRow.getCell(3).note = "Entrada ajustada - Chegou antes do turno";
        }

        // Restaura o destaque de faltas e incompletos para garantir o formato correto, embora não tenha sido explicitamente solicitado,
        // isso evita quebras visuais (deixar o destaque de fim de semana mas não o de falta).

        // RESTAURADO: Destaque de registros incompletos com fonte vermelha (como no antigo)
        if (row.lunchStart === "---" || row.clockOut === "---") {
          for (let i = 1; i <= 10; i++) {
            excelRow.getCell(i).font = {
              ...excelRow.getCell(i).font,
              color: { argb: "FFFF0000" },
            };
          }
        }

        // RESTAURADO: Adicionar comentários nas observações complexas (como no antigo)
        if (row.observations && row.observations.length > 30) {
          excelRow.getCell(10).note = row.observations;
        }

        if (["Sábado", "Domingo"].includes(row.dayOfWeek)) {
          for (let i = 1; i <= 10; i++)
            excelRow.getCell(i).fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF0F0F0" },
            };
        }

        // RESTAURADO: Destaque de faltas com fundo rosa claro (como no antigo)
        if (row.observations === "Falta") {
          for (let i = 1; i <= 10; i++) {
            excelRow.getCell(i).fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFFFE0E0" },
            };
          }
        }

        for (let i = 1; i <= 10; i++) {
          excelRow.getCell(i).border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        }
      });

      // RESTAURADO: Resumo dos Dados do Mês (Bloco de Resumo)
      const summaryStartRow = report.rows.length + 9;

      worksheet.mergeCells(`A${summaryStartRow}:J${summaryStartRow}`);
      const summaryTitle = worksheet.getCell(`A${summaryStartRow}`);
      summaryTitle.value = "RESUMO DO MÊS";
      summaryTitle.font = { bold: true, size: 12 };
      summaryTitle.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" },
      };
      summaryTitle.alignment = { horizontal: "center", vertical: "middle" };

      const summaryData = [
        [
          "Total de Dias:",
          report.summary.totalDays,
          "Total de Horas:",
          report.summary.totalHours,
        ],
        [
          "Dias Trabalhados:",
          report.summary.workedDays,
          "Horas Extras:",
          report.summary.totalOvertime,
        ],
        [
          "Faltas:",
          report.summary.absences,
          "Total de Atrasos:",
          report.summary.totalLate,
        ],
      ];

      summaryData.forEach((row, index) => {
        const rowNum = summaryStartRow + index + 2;
        worksheet.getCell(`A${rowNum}`).value = row[0];
        worksheet.getCell(`A${rowNum}`).font = { bold: true };
        worksheet.getCell(`B${rowNum}`).value = row[1];

        worksheet.getCell(`D${rowNum}`).value = row[2];
        worksheet.getCell(`D${rowNum}`).font = { bold: true };
        worksheet.getCell(`E${rowNum}`).value = row[3];
      });
      // Fim da RESTAURAÇÃO do Resumo

      worksheet.columns = [
        { width: 12 },
        { width: 12 },
        { width: 10 },
        { width: 12 },
        { width: 12 },
        { width: 10 },
        { width: 10 },
        { width: 10 },
        { width: 10 },
        { width: 30 },
      ];
    });

    await this.workbook.xlsx.writeFile(outputPath);
    return outputPath;
  }
}
