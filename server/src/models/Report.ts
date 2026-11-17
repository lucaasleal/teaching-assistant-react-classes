import { Class } from './Class';
import { Enrollment } from './Enrollment';
import { EVALUATION_GOALS, Grade } from './Evaluation';

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

export interface IReportGenerator {
  generate(): ReportData;
}

/**
 * Statistics report of a class. Placeholder: only the class identification
 * is filled in; the statistics are not implemented yet.
 */
export class Report implements IReportGenerator {
  private classObj: Class;

  constructor(classObj: Class) {
    this.classObj = classObj;
  }

  /**
   * Generates the full class report.
   * @returns ReportData object compliant with the interface.
   */
  public generate(): ReportData {
    // Not implemented yet.

    return {
      classId: this.classObj.getClassId(),
      topic: this.classObj.getTopic(),
      semester: this.classObj.getSemester(),
      year: this.classObj.getYear(),
      totalEnrolled: 0, 
      studentsAverage: 0,
      approvedCount: 0,
      inFinalCount: 0,
      approvedFinalCount: 0,
      notApprovedCount: 0,
      evaluationPerformance: this.calculateEvaluationPerformance(),
      students: this.getStudentReports(),
      generatedAt: new Date()
    };
  }

  
  private calculateStudentAverage(enrollment: Enrollment): number {
    // Not implemented yet.
    return 0; 
  }

  private calculateClassAverage(): number {
    // Not implemented yet.
    return 0;
  }

  private isStudentApproved(enrollment: Enrollment): boolean {
    // Not implemented yet.
    return false;
  }

  private calculateApprovalStats(): { approved: number; inFinalCount: number; approvedFinal: number; notApproved: number } {
    // Not implemented yet.
    return { approved: 0, inFinalCount: 0, approvedFinal: 0, notApproved: 0 };
  }

  private calculateEvaluationPerformance(): EvaluationPerformance[] {
    // Not implemented yet: one entry per goal, with every statistic zeroed.
    return EVALUATION_GOALS.map(goal => ({
      goal,
      averageGrade: 0,
      gradeDistribution: { MANA: 0, MPA: 0, MA: 0 },
      evaluatedStudents: 0
    }));
  }

  private getStudentReports(): StudentEntry[] {
    // Not implemented yet: lists the enrolled students with placeholder grade and status.
    return this.classObj.getEnrollments().map((enrollment): StudentEntry => ({
      studentId: enrollment.getStudent().getCPF(),
      name: enrollment.getStudent().getName(),
      finalGrade: 0,
      status: 'FAILED'
    }));
  }

  public toJSON(): ReportData {
    return this.generate();
  }
}