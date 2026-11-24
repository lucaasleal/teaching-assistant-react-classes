import { Router } from 'express';
import { Classes } from '../models/Classes';
import { Report } from '../models/Report';
import { Comparison, ComparisonPayload } from '../models/Comparison';
import { badRequest, notFound } from './HttpError';
import { isNonEmptyString, isNonEmptyStringArray } from './validation';

/** Checks that a request body carries valid parameters for class comparison. */
function requireComparisonFields(body: unknown): ComparisonPayload {
  const payload = (body ?? {}) as Record<string, unknown>;
  const { topic, classIds, metrics } = payload;

  if (!isNonEmptyStringArray(classIds) || classIds.length < 2) {
    throw badRequest('É necessário fornecer ao menos duas turmas no payload');
  }

  if (!isNonEmptyStringArray(metrics)) {
    throw badRequest('É necessário selecionar ao menos uma métrica no payload');
  }

  if (topic !== undefined && !isNonEmptyString(topic)) {
    throw badRequest('A disciplina informada deve ser uma string não vazia');
  }

  return {
    topic,
    classIds,
    metrics
  };
}

/**
 * Routes for class statistics reports and performance comparison.
 * Mounted at /api/classes.
 *
 * @param classes the class collection to report on
 */
export function reportRoutes(classes: Classes): Router {
  const router = Router();
  const comparison = new Comparison(classes);

  // POST /api/classes/comparison - Compare performance metrics across two or more classes
  router.post('/comparison', (req, res) => {
    const payload = requireComparisonFields(req.body);
    const result = comparison.execute(payload);
    res.status(200).json(result);
  });

  // GET /api/classes/:classId/report - Generate statistics report for a class
  router.get('/:classId/report', (req, res) => {
    const classObj = classes.findClassById(req.params.classId);
    if (!classObj) {
      throw notFound('Class not found');
    }
    res.json(new Report(classObj).toJSON());
  });

  return router;
}
