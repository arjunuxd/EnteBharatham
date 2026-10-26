import 'dotenv/config';
import { connectToDatabase, disconnectFromDatabase } from '../config/database.js';
import { loadEnv } from '../config/env.js';
import { AuditEventModel } from '../models/AuditEvent.js';
import { CommunityReportModel } from '../models/CommunityReport.js';
import { CorrectionProposalModel } from '../models/CorrectionProposal.js';
import { HeritageMediaModel } from '../models/HeritageMedia.js';
import { HeritageRecordModel } from '../models/HeritageRecord.js';
import { RateLimitModel } from '../middleware/rateLimitStore.js';
import { ReviewFeedbackModel } from '../models/ReviewFeedback.js';
import { TokenModel } from '../models/Token.js';
import { TranslationModel } from '../models/Translation.js';
import { UserModel } from '../models/User.js';
import { WithdrawalRequestModel } from '../models/WithdrawalRequest.js';

/**
 * Explicit index creation for deployed environments:
 * `npm run db:indexes -w @entebharatham/api`
 *
 * Production startup disables Mongoose `autoIndex` so a request never pays for
 * schema/index work and a cold start cannot race index builds across
 * instances. Run this once (and again after a schema change) during deploy.
 *
 * `createIndexes()` is additive and idempotent: it creates the indexes declared
 * by the schemas and never drops indexes that were added manually (for example
 * by a database operator). It does not overwrite an existing index that
 * conflicts with a changed definition — drop and recreate such an index
 * deliberately during a reviewed migration.
 */
const models = [
  UserModel,
  HeritageRecordModel,
  HeritageMediaModel,
  WithdrawalRequestModel,
  CommunityReportModel,
  CorrectionProposalModel,
  ReviewFeedbackModel,
  TranslationModel,
  AuditEventModel,
  TokenModel,
  RateLimitModel,
] as const;

async function main(): Promise<void> {
  const env = loadEnv();

  try {
    await connectToDatabase(env.MONGODB_URI, { autoIndex: false });
  } catch {
    // Never print the driver error: it can embed the connection string.
    console.error('[db:indexes] could not connect to the database');
    process.exit(1);
  }

  let failed = false;
  try {
    for (const model of models) {
      try {
        await model.createIndexes();
        console.log(`[db:indexes] ok ${model.collection.name}`);
      } catch {
        // Index names only; no document data or connection details.
        console.error(`[db:indexes] failed ${model.collection.name}`);
        failed = true;
      }
    }
  } finally {
    await disconnectFromDatabase();
  }

  if (failed) {
    console.error('[db:indexes] one or more collections failed');
    process.exit(1);
  }
  console.log('[db:indexes] complete');
}

void main().catch(() => {
  console.error('[db:indexes] unexpected failure');
  process.exit(1);
});
