import PDFDocument from 'pdfkit';
import { EmployeeMonthlyReport, MonthlyReportRow, ReportData, ReportSection } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import fs from 'fs';
import path from 'path';

export class PDFGeneratorService {
  private doc!: PDFKit.PDFDocument;
  private currentY: number = 50;
  private pageNumber: number = 1;

  async generatePDF(reportData: ReportData, outputPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        this.doc = new PDFDocument({
          size: 'A4',
          margins: { top: 50, bottom: 50, left: 50, right: 50 },
        });

        const stream = fs.createWriteStream(outputPath);
        this.doc.pipe(stream);

        this.addHeader(reportData);
        if (reportData.summary) this.addSummary(reportData.summary);

        for (const section of reportData.sections) {
          this.addSection(section);
        }

        this.addFooter(reportData);
        this.doc.end();

        stream.on('finish', () => resolve(outputPath));
        stream.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  private addHeader(reportData: ReportData) {
    this.doc.fontSize(20).font('Helvetica-Bold').text(reportData.title, 50, 50, { align: 'center' });
    this.doc.fontSize(12).font('Helvetica').text(reportData.subtitle, { align: 'center' });

    this.currentY = 120;
    this.doc.fontSize(10).text(`Gerado em: ${format(reportData.generatedAt, 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 50, this.currentY);
    this.currentY += 15;
    this.doc.text(`Por: ${reportData.generatedBy}`, 50, this.currentY);

    this.currentY += 20;
    this.doc.moveTo(50, this.currentY).lineTo(545, this.currentY).stroke();
    this.currentY += 20;
  }

  private addSummary(summary: any) {
    this.doc.fontSize(14).font('Helvetica-Bold').text('Resumo Executivo', 50, this.currentY);
    this.currentY += 20;

    const summaryItems = [
      { label: 'Total de Funcionários:', value: summary.totalEmployees },
      { label: 'Horas Trabalhadas:', value: summary.totalHoursWorked ? `${summary.totalHoursWorked.toFixed(2)}h` : '-' },
    ];

    this.doc.fontSize(10).font('Helvetica');
    summaryItems.forEach(item => {
      if (item.value !== undefined) {
         this.doc.text(`${item.label} ${item.value}`, 70, this.currentY);
         this.currentY += 15;
      }
    });
    this.currentY += 10;
  }

  private addSection(section: ReportSection) {
    if (this.currentY > 700) this.addNewPage();

    this.doc.fontSize(12).font('Helvetica-Bold').text(section.title, 50, this.currentY);
    this.currentY += 20;

    switch (section.type) {
      case 'table': this.addTable(section); break;
      case 'text': this.addText(section.data); break;
      case 'summary': this.addSummarySection(section.data); break;
    }
    this.currentY += 20;
  }

  private addTable(section: ReportSection) {
    if (!section.columns || !section.data) return;
    const tableTop = this.currentY;
    const rowHeight = 20;
    
    // Simple table rendering logic
    let xOffset = 50;
    this.doc.fontSize(9).font('Helvetica-Bold');
    section.columns.forEach(col => {
      this.doc.text(col.header, xOffset, tableTop, { width: col.width || 100, align: col.align || 'left' });
      xOffset += (col.width || 100) + 10;
    });

    this.doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke();
    this.doc.font('Helvetica');
    this.currentY = tableTop + rowHeight;

    section.data.forEach((row: any) => {
      if (this.currentY > 700) {
        this.addNewPage();
        this.currentY = 50;
      }
      xOffset = 50;
      section.columns!.forEach(col => {
        const value = this.formatValue(row[col.key], col.format);
        this.doc.text(value, xOffset, this.currentY, { width: col.width || 100, align: col.align || 'left' });
        xOffset += (col.width || 100) + 10;
      });
      this.currentY += rowHeight;
    });
  }

  private addText(text: string) {
    this.doc.fontSize(10).font('Helvetica').text(text, 50, this.currentY, { width: 495, align: 'justify' });
    this.currentY += 50;
  }

  private addSummarySection(data: any) {
    Object.entries(data).forEach(([key, value]) => {
      this.doc.fontSize(10).font('Helvetica').text(`${key}: ${value}`, 70, this.currentY);
      this.currentY += 15;
    });
  }

  private addFooter(reportData: ReportData) {
    const pageHeight = 841.89;
    this.doc.fontSize(8).font('Helvetica').text(`Página ${this.pageNumber} | ${reportData.title}`, 50, pageHeight - 30, { align: 'center', width: 495 });
  }

  private addNewPage() {
    this.doc.addPage();
    this.pageNumber++;
    this.currentY = 50;
  }

  private formatValue(value: any, type?: string): string {
    if (value === null || value === undefined) return '';
    switch (type) {
      case 'currency': return `R$ ${parseFloat(value).toFixed(2)}`;
      case 'percentage': return `${value}%`;
      case 'date': return format(new Date(value), 'dd/MM/yyyy');
      default: return String(value);
    }
  }

  async generateMonthlyReportPDF(reports: EmployeeMonthlyReport[], outputPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        this.doc = new PDFDocument({ size: 'A4', layout: 'landscape', margins: { top: 30, bottom: 30, left: 30, right: 30 } });
        const stream = fs.createWriteStream(outputPath);
        this.doc.pipe(stream);

        reports.forEach((report, index) => {
          if (index > 0) this.doc.addPage();
          this.addMonthlyReportPage(report);
        });

        this.doc.end();
        stream.on('finish', () => resolve(outputPath));
        stream.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  private addMonthlyReportPage(report: EmployeeMonthlyReport) {
    this.doc.fontSize(16).font('Helvetica-Bold').text('RELATÓRIO MENSAL DE PONTO', { align: 'center' });
    this.doc.fontSize(12).text(`${report.month.toUpperCase()} / ${report.year}`, { align: 'center' });
    
    this.currentY = 80;
    this.doc.fontSize(10).font('Helvetica');
    this.doc.text(`Funcionário: ${report.employee.name}`, 30, this.currentY);
    this.doc.text(`Matrícula: ${report.employee.sheetId}`, 300, this.currentY);
    
    this.currentY += 20;
    this.addMonthlyTable(report.rows);
  }

  private addMonthlyTable(rows: MonthlyReportRow[]) {
    const columns = [
      { header: 'Data', width: 65, key: 'date' },
      { header: 'Dia', width: 60, key: 'dayOfWeek' },
      { header: 'Entrada', width: 50, key: 'clockIn' },
      { header: 'Almoço Início', width: 70, key: 'lunchStart' },
      { header: 'Almoço Fim', width: 65, key: 'lunchEnd' },
      { header: 'Saída', width: 50, key: 'clockOut' },
      { header: 'Total', width: 50, key: 'totalWorked' },
      { header: 'H.Extra', width: 50, key: 'overtime' },
      { header: 'Atraso', width: 50, key: 'late' },
      { header: 'Observações', width: 200, key: 'observations' },
    ];

    let xPos = 30;
    this.doc.fontSize(8).font('Helvetica-Bold');
    columns.forEach(col => {
      this.doc.text(col.header, xPos, this.currentY, { width: col.width, align: 'center' });
      xPos += col.width + 5;
    });

    this.currentY += 12;
    this.doc.moveTo(30, this.currentY).lineTo(812, this.currentY).stroke();

    this.doc.font('Helvetica').fontSize(7);
    this.currentY += 5;

    rows.forEach((row) => {
      if (this.currentY > 520) {
        this.doc.addPage();
        this.currentY = 30;
      }
      xPos = 30;
      if (['Sábado', 'Domingo'].includes(row.dayOfWeek)) this.doc.fillColor('#f0f0f0');
      else if (row.observations === 'Falta') this.doc.fillColor('#ffe0e0');

      columns.forEach(col => {
        const value = row[col.key as keyof MonthlyReportRow] || '-';
        this.doc.text(value, xPos, this.currentY, { width: col.width, align: col.key === 'observations' ? 'left' : 'center' });
        xPos += col.width + 5;
      });
      
      this.doc.fillColor('black');
      this.currentY += 12;
    });
  }
}