import express from 'express';
import session from 'express-session';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createSessionMiddleware, SESSION_COOKIE_NAME } from '../src/config/session.js';
import { createTestEnv } from './helpers/testApp.js';

/**
 * Session configuration behavior, verified through a real HTTP round trip:
 * cookie attributes are asserted from the Set-Cookie header, and the
 * production refusal of in-memory stores is asserted directly.
 */

/** Minimal non-MemoryStore store so the production guard can be exercised. */
class FakeStore extends session.Store {
  override get(_sid: string, callback: (err?: unknown, session?: null) => void): void {
    callback(null, null);
  }
  override set(_sid: string, _sess: session.Session, callback: (err?: unknown) => void): void {
    callback(null);
  }
  override destroy(_sid: string, callback: (err?: unknown) => void): void {
    callback(null);
  }
}

/** Builds a tiny app whose route mutates the session so a cookie is issued. */
function sessionApp(store: session.Store, env = createTestEnv()): express.Express {
  const app = express();
  app.use(createSessionMiddleware(env, store));
  app.get('/touch', (req, res) => {
    req.session.userId = 'touch-target';
    res.json({ ok: true });
  });
  return app;
}

/** Production configuration that satisfies every startup safeguard. */
function productionEnv(overrides: NodeJS.ProcessEnv = {}) {
  return createTestEnv({
    NODE_ENV: 'production',
    MONGODB_URI: 'mongodb+srv://user:pass@cluster.example.mongodb.net/entebharatham',
    SESSION_SECRET: 'a-production-grade-secret-of-sufficient-length',
    API_CORS_ORIGINS: 'https://app.example.com',
    APP_BASE_URL: 'https://app.example.com',
    EMAIL_PROVIDER: 'smtp',
    EMAIL_FROM: 'heritage@example.com',
    SMTP_HOST: 'smtp.example.com',
    RATE_LIMIT_STORE: 'mongo',
    STORAGE_PROVIDER: 's3',
    S3_REGION: 'ap-south-1',
    S3_BUCKET: 'entebharatham-media',
    ...overrides,
  });
}

/**
 * Builds the same app with proxy trust enabled, so a request carrying
 * `X-Forwarded-Proto: https` reads as secure — the production deployment
 * shape behind a TLS-terminating proxy. express-session refuses to emit a
 * `Secure` cookie over plain http, so this is how the Secure attribute can
 * be observed in a test.
 */
function proxiedSessionApp(
  store: session.Store,
  env: ReturnType<typeof createTestEnv>,
): express.Express {
  const app = sessionApp(store, env);
  app.set('trust proxy', true);
  return app;
}

function sessionCookie(response: request.Response): string | undefined {
  const raw = response.headers['set-cookie'];
  const cookies = Array.isArray(raw) ? raw : raw !== undefined ? [String(raw)] : [];
  return cookies.find((cookie) => cookie.startsWith(`${SESSION_COOKIE_NAME}=`));
}

describe('createSessionMiddleware', () => {
  it('issues the configured cookie name with HttpOnly, Path, and SameSite=Lax', async () => {
    const app = sessionApp(new session.MemoryStore());
    const response = await request(app).get('/touch');
    const cookie = sessionCookie(response);

    expect(cookie).toBeDefined();
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).not.toContain('Secure');
  });

  it('marks the cookie Secure and honors SameSite from env in production', async () => {
    const env = productionEnv({
      SESSION_COOKIE_SAMESITE: 'none',
      TRUST_PROXY_HOPS: '1',
    });
    const app = proxiedSessionApp(new FakeStore(), env);
    const response = await request(app).get('/touch').set('X-Forwarded-Proto', 'https');
    const cookie = sessionCookie(response);

    expect(cookie).toBeDefined();
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=None');
  });

  it('applies the configured session lifetime to the cookie expiry', async () => {
    const env = createTestEnv({ SESSION_MAX_AGE_HOURS: '24' });
    const app = sessionApp(new session.MemoryStore(), env);
    const before = Date.now();
    const response = await request(app).get('/touch');
    const cookie = sessionCookie(response);

    expect(cookie).toBeDefined();
    // express-session serializes maxAge as an Expires date ~24h in the future.
    const expiresMatch = /Expires=([^;]+)/.exec(cookie ?? '');
    expect(expiresMatch).not.toBeNull();
    const expiresAt = Date.parse(expiresMatch?.[1] ?? '');
    expect(expiresAt).toBeGreaterThan(before + 23 * 60 * 60 * 1000);
    expect(expiresAt).toBeLessThan(before + 25 * 60 * 60 * 1000);
  });

  it('refuses an in-memory store in production', () => {
    const env = productionEnv();
    expect(() => createSessionMiddleware(env, new session.MemoryStore())).toThrow(
      /not allowed in production/,
    );
  });

  it('does not set a session cookie for untouched sessions', async () => {
    const app = express();
    app.use(createSessionMiddleware(createTestEnv(), new session.MemoryStore()));
    app.get('/untouched', (_req, res) => {
      res.json({ ok: true });
    });

    const response = await request(app).get('/untouched');
    expect(sessionCookie(response)).toBeUndefined();
  });
});
