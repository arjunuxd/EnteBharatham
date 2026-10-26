import { Router } from 'express';
import { updateProfileHandler } from '../controllers/profile.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { profileUpdateSchema } from '../validation/auth.schema.js';

/**
 * Account profile routes. Updates are limited to the caller's own account and
 * to the fields in the strict profile schema; role, status, and email are
 * unreachable (see docs/SECURITY.md).
 */
export function createProfileRoutes(): Router {
  const router = Router();
  router.patch('/', requireAuth, validateBody(profileUpdateSchema), updateProfileHandler);
  return router;
}
