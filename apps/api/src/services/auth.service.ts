import type { AuthUserPublic, PublicContributorProfile } from '@entebharatham/shared';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import type { LoginInput, RegisterInput } from '../validation/auth.schema.js';
import { UserModel } from '../models/User.js';
import { toAuthUserDto, toPublicContributorDto } from './user.mapper.js';
import { AppError } from '../utils/AppError.js';

/**
 * Authentication business logic.
 *
 * - Passwords are hashed with bcrypt (cost factor below) — never plaintext,
 *   never logged, and never returned through API responses.
 * - Login failures are deliberately generic ("Invalid email or password") so
 *   the API does not disclose whether an account exists. A dummy hash equalizes
 *   timing for unknown emails.
 * - New accounts always receive `contributor` / `active`, assigned here on the
 *   server; client input never influences role or status.
 */

/** bcrypt work factor. 10 rounds ≈ 100ms per hash on typical hardware. */
export const BCRYPT_ROUNDS = 10;

let dummyHashPromise: Promise<string> | null = null;

/** Lazily computed hash used to equalize timing for unknown-email logins. */
function getDummyHash(): Promise<string> {
  dummyHashPromise ??= bcrypt.hash('entebharatham-dummy-password-not-a-secret', BCRYPT_ROUNDS);
  return dummyHashPromise;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 11000
  );
}

/**
 * Creates a new contributor account. Duplicate normalized emails are rejected
 * by the unique database index and surfaced as a controlled 409.
 */
export async function registerUser(input: RegisterInput): Promise<AuthUserPublic> {
  try {
    const passwordHash = await hashPassword(input.password);
    const user = await UserModel.create({
      displayName: input.displayName,
      email: input.email,
      passwordHash,
      role: 'contributor',
      accountStatus: 'active',
    });
    return toAuthUserDto(user);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AppError(
        409,
        'An account with this email already exists',
        'EMAIL_ALREADY_REGISTERED',
      );
    }
    throw error;
  }
}

/**
 * Verifies credentials. Every failure path returns the identical generic
 * 401 — wrong password, unknown email, and malformed credentials are
 * indistinguishable to the client. Suspended accounts are only revealed
 * after the password verifies (403).
 */
export async function authenticateUser(input: LoginInput): Promise<AuthUserPublic> {
  const invalidCredentials = new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');

  const user = await UserModel.findOne({ email: input.email }).select('+passwordHash').exec();

  if (user === null) {
    // Equalize response timing against account-enumeration attempts.
    await bcrypt.compare(input.password, await getDummyHash());
    throw invalidCredentials;
  }

  const passwordValid = await verifyPassword(input.password, user.passwordHash);
  if (!passwordValid) {
    throw invalidCredentials;
  }

  if (user.accountStatus !== 'active') {
    throw new AppError(403, 'This account has been suspended', 'ACCOUNT_SUSPENDED');
  }

  await UserModel.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } }).exec();
  return toAuthUserDto(user);
}

/** Looks up the user's own account by id (used by GET /auth/me). */
export async function getAccountById(userId: string): Promise<AuthUserPublic | null> {
  if (!Types.ObjectId.isValid(userId)) return null;
  const user = await UserModel.findById(userId).exec();
  return user === null ? null : toAuthUserDto(user);
}

/** Current credential version, used to bind a session to the account state. */
export async function getCredentialVersion(userId: string): Promise<number> {
  const user = await UserModel.findById(userId).select({ credentialVersion: 1 }).lean().exec();
  return user?.credentialVersion ?? 0;
}

/**
 * Updates the permitted profile fields of the authenticated account. The
 * input schema is strict, so role/status/email/password fields can never
 * reach this function.
 */
export async function updateOwnProfile(
  userId: string,
  input: { displayName?: string; bio?: string; attributionName?: string },
): Promise<AuthUserPublic> {
  const set: Record<string, string> = {};
  if (input.displayName !== undefined) set.displayName = input.displayName;
  if (input.bio !== undefined) set.bio = input.bio;
  if (input.attributionName !== undefined) set.attributionName = input.attributionName;

  const user = await UserModel.findOneAndUpdate(
    { _id: userId, accountStatus: 'active' },
    { $set: set },
    { new: true },
  ).exec();

  if (user === null) {
    throw new AppError(401, 'Please sign in to continue', 'UNAUTHENTICATED');
  }
  return toAuthUserDto(user);
}

/**
 * Public contributor profile. Returns null for unknown accounts so callers
 * can produce a non-disclosing 404.
 */
export async function getPublicContributor(
  userId: string,
): Promise<PublicContributorProfile | null> {
  if (!Types.ObjectId.isValid(userId)) return null;
  const user = await UserModel.findById(userId).exec();
  return user === null ? null : toPublicContributorDto(user);
}
