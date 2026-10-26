import 'dotenv/config';
import type { Server } from 'http';
import { createApp } from './app.js';
import { connectToDatabase, disconnectFromDatabase } from './config/database.js';
import { loadEnv } from './config/env.js';
import { closeSessionStore, createSessionStore } from './config/session.js';
import { createEmailTransportFromEnv } from './services/email/transport.js';
import { createShutdownHandler } from './utils/gracefulShutdown.js';
import { log } from './utils/logger.js';

async function main(): Promise<void> {
  // Validate configuration first; never start with an invalid environment.
  const env = loadEnv();

  // Connect before listening so the API never serves database-dependent
  // requests while the connection is down. No silent in-memory fallback:
  // a failed connection exits nonzero.
  try {
    // Production builds indexes explicitly with `npm run db:indexes`; startup
    // must not perform schema work or race index builds across instances.
    await connectToDatabase(env.MONGODB_URI, { autoIndex: env.NODE_ENV !== 'production' });
  } catch {
    // Deliberately not printing the raw driver error: connection/parse
    // errors can embed the connection string, including credentials.
    console.error('[database] startup connection failed');
    process.exit(1);
  }

  // Persistent, shared session store (MongoDB) and the configured email
  // transport are created once and owned by the process.
  const sessionStore = createSessionStore(env);
  const emailTransport = createEmailTransportFromEnv(env);

  let server: Server | null = null;
  try {
    const app = createApp(env, { sessionStore, emailTransport });
    server = app.listen(env.PORT, () => {
      log('info', 'server.started', {
        port: env.PORT,
        environment: env.NODE_ENV,
        storageProvider: env.STORAGE_PROVIDER,
        emailProvider: env.EMAIL_PROVIDER,
        rateLimitStore: env.RATE_LIMIT_STORE,
      });
    });
  } catch (error) {
    await closeSessionStore(sessionStore);
    await emailTransport.close?.();
    await disconnectFromDatabase();
    throw error;
  }

  const shutdown = createShutdownHandler({
    closeServer: () =>
      new Promise<void>((resolve, reject) => {
        server?.close((error) => (error ? reject(error) : resolve()));
      }),
    closeDatabase: disconnectFromDatabase,
    closeStores: async () => {
      await closeSessionStore(sessionStore);
      await emailTransport.close?.();
    },
    exit: (code) => process.exit(code),
  });

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

void main().catch((error: unknown) => {
  // Environment-validation errors are safe (field names only); driver errors
  // are not printed because they can embed the connection string.
  if (error instanceof Error && error.message.startsWith('Invalid environment configuration')) {
    console.error(error.message);
  } else {
    console.error('[server] failed to start');
  }
  process.exit(1);
});
