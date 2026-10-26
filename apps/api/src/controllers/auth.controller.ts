import type { RequestHandler } from 'express';
import { destroySession } from '../middleware/auth.js';
import { getValidatedBody } from '../middleware/validate.js';
import { authenticateUser, getCredentialVersion, registerUser } from '../services/auth.service.js';
import { recordAuditEvent } from '../services/audit.service.js';
import { getCsrfToken } from '../middleware/csrf.js';
import type { LoginInput, RegisterInput } from '../validation/auth.schema.js';
import { AppError } from '../utils/AppError.js';

/**
 * Session lifecycle handlers. The session id is regenerated on every login
 * (prevents fixation); the CSRF token lives in the session and therefore
 * rotates with it.
 */

/**
 * Registers a new contributor account, records an audit event, and starts a
 * session. Responds 409 for already-registered emails.
 */
export const registerHandler: RequestHandler = async (req, res, next) => {
  try {
    const input = getValidatedBody<RegisterInput>(res);
    const user = await registerUser(input);

    await new Promise<void>((resolve, reject) => {
      // Session stores may invoke this callback with `null` on success (for
      // example connect-mongo). Only a truthy error is a failure.
      req.session.regenerate((error) => (error ? reject(error) : resolve()));
    });
    req.session.userId = user.id;
    req.session.credentialVersion = 0;
    await new Promise<void>((resolve, reject) => {
      req.session.save((error) => (error ? reject(error) : resolve()));
    });

    await recordAuditEvent({
      action: 'user.registered',
      actorId: user.id,
      actorRole: user.role,
    });

    res.status(201).json({ user, csrfToken: await getCsrfToken(req) });
  } catch (error) {
    next(error);
  }
};

/** Authenticates and starts a session with a fresh session id. */
export const loginHandler: RequestHandler = async (req, res, next) => {
  try {
    const input = getValidatedBody<LoginInput>(res);
    const user = await authenticateUser(input);
    const credentialVersion = await getCredentialVersion(user.id);

    // Regenerate before trusting the session: a pre-login session id from
    // another user (fixation) is discarded.
    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((error) => (error ? reject(error) : resolve()));
    });
    req.session.userId = user.id;
    req.session.credentialVersion = credentialVersion;
    await new Promise<void>((resolve, reject) => {
      req.session.save((error) => (error ? reject(error) : resolve()));
    });

    res.json({ user, csrfToken: await getCsrfToken(req) });
  } catch (error) {
    next(error);
  }
};

/** Destroys the session. Idempotent: logging out twice is a no-op. */
export const logoutHandler: RequestHandler = async (req, res, next) => {
  try {
    await destroySession(req);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

/**
 * Returns the authenticated account, or 401. Also returns the current CSRF
 * token so a page reload can resynchronise its header.
 */
export const meHandler: RequestHandler = async (req, res, next) => {
  try {
    const user = req.currentUser;
    if (user === undefined) {
      throw new AppError(401, 'Please sign in to continue', 'UNAUTHENTICATED');
    }
    res.json({ user, csrfToken: await getCsrfToken(req) });
  } catch (error) {
    next(error);
  }
};
