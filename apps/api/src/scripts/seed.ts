import 'dotenv/config';
import { connectToDatabase, disconnectFromDatabase } from '../config/database.js';
import { loadEnv } from '../config/env.js';
import { upsertSeedFixtures } from './seedDatabase.js';

/**
 * Development-only seed command: `npm run seed -w @entebharatham/api`.
 * Inserts the fictional demo fixtures idempotently (upsert by slug).
 * Refuses to run in production and never drops or deletes data.
 */
async function main(): Promise<void> {
  const env = loadEnv();

  if (env.NODE_ENV === 'production') {
    console.error('[seed] refusing to run with NODE_ENV=production');
    process.exit(1);
  }

  try {
    await connectToDatabase(env.MONGODB_URI);
  } catch {
    console.error('[seed] could not connect to the database');
    process.exit(1);
  }

  try {
    const { inserted, skipped } = await upsertSeedFixtures();
    console.log(
      `[seed] done: ${inserted} inserted, ${skipped} already present (fictional demo data)`,
    );
  } catch {
    console.error('[seed] seeding failed');
    process.exit(1);
  }

  await disconnectFromDatabase();
}

void main().catch(() => {
  console.error('[seed] unexpected failure');
  process.exit(1);
});
