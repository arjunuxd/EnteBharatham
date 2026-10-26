import { Router } from 'express';
import { createHealthHandler, readinessHandler } from '../controllers/health.controller.js';
import { validateQuery } from '../middleware/validate.js';
import { healthQuerySchema } from '../validation/health.schema.js';

export function createHealthRoutes(environment: string): Router {
  const router = Router();
  router.get('/', validateQuery(healthQuerySchema), createHealthHandler(environment));
  router.get('/ready', readinessHandler);
  return router;
}
