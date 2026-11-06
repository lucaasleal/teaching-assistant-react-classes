import express, { Express } from 'express';
import cors from 'cors';
import { StudentSet } from './models/StudentSet';
import { Classes } from './models/Classes';
import { AppStateRepository } from './persistence/AppStateRepository';
import { studentRoutes } from './routes/students';
import { studentImportRoutes } from './routes/studentImport';
import { classRoutes } from './routes/classes';
import { enrollmentRoutes } from './routes/enrollments';
import { reportRoutes } from './routes/reports';
import { gradeImportRoutes } from './routes/gradeImport';
import { errorHandler } from './routes/HttpError';
/** Everything the HTTP application needs, injected by the composition root. */
export interface AppDependencies {
  students: StudentSet;
  classes: Classes;
  repository: AppStateRepository;
}
/**
 * Builds the Express application that exposes the REST API.
 *
 * The application owns no state of its own: it operates on the given
 * collections and asks the repository to persist them after each change.
 * Persistence is deferred (setImmediate) so that responses are not delayed
 * by disk access.
 */
export function createApp({ students, classes, repository }: AppDependencies): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());
  const onStateChanged = (): void => {
    setImmediate(() => repository.save(students, classes));
  };

  app.use('/api/students', studentImportRoutes(students, classes, onStateChanged));
  app.use('/api/students', studentRoutes(students, onStateChanged));
  app.use('/api/classes', classRoutes(classes, onStateChanged));
  app.use('/api/classes', enrollmentRoutes(classes, students, onStateChanged));
  app.use('/api/classes', reportRoutes(classes));
  app.use('/api/classes', gradeImportRoutes());
  app.use(errorHandler);

  return app;
}
