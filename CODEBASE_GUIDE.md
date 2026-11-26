# Teaching Assistant codebase guide

This document explains the repository as it exists now: its architecture, runtime
flow, data model, API, user interface, tests, configuration, and unfinished
features. The main application is a React + Express/TypeScript system. The
`ta-gui` directory is a separate Angular starter and is not part of the root
React/Express commands.

## 1. What the application does

The application helps a professor:

- register, edit, list, filter, and delete students;
- create, edit, list, and delete class offerings;
- enroll registered students in classes;
- assign one of `MANA`, `MPA`, or `MA` to six learning goals;
- compare class-level results with Pearson correlation;
- persist students, classes, enrollments, evaluations, and some grade metadata
  in a JSON file.

The deployed application is deliberately small: there is no database,
authentication, authorization, user account, or migration system. The server
loads all state into memory at startup and writes the complete state back to one
file after each successful mutation.

## 2. Repository map

```text
/
├── package.json                 Root workspace scripts
├── README.md                    Setup, API, deployment, and project overview
├── install-deps.sh              Convenience dependency installer
├── features/                    Older/root-level Cucumber feature files
├── stepDefinitions/             Older/root-level Cucumber step definitions
├── .vscode/                     Debug and task launch configurations
├── client/                      The working React front end
├── server/                      The working Express back end
└── ta-gui/                      Separate Angular CLI starter application
```

`node_modules`, build output, caches, and generated reports are not application
source. The source of truth is the tracked files under `client/src`,
`server/src`, and (for the unfinished second UI) `ta-gui/src`.

## 3. How to run it

Requirements are Node.js 18.14+ and npm 9+. From the repository root:

```bash
npm install
npm run dev
```

The root `package.json` uses npm workspaces for `client` and `server`.
`npm run dev` uses `concurrently` to run:

- React development server: `http://localhost:3004`
- Express API: `http://localhost:3005`

The client port and API URL are in [`client/.env`](client/.env). The server reads
`PORT`, defaulting to 3005; the documented example is
[`server/.env.example`](server/.env.example). Individual processes can be run
with `npm run client` or `npm run server`.

The React entry point is [`client/src/index.tsx`](client/src/index.tsx), which
mounts `App` inside `React.StrictMode`. The server entry point is
[`server/src/index.ts`](server/src/index.ts), which creates the domain
collections, loads JSON data, builds Express, and starts listening.

## 4. End-to-end request flow

For a normal write, the flow is:

1. A React component collects form or selection data.
2. A service in `client/src/services` calls the shared `apiClient`.
3. `apiClient` prefixes the path with `REACT_APP_API_URL`, sends JSON, and
   converts non-2xx responses into an `ApiError`.
4. Express parses JSON and dispatches to a router mounted by
   [`server/src/app.ts`](server/src/app.ts).
5. The route validates the request and calls a domain model.
6. The model enforces rules such as unique CPF, unique class ID, or one
   enrollment per student.
7. The route returns JSON (or 204 for deletion) and invokes `onStateChanged`.
8. `onStateChanged` schedules a repository save with `setImmediate`, so disk I/O
   does not hold up the HTTP response.
9. The component refreshes its server-backed state and renders the result.

The application composition is intentionally dependency-injected. `createApp`
receives `StudentSet`, `Classes`, and an `AppStateRepository`, so tests can use
the same routes with an in-memory repository instead of touching the committed
data file.

## 5. Server architecture

### `server/src/index.ts`

This is the composition root. It:

- chooses `PORT`;
- creates an empty `StudentSet` and `Classes`;
- creates `JsonFileRepository` for `./data/app-data.json`;
- loads persisted data into the collections;
- calls `createApp(...)`;
- starts the HTTP listener.

### `server/src/app.ts`

`createApp` creates Express, enables CORS and JSON parsing, defines the
persistence callback, mounts all routers under `/api`, and installs the final
error handler. It owns no domain state itself.

### `server/src/routes`

- [`students.ts`](server/src/routes/students.ts): list/create/read/update/delete
  students. CPF path parameters may be formatted or plain digits.
- [`classes.ts`](server/src/routes/classes.ts): list/create/update/delete
  classes and build correlation results.
- [`enrollments.ts`](server/src/routes/enrollments.ts): enroll/unenroll students,
  list enrollments, read averages, and add/update/remove evaluations.
- [`reports.ts`](server/src/routes/reports.ts): returns the current report
  placeholder for one class.
- [`gradeImport.ts`](server/src/routes/gradeImport.ts): explicitly returns 501;
  it does not accept or store uploads yet.
- [`validation.ts`](server/src/routes/validation.ts): small runtime type guards
  for strings, non-empty strings, and integers.
- [`HttpError.ts`](server/src/routes/HttpError.ts): creates 400/404 errors and
  turns expected errors into `{ "error": "..." }`.

Routes throw errors rather than repeating response handling. The shared handler
maps `HttpError` and middleware errors with a status to that status, maps
`DomainError` to 400, and logs unexpected errors while returning a generic 500.
Malformed JSON therefore gets an explicit client error instead of being treated
as a domain failure.

## 6. Server domain model

All domain classes live in [`server/src/models`](server/src/models). They do
not know about Express or the JSON file.

### Students

- [`Student.ts`](server/src/models/Student.ts) stores name, immutable clean CPF,
  and email.
- CPF is normalized by [`CPF.ts`](server/src/models/CPF.ts): dots and hyphens
  are removed internally, and API JSON formats it as `000.000.000-00`.
- CPF validation currently means exactly 11 digits; it does not verify Brazilian
  CPF check digits.
- Email validation rejects whitespace, malformed local/domain parts, repeated
  dots, and invalid domain hyphen placement.
- [`StudentSet.ts`](server/src/models/StudentSet.ts) owns the collection,
  rejects duplicate clean CPFs, updates only name/email, and returns copies of
  its array.
- [`DomainError.ts`](server/src/models/DomainError.ts) represents a business
  rule failure.

### Classes and enrollments

- [`Class.ts`](server/src/models/Class.ts) represents one offering. Its ID is
  `${topic}-${year}-${semester}`. It holds an immutable reference to an
  `AverageCalculationSpecification` and a private enrollment array.
- [`Classes.ts`](server/src/models/Classes.ts) enforces unique IDs and provides
  lookup, removal, year/topic filtering, and unique enrolled-student
  aggregation. `updateClassIdentification` changes the ID while checking for
  conflicts.
- [`Enrollment.ts`](server/src/models/Enrollment.ts) links a `Student` to
  evaluations, optional pre/post-final averages, and an absence-failure flag.
  Evaluation insertion is an upsert by goal.
- `Class.addEnrollment` rejects duplicate enrollment. Removing a student from
  `StudentSet` does **not** remove that student's existing enrollments; the
  enrollment retains its object reference.

### Evaluations and averages

- [`Evaluation.ts`](server/src/models/Evaluation.ts) defines the grades
  `MANA`, `MPA`, and `MA`, the `isGrade` guard, and the six goals:
  Requirements, Configuration Management, Project Management, Design, Tests,
  and Refactoring.
- [`AverageCalculationSpecification.ts`](server/src/models/AverageCalculationSpecification.ts)
  stores grade points and goal weights as copied `Map`s. The default assigns
  `MANA=0`, `MPA=7`, `MA=10`, and weight 1 to every goal. Its calculation is a
  weighted mean over the grades supplied.
- The specification serializes maps as plain JSON objects. Its loader also
  accepts older Portuguese property names and older array-of-pairs formats.
- [`Enrollment.calculateAverageBeforeFinalExam` and
  `calculateAverageAfterFinalExam`](server/src/models/Enrollment.ts) are
  intentionally not implemented; they throw. The route currently exposes stored
  averages, which are normally `null`, rather than calculating them.

### Correlation

- [`ComputeCorrelation.ts`](server/src/models/ComputeCorrelation.ts) computes
  Pearson's coefficient for two equally sized, non-constant arrays.
- [`BuildCorrelation.ts`](server/src/models/BuildCorrelation.ts) accepts at
  least two class IDs and two different known variables. For each selected
  class it averages the selected students' values, then correlates the
  class-level values. Missing data points are skipped.
- Supported variables are attendance rate, overall average, and the six goals.
  Attendance is currently binary: not failed by absence = 1, failed by absence =
  0. `overallAverage` means the mean of available goal grades, not the
  `AverageCalculationSpecification` average.
- Results classify absolute correlation strength as weak/no (`<0.3`),
  moderate (`0.3` to `<0.7`), or strong (`>=0.7`), with positive/negative
  wording. Constant data produces a coefficient of 0 instead of calling the
  calculator.

### Reports

[`Report.ts`](server/src/models/Report.ts) defines the intended report shape
(class metadata, enrollment count, averages, approval counts, goal performance,
student rows, timestamp), but `generate()` currently returns zero/empty
placeholders. All private calculation helpers are also stubs. The endpoint is
therefore structurally present but not a real grade report.

## 7. Persistence

### Repository boundary

[`AppStateRepository.ts`](server/src/persistence/AppStateRepository.ts) defines
`load` and `save`. `InMemoryOnlyRepository` is used by tests and is a no-op.
This boundary is the intended replacement point for a database.

### JSON implementation

[`JsonFileRepository.ts`](server/src/persistence/JsonFileRepository.ts):

- writes students, classes, specifications, enrollment CPF references,
  evaluations, averages, and absence status;
- creates the parent directory before saving;
- loads only if the file exists;
- rebuilds students first, then classes, then resolves each enrollment CPF;
- logs and skips invalid individual records so one bad record does not prevent
  startup;
- logs a corrupt-file or filesystem error rather than throwing out of startup;
- reads legacy Portuguese names such as `mediaPreFinal` and
  `especificacaoDoCalculoDaMedia`, but writes only the current English names.

The committed example is [`server/data/app-data.json`](server/data/app-data.json).
It contains four students, two 2025 class offerings, and sample enrollments and
evaluations. [`server/data/students.json`](server/data/students.json) is a
separate older/simple student fixture and is not loaded by `index.ts`.

Persistence is a whole-file snapshot. It is not transactional, versioned, or
safe for multiple server processes writing concurrently. On ephemeral hosting
such as a free Render service, changes disappear when the instance restarts.

## 8. HTTP API

All API paths are under `http://localhost:3005/api`. JSON errors use
`{ "error": "message" }`.

### Students

| Method | Path | Behavior |
|---|---|---|
| GET | `/students` | All students |
| POST | `/students` | Requires string `name`, `cpf`, `email`; returns 201 |
| GET | `/students/:cpf` | One student; formatted/plain CPF accepted |
| PUT | `/students/:cpf` | Requires string `name` and `email`; CPF cannot change |
| DELETE | `/students/:cpf` | Removes the registered student; returns 204 |

### Classes

| Method | Path | Behavior |
|---|---|---|
| GET | `/classes` | All classes with nested enrollments |
| POST | `/classes` | Requires non-empty `topic` and integer `semester`/`year`; returns 201 |
| PUT | `/classes/:id` | Changes topic/year/semester and therefore the ID |
| DELETE | `/classes/:id` | Removes a class; returns 204 |
| POST | `/classes/correlation` | Body: `{ classIds, variables }`; returns correlation results |
| GET | `/classes/:id/report` | Returns the report placeholder |
| POST | `/classes/gradeImport/:id` | Returns 501; import is not implemented |

### Enrollments and evaluations

| Method | Path | Behavior |
|---|---|---|
| POST | `/classes/:id/enroll` | Body `{ studentCPF }`; resolves a registered student |
| DELETE | `/classes/:id/enroll/:cpf` | Removes an enrollment; returns 204 |
| GET | `/classes/:id/enrollments` | Lists enrollment JSON |
| GET | `/classes/:id/enrollments/:cpf/evaluation` | Returns student plus stored `average` and `final_average` |
| PUT | `/classes/:id/enrollments/:cpf/evaluation` | Body `{ goal, grade }`; empty grade removes that goal |

The API currently does not expose a server-side student list import endpoint
despite the React UI showing a sheet picker.

## 9. React client

### Application state and tabs

[`client/src/App.tsx`](client/src/App.tsx) owns the top-level students,
classes, selected class, loading state, error message, editing student, and
active tab. On mount it fetches students and classes. It passes refresh and
error callbacks down instead of using a global store.

The three tabs are:

- `StudentsTab`: class filter, student form, sheet-import placeholder, and list.
- `Classes`: class form/list, enrollment modal, and correlation controls.
- `Evaluations`: class selector and a matrix of student × learning goal grades.

After mutations, components generally re-fetch the relevant resource. A class
selection in the evaluations tab is saved in `localStorage` under
`evaluations-selected-class`.

### Components

- [`StudentsTab.tsx`](client/src/components/StudentsTab.tsx) composes student
  UI and limits the list to a selected class's enrolled students.
- [`ClassFilter.tsx`](client/src/components/ClassFilter.tsx) selects “All
  Students” or one class.
- [`StudentForm.tsx`](client/src/components/StudentForm.tsx) creates or edits
  students, formats CPF input, and auto-enrolls a newly created student into
  the selected class. Creation and enrollment are two separate requests.
- [`StudentList.tsx`](client/src/components/StudentList.tsx) renders a table
  and confirms before deletion.
- [`StudentListImport.tsx`](client/src/components/StudentListImport.tsx)
  selects CSV/XLS/XLSX files, but does not upload or parse them. Its submit
  handler currently stops after setting `isSubmitting`.
- [`Classes.tsx`](client/src/components/Classes.tsx) coordinates class data,
  student loading, editing, and the enrollment modal.
- [`ClassForm.tsx`](client/src/components/ClassForm.tsx) creates or renames a
  class. The UI offers the current year ±5 and semesters 1/2.
- [`ClassList.tsx`](client/src/components/ClassList.tsx) renders class actions.
- [`EnrollmentModal.tsx`](client/src/components/EnrollmentModal.tsx) selects
  available registered students and sends enrollment requests in parallel.
- [`Evaluations.tsx`](client/src/components/Evaluations.tsx) loads classes,
  renders six grade selectors per student, and sends evaluation updates.
- [`CorrelationSection.tsx`](client/src/components/CorrelationSection.tsx)
  selects classes and two variables, then displays the server's result. Some
  visible text is Portuguese even though most UI text is English.
- [`ImportGrade.tsx`](client/src/components/ImportGrade.tsx) only renders the
  heading “Grade Import”; it does not call the 501 API.

[`client/src/App.css`](client/src/App.css) contains all React styling.
[`client/public/index.html`](client/public/index.html) is the HTML shell used
by Create React App.

### Services and shared client types

- [`apiClient.ts`](client/src/services/apiClient.ts) centralizes base URL,
  `fetch`, JSON request bodies, 204 handling, and server error extraction.
- [`StudentService.ts`](client/src/services/StudentService.ts) wraps student
  endpoints. Its old `updateEvaluation` method remains for compatibility but
  targets a deprecated endpoint.
- [`ClassService.ts`](client/src/services/ClassService.ts) wraps class,
  report, and correlation endpoints.
- [`EnrollmentService.ts`](client/src/services/EnrollmentService.ts) wraps
  enrollment and evaluation endpoints.
- `client/src/types` mirrors API payloads: students, classes, enrollments,
  evaluations, reports, correlation results, CPF formatting, and the average
  specification. These are compile-time interfaces/constants, not runtime
  validation.

The client and server intentionally duplicate several constants (grades,
learning goals, correlation variables). They must be kept synchronized
manually.

## 10. Angular `ta-gui` directory

`ta-gui` is an Angular 22 SSR starter generated separately from the React
application. It has its own `package.json`, lockfile, TypeScript configs,
Angular config, and scripts. It is not included in the root npm workspaces and
is not started by `npm run dev`.

Important files:

- [`ta-gui/src/main.ts`](ta-gui/src/main.ts): browser bootstrap.
- [`ta-gui/src/main.server.ts`](ta-gui/src/main.server.ts): SSR bootstrap.
- [`ta-gui/src/app/app.ts`](ta-gui/src/app/app.ts): one starter component with
  a `title` signal set to `ta-gui`.
- [`ta-gui/src/app/app.html`](ta-gui/src/app/app.html): default Angular
  welcome template and styles; it contains no teaching-assistant feature.
- [`ta-gui/src/app/app-module.ts`](ta-gui/src/app/app-module.ts): Angular
  `NgModule` and hydration providers.
- [`ta-gui/src/app/app-routing-module.ts`](ta-gui/src/app/app-routing-module.ts):
  empty route list.
- [`ta-gui/src/app/app.module.server.ts`](ta-gui/src/app/app.module.server.ts):
  SSR providers.
- [`ta-gui/src/app/app.routes.server.ts`](ta-gui/src/app/app.routes.server.ts):
  prerenders all routes.
- [`ta-gui/src/server.ts`](ta-gui/src/server.ts): Angular SSR Express host,
  static-file serving, and catch-all rendering. It defaults to port 4000.
- [`ta-gui/src/app/app.spec.ts`](ta-gui/src/app/app.spec.ts): starter tests
  checking component creation and “Hello, ta-gui”.

The Angular README and CSS are generated starter documentation/presentation,
not shared application logic.

## 11. Tests and acceptance tests

Run unit/component tests with:

```bash
npm test
npm run test:server
npm run test:client
```

Server tests use Jest, ts-jest, and Supertest. They cover model rules,
validation, persistence round trips and legacy data, error mapping, and the
student/class/enrollment/evaluation endpoints. The server test composition
helper is [`server/src/__tests__/support/newTestApp.ts`](server/src/__tests__/support/newTestApp.ts).

Client tests use Create React App's Jest runner and Testing Library. They cover
the shared HTTP client, services, main components, form behavior, lists, and
evaluation UI. [`client/src/setupTests.ts`](client/src/setupTests.ts) installs
Testing Library matchers, while `client/src/test-support/fixtures.ts` provides
test data.

Browser acceptance tests use Cucumber + Puppeteer:

```bash
npm run dev
npm run test:cucumber
```

The feature files are in [`client/src/features`](client/src/features), step
definitions in [`client/src/step-definitions`](client/src/step-definitions), and
configuration in [`client/cucumber.js`](client/cucumber.js). The Cucumber
configuration forces `tsconfig.test.json` because test steps need CommonJS
module behavior. The root `features/` and `stepDefinitions/` are an older
parallel test location and are not the path used by the client script.

`cypress.json` is a small legacy configuration pointing at those root-level
feature/step-definition directories; the current package scripts do not invoke
Cypress.

## 12. Build and debug configuration

- Root `package.json` defines workspace orchestration, build, and test aliases.
- `client/tsconfig.json` and `client/tsconfig.test.json` configure application
  and Cucumber/test compilation.
- `server/tsconfig.json` compiles the API to `dist`; `server/jest.config.json`
  configures Jest and coverage.
- `package-lock.json`, `client/package-lock.json`, `server/package-lock.json`,
  and `ta-gui/package-lock.json` lock dependencies for their respective
  package contexts.
- `.gitignore` excludes generated/dependency files.
- `.vscode/tasks.json` provides dependency-install and separate start tasks.
- `.vscode/launch.json` launches the React client, Node server, Chrome, or the
  “Launch Full Stack” compound.
- `.github/PULL_REQUEST_TEMPLATE` is the pull-request checklist/template.

## 13. Known gaps and surprising behavior

These are current implementation facts, not recommendations:

1. Average calculation is implemented as a standalone specification, but
   `Enrollment` does not invoke it; stored averages remain null unless loaded
   from data or set programmatically.
2. The report endpoint returns a placeholder with zero counts and empty lists.
3. Grade import is unfinished in both layers: the server returns 501, while
   the React file picker never submits the selected file.
4. Deleting a student leaves enrollments behind, because classes store student
   object references and deletion only removes the student from `StudentSet`.
5. The correlation feature aggregates by class, despite UI wording that can
   suggest student-level comparison. Missing evaluations are omitted.
6. `Classes.updateClass` contains a merge-oriented implementation, but the
   route uses `updateClassIdentification`, so the route changes identification
   while preserving enrollments on the existing object.
7. JSON loading is intentionally lenient and logs errors; it can start with a
   partially reconstructed state.
8. The browser client has no authentication and the API enables unrestricted
   CORS.
9. There are duplicated constants and types across client/server, so changing a
   goal or variable requires coordinated edits.
10. `ta-gui` is currently a stock Angular welcome screen rather than another
    implementation of the React application.

## 14. A practical way to explore a feature

For any feature, read it in this order:

1. Start at the UI component in `client/src/components`.
2. Follow its service call in `client/src/services`.
3. Match the URL to a router in `server/src/routes`.
4. Follow the route into `server/src/models`.
5. Check persistence serialization in `JsonFileRepository`.
6. Read the closest client/server tests to see the intended edge cases.

For example, “grade a student” is:

`Evaluations.tsx` → `EnrollmentService.updateEvaluation` →
`PUT /api/classes/:id/enrollments/:cpf/evaluation` →
`Enrollment.addOrUpdateEvaluation` → `Evaluation` → deferred JSON save.

