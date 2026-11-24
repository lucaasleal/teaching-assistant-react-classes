import { Classes } from '../models/Classes';
import { Class } from '../models/Class';
import { Student } from '../models/Student';
import { DEFAULT_AVERAGE_CALCULATION_SPECIFICATION } from '../models/AverageCalculationSpecification';
import { Comparison, ComparisonDomainError } from '../models/Comparison';
import { Report } from '../models/Report';

describe('Integração entre Comparison.ts e Report.ts', () => {
  let classesRepo: Classes;
  let comparisonService: Comparison;

  beforeEach(() => {
    // Garante independência entre os testes (Fresh instance - Boa prática dos slides)
    classesRepo = new Classes();
    comparisonService = new Comparison(classesRepo);

    const student1 = new Student('Alice Silva', '111.222.333-44', 'alice@cin.ufpe.br');
    const student2 = new Student('Bruno Costa', '222.333.444-55', 'bruno@cin.ufpe.br');
    const student3 = new Student('Carlos Souza', '333.444.555-66', 'carlos@cin.ufpe.br');

    // Turma 1: Sistemas Operacionais 2025.1
    const class1 = new Class(
      'Sistemas Operacionais',
      1,
      2025,
      DEFAULT_AVERAGE_CALCULATION_SPECIFICATION
    );
    const enroll1A = class1.addEnrollment(student1);
    enroll1A.setAverageBeforeFinalExam(8.0);
    const enroll1B = class1.addEnrollment(student2);
    enroll1B.setAverageBeforeFinalExam(9.0);

    // Turma 2: Sistemas Operacionais 2025.2
    const class2 = new Class(
      'Sistemas Operacionais',
      2,
      2025,
      DEFAULT_AVERAGE_CALCULATION_SPECIFICATION
    );
    const enroll2A = class2.addEnrollment(student1);
    enroll2A.setAverageBeforeFinalExam(9.5);
    const enroll2B = class2.addEnrollment(student2);
    enroll2B.setAverageBeforeFinalExam(8.9);
    const enroll2C = class2.addEnrollment(student3);
    enroll2C.setAverageBeforeFinalExam(4.0); // Reprovado por nota

    classesRepo.addClass(class1);
    classesRepo.addClass(class2);
  });

  it('deve integrar Comparison.ts com Report.ts para consolidar múltiplas métricas entre turmas', () => {
    const classId1 = 'Sistemas Operacionais-2025-1';
    const classId2 = 'Sistemas Operacionais-2025-2';

    // Verifica que Report.ts calcula os dados individuais corretamente
    const report1 = new Report(classesRepo.findClassById(classId1)!).generate();
    const report2 = new Report(classesRepo.findClassById(classId2)!).generate();
    expect(report1.studentsAverage).toBe(8.5);
    expect(report2.studentsAverage).toBe(7.47);

    // Executa o Comparison.ts que consome Report.ts internamente sem stubs
    const result = comparisonService.execute({
      topic: 'Sistemas Operacionais',
      classIds: [classId1, classId2],
      metrics: ['Média', 'Número de alunos aprovados por nota', 'Número de alunos reprovados por nota']
    });

    // Pós-condição fortalecida (Strengthening the post-condition)
    expect(result.topic).toBe('Sistemas Operacionais');
    expect(result.warnings).toHaveLength(0);
    expect(result.metrics['Média'][classId1]).toBe(8.5);
    expect(result.metrics['Média'][classId2]).toBe(7.47);
    expect(result.metrics['Número de alunos aprovados por nota'][classId1]).toBe(2);
    expect(result.metrics['Número de alunos aprovados por nota'][classId2]).toBe(2);
    expect(result.metrics['Número de alunos reprovados por nota'][classId1]).toBe(0);
    expect(result.metrics['Número de alunos reprovados por nota'][classId2]).toBe(1);
  });

  it('deve retornar N/A e aviso quando Report.ts identificar turma sem alunos avaliados', () => {
    const emptyClass = new Class(
      'Sistemas Operacionais',
      1,
      2026,
      DEFAULT_AVERAGE_CALCULATION_SPECIFICATION
    );
    classesRepo.addClass(emptyClass);

    const result = comparisonService.execute({
      topic: 'Sistemas Operacionais',
      classIds: ['Sistemas Operacionais-2025-1', 'Sistemas Operacionais-2026-1'],
      metrics: ['Média']
    });

    expect(result.metrics['Média']['Sistemas Operacionais-2025-1']).toBe(8.5);
    expect(result.metrics['Média']['Sistemas Operacionais-2026-1']).toBe('N/A');
    expect(result.warnings).toContain(
      'A turma "Sistemas Operacionais-2026-1" não possui dados cadastradas'
    );
  });

  it('deve impedir comparação entre disciplinas diferentes lançando ComparisonDomainError', () => {
    const otherTopicClass = new Class(
      'Banco de Dados',
      1,
      2025,
      DEFAULT_AVERAGE_CALCULATION_SPECIFICATION
    );
    classesRepo.addClass(otherTopicClass);

    expect(() =>
      comparisonService.execute({
        classIds: ['Sistemas Operacionais-2025-1', 'Banco de Dados-2025-1'],
        metrics: ['Média']
      })
    ).toThrow(ComparisonDomainError);
  });
});