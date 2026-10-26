import type { AuthUserPublic } from '@entebharatham/shared';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { UserModel } from '../models/User.js';
import { toAuthUserDto } from '../services/user.mapper.js';
import { AppError } from '../utils/AppError.js';

/**
 * Session and role guards. The server is the single source of truth for
 * authentication and authorization: roles come from the database through the
 * session, never from client-supplied headers, bodies, or query strings.
 */

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    /** Credential version at login; a mismatch invalidates the session. */
    credentialVersion?: number;
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    /** Set by {@link loadSessionUser}; undefined for anonymous requests. */
    currentUser?: AuthUserPublic;
  }
}

/**
 * Resolves the session's `userId` to a live, active account and attaches it
 * to `req.currentUser`. A session pointing at a deleted or suspended account
 * is invalidated instead of silently trusted.
 */
export const loadSessionUser: RequestHandler = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.session.userId;
    if (userId === undefined) {
      next();
      return;
    }

    const user = await UserModel.findById(userId).exec();
    if (user === null || user.accountStatus !== 'active') {
      await destroySession(req);
      next();
      return;
    }

    // Sessions are bound to the credential version they were created with.
    // A password reset (or any future credential change) increments the
    // account version, which invalidates every pre-existing session.
    const sessionVersion = req.session.credentialVersion ?? 0;
    const accountVersion = user.credentialVersion ?? 0;
    if (sessionVersion !== accountVersion) {
      await destroySession(req);
      next();
      return;
    }

    req.currentUser = toAuthUserDto(user);
    next();
  } catch (error) {
    next(error);
  }
};

/** Destroys the current session. Safe when no session exists. */
export async function destroySession(req: Request): Promise<void> {
  await new Promise<void>((resolve) => {
    req.session.destroy(() => resolve());
  });
}

/** Rejects anonymous requests with a non-disclosing 401. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  if (req.currentUser === undefined) {
    next(new AppError(401, 'Please sign in to continue', 'UNAUTHENTICATED'));
    return;
  }
  next();
};

/**
 * Rejects authenticated users whose server-side role is not in `roles`.
 * Must run after {@link requireAuth}.
 */
export function requireRole(...roles: AuthUserPublic['role'][]): RequestHandler {
  return (req, _res, next) => {
    const user = req.currentUser;
    if (user === undefined) {
      next(new AppError(401, 'Please sign in to continue', 'UNAUTHENTICATED'));
      return;
    }
    if (!roles.includes(user.role)) {
      next(new AppError(403, 'You do not have permission to perform this action', 'FORBIDDEN'));
      return;
    }
    next();
  };
}
