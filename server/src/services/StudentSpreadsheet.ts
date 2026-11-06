import ExcelJS from 'exceljs';
import { parse } from 'csv-parse/sync';
import { Student } from '../models/Student';
import { DomainError } from '../models/DomainError';

type ImportErrorCode =
  | 'FORMATO_INCOMPATIVEL'
  | 'PLANILHA_VAZIA'
  | 'COLUNA_FALTANTE'
  | 'COLUNA_EXTRA'
  | 'COLUNA_INCORRETA'
  | 'DADOS_INCOMPLETOS'
  | 'DADOS_INVALIDOS';

export class StudentSpreadsheetError extends Error {
  constructor(
    readonly code: ImportErrorCode,
    readonly missingColumns: string[] = [],
    readonly row?: number
  ) {
    super(code);
    this.name = 'StudentSpreadsheetError';
  }
}

// Internal field names are English; accept the equivalent Portuguese spreadsheet headers.
type StudentField = 'name' | 'email' | 'cpf';
const REQUIRED: StudentField[] = ['name', 'email', 'cpf'];
const LABEL: Record<StudentField, string> = { name: 'Nome', email: 'Email', cpf: 'CPF' };

function normalizeHeader(header: string): StudentField | null {
  const normalized = header.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (normalized === 'nome' || normalized === 'name') return 'name';
  if (normalized === 'email' || normalized === 'e-mail') return 'email';
  if (normalized === 'cpf') return 'cpf';
  return null;
}

function validateColumns(header: string[]): Record<StudentField, number> {
  const mapped = header.map(normalizeHeader);
  const missing = REQUIRED.filter(field => !mapped.includes(field));
  const extras = mapped.filter(field => field === null).length;
  const duplicates = REQUIRED.some(field => mapped.filter(item => item === field).length > 1);

  if (duplicates || (missing.length > 0 && extras > 0)) {
    throw new StudentSpreadsheetError('COLUNA_INCORRETA', missing.map(field => LABEL[field]));
  }
  if (missing.length > 0) {
    throw new StudentSpreadsheetError('COLUNA_FALTANTE', missing.map(field => LABEL[field]));
  }
  if (extras > 0) {
    throw new StudentSpreadsheetError('COLUNA_EXTRA');
  }
  return {
    name: mapped.indexOf('name'),
    email: mapped.indexOf('email'),
    cpf: mapped.indexOf('cpf')
  };
}

function convertRows(rows: string[][]): Student[] {
  // A completely empty file is different from one with an incomplete header.
  if (rows.length === 0 || rows.every(row => row.every(value => value.trim() === ''))) {
    throw new StudentSpreadsheetError('PLANILHA_VAZIA');
  }

  const [header, ...dataRows] = rows;
  const indexes = validateColumns(header);
  const students: Student[] = [];

  dataRows.forEach((cells, index) => {
    const rowNumber = index + 2; // Header occupies row 1 in both CSV and XLSX.
    if (cells.every(value => value.trim() === '')) return;
    if (cells.length > header.length && cells.slice(header.length).some(value => value.trim() !== '')) {
      throw new StudentSpreadsheetError('COLUNA_EXTRA', [], rowNumber);
    }

    const name = (cells[indexes.name] || '').trim();
    const email = (cells[indexes.email] || '').trim();
    const cpf = (cells[indexes.cpf] || '').trim();

    if (!name || !email || !cpf) {
      throw new StudentSpreadsheetError('DADOS_INCOMPLETOS', [], rowNumber);
    }
    // Import requirements are intentionally stricter than the manual registration:
    // an imported CPF must have dots and hyphen, not just eleven digits.
    if (!/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(cpf)) {
      throw new StudentSpreadsheetError('DADOS_INVALIDOS', [], rowNumber);
    }
    try {
      students.push(new Student(name, cpf, email));
    } catch (error) {
      if (error instanceof DomainError) {
        throw new StudentSpreadsheetError('DADOS_INVALIDOS', [], rowNumber);
      }
      throw error;
    }
  });

  if (students.length === 0) throw new StudentSpreadsheetError('PLANILHA_VAZIA');
  return students;
}

/** Reads the complete file before any mutation of the StudentSet. */
export async function readStudentSpreadsheet(filename: string, buffer: Buffer): Promise<Student[]> {
  const extension = filename.toLowerCase().split('.').pop();
  if (extension !== 'csv' && extension !== 'xlsx') {
    throw new StudentSpreadsheetError('FORMATO_INCOMPATIVEL');
  }
  try {
    let rows: string[][];
    if (extension === 'csv') {
      rows = parse(buffer.toString('utf8'), {
        bom: true,
        skip_empty_lines: true,
        relax_column_count: true,
        // Accept CSV files exported with comma or semicolon separators.
        delimiter: [',', ';']
      }) as string[][];
    } else {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      const sheet = workbook.worksheets[0];
      if (!sheet) throw new StudentSpreadsheetError('PLANILHA_VAZIA');

      rows = [];
      sheet.eachRow({ includeEmpty: true }, (row, number) => {
        const cells: string[] = [];
        for (let col = 1; col <= row.cellCount; col++) {
          cells.push(row.getCell(col).text.trim());
        }
        // Preserve physical row numbers, including blank rows, for error reporting.
        while (rows.length < number - 1) rows.push([]);
        rows.push(cells);
      });
    }
    return convertRows(rows);
  } catch (error) {
    if (error instanceof StudentSpreadsheetError) throw error;
    throw new StudentSpreadsheetError('DADOS_INVALIDOS');
  }
}
