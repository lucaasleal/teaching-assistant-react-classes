import { DataTable, Given, Then, When, World } from '@cucumber/cucumber';
import expect from 'expect';
import request, { Response } from 'supertest';
import { newTestApp } from '../../../server/src/__tests__/support/newTestApp';

interface CorrelationApiWorld extends World {
  api: ReturnType<typeof request>;
  response: Response;
  studentCount: number;
}

Given('the correlation API is available', function (this: CorrelationApiWorld) {
  this.api = request(newTestApp());
  this.studentCount = 0;
});

async function createClass(world: CorrelationApiWorld, classId: string) {
  const [, topic, year, semester] = /^(.*)-(\d{4})-(\d+)$/.exec(classId) ?? [];
  const response = await world.api.post('/api/classes')
    .send({ topic, year: Number(year), semester: Number(semester) })
    .expect(201);
  expect(response.body.id).toBe(classId);
}

Given('the class {string} exists', async function (this: CorrelationApiWorld, classId: string) {
  await createClass(this, classId);
});

Given('the class {string} has enrolled students with:', async function (
  this: CorrelationApiWorld, classId: string, table: DataTable
) {
  await createClass(this, classId);
  const classPath = `/api/classes/${encodeURIComponent(classId)}`;
  for (const { student, ...grades } of table.hashes()) {
    const cpf = String(91000000000 + ++this.studentCount);
    await this.api.post('/api/students')
      .send({ name: student, cpf, email: `student${this.studentCount}@example.com` })
      .expect(201);
    await this.api.post(`${classPath}/enroll`).send({ studentCPF: cpf }).expect(201);
    for (const [goal, grade] of Object.entries(grades)) {
      await this.api.put(`${classPath}/enrollments/${cpf}/evaluation`)
        .send({ goal, grade })
        .expect(200);
    }
  }
});

When('I POST {string} with:', async function (this: CorrelationApiWorld, path: string, body: string) {
  this.response = await this.api.post(path).send(JSON.parse(body));
});

Then('the response status is {int}', function (this: CorrelationApiWorld, status: number) {
  expect(this.response.status).toBe(status);
});

Then('the response error is {string}', function (this: CorrelationApiWorld, error: string) {
  expect(this.response.body.error).toBe(error);
});

Then('the response body is an empty JSON array', function (this: CorrelationApiWorld) {
  expect(this.response.body).toEqual([]);
});

Then(
  'the response contains one correlation result with {int} data points, coefficient {float} and interpretation {string}',
  function (this: CorrelationApiWorld, dataPoints: number, value: number, interpretation: string) {
    expect(this.response.body).toEqual([{
      firstVariable: 'Requirements',
      firstVariableLabel: 'Requirements',
      secondVariable: 'Design',
      secondVariableLabel: 'Design',
      dataPoints,
      value: expect.any(Number),
      interpretation
    }]);
    expect(this.response.body[0].value).toBeCloseTo(value, 8);
  }
);
