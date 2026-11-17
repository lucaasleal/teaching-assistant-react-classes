export interface EvaluationPerformance {
  goal: string;
  averageGrade: number;
  gradeDistribution: {
    MANA: number;
    MPA: number;
    MA: number;
  };
  evaluatedStudents: number;
}

export interface ReportFilter {
  type: 'ALL' | 'IN_FINAL' | 'APPROVED' | 'APPROVED_FINAL' | 'FAILED' | 'BELOW_AVERAGE' | 'BELOW_THRESHOLD';
  threshold?: number; 
}

export type StudentStatus = 'APPROVED' | 'IN_FINAL' | 'APPROVED_FINAL' | 'FAILED';

export interface StudentEntry {
  studentId: string;
  name: string;
  finalGrade: number;
  status: StudentStatus;
}

export interface ReportData {
  classId: string;
  topic: string;
  semester: number;
  year: number;
  totalEnrolled: number;
  studentsAverage: number;
  approvedCount: number;
  inFinalCount: number;
  approvedFinalCount: number;
  notApprovedCount: number;
  evaluationPerformance: EvaluationPerformance[];
  students: StudentEntry[]; 
  generatedAt: Date;
}

export const STATUS_LABELS: Record<StudentStatus, string> = {
  APPROVED: 'Approved',
  IN_FINAL: 'In Final Exam',          // final grade not computed yet
  APPROVED_FINAL: 'Approved at Final', // passed after the final exam
  FAILED: 'Not Approved',
};