import { Router } from 'express';
import {
  loginHandler,
  logoutHandler,
  meHandler,
  registerHandler,
} from '../controllers/auth.controller.js';
import { getCsrfToken } from '../middleware/csrf.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import type { RateLimiters } from '../middleware/rateLimit.js';
import { loginSchema, registerSchema } from '../validation/auth.schema.js';

/**
 * Session authentication routes.
 *
 * - Register/login share one rate limiter (brute-force protection across both
 *   endpoints, not per endpoint).
 * - The CSRF endpoint issues the synchroniser token stored in the session;
 *   the global `csrfProtection` middleware exempts safe methods, so this GET
 *   never needs a token itself.
 * - Login regenerates the session id (fixation defense); the issued CSRF
 *   token therefore also rotates at login.
 */
export function createAuthRoutes(limiters: Pick<RateLimiters, 'authAttempts'>): Router {
  const router = Router();

  router.get('/csrf', (req, res, next) => {
    const csrfToken = getCsrfToken(req);
    // Persist the new session before responding. Without an explicit save the
    // client can issue its next CSRF-protected request before the store has
    // committed the token/session, which surfaces as a spurious 403 under load.
    req.session.save((error) => {
      if (error) {
        next(error);
        return;
      }
      res.json({ csrfToken });
    });
  });

  router.post('/register', limiters.authAttempts, validateBody(registerSchema), registerHandler);
  router.post('/login', limiters.authAttempts, validateBody(loginSchema), loginHandler);
  router.post('/logout', requireAuth, logoutHandler);
  router.get('/me', requireAuth, meHandler);

  return router;
}
