import { Given, When, Then, Before, After, DataTable, setDefaultTimeout } from '@cucumber/cucumber';
import { Browser, Page, launch } from 'puppeteer';
import expect from 'expect';
import { ReportData, StudentEntry, StudentStatus, STATUS_LABELS } from '../types/Report';

setDefaultTimeout(30 * 1000);

const baseUrl = 'http://localhost:3004';
const serverUrl = 'http://localhost:3005';

let browser: Browser;
let page: Page;

// What the scenario created on the server, so that the After hook can remove it
let createdClassIds: string[] = [];

// STUB: responses the browser receives instead of asking the server, by class id.
// The final grade and the status of each student, and the rule that refuses a
// report for a class without grades, belong to code that is not available yet,
// so the "server side" of the report is faked at the HTTP boundary. These tests
// check how the GUI PRESENTS what the server says; the expected values come from
// the scenarios, never from the stub.
interface ReportStub {
  status: number;
  body: unknown;
}
let reportStubs: Map<string, ReportStub>;

// Same convention as the server's error handler: { "error": "<message>" }
// ATTENTION: the real server must use exactly this text when it implements the rule
const NO_GRADES_MESSAGE = 'Relatório de desempenho indisponível para turmas sem notas registradas';

/* ------------------------------ helpers ------------------------------ */

/** Calls the server API. Returns the JSON body, or null when there is none (e.g. 204). */
const api = async (method: string, path: string, body?: unknown, okStatuses: number[] = []): Promise<any> => {
  const response = await fetch(`${serverUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (!response.ok && !okStatuses.includes(response.status)) {
    throw new Error(`${method} ${path} failed with ${response.status}: ${await response.text()}`);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

/** "ESS 2025.2" -> topic "ESS", year 2025, semester 2, and the id the server gives such a class. */
const parseClassName = (className: string) => {
  const match = /^(.+) (\d{4})\.([12])$/.exec(className);
  if (!match) {
    throw new Error(`Class name "${className}" does not follow the pattern "<topic> <year>.<semester>"`);
  }
  const [, topic, year, semester] = match;
  return { topic, year: Number(year), semester: Number(semester), id: `${topic}-${year}-${semester}` };
};

/** "Approved" -> "APPROVED": the status whose label the interface shows. */
const statusOfLabel = (label: string): StudentStatus => {
  const entry = Object.entries(STATUS_LABELS).find(([, shown]) => shown === label);
  if (!entry) {
    throw new Error(`Unknown status "${label}"; the interface shows: ${Object.values(STATUS_LABELS).join(', ')}`);
  }
  return entry[0] as StudentStatus;
};

const deleteClassIfExists = (id: string) =>
  api('DELETE', `/api/classes/${encodeURIComponent(id)}`, undefined, [404]);

/** The report the (real) server would send for students with these final grades and statuses. */
const buildReport = (className: string, students: StudentEntry[]): ReportData => {
  const { topic, year, semester, id } = parseClassName(className);
  const countOf = (status: StudentStatus) => students.filter(s => s.status === status).length;
  const total = students.length;
  return {
    classId: id,
    topic,
    semester,
    year,
    totalEnrolled: total,
    studentsAverage: total === 0 ? 0 : students.reduce((sum, s) => sum + s.finalGrade, 0) / total,
    approvedCount: countOf('APPROVED'),
    inFinalCount: countOf('IN_FINAL'),
    approvedFinalCount: countOf('APPROVED_FINAL'),
    notApprovedCount: countOf('FAILED'),
    evaluationPerformance: [],
    students,
    generatedAt: new Date()
  };
};

/** "bar chart" -> "bar": the view whose toggle button the interface shows. */
type ReportView = 'table' | 'bar' | 'pie';
const viewOfLabel = (label: string): ReportView => {
  const view = label.toLowerCase().replace(' chart', '');
  if (view !== 'table' && view !== 'bar' && view !== 'pie') {
    throw new Error(`Unknown view "${label}"; use "table", "bar chart" or "pie chart"`);
  }
  return view;
};

/** Clicks the Report button of the class, without waiting for the report. */
const clickReportButton = async (className: string) => {
  const { id } = parseClassName(className);
  const reportButton = `[data-testid="report-class-${id}"]`;
  await page.waitForSelector(reportButton);
  await page.click(reportButton);
};

/** Waits until the report shows the given view. */
const waitForView = (view: ReportView) =>
  page.waitForSelector(view === 'table' ? '[data-testid="status-row-APPROVED"]' : `[data-testid="status-chart-${view}"]`);

/* ------------------------------- hooks -------------------------------- */

Before({ tags: '@report-gui' }, async function () {
  createdClassIds = [];
  reportStubs = new Map();
  browser = await launch({
    headless: false, // true for CI
    slowMo: 50,
    // Chrome of this machine; set CHROME_PATH to use another one
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  });
  page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  // Answers the report request of a stubbed class; everything else goes to the real server
  await page.setRequestInterception(true);
  page.on('request', request => {
    const match = /\/api\/classes\/([^/]+)\/report$/.exec(new URL(request.url()).pathname);
    const stub = match && reportStubs.get(decodeURIComponent(match[1]));
    if (stub) {
      request.respond({
        status: stub.status,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' }, // client (3004) and server (3005) differ in origin
        body: JSON.stringify(stub.body)
      });
    } else {
      request.continue();
    }
  });
});

After({ tags: '@report-gui' }, async function () {
  // The server writes every change to server/data/app-data.json, so clean up
  for (const id of createdClassIds) {
    await deleteClassIfExists(id).catch(() => undefined);
  }
  if (browser) {
    await browser.close();
  }
});

/* -------------------------------- Given -------------------------------- */

Given('the class {string} has the following students and academic statuses:', async function (className: string, table: DataTable) {
  const { topic, year, semester, id } = parseClassName(className);

  // The class really exists on the server, so the Classes page lists it with its Report button
  await deleteClassIfExists(id);
  await api('POST', '/api/classes', { topic, year, semester });
  createdClassIds.push(id);

  // Its report is the one for the final grades and statuses of the table
  const students: StudentEntry[] = table.hashes().map((row, index) => ({
    studentId: `9000000000${index}`,
    name: row.student,
    finalGrade: Number(row['final grade']),
    status: statusOfLabel(row.status)
  }));
  reportStubs.set(id, { status: 200, body: buildReport(className, students) });
});

Given('the class {string} has no student grades recorded in the system', async function (className: string) {
  const { topic, year, semester, id } = parseClassName(className);

  // The class really exists (with no students, hence no grades)
  await deleteClassIfExists(id);
  await api('POST', '/api/classes', { topic, year, semester });
  createdClassIds.push(id);

  // The server refuses to generate its report
  reportStubs.set(id, { status: 400, body: { error: NO_GRADES_MESSAGE } });
});

// Opened after the setup, so the page loads the class the setup created
Given('I am at the {string} page', async function (pageName: string) {
  await page.goto(baseUrl);
  const tab = `[data-testid="${pageName.toLowerCase()}-tab"]`; // "Classes" -> classes-tab
  await page.waitForSelector(tab);
  await page.click(tab);
  await page.waitForSelector('.classes-container');
});

Given('I am viewing the performance report for class {string} as a {string}', async function (className: string, viewLabel: string) {
  await clickReportButton(className);
  await page.waitForSelector('.report-summary'); // the modal first shows "Loading report..."
  const view = viewOfLabel(viewLabel);
  await page.click(`[data-testid="report-view-${view}"]`);
  await waitForView(view);
});

/* --------------------------------- When --------------------------------- */

When('I view the performance report for class {string}', async function (className: string) {
  await clickReportButton(className);
});

When('I request to view the performance report as a {string}', async function (viewLabel: string) {
  await page.click(`[data-testid="report-view-${viewOfLabel(viewLabel)}"]`);
});

/* --------------------------------- Then --------------------------------- */

Then('I should see the performance report for class {string}', async function (className: string) {
  const { topic, year, semester } = parseClassName(className);
  await page.waitForSelector('[data-testid="report-modal"]');
  await page.waitForSelector('.report-summary'); // the modal first shows "Loading report..."
  const title = await page.$eval('[data-testid="report-modal"] h3', el => el.textContent);
  expect(title).toContain(`Report of ${topic} (${year}.${semester})`);
});

Then('the report should display the students by status:', async function (table: DataTable) {
  for (const row of table.hashes()) {
    const selector = `[data-testid="status-row-${statusOfLabel(row.status)}"]`;
    await page.waitForSelector(selector);
    const cells = await page.$$eval(`${selector} td`, tds => tds.map(td => (td.textContent ?? '').trim()));
    expect(cells).toEqual([row.status, row.students, row.percentage]);
  }
});

Then('the report should list the students with their final grades and statuses:', async function (table: DataTable) {
  await page.waitForSelector('[data-testid="report-student-row"]');
  const shown: string[][] = await page.$$eval('[data-testid="report-student-row"]', rows =>
    rows.map(row => Array.from(row.querySelectorAll('td')).map(td => (td.textContent ?? '').trim()))
  );
  const expected = table.hashes().map(row => [row.student, row['final grade'], row.status]);
  // the order of the rows is not part of the requirement
  expect([...shown].sort()).toEqual([...expected].sort());
});

Then('I should see the error message {string}', async function (message: string) {
  await page.waitForSelector('[data-testid="error-message"]');
  const shown = await page.$eval('[data-testid="error-message"]', el => el.textContent);
  expect(shown).toContain(message);
});

Then('I do not see the performance report for class {string}', async function (className: string) {
  const { topic, year, semester } = parseClassName(className);
  // the modal opens showing "Loading report..." and closes when the error arrives
  await page.waitForSelector('[data-testid="report-modal"]', { hidden: true });
  const text = await page.$eval('body', el => el.textContent ?? '');
  expect(text).not.toContain(`Report of ${topic} (${year}.${semester})`);
});

Then('I should see the performance report displayed as a {string}', async function (viewLabel: string) {
  const view = viewOfLabel(viewLabel);
  await waitForView(view);
  const pressed = await page.$eval(`[data-testid="report-view-${view}"]`, el => el.getAttribute('aria-pressed'));
  expect(pressed).toBe('true');
  // and no other chart is shown at the same time
  for (const other of ['bar', 'pie'].filter(chart => chart !== view)) {
    expect(await page.$(`[data-testid="status-chart-${other}"]`)).toBeNull();
  }
});

Then('the chart should represent the students by status as:', async function (table: DataTable) {
  const rows = table.hashes();
  const total = rows.reduce((sum, row) => sum + Number(row.students), 0);
  const segments = await page.$$eval('[data-testid^="chart-segment-"]', els =>
    els.map(el => ({
      testId: el.getAttribute('data-testid') ?? '',
      tag: el.tagName.toLowerCase(),
      path: el.getAttribute('d'),
      count: el.getAttribute('data-count'),
      percentage: el.getAttribute('data-percentage')
    }))
  );

  for (const row of rows) {
    const segment = segments.find(s => s.testId === `chart-segment-${statusOfLabel(row.status)}`);
    expect(segment).toBeDefined();
    expect(segment!.count).toBe(row.students);
    expect(segment!.percentage).toBe(row.percentage);

    // A pie slice must also be drawn with the right size: compare its angle with the expected share
    const expectedShare = Number(row.students) / total;
    if (segment!.tag === 'circle') {
      expect(expectedShare).toBe(1); // a single status holds everyone
    } else if (segment!.tag === 'path') {
      const n = '([-+\\d.eE]+)';
      const match = new RegExp(`^M ${n} ${n} L ${n} ${n} A ${n} ${n} 0 [01] 1 ${n} ${n} Z$`).exec(segment!.path ?? '');
      expect(match).not.toBeNull();
      const [cx, cy, sx, sy, , , ex, ey] = match!.slice(1).map(Number);
      const sweep = (Math.atan2(ey - cy, ex - cx) - Math.atan2(sy - cy, sx - cx) + 2 * Math.PI) % (2 * Math.PI);
      expect(Math.abs(sweep / (2 * Math.PI) - expectedShare)).toBeLessThan(0.01);
    }
  }

  // The pie chart also has a legend that the professor reads
  const legend = await page.$$eval('.report-chart-legend li', items => items.map(item => (item.textContent ?? '').trim()));
  if (legend.length > 0) {
    for (const row of rows) {
      expect(legend).toContain(`${row.status}: ${row.students} (${row.percentage})`);
    }
  }
});