import { randomUUID } from 'crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Small structured logger with explicit redaction.
 *
 * The operational requirement is proportionate: JSON lines that the hosting
 * platform can search, request correlation, and no secrets. It is deliberately
 * not a logging framework — a deployment can forward stdout to any collector.
 */

const SENSITIVE_KEY = /pass(word)?|secret|token|authorization|cookie|credential|signature|session/i;
const TOKEN_IN_STRING = /(token|signature|password|secret|authorization|cookie)=([^&\s"']+)/gi;
const BEARER = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;
const CREDENTIAL_URI = /\b(mongodb(?:\+srv)?|rediss?|smtps?|https?):\/\/[^@\s]+@/gi;

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogFields {
  [key: string]: unknown;
}

function redactString(value: string): string {
  return value
    .replace(CREDENTIAL_URI, '$1://[REDACTED]@')
    .replace(TOKEN_IN_STRING, '$1=[REDACTED]')
    .replace(BEARER, 'Bearer [REDACTED]');
}

/** Recursively removes values for keys that can carry credentials or URLs. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 5) return '[TRUNCATED]';
  if (typeof value === 'string') return redactString(value);
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (typeof value === 'object' && value !== null) {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      output[key] = SENSITIVE_KEY.test(key) ? '[REDACTED]' : redact(item, depth + 1);
    }
    return output;
  }
  return value;
}

export function log(level: LogLevel, event: string, fields: LogFields = {}): void {
  const record = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...(redact(fields) as Record<string, unknown>),
  };
  const line = JSON.stringify(record);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    /** Correlation id echoed to the client and included in server logs. */
    requestId?: string;
  }
}

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{8,64}$/;

/**
 * Assigns a request id (honouring a safe inbound `x-request-id`) and logs one
 * completion line. Query strings are not logged because they can contain
 * sensitive values; the path is sufficient for correlation.
 */
export const requestContext: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const inbound = req.header('x-request-id');
  const requestId =
    inbound !== undefined && REQUEST_ID_PATTERN.test(inbound) ? inbound : randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    log(res.statusCode >= 500 ? 'error' : 'info', 'http.request', {
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Math.round(durationMs),
    });
  });
  next();
};
