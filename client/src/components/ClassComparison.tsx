import React, { useState, useMemo } from 'react';
import { Class } from '../types/Class';
import { classService, ComparisonApiResponse } from '../services/ClassService';

interface ClassComparisonProps {
  classes: Class[];
  onError: (errorMessage: string) => void;
}

const AVAILABLE_METRICS = [
  'Média',
  'Número de alunos aprovados',
  'Número de alunos aprovados por nota',
  'Número de alunos reprovados por nota',
  'Número de alunos reprovados por falta'
];

// Formats class display label
const formatClassLabel = (classObj: Class): string =>
  `${classObj.year}/${classObj.semester}`;

// Section inside Classes tab to compare performance metrics across 2+ classes of the same topic
const ClassComparison: React.FC<ClassComparisonProps> = ({ classes, onError }) => {
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [selectedClassIds, setSelectedClassIds] = useState<Set<string>>(new Set());
  const [selectedMetrics, setSelectedMetrics] = useState<Set<string>>(new Set());
  const [comparisonResult, setComparisonResult] = useState<ComparisonApiResponse | null>(null);
  const [localError, setLocalError] = useState<string>('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Extract unique sorted topics
  const availableTopics = useMemo(() => {
    const topicsSet = new Set(classes.map((c) => c.topic));
    return Array.from(topicsSet).sort();
  }, [classes]);

  // Filter classes belonging to the selected topic
  const classesForTopic = useMemo(() => {
    if (!selectedTopic) return [];
    return classes.filter((c) => c.topic === selectedTopic);
  }, [classes, selectedTopic]);

  // Scenario: Selecting a different topic clears previous topic selection and selected classes
  const handleTopicChange = (newTopic: string) => {
    setSelectedTopic(newTopic);
    setSelectedClassIds(new Set());
    setComparisonResult(null);
    setLocalError('');
    setWarnings([]);
    onError('');
  };

  // Scenario: Clicking an already selected class removes its selection
  const handleClassToggle = (classId: string) => {
    if (!selectedTopic) return;

    setSelectedClassIds((prev) => {
      const updated = new Set(prev);
      if (updated.has(classId)) {
        updated.delete(classId);
      } else {
        updated.add(classId);
      }
      return updated;
    });
    setLocalError('');
  };

  // Scenario: Clicking an already selected metric removes its selection
  const handleMetricToggle = (metric: string) => {
    setSelectedMetrics((prev) => {
      const updated = new Set(prev);
      if (updated.has(metric)) {
        updated.delete(metric);
      } else {
        updated.add(metric);
      }
      return updated;
    });
    setLocalError('');
  };

  const reportValidationError = (message: string) => {
    setLocalError(message);
    setComparisonResult(null);
    onError(message);
  };

  const handleGenerateChart = async (e: React.FormEvent) => {
    e.preventDefault();
    setWarnings([]);

    // No topic selected case
    if (!selectedTopic) {
      reportValidationError('Selecione uma disciplina para realizar a comparação.');
      return;
    }

    // Fewer than 2 classes selected case
    if (selectedClassIds.size < 2) {
      reportValidationError('Selecione ao menos 2 turmas para gerar o gráfico de desempenho.');
      return;
    }

    // No metric selected case
    if (selectedMetrics.size === 0) {
      reportValidationError('Selecione ao menos 1 métrica de comparação.');
      return;
    }

    setLocalError('');
    onError('');
    setIsLoading(true);

    try {
      const apiResult = await classService.compareClasses({
        topic: selectedTopic,
        classIds: Array.from(selectedClassIds),
        metrics: Array.from(selectedMetrics)
      });

      setWarnings(apiResult.warnings || []);

      // Check how many classes actually have numeric data (not 'N/A')
      const firstMetricName = Array.from(selectedMetrics)[0];
      const firstMetricValues = apiResult.metrics[firstMetricName] || {};
      const validClassIds = Object.keys(firstMetricValues).filter(
        (id) => firstMetricValues[id] !== 'N/A'
      );

      // Scenario: If fewer than 2 classes have valid data, do not display the chart
      if (validClassIds.length < 2) {
        setComparisonResult(null);
        return;
      }

      setComparisonResult(apiResult);
    } catch (error) {
      reportValidationError((error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="class-form-container comparison-section"
      data-cy="performance-comparison-section"
    >
      <h3>Comparação de Desempenho</h3>

      <form onSubmit={handleGenerateChart} className="class-form">
        {/* 1. Seleção de Disciplina */}
        <div className="form-group">
          <label htmlFor="comparison-topic-select">Disciplina:</label>
          <select
            id="comparison-topic-select"
            data-cy="topic-select"
            value={selectedTopic}
            onChange={(e) => handleTopicChange(e.target.value)}
            className="class-selector"
          >
            <option value="">-- Selecione uma disciplina --</option>
            {availableTopics.map((topic) => (
              <option key={topic} value={topic}>
                {topic}
              </option>
            ))}
          </select>
        </div>

        {/* 2. Seleção de Turmas */}
        <div className="form-group">
          <label>Turmas (selecione 2 ou mais):</label>
          {!selectedTopic ? (
            <p className="no-enrollments" data-cy="classes-disabled-hint">
              Selecione uma disciplina acima para habilitar a seleção de turmas.
            </p>
          ) : classesForTopic.length === 0 ? (
            <p className="no-enrollments">Nenhuma turma cadastrada para esta disciplina.</p>
          ) : (
            <div className="students-grid">
              {classesForTopic.map((classObj) => {
                const isSelected = selectedClassIds.has(classObj.id);
                return (
                  <div
                    key={classObj.id}
                    role="checkbox"
                    aria-checked={isSelected}
                    data-cy={`class-option-${classObj.id}`}
                    className={`student-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleClassToggle(classObj.id)}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleClassToggle(classObj.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="student-info">
                      <div className="student-name">{formatClassLabel(classObj)}</div>
                      <div className="student-cpf">{classObj.id}</div>
                      <div className="student-email">
                        {classObj.enrollments.length} aluno(s)
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. Seleção de Métricas */}
        <div className="form-group">
          <label>Métricas de Comparação:</label>
          <div className="students-grid">
            {AVAILABLE_METRICS.map((metric) => {
              const isSelected = selectedMetrics.has(metric);
              return (
                <div
                  key={metric}
                  role="checkbox"
                  aria-checked={isSelected}
                  data-cy={`metric-option-${metric}`}
                  className={`student-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleMetricToggle(metric)}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleMetricToggle(metric)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="student-info">
                    <div className="student-name">{metric}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Botão de Ação */}
        <div className="form-buttons">
          <button
            type="submit"
            disabled={isLoading}
            className="submit-btn"
            data-cy="generate-comparison-btn"
          >
            {isLoading ? 'Gerando Gráfico...' : 'Gerar Gráfico de Desempenho'}
          </button>
        </div>
      </form>

      {/* Mensagens de Erro e Aviso */}
      {localError && (
        <div className="error-message" data-cy="comparison-error-alert" style={{ marginTop: '1rem' }}>
          {localError}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="comparison-warning" data-cy="comparison-warning-alert">
          {warnings.map((warning, idx) => (
            <div key={idx}>{warning}</div>
          ))}
        </div>
      )}

      {/* 4. Gráficos de Colunas (um para cada métrica selecionada) */}
      {comparisonResult && (
        <div className="comparison-charts-container">
          {Object.entries(comparisonResult.metrics).map(([metricTitle, classValuesMap]) => {
            const validEntries = Object.entries(classValuesMap).filter(
              (entry): entry is [string, number] => typeof entry[1] === 'number'
            );

            const maxValue = Math.max(...validEntries.map(([, val]) => val), 1);

            return (
              <div
                key={metricTitle}
                className="comparison-chart-card"
                data-cy={`comparison-chart-${metricTitle}`}
              >
                <h4 data-cy={`comparison-chart-title-${metricTitle}`}>{metricTitle}</h4>

                <div className="chart-bars-area">
                  {validEntries.map(([classId, numericValue]) => {
                    const heightPercent = Math.max((numericValue / maxValue) * 100, 4);
                    return (
                      <div key={classId} className="chart-bar-column">
                        <span className="chart-bar-value">{numericValue}</span>
                        <div
                          className="chart-bar-fill"
                          data-cy={`chart-bar-${classId}`}
                          data-value={String(numericValue)}
                          style={{ height: `${heightPercent}%` }}
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="chart-x-axis" data-cy="chart-x-axis">
                  {validEntries.map(([classId]) => (
                    <div key={classId} className="chart-x-label">
                      {classId}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ClassComparison;