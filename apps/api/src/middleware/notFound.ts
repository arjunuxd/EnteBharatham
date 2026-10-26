import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError.js';

/** Terminal 404 handler mounted after all routes. */
export function notFound(_req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(404, 'We could not find what you were looking for', 'NOT_FOUND'));
}
