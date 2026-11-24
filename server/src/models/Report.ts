import { Class } from './Class';
import { Enrollment } from './Enrollment';
import { Grade } from './Evaluation';

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
  failedByGradeCount?: number;
  failedByAbsenceCount?: number;
  evaluatedStudentsCount?: number;
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
    const enrollments = this.classObj.getEnrollments();
    const approvalStats = this.calculateApprovalStats();
    const failureBreakdown = this.calculateFailureBreakdown();

    return {
      classId: this.classObj.getClassId(),
      topic: this.classObj.getTopic(),
      semester: this.classObj.getSemester(),
      year: this.classObj.getYear(),
      totalEnrolled: enrollments.length,
      studentsAverage: this.calculateClassAverage(),
      approvedCount: approvalStats.approved,
      inFinalCount: approvalStats.inFinal,
      approvedFinalCount: approvalStats.approvedFinal,
      notApprovedCount: approvalStats.notApproved,
      evaluationPerformance: this.calculateEvaluationPerformance(),
      students: this.getStudentReports(),
      generatedAt: new Date(),
      failedByGradeCount: failureBreakdown.failedByGrade,
      failedByAbsenceCount: failureBreakdown.failedByAbsence,
      evaluatedStudentsCount: this.getEvaluatedEnrollments().length
    };
  }

  private calculateStudentAverage(enrollment: Enrollment): number {
    const avgAfterFinal = enrollment.getAverageAfterFinalExam();
    if (avgAfterFinal !== null) {
      return this.round(avgAfterFinal);
    }

    const avgBeforeFinal = enrollment.getAverageBeforeFinalExam();
    if (avgBeforeFinal !== null) {
      return this.round(avgBeforeFinal);
    }

    const evaluations = enrollment.getEvaluations();
    if (evaluations.length === 0) {
      return 0;
    }

    const gradesByGoal = new Map<string, Grade>();
    for (const evaluation of evaluations) {
      gradesByGoal.set(evaluation.getGoal(), evaluation.getGrade());
    }

    const spec = this.classObj.getAverageCalculationSpecification();
    return this.round(spec.calculateAverage(gradesByGoal));
  }

  private calculateClassAverage(): number {
    const evaluated = this.getEvaluatedEnrollments();
    if (evaluated.length === 0) {
      return 0;
    }

    const total = evaluated.reduce(
      (sum, enrollment) => sum + this.calculateStudentAverage(enrollment),
      0
    );
    return this.round(total / evaluated.length);
  }

  private isStudentApproved(enrollment: Enrollment): boolean {
    const status = this.resolveStudentStatus(enrollment);
    return status === 'APPROVED' || status === 'APPROVED_FINAL';
  }

  private calculateApprovalStats(): { approved: number; inFinal: number; approvedFinal: number; notApproved: number } {
    let approved = 0;
    let inFinal = 0;
    let approvedFinal = 0;
    let notApproved = 0;

    for (const enrollment of this.classObj.getEnrollments()) {
      if (!this.hasEvaluations(enrollment) && !enrollment.getFailedByAbsence()) {
        continue;
      }

      const status = this.resolveStudentStatus(enrollment);
      if (status === 'APPROVED') {
        approved++;
      } else if (status === 'APPROVED_FINAL') {
        approvedFinal++;
      } else if (status === 'IN_FINAL') {
        inFinal++;
      } else {
        notApproved++;
      }
    }

    return { approved, inFinal, approvedFinal, notApproved };
  }

  private calculateEvaluationPerformance(): EvaluationPerformance[] {
    const enrollments = this.classObj.getEnrollments();
    const goalsMap = new Map<
      string,
      { grades: number[]; distribution: { MANA: number; MPA: number; MA: number } }
    >();

    for (const enrollment of enrollments) {
      for (const evaluation of enrollment.getEvaluations()) {
        const goal = evaluation.getGoal();
        const grade = evaluation.getGrade();

        if (!goalsMap.has(goal)) {
          goalsMap.set(goal, {
            grades: [],
            distribution: { MANA: 0, MPA: 0, MA: 0 }
          });
        }

        const entry = goalsMap.get(goal)!;
        entry.grades.push(this.gradeToPoints(grade));
        entry.distribution[grade]++;
      }
    }

    const result: EvaluationPerformance[] = [];
    goalsMap.forEach((data, goal) => {
      const evaluatedStudents = data.grades.length;
      const sum = data.grades.reduce((acc, g) => acc + g, 0);
      const averageGrade = evaluatedStudents > 0 ? this.round(sum / evaluatedStudents) : 0;

      result.push({
        goal,
        averageGrade,
        gradeDistribution: data.distribution,
        evaluatedStudents
      });
    });

    return result;
  }

  private getStudentReports(): StudentEntry[] {
    return this.classObj.getEnrollments().map((enrollment) => {
      const student = enrollment.getStudent();
      return {
        studentId: student.getCPF(),
        name: student.getName(),
        finalGrade: this.calculateStudentAverage(enrollment),
        status: this.resolveStudentStatus(enrollment)
      };
    });
  }

  public toJSON(): ReportData {
    return this.generate();
  }

  // ===================
  // MÉTODOS AUXILIARES
  // ===================

  private getEvaluatedEnrollments(): Enrollment[] {
    return this.classObj
      .getEnrollments()
      .filter((enrollment) => this.hasEvaluations(enrollment));
  }

  private hasEvaluations(enrollment: Enrollment): boolean {
    return (
      enrollment.getEvaluations().length > 0 ||
      enrollment.getAverageBeforeFinalExam() !== null ||
      enrollment.getAverageAfterFinalExam() !== null
    );
  }

  private resolveStudentStatus(enrollment: Enrollment): StudentStatus {
    if (enrollment.getFailedByAbsence()) {
      return 'FAILED';
    }

    const avgBeforeFinal =
      enrollment.getAverageBeforeFinalExam() ?? this.calculatePreFinalAverage(enrollment);

    if (avgBeforeFinal >= 7.0) {
      return 'APPROVED';
    }

    const avgAfterFinal = enrollment.getAverageAfterFinalExam();
    if (avgBeforeFinal >= 3.0 && avgAfterFinal !== null && avgAfterFinal >= 5.0) {
      return 'APPROVED_FINAL';
    }
    
    if (avgBeforeFinal >= 3.0 && avgAfterFinal === null) {
      return 'IN_FINAL';
    }

    return 'FAILED';
  }

  private calculatePreFinalAverage(enrollment: Enrollment): number {
    const evaluations = enrollment.getEvaluations();
    if (evaluations.length === 0) {
      return 0;
    }

    const gradesByGoal = new Map<string, Grade>();
    for (const evaluation of evaluations) {
      gradesByGoal.set(evaluation.getGoal(), evaluation.getGrade());
    }

    return this.round(
      this.classObj.getAverageCalculationSpecification().calculateAverage(gradesByGoal)
    );
  }

  private calculateFailureBreakdown(): { failedByGrade: number; failedByAbsence: number } {
    let failedByGrade = 0;
    let failedByAbsence = 0;

    for (const enrollment of this.classObj.getEnrollments()) {
      if (enrollment.getFailedByAbsence()) {
        failedByAbsence++;
      } else if (this.hasEvaluations(enrollment) && !this.isStudentApproved(enrollment)) {
        failedByGrade++;
      }
    }

    return { failedByGrade, failedByAbsence };
  }

  private gradeToPoints(grade: Grade): number {
    if (grade === 'MA') return 10;
    if (grade === 'MPA') return 7;
    return 0; // 'MANA'
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}