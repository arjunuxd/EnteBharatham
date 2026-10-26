import MongoStore from 'connect-mongo';
import session from 'express-session';
import type { Env } from './env.js';

/** Session cookie name (no `__Host-` prefix so local http development works). */
export const SESSION_COOKIE_NAME = 'entebharatham.sid';

/**
 * Persistent, production-grade session store backed by MongoDB. Sessions
 * survive process restarts and are shared across server instances — no
 * in-memory store is ever created implicitly.
 *
 * The returned store owns its own MongoDB client (connect-mongo behaviour) and
 * must be closed during graceful shutdown via {@link closeSessionStore}.
 */
export function createSessionStore(env: Env): MongoStore {
  return MongoStore.create({
    mongoUrl: env.MONGODB_URI,
    ttl: env.SESSION_MAX_AGE_HOURS * 60 * 60,
    collectionName: 'sessions',
    // Fixed event payloads only: store errors can contain connection details.
    autoRemove: 'native',
  });
}

/**
 * Closes the store's owned MongoDB client. Safe when the store has not
 * connected yet. Errors are swallowed after a fixed log line because the
 * underlying driver error can embed the connection string.
 */
export async function closeSessionStore(store: session.Store): Promise<void> {
  const closable = store as session.Store & { close?: () => Promise<void> | void };
  if (typeof closable.close !== 'function') {
    return;
  }
  try {
    await closable.close();
  } catch {
    console.error('[session] failed to close session store');
  }
}

/**
 * Builds the express-session middleware from validated configuration.
 *
 * - `HttpOnly` always; `Secure` in production (and required when
 *   `SameSite=None` is chosen for cross-site deployments).
 * - `saveUninitialized: false` so anonymous visitors do not get a session
 *   cookie (the CSRF token endpoint creates a session only when a token is
 *   generated, which mutates the session).
 * - An injected store may only be a non-production store outside production;
 *   production refuses in-memory stores instead of silently weakening
 *   session persistence.
 */
export function createSessionMiddleware(env: Env, store?: session.Store) {
  const resolvedStore = store ?? createSessionStore(env);

  if (env.NODE_ENV === 'production' && resolvedStore instanceof session.MemoryStore) {
    throw new Error('In-memory session stores are not allowed in production');
  }

  return session({
    name: SESSION_COOKIE_NAME,
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: resolvedStore,
    cookie: {
      httpOnly: true,
      secure: env.NODE_ENV === 'production' || env.SESSION_COOKIE_SAMESITE === 'none',
      sameSite: env.SESSION_COOKIE_SAMESITE,
      path: '/',
      maxAge: env.SESSION_MAX_AGE_HOURS * 60 * 60 * 1000,
    },
  });
}
