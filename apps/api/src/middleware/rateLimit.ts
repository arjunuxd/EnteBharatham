import { rateLimit, type RateLimitRequestHandler } from 'express-rate-limit';
import { AppError } from '../utils/AppError.js';
import { loadEnv, type Env } from '../config/env.js';
import { MongoRateLimitStore } from './rateLimitStore.js';

/**
 * Request limiters for authentication, contribution, and moderation endpoints.
 *
 * Each `createApp()` call builds its own limiters (fresh counters), so test
 * instances are isolated. In production a shared MongoDB store is required so
 * limits apply across all API instances; memory stores are development/test
 * only and are rejected by both env validation and this module.
 *
 * Responses are deliberately uniform (429 + generic message) and carry no
 * rate-limit configuration headers, so internals are not disclosed.
 */

function resolveEnv(explicit?: Env): Env | null {
  if (explicit !== undefined) return explicit;
  try {
    return loadEnv();
  } catch {
    return null;
  }
}

function buildLimiter(
  name: string,
  windowMs: number,
  limit: number,
  env: Env | null,
): RateLimitRequestHandler {
  let store: InstanceType<typeof MongoRateLimitStore> | undefined;

  if (env?.NODE_ENV === 'production') {
    if (env.RATE_LIMIT_STORE === 'memory' || env.RATE_LIMIT_STORE === 'redis') {
      throw new AppError(500, 'Rate limit store misconfigured', 'RATE_LIMIT_STORE_INVALID');
    }
  }

  if (env?.RATE_LIMIT_STORE === 'mongo') {
    // One prefix per limiter: otherwise unrelated endpoints would share the
    // same counter for a given client.
    store = new MongoRateLimitStore({ prefix: `rl:${name}:` });
    (store as MongoRateLimitStore & { windowMs?: number }).windowMs = windowMs;
  }

  return rateLimit({
    windowMs,
    limit,
    standardHeaders: false,
    legacyHeaders: false,
    // Store outages fail closed (HTTP 500) rather than falling back to a
    // per-process memory store in production.
    passOnStoreError: false,
    ...(store ? { store } : {}),
    handler: (_request, _response, next) => {
      next(new AppError(429, 'Too many requests. Please try again later.', 'RATE_LIMITED'));
    },
  });
}

export interface RateLimiters {
  /** Anonymous public reads: listings, search, facets, profiles, translations. */
  publicRead: RateLimitRequestHandler;
  /** Shared across POST /auth/register and POST /auth/login. */
  authAttempts: RateLimitRequestHandler;
  createDraft: RateLimitRequestHandler;
  submitForReview: RateLimitRequestHandler;
  moderationActions: RateLimitRequestHandler;
  /** Community reports, correction proposals, and withdrawal requests. */
  publicReports: RateLimitRequestHandler;
  /** Media uploads. */
  mediaUploads: RateLimitRequestHandler;
  /** Email verification and password reset requests/confirmations. */
  accountRecovery: RateLimitRequestHandler;
}

/**
 * Builds the limiters with production defaults. `limits` overrides the
 * request counts (window sizes are unchanged) — used by integration tests
 * that make many more calls than a human would. `env` should be the validated
 * runtime environment; when omitted the limiters resolve it themselves for
 * legacy test call sites.
 */
export function createRateLimiters(
  limits: Partial<Record<keyof RateLimiters, number>> = {},
  env?: Env,
): RateLimiters {
  const resolved = resolveEnv(env);
  return {
    publicRead: buildLimiter('public-read', 60 * 1000, limits.publicRead ?? 300, resolved),
    authAttempts: buildLimiter('auth', 15 * 60 * 1000, limits.authAttempts ?? 15, resolved),
    createDraft: buildLimiter('draft-create', 60 * 60 * 1000, limits.createDraft ?? 60, resolved),
    submitForReview: buildLimiter(
      'draft-submit',
      60 * 60 * 1000,
      limits.submitForReview ?? 60,
      resolved,
    ),
    moderationActions: buildLimiter(
      'moderation',
      60 * 1000,
      limits.moderationActions ?? 60,
      resolved,
    ),
    publicReports: buildLimiter(
      'public-reports',
      60 * 60 * 1000,
      limits.publicReports ?? 20,
      resolved,
    ),
    mediaUploads: buildLimiter('media-upload', 60 * 60 * 1000, limits.mediaUploads ?? 20, resolved),
    accountRecovery: buildLimiter(
      'account-recovery',
      60 * 60 * 1000,
      limits.accountRecovery ?? 10,
      resolved,
    ),
  };
}
