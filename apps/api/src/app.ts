import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import type session from 'express-session';
import type { Env } from './config/env.js';
import { createSessionMiddleware } from './config/session.js';
import { loadSessionUser } from './middleware/auth.js';
import { csrfProtection } from './middleware/csrf.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { createRateLimiters, type RateLimiters } from './middleware/rateLimit.js';
import { createApiRouter, type ApiRouterDependencies } from './routes/index.js';
import { createSitemapRoutes } from './routes/sitemap.routes.js';
import { requestContext } from './utils/logger.js';

export interface AppOptions extends ApiRouterDependencies {
  /**
   * Injected session store (tests pass `new session.MemoryStore()`). When
   * omitted, a MongoDB-backed store is created from MONGODB_URI — sessions
   * are never silently kept in process memory.
   */
  sessionStore?: session.Store;
  /**
   * Injected rate limiters (tests raise the request counts so suites are not
   * throttled). When omitted, production-default limiters are built.
   */
  rateLimiters?: RateLimiters;
}

/**
 * Builds the Express application. Kept separate from server.ts so tests can
 * exercise the app without binding a port or connecting to MongoDB.
 *
 * Middleware order: request id/logging → security headers → CORS
 * (credentials) → body parsing → session → session-user resolution → CSRF →
 * API routes → 404 → error handler. Rate limiters are built per app instance
 * so tests get fresh counters.
 */
export function createApp(env: Env, options: AppOptions = {}): express.Express {
  const app = express();

  app.disable('x-powered-by');
  // Express 5 defaults to the simple query parser, but set it explicitly so a
  // future default change cannot reintroduce nested-object query injection.
  app.set('query parser', 'simple');
  app.use(requestContext);
  app.use(
    helmet({
      // The API serves JSON and media, never an HTML document, so its CSP is
      // irrelevant; the web host sends the application CSP.
      contentSecurityPolicy: false,
      // Media is embedded by the separately-hosted web app.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );

  // Behind a reverse proxy (Render, nginx) set TRUST_PROXY_HOPS=1 so
  // req.ip reflects the real client and rate limiting works globally.
  if (env.TRUST_PROXY_HOPS > 0) {
    app.set('trust proxy', env.TRUST_PROXY_HOPS);
  }

  const allowWildcard = env.API_CORS_ORIGINS.includes('*');
  app.use(
    cors({
      // Wildcard is only possible when the env schema permitted it (non-production).
      // Credentials require an explicit origin, so wildcard mode disables them.
      origin: allowWildcard ? true : env.API_CORS_ORIGINS,
      credentials: !allowWildcard,
      exposedHeaders: ['X-Request-Id'],
      // Cache preflight responses so browsers do not re-ask on every write.
      maxAge: 600,
    }),
  );

  app.use(express.json({ limit: '100kb' }));

  app.use(createSessionMiddleware(env, options.sessionStore));
  app.use(loadSessionUser);
  // csrf-sync skips safe methods (GET/HEAD/OPTIONS) internally.
  app.use(csrfProtection);

  const limiters = options.rateLimiters ?? createRateLimiters({}, env);
  // API responses are session-aware unless a handler explicitly opts into a
  // public cache policy. This prevents an intermediary from ever storing
  // authenticated or CSRF responses.
  app.use('/api/v1', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use('/api/v1', createApiRouter(env, limiters, options));
  app.use('/', createSitemapRoutes(env));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
