import type { AccountStatus, UserRole } from '@entebharatham/shared';
import { ACCOUNT_STATUSES, USER_ROLES } from '@entebharatham/shared';
import { Schema, model, type Types } from 'mongoose';

/**
 * Account records for authentication and profile data.
 *
 * Security properties:
 * - `email` is stored normalized (trimmed, lowercased) with a unique index;
 *   duplicates are rejected by the database, not just by application checks.
 * - `passwordHash` is `select: false`, so it is never returned unless a query
 *   explicitly opts in — password hashes cannot leak through API responses.
 * - `role` and `accountStatus` are server-assigned only. No public endpoint
 *   accepts them from client input.
 */
export interface UserFields {
  _id: Types.ObjectId;
  displayName: string;
  /** Normalized (lowercase, trimmed) email address. */
  email: string;
  passwordHash: string;
  role: UserRole;
  accountStatus: AccountStatus;
  /** Optional public biography (plain text; rendered as text, never HTML). */
  bio?: string;
  /** Optional preferred attribution name (may be a pseudonym). */
  attributionName?: string;
  /** Whether the public profile is enabled */
  publicProfileEnabled: boolean;
  /** Whether email is verified */
  emailVerified: boolean;
  emailVerifiedAt?: Date;
  /**
   * Incremented whenever credentials change (password reset). Sessions store
   * the version they were created with, so older sessions stop authenticating.
   */
  credentialVersion: number;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema(
  {
    displayName: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 5,
      maxlength: 254,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, required: true, default: 'contributor' },
    accountStatus: { type: String, enum: ACCOUNT_STATUSES, required: true, default: 'active' },
    bio: { type: String, trim: true, maxlength: 1000 },
    attributionName: { type: String, trim: true, maxlength: 120 },
    publicProfileEnabled: { type: Boolean, default: true },
    emailVerified: { type: Boolean, default: false },
    emailVerifiedAt: { type: Date },
    lastLoginAt: { type: Date },
    credentialVersion: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const UserModel = model<UserFields>('User', UserSchema);
