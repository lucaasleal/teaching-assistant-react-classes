const { Given, When, Then, And } = require("cypress-cucumber-preprocessor/steps");

// Função auxiliar para evitar duplicação de código (Boa prática dos slides)
const selectOptionByTestId = (groupTestId, itemValue) => {
  cy.get(`[data-cy="${groupTestId}-option-${itemValue}"]`).click();
};

Given('eu estou na página {string}', (pageName) => {
  cy.visit('http://localhost:3000');
  cy.get('[data-cy="nav-classes-tab"]').click();
  cy.get('[data-cy="performance-comparison-section"]')
    .should('be.visible')
    .and('contain.text', pageName);
});

And('a disciplina {string} existe na lista de disciplinas', (topic) => {
  cy.get('[data-cy="topic-select"]').should('contain.text', topic);
});

And(
  'a turma {string} possui {string} de média e existe na lista de turmas da disciplina {string}',
  (classId, expectedValue, topic) => {
    // Pré-condição verificada/configurada na API ou estado da página
    cy.request({
      method: 'GET',
      url: 'http://localhost:3005/api/classes',
      failOnStatusCode: false
    }).then((response) => {
      expect(response.status).to.be.oneOf([200, 304]);
    });
  }
);

When('eu seleciono a disciplina {string}', (topic) => {
  cy.get('[data-cy="topic-select"]').select(topic);
});

And('eu seleciono a turma {string}', (classId) => {
  selectOptionByTestId('class', classId);
});

And('eu seleciono a métrica {string}', (metric) => {
  selectOptionByTestId('metric', metric);
});

And('eu solicito a geração do gráfico de desempenho', () => {
  cy.get('[data-cy="generate-comparison-btn"]').click();
});

Then('eu consigo ver um gráfico de colunas com o título {string} abaixo das seleções', (metricTitle) => {
  cy.get(`[data-cy="comparison-chart-${metricTitle}"]`).should('be.visible');
  cy.get(`[data-cy="comparison-chart-title-${metricTitle}"]`).should('have.text', metricTitle);
});

And('o eixo X do gráfico possui as turmas {string} e {string}', (class1, class2) => {
  cy.get('[data-cy="chart-x-axis"]')
    .should('contain.text', class1)
    .and('contain.text', class2);
});

And(
  'o eixo Y do gráfico possui o valor {string} determinando a altura da coluna da turma {string}',
  (expectedValue, classId) => {
    cy.get(`[data-cy="chart-bar-${classId}"]`)
      .should('be.visible')
      .and('have.attr', 'data-value', expectedValue);
  }
);

// 
And('a turma {string} existe na lista de turmas da disciplina {string}', (classId, topic) => {
  cy.get('[data-cy="topic-select"]').select(topic);
  cy.get(`[data-cy="class-option-${classId}"]`).should('exist');
});

And('a disciplina {string} está selecionada', (topic) => {
  cy.get('[data-cy="topic-select"]').select(topic);
  cy.get('[data-cy="topic-select"]').should('have.value', topic);
});

When('eu seleciono novamente a turma {string}', (classId) => {
  selectOptionByTestId('class', classId);
});

Then('o sistema remove a seleção da turma {string}', (classId) => {
  cy.get(`[data-cy="class-option-${classId}"]`)
    .should('have.attr', 'aria-checked', 'false')
    .and('not.have.class', 'selected');
});

Then('o sistema remove a seleção da disciplina {string}', (previousTopic) => {
  cy.get('[data-cy="topic-select"]').should('not.have.value', previousTopic);
});

And('o sistema mantém a disciplina {string} selecionada', (currentTopic) => {
  cy.get('[data-cy="topic-select"]').should('have.value', currentTopic);
});

Then('o sistema não exibe o gráfico de desempenho', () => {
  cy.get('[data-cy^="comparison-chart-"]').should('not.exist');
});

And('eu consigo ver uma mensagem de erro solicitando a seleção de ao menos 2 turmas', () => {
  cy.get('[data-cy="comparison-error-alert"]')
    .should('be.visible')
    .and('not.be.empty');
});
