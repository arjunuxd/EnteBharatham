import mongoose from 'mongoose';
import { clearAllTtlCaches } from '../utils/ttlCache.js';

// Fail queries immediately when the connection is down instead of silently
// buffering them (which would make readiness appear fine while requests hang).
mongoose.set('bufferCommands', false);

let listenersAttached = false;

function attachConnectionListeners(): void {
  if (listenersAttached) return;
  listenersAttached = true;
  // Fixed strings only — driver error objects can embed connection details.
  mongoose.connection.on('error', () => {
    console.error('[database] connection error');
  });
  mongoose.connection.on('disconnected', () => {
    // Cached public reads must not outlive the connection that produced them:
    // after a disconnect the API surfaces a safe error rather than stale data.
    clearAllTtlCaches();
    console.log('[database] disconnected');
  });
  mongoose.connection.on('reconnected', () => {
    console.log('[database] reconnected');
  });
}

export interface ConnectOptions {
  /**
   * Build Mongoose indexes automatically on model use. Defaults to true for
   * local/test. Production passes false and uses the explicit index script so
   * startup does not perform schema work.
   */
  autoIndex?: boolean;
}

/**
 * Establishes the MongoDB connection using the validated URI from
 * environment configuration. Supports local MongoDB and MongoDB Atlas
 * equally — no hosts are hardcoded. Throws on failure so the caller can
 * fail fast; never logs the URI or credentials.
 */
export async function connectToDatabase(
  mongodbUri: string,
  options: ConnectOptions = {},
): Promise<void> {
  attachConnectionListeners();
  await mongoose.connect(mongodbUri, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
    maxPoolSize: 10,
    autoIndex: options.autoIndex ?? true,
    retryWrites: true,
  });
  // Log only the connection state, never the credentials in the URI.
  console.log('[database] connected');
}

/** Closes the MongoDB connection. Safe to call when already disconnected. */
export async function disconnectFromDatabase(): Promise<void> {
  await mongoose.disconnect();
  // The event listener normally handles this, but clear explicitly so the
  // guarantee does not depend on event ordering.
  clearAllTtlCaches();
}

/** True only while the connection can actually serve queries. */
export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
