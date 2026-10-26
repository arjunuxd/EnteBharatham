import type { Types } from 'mongoose';
import { TokenModel } from '../../models/Token.js';
import { generateToken, hashToken } from '../../utils/tokens.js';

export type TokenPurpose = 'email_verification' | 'password_reset';

export const TOKEN_TTL_MS: Record<TokenPurpose, number> = {
  email_verification: 24 * 60 * 60 * 1000,
  password_reset: 60 * 60 * 1000,
};

/**
 * Single-use account tokens.
 *
 * - Only a SHA-256 hash is stored; a database read cannot yield a usable
 *   token.
 * - Issuing a new token invalidates every earlier unused token of the same
 *   purpose for that user.
 * - Consumption is a single atomic `findOneAndUpdate` filtered on
 *   `usedAt: null` and an unexpired `expiresAt`, so two concurrent requests
 *   cannot both consume the same token.
 */
export async function issueAccountToken(
  userId: Types.ObjectId | string,
  purpose: TokenPurpose,
): Promise<string> {
  await TokenModel.deleteMany({ userId, purpose, usedAt: null }).exec();

  const token = generateToken();
  await TokenModel.create({
    userId,
    tokenHash: hashToken(token),
    purpose,
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS[purpose]),
  });
  return token;
}

/** Returns the owning user id, or null for invalid/expired/reused tokens. */
export async function consumeAccountToken(
  token: string,
  purpose: TokenPurpose,
): Promise<Types.ObjectId | null> {
  const tokenHash = hashToken(token);
  const consumed = await TokenModel.findOneAndUpdate(
    {
      tokenHash,
      purpose,
      usedAt: null,
      expiresAt: { $gt: new Date() },
    },
    { $set: { usedAt: new Date() } },
    { new: true },
  )
    .select({ userId: 1 })
    .exec();

  if (consumed === null) return null;
  return consumed.userId;
}

/** Best-effort invalidation after a failed delivery. */
export async function revokeAccountToken(token: string, purpose: TokenPurpose): Promise<void> {
  try {
    await TokenModel.deleteOne({ tokenHash: hashToken(token), purpose, usedAt: null }).exec();
  } catch {
    console.error('[account] failed to revoke undelivered token');
  }
}

export async function invalidateAccountTokens(
  userId: Types.ObjectId | string,
  purpose: TokenPurpose,
): Promise<void> {
  await TokenModel.deleteMany({ userId, purpose, usedAt: null }).exec();
}
