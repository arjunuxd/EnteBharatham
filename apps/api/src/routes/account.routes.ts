import { Router } from 'express';
import { createAccountHandlers } from '../controllers/account.controller.js';
import { validateBody } from '../middleware/validate.js';
import type { RateLimiters } from '../middleware/rateLimit.js';
import type { EmailService } from '../services/email/emailService.js';
import {
  emailVerificationConfirmSchema,
  emailVerificationRequestSchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
} from '../validation/phase4.schema.js';

/**
 * Account recovery routes. Every endpoint is rate-limited with the shared
 * account-recovery limiter; all state-changing requests also pass through the
 * global CSRF middleware.
 */
export function createAccountRoutes(emailService: EmailService, limiters: RateLimiters): Router {
  const router = Router();
  const handlers = createAccountHandlers(emailService);

  router.post(
    '/verify-email/request',
    limiters.accountRecovery,
    validateBody(emailVerificationRequestSchema),
    handlers.requestVerification,
  );
  router.post(
    '/verify-email/confirm',
    limiters.accountRecovery,
    validateBody(emailVerificationConfirmSchema),
    handlers.confirmVerification,
  );
  router.post(
    '/password-reset/request',
    limiters.accountRecovery,
    validateBody(passwordResetRequestSchema),
    handlers.requestReset,
  );
  router.post(
    '/password-reset/confirm',
    limiters.accountRecovery,
    validateBody(passwordResetConfirmSchema),
    handlers.confirmReset,
  );

  return router;
}
