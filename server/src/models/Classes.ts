import { Class } from './Class';
import { Student } from './Student';
import { DomainError } from './DomainError';

/** The registered classes, with at most one class per id (topic, year, semester). */

export interface ComparisonChartResult {
  metrics: {
    [metricName: string]: {
      [classId: string]: number | 'N/A';
    };
  };
  warnings: string[];
}

export class Classes {
  private classes: Class[] = [];

  constructor() {
    // Classes management is independent of persistence
  }

  // Add a new class
  addClass(classObj: Class): Class {
    // Check if class already exists (same topic, year, semester)
    if (this.findClassById(classObj.getClassId())) {
      throw new DomainError('Class with same topic, year, and semester already exists');
    }

    this.classes.push(classObj);
    return classObj;
  }

  // Remove class by ID
  removeClass(classId: string): boolean {
    const index = this.classes.findIndex(c => c.getClassId() === classId);
    
    if (index === -1) {
      return false;
    }

    this.classes.splice(index, 1);
    return true;
  }

  // Update class
  updateClass(updatedClass: Class): Class {
    const existingClass = this.findClassById(updatedClass.getClassId());
    
    if (!existingClass) {
      throw new DomainError('Class not found');
    }

    // Update basic fields of the existing class object
    existingClass.setTopic(updatedClass.getTopic());
    existingClass.setSemester(updatedClass.getSemester());
    existingClass.setYear(updatedClass.getYear());
    
    // Update enrollments: merge existing with updated enrollments
    const updatedEnrollments = updatedClass.getEnrollments();
    const existingEnrollments = existingClass.getEnrollments();
    
    // Process each updated enrollment
    updatedEnrollments.forEach(updatedEnrollment => {
      const studentCPF = updatedEnrollment.getStudent().getCPF();
      const existingEnrollment = existingClass.findEnrollmentByStudentCPF(studentCPF);
      
      if (existingEnrollment) {
        // Update existing enrollment's evaluations
        const updatedEvaluations = updatedEnrollment.getEvaluations();
        updatedEvaluations.forEach(evaluation => {
          existingEnrollment.addOrUpdateEvaluation(evaluation.getGoal(), evaluation.getGrade());
        });
      } else {
        // Add new enrollment that doesn't exist yet
        try {
          existingClass.addEnrollment(updatedEnrollment.getStudent());
          const newEnrollment = existingClass.findEnrollmentByStudentCPF(studentCPF);
          if (newEnrollment) {
            // Copy over evaluations from updated enrollment
            const updatedEvaluations = updatedEnrollment.getEvaluations();
            updatedEvaluations.forEach(evaluation => {
              newEnrollment.addOrUpdateEvaluation(evaluation.getGoal(), evaluation.getGrade());
            });
          }
        } catch (error) {
          // Enrollment already exists, this shouldn't happen but handle gracefully
          console.warn(`Could not add enrollment for student ${studentCPF}: ${error}`);
        }
      }
    });
    
    return existingClass;
  }

  /**
   * Changes the topic, semester and year (and therefore the id) of a
   * registered class, keeping class ids unique.
   */
  updateClassIdentification(classId: string, topic: string, semester: number, year: number): Class {
    const existingClass = this.findClassById(classId);
    if (!existingClass) {
      throw new DomainError('Class not found');
    }
    const newId = new Class(topic, semester, year, existingClass.getAverageCalculationSpecification()).getClassId();
    const conflictingClass = this.findClassById(newId);
    if (conflictingClass && conflictingClass !== existingClass) {
      throw new DomainError('Class with same topic, year, and semester already exists');
    }
    existingClass.setTopic(topic);
    existingClass.setSemester(semester);
    existingClass.setYear(year);
    return existingClass;
  }

  // Find class by ID
  findClassById(classId: string): Class | undefined {
    return this.classes.find(c => c.getClassId() === classId);
  }

  // Get all classes
  getAllClasses(): Class[] {
    return [...this.classes]; // Return a copy to prevent external modification
  }

  // Get classes count
  getCount(): number {
    return this.classes.length;
  }

  // Find classes by year
  findClassesByYear(year: number): Class[] {
    return this.classes.filter(c => c.getYear() === year);
  }

  // Find classes by topic
  findClassesByTopic(topic: string): Class[] {
    return this.classes.filter(c => c.getTopic().toLowerCase().includes(topic.toLowerCase()));
  }

  // Get all students enrolled in any class
  getAllEnrolledStudents(): Student[] {
    const students: Student[] = [];
    const seenCPFs = new Set<string>();

    this.classes.forEach(classObj => {
      classObj.getEnrolledStudents().forEach(student => {
        if (!seenCPFs.has(student.getCPF())) {
          seenCPFs.add(student.getCPF());
          students.push(student);
        }
      });
    });

    return students;
  }

  // Generate comparison chart for a given metric across all classes
  generateChart(classIds: string[], metrics: string[]): ComparisonChartResult {
    
    // Find the classes by their IDs
    const selectedClasses = classIds.map((id) => {
      const cls = this.findClassById(id);
      if (!cls) throw new DomainError(`Turma ${id} não encontrada`);
      return cls;
    });

    // Check if all selected classes have the same topic
    const distinctTopics = new Set(selectedClasses.map((c) => c.getTopic()));
    if (distinctTopics.size > 1) {
      throw new DomainError('Só é permitida a comparação entre turmas de uma única disciplina');
    }

    // Prepare the result structure
    const result: ComparisonChartResult = { metrics: {}, warnings: [] };

    for (const metric of metrics) {
      result.metrics[metric] = {};
      for (const cls of selectedClasses) {
        try {
          const value = cls.generateComparisonChart(metric);
          result.metrics[metric][cls.getClassId()] = value;

          if (value === 'N/A' && !result.warnings.includes(cls.getClassId())) {
            result.warnings.push(`A turma "${cls.getClassId()}" não possui dados cadastradas`);
          }
        } catch (err) {
          // If an error occurs while calculating the metric for a class, we log the error and set the value to 'N/A'
          selectedClasses.forEach((c) => (result.metrics[metric][c.getClassId()] = 'N/A'));
          throw err;
        }
      }
    }

    return result;
  }
}