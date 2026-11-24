import { Student, CreateStudentRequest, UpdateStudentRequest } from '../types/Student';
import { API_BASE_URL, get, remove, sendJson } from './apiClient';

const STUDENTS = '/api/students';
const studentPath = (cpf: string) => `${STUDENTS}/${encodeURIComponent(cpf)}`;

export interface StudentImportResult {
  imported: number;
  duplicated: number;
  enrolled: number;
  message: string;
}

/** Access to the students kept by the server. */
export const studentService = {
  getAllStudents: (): Promise<Student[]> =>
    get(STUDENTS, 'Failed to fetch students'),
  getStudentByCPF: (cpf: string): Promise<Student> =>
    get(studentPath(cpf), 'Failed to fetch student'),

  createStudent: (student: CreateStudentRequest): Promise<Student> =>
    sendJson('POST', STUDENTS, student, 'Failed to create student'),

  /** Updates name and email; the CPF identifies the student and cannot change. */
  updateStudent: (cpf: string, updates: UpdateStudentRequest): Promise<Student> =>
    sendJson('PUT', studentPath(cpf), updates, 'Failed to update student'),
  deleteStudent: (cpf: string): Promise<void> =>
    remove(studentPath(cpf), 'Failed to delete student'),

  /** Uploads the original file so the server validates all rows before saving. */
  importStudents: async (file: File, classId?: string): Promise<StudentImportResult> => {
    const body = new FormData();
    body.append('file', file);
    if (classId) body.append('classId', classId);
    const response = await fetch(`${API_BASE_URL}${STUDENTS}/import`, {
      method: 'POST',
      body // Browser sets multipart/form-data boundary automatically.
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      if (result.error === 'COLUNA_FALTANTE' && Array.isArray(result.missingColumns)) {
        throw new Error(`Coluna esperada: ${result.missingColumns.join(', ')}`);
      }
      throw new Error(typeof result.error === 'string' ? result.error : 'Falha ao importar planilha');
    }
    return response.json();
  },

  /**
   * @deprecated the server no longer offers PUT /api/students/:cpf/evaluation;
   * evaluations belong to enrollments (see enrollmentService.updateEvaluation).
   */
  updateEvaluation: (cpf: string, goal: string, grade: string): Promise<Student> =>
    sendJson('PUT', `${studentPath(cpf)}/evaluation`, { goal, grade }, 'Failed to update evaluation')
};
