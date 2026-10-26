import type { RequestHandler } from 'express';
import { getValidatedQuery } from '../middleware/validate.js';
import { getHealth, getReadiness } from '../services/health.service.js';
import type { HealthQuery } from '../validation/health.schema.js';

export function createHealthHandler(environment: string): RequestHandler {
  return (req, res) => {
    const { verbose } = getValidatedQuery<HealthQuery>(res);
    res.json(getHealth(verbose === '1', environment));
  };
}

/** Readiness probe: 200 when the database is connected, 503 otherwise. */
export const readinessHandler: RequestHandler = (_req, res) => {
  const readiness = getReadiness();
  res.status(readiness.status === 'ready' ? 200 : 503).json(readiness);
};
