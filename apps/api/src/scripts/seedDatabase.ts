import { HeritageRecordModel } from '../models/HeritageRecord.js';
import { SEED_FIXTURES } from './seedFixtures.js';

/**
 * Idempotently upserts the fictional development fixtures by stable slug.
 * Uses $setOnInsert so rerunning never modifies or duplicates existing
 * records, and never deletes or drops anything.
 */
export async function upsertSeedFixtures(): Promise<{ inserted: number; skipped: number }> {
  // Ensure indexes (including the unique slug and text index) exist.
  // syncIndexes() is used instead of init(): with bufferCommands disabled, a
  // model compiled before mongoose.connect() has its automatic init promise
  // rejected at compile time (nothing to buffer against), and init() would
  // keep returning that cached rejection. syncIndexes() runs cleanly once
  // the connection is actually up.
  await HeritageRecordModel.syncIndexes();

  let inserted = 0;
  let skipped = 0;

  for (const fixture of SEED_FIXTURES) {
    const result = await HeritageRecordModel.updateOne(
      { slug: fixture.slug },
      { $setOnInsert: { ...fixture } },
      { upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
    if (result.upsertedCount > 0) {
      inserted += 1;
    } else {
      skipped += 1;
    }
  }

  return { inserted, skipped };
}
