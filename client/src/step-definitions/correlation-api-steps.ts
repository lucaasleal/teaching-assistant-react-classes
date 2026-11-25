import { After, DataTable, Given, Then, When, World } from '@cucumber/cucumber';
import expect from 'expect';

const apiBaseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:3005').replace(/\/+$/, '');

interface CorrelationApiWorld extends World {
  response: Response;
  responseBody: unknown;
  studentCount: number;
  studentCPFs: string[];
}

function apiRequest(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${apiBaseUrl}${path}`, init);
}

async function removeApiTestClasses() {
  const response = await apiRequest('/api/classes');
  expect(response.status).toBe(200);
  const classes = await response.json();
  for (const { id } of classes.filter((item: { id: string }) => item.id.startsWith('API-'))) {
    const deletion = await apiRequest(`/api/classes/${encodeURIComponent(id)}`, { method: 'DELETE' });
    expect(deletion.status).toBe(204);
  }
}

Given('the correlation API is available', async function (this: CorrelationApiWorld) {
  this.studentCount = 0;
  this.studentCPFs = [];
  await removeApiTestClasses();
});

After(async function (this: CorrelationApiWorld) {
  await removeApiTestClasses();
  for (const cpf of this.studentCPFs) {
    const deletion = await apiRequest(`/api/students/${encodeURIComponent(cpf)}`, { method: 'DELETE' });
    expect([204, 404]).toContain(deletion.status);
  }
});

async function createClass(classId: string) {
  const [, topic, year, semester] = /^(.*)-(\d{4})-(\d+)$/.exec(classId) ?? [];
  const response = await apiRequest('/api/classes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, year: Number(year), semester: Number(semester) })
  });
  expect(response.status).toBe(201);
  const body = await response.json();
  expect(body.id).toBe(classId);
}

Given('the class {string} exists', async function (this: CorrelationApiWorld, classId: string) {
  await createClass(classId);
});

Given('the class {string} has enrolled students with:', async function (
  this: CorrelationApiWorld, classId: string, table: DataTable
) {
  await createClass(classId);
  const classPath = `/api/classes/${encodeURIComponent(classId)}`;
  for (const { student, ...grades } of table.hashes()) {
    const cpf = String(91000000000 + (Date.now() % 8000000000) + ++this.studentCount);
    this.studentCPFs.push(cpf);
    const studentResponse = await apiRequest('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: student, cpf, email: `student${this.studentCount}@example.com` })
    });
    expect(studentResponse.status).toBe(201);
    const enrollmentResponse = await apiRequest(`${classPath}/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentCPF: cpf })
    });
    expect(enrollmentResponse.status).toBe(201);
    for (const [goal, grade] of Object.entries(grades)) {
      const evaluationResponse = await apiRequest(`${classPath}/enrollments/${cpf}/evaluation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, grade })
      });
      expect(evaluationResponse.status).toBe(200);
    }
  }
});

When('I POST {string} with:', async function (this: CorrelationApiWorld, path: string, body: string) {
  this.response = await apiRequest(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body
  });
  this.responseBody = await this.response.json();
});

Then('the response status is {int}', function (this: CorrelationApiWorld, status: number) {
  expect(this.response.status).toBe(status);
});

Then('the response error is {string}', function (this: CorrelationApiWorld, error: string) {
  expect(this.responseBody).toEqual(expect.objectContaining({ error }));
});

Then('the response body is an empty JSON array', function (this: CorrelationApiWorld) {
  expect(this.responseBody).toEqual([]);
});

Then(
  'the response contains one correlation result with {int} data points, coefficient {float} and interpretation {string}',
  function (this: CorrelationApiWorld, dataPoints: number, value: number, interpretation: string) {
    expect(this.responseBody).toEqual([{
      firstVariable: 'Requirements',
      firstVariableLabel: 'Requirements',
      secondVariable: 'Design',
      secondVariableLabel: 'Design',
      dataPoints,
      value: expect.any(Number),
      interpretation
    }]);
    const [result] = this.responseBody as Array<{ value: number }>;
    expect(result.value).toBeCloseTo(value, 8);
  }
);
