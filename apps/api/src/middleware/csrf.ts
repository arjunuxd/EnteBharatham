import { csrfSync } from 'csrf-sync';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { AppError } from '../utils/AppError.js';

/**
 * CSRF defense for cookie-based sessions: the Synchroniser Token Pattern via
 * the maintained `csrf-sync` library (successor recommendation to the
 * deprecated `csurf`).
 *
 * - Safe methods (GET/HEAD/OPTIONS) pass through; every state-changing
 *   request must carry the token from `GET /api/v1/auth/csrf` in the
 *   `x-csrf-token` header.
 * - Tokens live server-side in the session and rotate with it (including the
 *   session regeneration performed at login).
 * - Failures become a uniform 403 `CSRF_INVALID` through the standard error
 *   handler — CORS configuration alone is never treated as CSRF protection.
 */
const csrf = csrfSync({
  errorConfig: {
    statusCode: 403,
    message: 'Your session needs to be refreshed. Please try again.',
    code: 'CSRF_INVALID',
  },
});

export const csrfProtection: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  csrf.csrfSynchronisedProtection(req, res, (error: unknown) => {
    if (error !== undefined && error !== null) {
      next(
        new AppError(403, 'Your session needs to be refreshed. Please try again.', 'CSRF_INVALID'),
      );
      return;
    }
    next();
  });
};

/** Returns (and persists in the session) the CSRF token for this session. */
export function getCsrfToken(req: Request): string {
  return csrf.generateToken(req);
}
