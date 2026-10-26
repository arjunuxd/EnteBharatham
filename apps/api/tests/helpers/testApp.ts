import session from 'express-session';
import type { Express } from 'express';
import { createApp, type AppOptions } from '../../src/app.js';
import { parseEnv, type Env } from '../../src/config/env.js';
import { createRateLimiters } from '../../src/middleware/rateLimit.js';

/**
 * connect-mongo invokes store callbacks with `null` on success, while
 * express-session's MemoryStore invokes them with no arguments. Mirror the
 * production store so success is not mistaken for an error in session
 * regenerate/save callbacks.
 */
class MongoStyleMemoryStore extends session.MemoryStore {
  override set(sid: string, sess: session.SessionData, callback?: (err?: unknown) => void): void {
    super.set(sid, sess, (error) => callback?.(error ?? null));
  }

  override destroy(sid: string, callback?: (err?: unknown) => void): void {
    super.destroy(sid, (error) => callback?.(error ?? null));
  }
}

/**
 * Shared test harness: a fully configured app backed by an in-memory session
 * store and fresh rate limiters (per `createApp` call), so each test file —
 * and each `createTestApp()` call — is isolated from cookie state and
 * request counters.
 *
 * `MONGODB_URI` here is a placeholder: tests that need a database start
 * their own `MongoMemoryServer` and call `connectToDatabase(uri)`
 * themselves. Injecting the session store also guarantees no background
 * MongoStore connection is ever opened against this placeholder.
 *
 * By default the auth rate limit is raised so suites that register many
 * users are not throttled; pass `{ rateLimiters: createRateLimiters() }` to
 * exercise the real limits.
 */
export function createTestEnv(overrides: NodeJS.ProcessEnv = {}): Env {
  return parseEnv({
    NODE_ENV: 'test',
    MONGODB_URI: 'mongodb://127.0.0.1:27017/entebharatham-test',
    EMAIL_PROVIDER: 'test',
    RATE_LIMIT_STORE: 'memory',
    STORAGE_PROVIDER: 'local',
    ...overrides,
  });
}

export function createTestApp(env: Env = createTestEnv(), options: AppOptions = {}): Express {
  return createApp(env, {
    sessionStore: new MongoStyleMemoryStore(),
    rateLimiters: createRateLimiters({
      publicRead: 10_000,
      authAttempts: 10_000,
      createDraft: 10_000,
      submitForReview: 10_000,
      moderationActions: 10_000,
      publicReports: 10_000,
      mediaUploads: 10_000,
      accountRecovery: 10_000,
    }),
    ...options,
  });
}
