import { Class } from './Class';
import { Classes } from './Classes';
import { Report, ReportData } from './Report';
import { DomainError } from './DomainError';

export type ComparisonMetricValue = number | 'N/A';

export type ComparisonMetricsMap = Record<string, Record<string, ComparisonMetricValue>>;

export interface ComparisonPayload {
  topic?: string;
  classIds: string[];
  metrics: string[];
}

export interface ComparisonResponse {
  topic: string;
  metrics: ComparisonMetricsMap;
  warnings: string[];
}

export class ComparisonDomainError extends DomainError {
  public readonly metrics?: ComparisonMetricsMap;

  constructor(message: string, metrics?: ComparisonMetricsMap) {
    super(message);
    this.name = 'ComparisonDomainError';
    this.metrics = metrics;
  }
}

const METRIC_EXTRACTORS: Record<string, (data: ReportData) => number> = {
  'Média': (data) => data.studentsAverage,
  'Número de alunos aprovados': (data) => data.approvedCount,
  'Número de alunos aprovados por nota': (data) => data.approvedFinalCount,
  'Número de alunos reprovados por nota': (data) => data.failedByGradeCount ?? data.notApprovedCount,
  'Número de alunos reprovados por falta': (data) => data.failedByAbsenceCount ?? 0
};

export class Comparison {
  private readonly classesRepository: Classes;

  constructor(classesRepository: Classes) {
    this.classesRepository = classesRepository;
  }

  public static isSupportedMetric(metric: string): boolean {
    return Object.prototype.hasOwnProperty.call(METRIC_EXTRACTORS, metric);
  }

  public execute(payload: ComparisonPayload): ComparisonResponse {
    const { topic, classIds, metrics } = payload;

    // Localiza as turmas solicitadas
    const selectedClasses: Class[] = classIds.map((id) => {
      const found = this.findClassByIdentifier(id, topic);
      if (!found) {
        throw new ComparisonDomainError(`Turma "${id}" não encontrada`);
      }
      return found;
    });

    // Confere se todas as turmas comparadas são da mesma disciplina
    const distinctTopics = new Set(selectedClasses.map((c) => c.getTopic()));
    if (distinctTopics.size > 1 || (topic && !distinctTopics.has(topic))) {
      throw new ComparisonDomainError(
        'Só é permitida a comparação entre turmas de uma única disciplina'
      );
    }

    const effectiveTopic = topic || selectedClasses[0].getTopic();

    // Verifica se alguma métrica não é suportada
    const hasInvalidMetric = metrics.some((m) => !Comparison.isSupportedMetric(m));
    if (hasInvalidMetric) {
      const naMetrics: ComparisonMetricsMap = {};
      for (const metric of metrics) {
        naMetrics[metric] = {};
        for (let i = 0; i < selectedClasses.length; i++) {
          naMetrics[metric][classIds[i]] = 'N/A';
        }
      }
      throw new ComparisonDomainError(
        'A métrica solicitada não é suportada pelo sistema',
        naMetrics
      );
    }

    // Gera o Report para cada turma selecionada e consolida as métricas
    const resultMetrics: ComparisonMetricsMap = {};
    const warnings: string[] = [];

    for (const metric of metrics) {
      resultMetrics[metric] = {};
    }

    selectedClasses.forEach((classObj, index) => {
      const requestedKey = classIds[index];
      const reportData = new Report(classObj).generate();

      const hasGradedStudents =
        (reportData.evaluatedStudentsCount ?? 0) > 0 ||
        (reportData.failedByAbsenceCount ?? 0) > 0;

      if (!hasGradedStudents) {
        warnings.push(`A turma "${requestedKey}" não possui dados cadastradas`);
        for (const metric of metrics) {
          resultMetrics[metric][requestedKey] = 'N/A';
        }
      } else {
        for (const metric of metrics) {
          const extractor = METRIC_EXTRACTORS[metric];
          resultMetrics[metric][requestedKey] = extractor(reportData);
        }
      }
    });

    return {
      topic: effectiveTopic,
      metrics: resultMetrics,
      warnings
    };
  }

  private findClassByIdentifier(identifier: string, topic?: string): Class | undefined {
    // Busca direta pelo ID completo ("topic-year-semester")
    const directMatch = this.classesRepository.findClassById(identifier);
    if (directMatch && (!topic || directMatch.getTopic() === topic)) {
      return directMatch;
    }

    // Busca combinando o topic com o identificador caso o teste envie um código curto (ex: "T1-25.1")
    if (topic) {
      const compositeMatch = this.classesRepository.findClassById(`${topic}-${identifier}`);
      if (compositeMatch) {
        return compositeMatch;
      }
    }

    return this.classesRepository.getAllClasses().find((c) => {
      const sameTopic = !topic || c.getTopic() === topic;
      const shortYear = String(c.getYear()).slice(-2);
      const periodSuffix = `${c.getYear()}-${c.getSemester()}`;
      const shortPeriodSuffix = `${shortYear}.${c.getSemester()}`;

      return (
        sameTopic &&
        (c.getClassId() === identifier ||
          c.getClassId().endsWith(identifier) ||
          identifier.endsWith(periodSuffix) ||
          identifier.endsWith(shortPeriodSuffix))
      );
    });
  }
}