import { Router } from 'express';
import { createAuthRoutes } from './auth.routes.js';
import { createHealthRoutes } from './health.routes.js';
import { createHeritageRoutes } from './heritage.routes.js';
import { createMediaRoutes } from './media.routes.js';
import { createModerationRoutes } from './moderation.routes.js';
import { createPhase4Routes } from './phase4.routes.js';
import { createAccountRoutes } from './account.routes.js';
import { createProfileRoutes } from './profile.routes.js';
import { createSearchRoutes } from './search.routes.js';
import { createDiscoveryRoutes } from './discovery.routes.js';
import type { RateLimiters } from '../middleware/rateLimit.js';
import type { Env } from '../config/env.js';
import { EmailService } from '../services/email/emailService.js';
import { createEmailTransportFromEnv, type EmailTransport } from '../services/email/transport.js';
import { createStorageAdapter, type StorageAdapter } from '../services/storage/index.js';

export interface ApiRouterDependencies {
  /** Injected in tests to capture messages without a real SMTP server. */
  emailTransport?: EmailTransport;
  /** Injected in tests to simulate storage failures without a cloud bucket. */
  storage?: StorageAdapter;
}

export function createApiRouter(
  env: Env,
  limiters: RateLimiters,
  dependencies: ApiRouterDependencies = {},
): Router {
  const router = Router();
  const emailTransport = dependencies.emailTransport ?? createEmailTransportFromEnv(env);
  const emailService = new EmailService(emailTransport, env.APP_BASE_URL);
  const storage = dependencies.storage ?? createStorageAdapter(env);

  router.use('/health', createHealthRoutes(env.NODE_ENV));
  router.use('/auth', createAuthRoutes(limiters));
  router.use('/account', createAccountRoutes(emailService, limiters));
  router.use('/profile', createProfileRoutes());
  router.use('/heritage', createHeritageRoutes(limiters, storage));
  router.use('/search', createSearchRoutes(limiters));
  router.use('/discovery', createDiscoveryRoutes(limiters));
  router.use('/explore', createHeritageRoutes(limiters, storage));
  router.use('/media', createMediaRoutes(env, limiters, storage));
  router.use('/moderation', createModerationRoutes(limiters));

  // Governance surface: reports, corrections, withdrawals, translations, and
  // public profiles. Account recovery is mounted separately at /account.
  router.use('/', createPhase4Routes(limiters, storage));

  return router;
}
