import * as XLSX from 'xlsx';
import { dayjs } from '../lib/dayjs';

export interface ParsedEmployee {
  id: string;
  nome: string;
  departamento: string;
  presencas: { [day: string]: string[] };
}

export interface ParsedTimeRecord {
  sheetId: string;
  employeeName: string;
  department: string;
  date: Date;
  times: string[];
  clockIn1?: string;
  clockOut1?: string;
  clockIn2?: string;
  clockOut2?: string;
  clockIn3?: string;
  clockOut3?: string;
}

export interface ExcelParseResult {
  success: boolean;
  data: ParsedTimeRecord[];
  employees: ParsedEmployee[];
  errors: string[];
  warnings: string[];
  totalRecords: number;
  validRecords: number;
  startDate?: Date;
  endDate?: Date;
  month?: number;
  year?: number;
}

type SheetRow = Array<string | number | null | undefined>;

export class ExcelParser {
  private workbook: XLSX.WorkBook | null = null;
  private errors: string[] = [];
  private warnings: string[] = [];
  private currentMonth: number = dayjs().month() + 1; 
  private currentYear: number = dayjs().year();

  constructor(private buffer: Buffer) {}

  parse(): ExcelParseResult {
    try {
      this.workbook = XLSX.read(this.buffer, { 
        type: 'buffer',
        cellDates: false,
        raw: false,
        cellText: true
      });

      if (!this.workbook.SheetNames.length) {
        throw new Error('Arquivo Excel vazio ou corrompido');
      }

      const firstSheetName = this.workbook.SheetNames[0];
      const firstSheet = this.workbook.Sheets[firstSheetName];
      
      const data = XLSX.utils.sheet_to_json<SheetRow>(firstSheet, { 
        header: 1,
        defval: null,
        blankrows: true,
        raw: false
      });

      this.detectMonthYear(firstSheetName, data);
      const employees = this.processRows(data);
      const timeRecords = this.convertToTimeRecords(employees);

      // Ordenação final
      const sortedRecords = timeRecords.sort((a, b) => a.date.getTime() - b.date.getTime());
      
      return {
        success: this.errors.length === 0,
        data: sortedRecords,
        employees,
        errors: this.errors,
        warnings: this.warnings,
        totalRecords: sortedRecords.length,
        validRecords: sortedRecords.filter(r => r.times.length > 0).length,
        startDate: sortedRecords.length > 0 ? sortedRecords[0].date : undefined,
        endDate: sortedRecords.length > 0 ? sortedRecords[sortedRecords.length - 1].date : undefined,
        month: this.currentMonth,
        year: this.currentYear,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        data: [],
        employees: [],
        errors: [`Erro fatal ao processar arquivo: ${msg}`],
        warnings: this.warnings,
        totalRecords: 0,
        validRecords: 0,
      };
    }
  }

  private detectMonthYear(sheetName: string, data: SheetRow[]) {
    const sheetMatch = sheetName.match(/(\d{1,2})[-\/._\s]?(\d{4})/);
    if (sheetMatch) {
      this.currentMonth = parseInt(sheetMatch[1]);
      this.currentYear = parseInt(sheetMatch[2]);
      return;
    }

    if (data.length > 0) {
      const firstRowText = this.rowToString(data[0]);
      
      const textMonthMatch = firstRowText.match(/([a-zç]+)\s+(?:de\s+)?(\d{4})/i);
      if (textMonthMatch) {
        const monthName = textMonthMatch[1];
        const year = parseInt(textMonthMatch[2]);
        const parsedDate = dayjs(`${monthName} ${year}`, 'MMMM YYYY');
        if (parsedDate.isValid()) {
          this.currentMonth = parsedDate.month() + 1;
          this.currentYear = parsedDate.year();
          return;
        }
      }

      const numMatch = firstRowText.match(/(\d{1,2})[\/.-](\d{4})|(\d{4})[\/.-](\d{1,2})/);
      if (numMatch) {
        const parts = [numMatch[1], numMatch[2], numMatch[3], numMatch[4]].filter(Boolean).map(Number);
        if (parts.length === 2) {
           const [p1, p2] = parts;
           if (p1 > 12) { 
             this.currentYear = p1;
             this.currentMonth = p2;
           } else {
             this.currentMonth = p1;
             this.currentYear = p2;
           }
           return;
        }
      }
    }
  }

  private processRows(data: SheetRow[]): ParsedEmployee[] {
    const employees: ParsedEmployee[] = [];
    let i = 0;
    while (i < data.length) {
      const rowText = this.rowToString(data[i]);
      if (/ID\s*(?:Usu[aáà]rio|Funcion[aáà]rio|Colaborador)|\bID\b/i.test(rowText)) {
        const { employee, nextIndex } = this.extractEmployeeBlock(data, i);
        if (employee) employees.push(employee);
        i = nextIndex;
      } else {
        i++;
      }
    }
    return employees;
  }

  private extractEmployeeBlock(data: SheetRow[], startIndex: number): { employee: ParsedEmployee | null, nextIndex: number } {
    const metaInfoBlock = data.slice(startIndex, startIndex + 3).map(r => this.rowToString(r)).join(' ');
    
    const idMatch = metaInfoBlock.match(/(?:ID\s*(?:Usu[aáà]rio|Funcion[aáà]rio)?|Matr[íi]cula)[:\s]*?(\d{1,10})/i);
    if (!idMatch) return { employee: null, nextIndex: startIndex + 1 };
    
    const id = idMatch[1].trim();
    const nomeMatch = metaInfoBlock.match(/Nome[:\s]*([\wÀ-ÿ\.\- ]+?)(?=\s+(?:Dep|Setor|Cargo)|$)/i);
    const nome = nomeMatch ? nomeMatch[1].trim() : `Colaborador ${id}`;
    const depMatch = metaInfoBlock.match(/(?:Dep(?:\.|artamento)?|Setor)[:\s]*([^0-9\n]+?)(?=\s+\d|$)/i);
    const departamento = depMatch ? depMatch[1].replace(/\s*\d+\s*$/, '').trim() : 'Geral';

    const headerIdx = this.findHeaderRowIndex(data, startIndex);
    if (headerIdx === -1) {
      this.warnings.push(`ID ${id}: Cabeçalho de dias não encontrado. Pulando.`);
      return { employee: null, nextIndex: startIndex + 5 };
    }

    const dayColumnMap = this.mapDayColumns(data[headerIdx]);
    const presencas: { [day: string]: string[] } = {};
    let currentIndex = headerIdx + 1;
    let emptyRowsCount = 0;

    while (currentIndex < data.length) {
      const rowRaw = data[currentIndex];
      const rowStr = this.rowToString(rowRaw);
      
      if (/ID\s*(?:Usu[aáà]rio|Funcion[aáà]rio)/i.test(rowStr) && rowStr.length > 10) break;
      
      if (!rowStr.trim()) {
        emptyRowsCount++;
        if (emptyRowsCount > 4) break; 
        currentIndex++;
        continue;
      }
      emptyRowsCount = 0;

      for (const [colIndex, day] of Object.entries(dayColumnMap)) {
        const cellValue = rowRaw[Number(colIndex)];
        if (cellValue) {
          const timesFound = this.extractTimesFromCell(String(cellValue));
          if (timesFound.length > 0) {
             if (!presencas[day]) presencas[day] = [];
             timesFound.forEach(t => { if (!presencas[day].includes(t)) presencas[day].push(t); });
          }
        }
      }
      currentIndex++;
    }
    
    Object.keys(presencas).forEach(day => presencas[day].sort());
    return { employee: { id, nome, departamento, presencas }, nextIndex: currentIndex };
  }

  private extractTimesFromCell(cellContent: string): string[] {
    const matches = cellContent.match(/\d{1,2}:\d{2}/g);
    if (!matches) return [];
    return matches.map(m => {
      const [h, min] = m.split(':');
      return `${h.padStart(2, '0')}:${min}`;
    });
  }

  private mapDayColumns(headerRow: SheetRow): { [col: number]: string } {
    const map: { [col: number]: string } = {};
    headerRow.forEach((cell, index) => {
      if (cell && /^\d{1,2}$/.test(String(cell).trim())) {
        const num = parseInt(String(cell));
        if (num >= 1 && num <= 31) map[index] = String(num);
      }
    });
    return map;
  }

  private findHeaderRowIndex(data: SheetRow[], startFrom: number): number {
    const limit = Math.min(startFrom + 10, data.length);
    for (let i = startFrom; i < limit; i++) {
      const row = data[i];
      if (!row) continue;
      let dayNumbersCount = 0;
      for (const cell of row) {
        if (cell && /^\d{1,2}$/.test(String(cell).trim())) {
          const n = parseInt(String(cell));
          if (n >= 1 && n <= 31) dayNumbersCount++;
        }
      }
      if (dayNumbersCount >= 5) return i;
    }
    return -1;
  }
  
  private rowToString(row: SheetRow): string {
    if (!Array.isArray(row)) return '';
    return row.map(c => (c === null || c === undefined) ? '' : String(c)).join(' ');
  }

  private convertToTimeRecords(employees: ParsedEmployee[]): ParsedTimeRecord[] {
    const records: ParsedTimeRecord[] = [];

    for (const emp of employees) {
      if (Object.keys(emp.presencas).length === 0) {
        this.warnings.push(`Funcionário ${emp.id} (${emp.nome}): Sem registros processados.`);
        continue;
      }

      for (const [day, times] of Object.entries(emp.presencas)) {
        const dayNum = parseInt(day);
        
        // Day.js para construção segura da data
        const dateObj = dayjs()
          .set('year', this.currentYear)
          .set('month', this.currentMonth - 1) // Dayjs month is 0-indexed
          .set('date', dayNum)
          .startOf('day');

        if (!dateObj.isValid()) {
          this.warnings.push(`Data inválida detectada: ${day}/${this.currentMonth}/${this.currentYear}`);
          continue;
        }

        // Check se não houve "rollover" de mês (ex: 31 de Fev virando Março)
        if (dateObj.month() !== (this.currentMonth - 1)) {
            continue; 
        }

        const record: ParsedTimeRecord = {
          sheetId: emp.id,
          employeeName: emp.nome,
          department: emp.departamento,
          date: dateObj.toDate(), // Converte para Date nativo para o Prisma
          times: times,
          ...(times[0] && { clockIn1: times[0] }),
          ...(times[1] && { clockOut1: times[1] }),
          ...(times[2] && { clockIn2: times[2] }),
          ...(times[3] && { clockOut2: times[3] }),
          ...(times[4] && { clockIn3: times[4] }),
          ...(times[5] && { clockOut3: times[5] }),
        };
        records.push(record);
      }
    }

    return records;
  }
  
  static validateStructure(buffer: Buffer): { valid: boolean; message?: string; warnings?: string[] } {
    const parser = new ExcelParser(buffer);
    const result = parser.parse();
    
    if (!result.success && result.errors.length > 0) {
        return { valid: false, message: result.errors.join(', ') };
    }
    if (result.employees.length === 0) {
        return { valid: false, message: 'Nenhum funcionário identificado no arquivo.' };
    }
    return { valid: true, warnings: result.warnings };
  }
}