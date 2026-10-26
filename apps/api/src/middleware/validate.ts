import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import { AppError } from '../utils/AppError.js';

/**
 * Validates req.query against a Zod schema. Express 5 exposes req.query as a
 * read-only getter, so the validated value is stored on res.locals and read
 * back with getValidatedQuery().
 */
export function validateQuery<TSchema extends ZodTypeAny>(schema: TSchema): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(
        new AppError(
          400,
          'Some filters are not valid. Please adjust them and try again.',
          'VALIDATION_ERROR',
        ),
      );
      return;
    }
    res.locals.validatedQuery = result.data;
    next();
  };
}

export function getValidatedQuery<T>(res: Response): T {
  return res.locals.validatedQuery as T;
}

/**
 * Validates req.body against a Zod schema. On failure the ZodError is passed
 * to the centralized error handler, which returns HTTP 400 with a stable code
 * and per-field messages (field paths only — never internal detail).
 */
export function validateBody<TSchema extends ZodTypeAny>(schema: TSchema): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(result.error);
      return;
    }
    res.locals.validatedBody = result.data;
    next();
  };
}

export function getValidatedBody<T>(res: Response): T {
  return res.locals.validatedBody as T;
}
