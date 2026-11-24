import { After, Before, DataTable, Given, Then, When, World, Status } from '@cucumber/cucumber';
import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import expect from 'expect';
import { Browser, launch, Page } from 'puppeteer';

interface CorrelationWorld extends World {
  browser?: Browser;
  page: Page;
  directory?: string;
  server?: ChildProcessWithoutNullStreams;
}

const section = 'section[aria-labelledby="correlation-heading"]';
const result = `${section} article`;
const action = `${section} ::-p-aria(Ver dados de correlação[role="button"])`;
const serverDir = resolve(__dirname, '../../../server');

Before({ tags: '@correlacao' }, async function (this: CorrelationWorld) {
  this.browser = await launch({
    headless: true,
    args: process.env.GUI_CHROME_NO_SANDBOX === '1' ? ['--no-sandbox'] : []
  });
  this.page = await this.browser.newPage();
  await this.page.setViewport({ width: 1280, height: 900 });
});

After({ tags: '@correlacao' }, async function (this: CorrelationWorld, scenario) {
  try {
    if (this.page && scenario.result?.status === Status.FAILED) {
      await attachCorrelation(this);
    }
  } finally {
    try {
      await this.browser?.close();
    } finally {
      await stopServer(this);
    }
  }
});

async function stopServer(world: CorrelationWorld) {
  const server = world.server;
  if (server && server.pid && server.exitCode === null && server.signalCode === null) {
    await new Promise<void>(done => {
      server.once('exit', () => done());
      server.kill();
    });
  }
  if (world.directory) await rm(world.directory, { recursive: true, force: true });
}

async function attachCorrelation(world: CorrelationWorld) {
  const area = await world.page.$(section);
  if (area) await world.attach(await area.screenshot({ encoding: 'base64' }), 'base64:image/png');
}

async function loadClasses(world: CorrelationWorld, rows: Record<string, string>[]) {
  const directory = await mkdtemp(join(tmpdir(), 'correlation-gui-'));
  world.directory = directory;
  const students = rows.map((_, index) => ({
    name: `Aluno de teste ${index + 1}`,
    cpf: String(91000000001 + index),
    email: `aluno${index + 1}@example.com`
  }));
  const classes = rows.map((row, index) => {
    const [year, semester] = row.turma.split('.').map(Number);
    const evaluations = ['Requirements', 'Design']
      .filter(goal => row[goal])
      .map(goal => ({ goal, grade: row[goal] }));
    return {
      topic: `ESS ${row.turma}`, year, semester,
      enrollments: [{ studentCPF: students[index].cpf, evaluations }]
    };
  });

  await mkdir(join(directory, 'data'));
  await writeFile(join(directory, 'data/app-data.json'), JSON.stringify({ students, classes }));
  const server = spawn(process.execPath, ['-r', require.resolve('ts-node/register/transpile-only'),
    join(serverDir, 'src/index.ts')], {
    cwd: directory,
    env: { ...process.env, PORT: '3005', TS_NODE_PROJECT: join(serverDir, 'tsconfig.json') }
  });
  world.server = server;
  await new Promise<void>((ready, fail) => {
    server.on('error', fail);
    server.on('exit', code => fail(new Error(`Servidor de teste encerrou (${code})`)));
    server.stderr.on('data', data => process.stderr.write(data));
    server.stdout.on('data', data => {
      if (String(data).includes('Server running')) ready();
    });
  });
  await world.page.goto('http://localhost:3004');
  await world.page.locator('[data-testid="classes-tab"]').click();
  await world.page.waitForSelector(`${section} button[aria-pressed]`, { visible: true });
}

Given('que existem turmas com os conceitos abaixo:', async function (this: CorrelationWorld, table: DataTable) {
  await loadClasses(this, table.hashes());
});

Given('que existem turmas sem avaliações', async function (this: CorrelationWorld) {
  await loadClasses(this, [{ turma: '2024.1' }, { turma: '2024.2' }]);
});

When('seleciono as turmas {string}', async function (this: CorrelationWorld, turmas: string) {
  for (const turma of turmas.split(', ')) {
    await this.page.locator(`${section} button[aria-pressed] ::-p-text(ESS ${turma})`).click();
  }
});

When('escolho {string} e {string} como variáveis', async function (this: CorrelationWorld, a: string, b: string) {
  await this.page.locator(`${section} ::-p-aria(Variável A[role="combobox"])`).fill(a);
  await this.page.locator(`${section} ::-p-aria(Variável B[role="combobox"])`).fill(b);
});

When('peço os dados de correlação', async function (this: CorrelationWorld) {
  await this.page.locator(action).click();
});

Then('vejo uma correlação com coeficiente {string} e {string}', async function (this: CorrelationWorld, coefficient: string, count: string) {
  await this.page.waitForSelector(result, { visible: true });
  const cards = await this.page.$$eval(result, elements => elements.map(el => el.textContent));
  expect(cards).toHaveLength(1);
  expect(cards[0]).toContain('Requirements ↔ Design');
  expect(cards[0]).toContain(count);
  expect(cards[0]).toContain(`(${coefficient})`);
});

Then('a frase do resultado contém {string}', async function (this: CorrelationWorld, interpretation: string) {
  const text = await this.page.$eval(`${result} p`, el => el.innerText);
  expect(text).toContain(`Há uma correlação ${interpretation} entre requirements e design`);
  await attachCorrelation(this);
});

Then('o botão de correlação fica desabilitado e não há resultado', async function (this: CorrelationWorld) {
  expect(await this.page.$(result)).toBeNull();
  expect(await this.page.$eval(action, el => (el as HTMLButtonElement).disabled)).toBe(true);
});

Then('vejo o aviso de dados insuficientes e não há resultado', async function (this: CorrelationWorld) {
  const status = `${section} [role="status"]`;
  await this.page.waitForSelector(status, { visible: true });
  expect(await this.page.$eval(status, el => el.textContent?.trim())).toBe(
    'Não há dados suficientes para construir correlações com as seleções atuais.'
  );
  expect(await this.page.$(result)).toBeNull();
});
