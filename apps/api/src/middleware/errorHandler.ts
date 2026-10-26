import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';
import { log } from '../utils/logger.js';
interface BodyParserError {
  type?: string;
  statusCode?: number;
  status?: number;
}

/**
 * Mongoose errors are recognised structurally (by name) rather than by
 * importing Mongoose, so the handler stays independent of the driver and
 * cannot accidentally leak driver internals to the client.
 */
interface MongooseCastLike {
  name?: string;
  path?: string;
}

interface MongooseValidationLike {
  name?: string;
  errors?: Record<string, { message?: string }>;
}

/** Multer errors are structural here so no upload internals reach clients. */
interface MulterLike {
  name?: string;
  code?: string;
}

/**
 * Zod's built-in messages describe types and shapes ("Invalid input: expected
 * string, received undefined"). Forms should only show plain-language prompts;
 * author-written custom messages (for example "Attribution name is required")
 * are kept because they tell the contributor what to fix.
 */
const DEFAULT_ZOD_MESSAGE =
  /^(Invalid input|Invalid string|Invalid option|Invalid format|Unrecognized key|Too small|Too big|String must contain|Number must be|Array must contain|Expected .+ received)/i;

function safeValidationMessage(message: string): string {
  return DEFAULT_ZOD_MESSAGE.test(message) ? 'Please check this value and try again.' : message;
}

/**
 * Centralized error handler. Returns safe messages to clients and never
 * leaks stack traces or internals in production.
 */
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof AppError) {
    // Curated 4xx messages are safe to show. A 5xx AppError is still an
    // internal failure: log it server-side and return a plain-language message
    // with the stable code, never the internal description.
    if (error.statusCode >= 500) {
      log('error', 'http.app_error', {
        requestId: _req.requestId,
        errorCode: error.code,
      });
      const requestId = typeof _req.requestId === 'string' ? _req.requestId : undefined;
      res.status(error.statusCode).json({
        error: {
          message: 'Something went wrong on our side. Please try again in a moment.',
          code: error.code,
          ...(requestId !== undefined ? { reference: requestId } : {}),
        },
      });
      return;
    }

    const body: { message: string; code: string; details?: unknown } = {
      message: error.message,
      code: error.code,
    };
    if (error.details !== undefined) {
      body.details = error.details;
    }
    res.status(error.statusCode).json({ error: body });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        message: 'Some details need attention. Please check them and try again.',
        code: 'VALIDATION_ERROR',
        details: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: safeValidationMessage(issue.message),
        })),
      },
    });
    return;
  }

  // A malformed identifier (or a document that violates the schema) is a
  // client mistake, not a server fault: answer 400 instead of 500 and never
  // echo the rejected value back to the caller.
  const castLike = error as MongooseCastLike;
  if (castLike?.name === 'CastError') {
    res.status(400).json({
      error: {
        message: 'That item reference is not valid',
        code: 'VALIDATION_ERROR',
        details: [
          { path: castLike.path ?? 'id', message: 'Please check this value and try again.' },
        ],
      },
    });
    return;
  }

  const validationLike = error as MongooseValidationLike;
  if (validationLike?.name === 'ValidationError' && validationLike.errors !== undefined) {
    res.status(400).json({
      error: {
        message: 'Some details need attention. Please check them and try again.',
        code: 'VALIDATION_ERROR',
        details: Object.entries(validationLike.errors).map(([path]) => ({
          path,
          message: 'Please check this value and try again.',
        })),
      },
    });
    return;
  }

  // Upload failures are client mistakes (too large, too many, wrong field).
  // Return friendly, specific messages and never Multer's own wording.
  const multerError = error as MulterLike;
  if (multerError?.name === 'MulterError') {
    if (multerError.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({
        error: {
          message: 'That file is too large. Please choose a smaller file.',
          code: 'PAYLOAD_TOO_LARGE',
        },
      });
      return;
    }
    res.status(400).json({
      error: {
        message: 'That upload could not be accepted. Please choose a single supported file.',
        code: 'INVALID_UPLOAD',
      },
    });
    return;
  }

  // Body-parser failures (malformed or oversized JSON) — safe generic
  // messages with the correct client-error status, never the parse error.
  const bodyError = error as BodyParserError;
  if (typeof bodyError?.type === 'string' && bodyError.type.startsWith('entity.')) {
    if (bodyError.type === 'entity.too.large') {
      res.status(413).json({
        error: {
          message: 'That request is too large. Please reduce it and try again.',
          code: 'PAYLOAD_TOO_LARGE',
        },
      });
      return;
    }
    res.status(400).json({
      error: {
        message: 'That request could not be read. Refresh the page and try again.',
        code: 'VALIDATION_ERROR',
      },
    });
    return;
  }

  // Unexpected error: log a redacted structured record server-side and return
  // a generic message. Stack traces never reach the client.
  const detail = error as { name?: unknown; code?: unknown; stack?: unknown };
  log('error', 'http.unhandled_error', {
    requestId: _req.requestId,
    errorName: typeof detail?.name === 'string' ? detail.name : 'Error',
    errorCode: typeof detail?.code === 'string' ? detail.code : undefined,
    stack: typeof detail?.stack === 'string' ? detail.stack : undefined,
  });
  // The request id is safe to disclose: it contains no user data and lets a
  // person quote it to support without exposing the underlying error.
  const requestId = typeof _req.requestId === 'string' ? _req.requestId : undefined;
  res.status(500).json({
    error: {
      message: 'Something went wrong on our side. Please try again in a moment.',
      code: 'INTERNAL_ERROR',
      ...(requestId !== undefined ? { reference: requestId } : {}),
    },
  });
}
