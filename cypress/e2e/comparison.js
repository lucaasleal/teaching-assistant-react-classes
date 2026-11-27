import { Before, After, Given, When, Then } from '@badeball/cypress-cucumber-preprocessor';

const API_BASE = 'http://localhost:3005/api';
const CLASSES_URL = `${API_BASE}/classes`;
const STUDENTS_URL = `${API_BASE}/students`;
const COMPARISON_URL = `${CLASSES_URL}/comparison`;

const EVALUATION_GOALS = [
  'Requirements',
  'Configuration Management',
  'Project Management',
  'Design',
  'Tests',
  'Refactoring'
];

// Alunos exclusivos para os testes de serviço (removidos no After)
const API_TEST_STUDENTS = [
  { name: 'Aluno Comparacao Um', cpf: '999.000.000-01', email: 'comp1@cin.ufpe.br' },
  { name: 'Aluno Comparacao Dois', cpf: '999.000.000-02', email: 'comp2@cin.ufpe.br' }
];

// --- Estado compartilhado ---
// GUI
let seededClasses = [];
let seededMetricsByClass = {};
let classesWithoutData = new Set();
let currentTopic = '';
let needsSync = false;

// Serviço (API real)
let apiCurrentTopic = '';
let apiCreatedClassIds = [];
let apiLastResponse = null;
let apiLastRequestedMetric = '';
let apiClassesSnapshotBefore = null;

// --- Funções auxiliares ---

const parsePeriod = (periodLabel) => {
  const [yearStr, semesterStr] = periodLabel.split('/');
  return {
    year: Number(yearStr),
    semester: Number(semesterStr)
  };
};

const buildClassId = (topic, periodLabel) => {
  const { year, semester } = parsePeriod(periodLabel);
  return `${topic}-${year}-${semester}`;
};

// --- Auxiliares de GUI ---

const addSeededClass = (topic, periodLabel, isPlaceholder = false) => {
  const { year, semester } = parsePeriod(periodLabel);
  const id = `${topic}-${year}-${semester}`;

  if (!isPlaceholder) {
    seededClasses = seededClasses.filter(
      (c) => !(c.topic === topic && c.__placeholder)
    );
  }

  if (!seededClasses.some((c) => c.id === id)) {
    seededClasses.push({
      id,
      topic,
      year,
      semester,
      averageCalculationSpecification: { gradeWeights: {}, goalWeights: {} },
      enrollments: [],
      __placeholder: isPlaceholder
    });
  }

  needsSync = true;
  return id;
};

const openComparisonSection = (
  sectionTitle = 'Comparação de Desempenho',
  tabName = 'Classes'
) => {
  const tabTestId = `${tabName.toLowerCase()}-tab`;
  cy.visit('/');
  cy.wait('@getClasses');
  cy.get(`[data-testid="${tabTestId}"]`).click();
  cy.get('[data-cy="performance-comparison-section"]')
    .should('be.visible')
    .and('contain.text', sectionTitle);
  needsSync = false;
};

const ensureSeededClassesLoaded = () => {
  if (needsSync) {
    openComparisonSection();
  }
};

const clickOptionByTestId = (group, value) => {
  cy.get(`[data-cy="${group}-option-${value}"]`).click();
};

// --- Auxiliares de Serviço (API real) ---

// 3 MA + 3 MPA = (30 + 21) / 6 = 8.5 | 4 MA + 2 MPA = (40 + 14) / 6 = 9.0
const GRADES_FOR_8_5 = ['MA', 'MA', 'MA', 'MPA', 'MPA', 'MPA'];
const GRADES_FOR_9_0 = ['MA', 'MA', 'MA', 'MA', 'MPA', 'MPA'];

const ensureApiTestStudents = () => {
  return cy.wrap(API_TEST_STUDENTS, { log: false }).each((student) => {
    cy.request({
      method: 'POST',
      url: STUDENTS_URL,
      body: student,
      failOnStatusCode: false
    });
  });
};

const createApiClass = (topic, periodLabel, withGrades) => {
  const { year, semester } = parsePeriod(periodLabel);
  const classId = `${topic}-${year}-${semester}`;

  // Remove caso tenha sobrado de uma execução interrompida
  return cy
    .request({
      method: 'DELETE',
      url: `${CLASSES_URL}/${encodeURIComponent(classId)}`,
      failOnStatusCode: false
    })
    .then(() =>
      cy.request('POST', CLASSES_URL, { topic, year, semester })
    )
    .then(() => {
      if (!apiCreatedClassIds.includes(classId)) {
        apiCreatedClassIds.push(classId);
      }

      if (!withGrades) return;

      // Sistemas Operacionais 2025/1 -> 2 alunos com média 8.5 (média 8.5, 2 aprovados)
      // Demais turmas com notas -> 1 aluno com média 9.0 (média 9, 1 aprovado)
      const isSO20251 = topic === 'Sistemas Operacionais' && periodLabel === '2025/1';
      const studentsToEnroll = isSO20251 ? API_TEST_STUDENTS : [API_TEST_STUDENTS[0]];
      const gradesPattern = isSO20251 ? GRADES_FOR_8_5 : GRADES_FOR_9_0;

      return ensureApiTestStudents().then(() =>
        cy.wrap(studentsToEnroll, { log: false }).each((student) => {
          cy.request(
            'POST',
            `${CLASSES_URL}/${encodeURIComponent(classId)}/enroll`,
            { studentCPF: student.cpf }
          );

          EVALUATION_GOALS.forEach((goal, idx) => {
            cy.request(
              'PUT',
              `${CLASSES_URL}/${encodeURIComponent(classId)}/enrollments/${encodeURIComponent(student.cpf)}/evaluation`,
              { goal, grade: gradesPattern[idx] }
            );
          });
        })
      );
    });
};

const cleanupApiTestData = () => {
  const classIdsToDelete = [...apiCreatedClassIds];
  apiCreatedClassIds = [];

  return cy
    .wrap(classIdsToDelete, { log: false })
    .each((classId) => {
      cy.request({
        method: 'DELETE',
        url: `${CLASSES_URL}/${encodeURIComponent(classId)}`,
        failOnStatusCode: false
      });
    })
    .then(() =>
      cy.wrap(API_TEST_STUDENTS, { log: false }).each((student) => {
        cy.request({
          method: 'DELETE',
          url: `${STUDENTS_URL}/${encodeURIComponent(student.cpf)}`,
          failOnStatusCode: false
        });
      })
    );
};

// =========================================================================
// HOOKS ISOLADOS (GUI vs API)
// =========================================================================

Before({ tags: '@comparacao and not @api' }, () => {
  seededClasses = [];
  seededMetricsByClass = {};
  classesWithoutData = new Set();
  currentTopic = '';
  needsSync = false;

  cy.intercept('GET', '**/api/classes', (req) => {
    const payload = seededClasses.map(({ __placeholder, ...cls }) => cls);
    req.reply({
      statusCode: 200,
      body: payload
    });
  }).as('getClasses');

  cy.intercept('POST', '**/api/classes/comparison', (req) => {
    const { topic, classIds, metrics } = req.body;
    const responseMetrics = {};
    const warnings = [];

    metrics.forEach((metric) => {
      responseMetrics[metric] = {};
      classIds.forEach((classId) => {
        if (classesWithoutData.has(classId)) {
          responseMetrics[metric][classId] = 'N/A';
          const warningMsg = `A turma "${classId}" não possui dados cadastrados`;
          if (!warnings.includes(warningMsg)) {
            warnings.push(warningMsg);
          }
        } else {
          const classMetrics = seededMetricsByClass[classId] || {};
          responseMetrics[metric][classId] =
            classMetrics[metric] !== undefined ? classMetrics[metric] : 0;
        }
      });
    });

    req.reply({
      statusCode: 200,
      body: {
        topic,
        metrics: responseMetrics,
        warnings
      }
    });
  }).as('postComparison');
});

After({ tags: '@comparacao and not @api' }, () => {
  seededClasses = [];
  seededMetricsByClass = {};
  classesWithoutData = new Set();
  currentTopic = '';
  needsSync = false;
});

Before({ tags: '@comparacao and @api' }, () => {
  apiCurrentTopic = '';
  apiCreatedClassIds = [];
  apiLastResponse = null;
  apiLastRequestedMetric = '';
  apiClassesSnapshotBefore = null;
});

After({ tags: '@comparacao and @api' }, () => {
  return cleanupApiTestData();
});

// =========================================================================
// STEPS DE SERVIÇO (@api)
// =========================================================================

Given('a disciplina {string} está cadastrada no sistema', (topic) => {
  apiCurrentTopic = topic;
});

Given('a turma {string} possui notas cadastradas no sistema', (periodLabel) => {
  return createApiClass(apiCurrentTopic, periodLabel, true);
});

Given('a turma {string} está cadastrada no sistema sem notas avaliadas', (periodLabel) => {
  return createApiClass(apiCurrentTopic, periodLabel, false);
});

Given('a turma {string} de {string} possui notas cadastradas no sistema', (periodLabel, topic) => {
  return createApiClass(topic, periodLabel, true);
});

When(
  'eu solicito ao sistema a comparação da métrica {string} entre as turmas {string} e {string} da disciplina {string}',
  (metric, period1, period2, topic) => {
    apiCurrentTopic = topic;
    apiLastRequestedMetric = metric;
    const classId1 = buildClassId(topic, period1);
    const classId2 = buildClassId(topic, period2);

    return cy
      .request('GET', CLASSES_URL)
      .then((res) => {
        apiClassesSnapshotBefore = res.body.filter(
          (c) => c.id === classId1 || c.id === classId2
        );
      })
      .then(() =>
        cy.request({
          method: 'POST',
          url: COMPARISON_URL,
          body: { topic, classIds: [classId1, classId2], metrics: [metric] },
          failOnStatusCode: false
        })
      )
      .then((res) => {
        apiLastResponse = res;
      });
  }
);

When(
  'eu envio uma requisição de comparação de {string} informando apenas a disciplina {string} e a turma {string}',
  (metric, topic, period1) => {
    apiCurrentTopic = topic;
    apiLastRequestedMetric = metric;
    const classId1 = buildClassId(topic, period1);

    return cy
      .request({
        method: 'POST',
        url: COMPARISON_URL,
        body: { topic, classIds: [classId1], metrics: [metric] },
        failOnStatusCode: false
      })
      .then((res) => {
        apiLastResponse = res;
      });
  }
);

When(
  'eu envio um payload de requisição tentando comparar a turma {string} de {string} diretamente com a turma {string} de {string}',
  (period1, topic1, period2, topic2) => {
    const classId1 = buildClassId(topic1, period1);
    const classId2 = buildClassId(topic2, period2);

    return cy
      .request({
        method: 'POST',
        url: COMPARISON_URL,
        body: { classIds: [classId1, classId2], metrics: ['Média'] },
        failOnStatusCode: false
      })
      .then((res) => {
        apiLastResponse = res;
      });
  }
);

When(
  'eu solicito ao sistema a comparação das métricas {string} e {string} entre as turmas {string} e {string} da disciplina {string}',
  (metric1, metric2, period1, period2, topic) => {
    apiCurrentTopic = topic;
    const classId1 = buildClassId(topic, period1);
    const classId2 = buildClassId(topic, period2);

    return cy
      .request({
        method: 'POST',
        url: COMPARISON_URL,
        body: { topic, classIds: [classId1, classId2], metrics: [metric1, metric2] },
        failOnStatusCode: false
      })
      .then((res) => {
        apiLastResponse = res;
      });
  }
);

When(
  'eu envio uma requisição de comparação informando as turmas {string} e {string} da disciplina {string} sem especificar uma métrica',
  (period1, period2, topic) => {
    apiCurrentTopic = topic;
    const classId1 = buildClassId(topic, period1);
    const classId2 = buildClassId(topic, period2);

    return cy
      .request({
        method: 'POST',
        url: COMPARISON_URL,
        body: { topic, classIds: [classId1, classId2], metrics: [] },
        failOnStatusCode: false
      })
      .then((res) => {
        apiLastResponse = res;
      });
  }
);

When(
  'eu envio uma requisição de comparação informando a métrica {string} entre as turmas {string} e {string} da disciplina {string}',
  (metric, period1, period2, topic) => {
    apiCurrentTopic = topic;
    apiLastRequestedMetric = metric;
    const classId1 = buildClassId(topic, period1);
    const classId2 = buildClassId(topic, period2);

    return cy
      .request({
        method: 'POST',
        url: COMPARISON_URL,
        body: { topic, classIds: [classId1, classId2], metrics: [metric] },
        failOnStatusCode: false
      })
      .then((res) => {
        apiLastResponse = res;
      });
  }
);

Then('o sistema retorna o status de sucesso', () => {
  expect(apiLastResponse).to.exist;
  expect(apiLastResponse.status).to.eq(200);
});

Then('o sistema retorna o valor {string} para a turma {string} no JSON de resposta', (expected, periodLabel) => {
  const classId = buildClassId(apiCurrentTopic, periodLabel);
  const actual = apiLastResponse.body.metrics[apiLastRequestedMetric][classId];
  expect(String(actual)).to.eq(expected);
});

Then(
  'as turmas {string} e {string} permanecem inalteradas no sistema com suas respectivas notas',
  (period1, period2) => {
    const classId1 = buildClassId(apiCurrentTopic, period1);
    const classId2 = buildClassId(apiCurrentTopic, period2);

    return cy.request('GET', CLASSES_URL).then((res) => {
      const snapshotAfter = res.body.filter(
        (c) => c.id === classId1 || c.id === classId2
      );
      expect(snapshotAfter).to.deep.equal(apiClassesSnapshotBefore);
    });
  }
);

Then('o sistema rejeita a requisição e retorna um código de erro de requisição inválida', () => {
  expect(apiLastResponse).to.exist;
  expect(apiLastResponse.status).to.eq(400);
});

Then('o sistema retorna uma mensagem de erro indicando que é necessário fornecer ao menos duas turmas no payload', () => {
  expect(apiLastResponse.body.error).to.include('duas turmas');
});

Then('o sistema intercepta a inconsistência e retorna um código de erro de entidade não processável', () => {
  expect(apiLastResponse).to.exist;
  expect(apiLastResponse.status).to.eq(422);
});

Then('o sistema não realiza nenhum cálculo de métrica', () => {
  expect(apiLastResponse.body.metrics).to.be.undefined;
});

Then('o sistema retorna uma mensagem de erro indicando que só é permitida a comparação entre turmas de uma única disciplina', () => {
  expect(apiLastResponse.body.error).to.include('única disciplina');
});

Then('o sistema retorna o valor {string} para a média da turma {string} no JSON de resposta', (expected, periodLabel) => {
  const classId = buildClassId(apiCurrentTopic, periodLabel);
  const actual = apiLastResponse.body.metrics['Média'][classId];
  expect(String(actual)).to.eq(expected);
});

Then(
  'o sistema retorna o valor {string} para o número de alunos aprovados da turma {string} no JSON de resposta',
  (expected, periodLabel) => {
    const classId = buildClassId(apiCurrentTopic, periodLabel);
    const actual = apiLastResponse.body.metrics['Número de alunos aprovados'][classId];
    expect(String(actual)).to.eq(expected);
  }
);

Then('o sistema retorna uma mensagem de erro indicando que é necessário selecionar ao menos uma métrica no payload', () => {
  expect(apiLastResponse.body.error).to.include('uma métrica');
});

Then('o sistema rejeita a requisição e retorna um código de erro de entidade não processável', () => {
  expect(apiLastResponse).to.exist;
  expect(apiLastResponse.status).to.eq(422);
});

Then('o sistema retorna uma mensagem de erro indicando que a métrica solicitada não é suportada pelo sistema', () => {
  expect(apiLastResponse.body.error).to.include('não é suportada');
});

// =========================================================================
// STEPS DE GUI
// =========================================================================

Given('eu estou na seção {string} da aba {string}', (sectionTitle, tabName) => {
  openComparisonSection(sectionTitle, tabName);
});

Given('a disciplina {string} existe na lista de disciplinas', (topic) => {
  if (!seededClasses.some((c) => c.topic === topic)) {
    addSeededClass(topic, '2025/1', true);
  }
});

Given(
  'a turma {string} possui {string} na métrica {string} e existe na lista de turmas da disciplina {string}',
  (periodLabel, expectedValue, metric, topic) => {
    const classId = addSeededClass(topic, periodLabel);
    seededMetricsByClass[classId] = {
      ...(seededMetricsByClass[classId] || {}),
      [metric]: Number(expectedValue)
    };
  }
);

Given(
  'a turma {string} possui {string} de média, {string} alunos aprovados e existe na lista de turmas da disciplina {string}',
  (periodLabel, avgValue, approvedValue, topic) => {
    const classId = addSeededClass(topic, periodLabel);
    seededMetricsByClass[classId] = {
      ...(seededMetricsByClass[classId] || {}),
      'Média': Number(avgValue),
      'Número de alunos aprovados': Number(approvedValue)
    };
  }
);

Given(
  'a turma {string} existe na lista de turmas da disciplina {string}',
  (periodLabel, topic) => {
    addSeededClass(topic, periodLabel);
  }
);

Given(
  'a turma {string} possui dados cadastrados e existe na lista de turmas da disciplina {string}',
  (periodLabel, topic) => {
    const classId = addSeededClass(topic, periodLabel);
    seededMetricsByClass[classId] = {
      ...(seededMetricsByClass[classId] || {}),
      'Média': 8.5
    };
  }
);

Given(
  'a turma {string} não possui dados cadastrados e existe na lista de turmas da disciplina {string}',
  (periodLabel, topic) => {
    const classId = addSeededClass(topic, periodLabel);
    classesWithoutData.add(classId);
  }
);

Given('a disciplina {string} está selecionada', (topic) => {
  ensureSeededClassesLoaded();
  currentTopic = topic;
  cy.get('[data-cy="topic-select"]')
    .select(topic)
    .should('have.value', topic);
});

When('eu seleciono a disciplina {string}', (topic) => {
  ensureSeededClassesLoaded();
  currentTopic = topic;
  cy.get('[data-cy="topic-select"]')
    .select(topic)
    .should('have.value', topic);
});

When('eu seleciono a turma {string}', (periodLabel) => {
  const classId = buildClassId(currentTopic, periodLabel);
  clickOptionByTestId('class', classId);
  cy.get(`[data-cy="class-option-${classId}"]`).should(
    'have.attr',
    'aria-checked',
    'true'
  );
});

When('eu seleciono novamente a turma {string}', (periodLabel) => {
  const classId = buildClassId(currentTopic, periodLabel);
  clickOptionByTestId('class', classId);
});

When('eu seleciono a métrica {string}', (metric) => {
  ensureSeededClassesLoaded();
  clickOptionByTestId('metric', metric);
  cy.get(`[data-cy="metric-option-${metric}"]`).should(
    'have.attr',
    'aria-checked',
    'true'
  );
});

When('eu solicito a geração do gráfico de desempenho', () => {
  cy.get('[data-cy="generate-comparison-btn"]').click();
});

Then(
  'eu consigo ver um gráfico de colunas com o título {string} abaixo das seleções',
  (metricTitle) => {
    cy.get('[data-cy="comparison-error-alert"]').should('not.exist');
    cy.get(`[data-cy="comparison-chart-${metricTitle}"]`).should('be.visible');
    cy.get(`[data-cy="comparison-chart-title-${metricTitle}"]`)
      .should('be.visible')
      .and('have.text', metricTitle);
  }
);

Then(
  'eu consigo ver um gráfico de colunas com o título {string} abaixo do primeiro gráfico',
  (metricTitle) => {
    cy.get(`[data-cy="comparison-chart-${metricTitle}"]`).should('be.visible');
    cy.get(`[data-cy="comparison-chart-title-${metricTitle}"]`)
      .should('be.visible')
      .and('have.text', metricTitle);
  }
);

Then('o eixo X do gráfico possui as turmas {string} e {string}', (period1, period2) => {
  const classId1 = buildClassId(currentTopic, period1);
  const classId2 = buildClassId(currentTopic, period2);
  cy.get('[data-cy="chart-x-axis"]')
    .should('be.visible')
    .and('contain.text', classId1)
    .and('contain.text', classId2);
});

Then(
  'o eixo X do gráfico possui as turmas {string}, {string}, {string} e {string}',
  (period1, period2, period3, period4) => {
    [period1, period2, period3, period4].forEach((period) => {
      const classId = buildClassId(currentTopic, period);
      cy.get('[data-cy="chart-x-axis"]')
        .should('be.visible')
        .and('contain.text', classId);
    });
  }
);

Then(
  'o eixo X de ambos os gráficos possui as turmas {string} e {string}',
  (period1, period2) => {
    const classId1 = buildClassId(currentTopic, period1);
    const classId2 = buildClassId(currentTopic, period2);
    cy.get('[data-cy="chart-x-axis"]').should('have.length', 2).each(($axis) => {
      cy.wrap($axis)
        .should('be.visible')
        .and('contain.text', classId1)
        .and('contain.text', classId2);
    });
  }
);

Then(
  'o eixo Y do gráfico possui o valor {string} determinando a altura da coluna da turma {string}',
  (expectedValue, periodLabel) => {
    const classId = buildClassId(currentTopic, periodLabel);
    cy.get(`[data-cy="chart-bar-${classId}"]`)
      .should('be.visible')
      .and('have.attr', 'data-value', expectedValue);
  }
);

Then(
  'o eixo Y do gráfico {string} possui o valor {string} determinando a altura da coluna da turma {string}',
  (metricTitle, expectedValue, periodLabel) => {
    const classId = buildClassId(currentTopic, periodLabel);
    cy.get(`[data-cy="comparison-chart-${metricTitle}"]`)
      .find(`[data-cy="chart-bar-${classId}"]`)
      .should('be.visible')
      .and('have.attr', 'data-value', expectedValue);
  }
);

Then('o sistema não exibe o gráfico de desempenho', () => {
  cy.get('[data-cy^="comparison-chart-"]').should('not.exist');
});

Then('o sistema não permite selecionar turmas', () => {
  cy.get('[data-cy="classes-disabled-hint"]').should('be.visible');
  cy.get('[data-cy^="class-option-"]').should('not.exist');
});

Then('eu consigo ver uma mensagem de erro solicitando a seleção de ao menos 2 turmas', () => {
  cy.get('[data-cy="comparison-error-alert"]')
    .should('be.visible')
    .and('contain.text', '2 turmas');
});

Then('eu consigo ver uma mensagem de erro solicitando a seleção de uma disciplina', () => {
  cy.get('[data-cy="comparison-error-alert"]')
    .should('be.visible')
    .and('contain.text', 'disciplina');
});

Then('eu consigo ver uma mensagem de erro solicitando a seleção de ao menos 1 métrica', () => {
  cy.get('[data-cy="comparison-error-alert"]')
    .should('be.visible')
    .and('contain.text', 'métrica');
});

Then(
  'eu consigo ver uma mensagem de aviso afirmando que a turma {string} não possui dados cadastrados',
  (periodLabel) => {
    const classId = buildClassId(currentTopic, periodLabel);
    cy.get('[data-cy="comparison-warning-alert"]')
      .should('be.visible')
      .and('contain.text', classId)
      .and('contain.text', 'não possui dados');
  }
);

Then('o sistema remove a seleção da turma {string}', (periodLabel) => {
  const classId = buildClassId(currentTopic, periodLabel);
  cy.get(`[data-cy="class-option-${classId}"]`)
    .should('have.attr', 'aria-checked', 'false')
    .and('not.have.class', 'selected');
});

Then('o sistema remove a seleção da disciplina {string}', (previousTopic) => {
  cy.get('[data-cy="topic-select"]').should('not.have.value', previousTopic);
});

Then('o sistema mantém a disciplina {string} selecionada', (selectedTopic) => {
  cy.get('[data-cy="topic-select"]').should('have.value', selectedTopic);
});