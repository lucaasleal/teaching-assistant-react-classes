// The steps use CommonJS so ts-node can import the project's TypeScript modules.
process.env.TS_NODE_PROJECT = process.env.TS_NODE_PROJECT || 'tsconfig.test.json';

const shared = {
  require: ['src/step-definitions/**/*.ts'],
  requireModule: ['ts-node/register'],
  format: [
    'progress-bar',
    'json:reports/cucumber_report.json',
    'html:reports/cucumber_report.html'
  ],
  formatOptions: { snippetInterface: 'async-await' }
};

module.exports = {
  default: {
    ...shared,
    paths: ['src/features/*student-management.feature']
  },
  // These scenarios start and stop their own API on port 3005.
  correlacao: {
    ...shared,
    paths: ['src/features/correlation-gui.feature']
  }
};
