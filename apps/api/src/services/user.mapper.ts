import type { PublicContributorProfile, AuthUserPublic } from '@entebharatham/shared';
import type { UserFields } from '../models/User.js';

/**
 * Explicit serialization of user documents into safe API shapes. Fields are
 * picked one by one — password hashes, internal timestamps, and any future
 * private columns are never spread into responses.
 */

function optional(value: string | undefined): string | undefined {
  return value === undefined || value === '' ? undefined : value;
}

/** Full safe account shape for the authenticated user (own profile views). */
export function toAuthUserDto(doc: UserFields): AuthUserPublic {
  const dto: AuthUserPublic = {
    id: String(doc._id),
    email: doc.email,
    displayName: doc.displayName,
    role: doc.role,
    accountStatus: doc.accountStatus,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
  const bio = optional(doc.bio);
  const attributionName = optional(doc.attributionName);
  if (bio !== undefined) dto.bio = bio;
  if (attributionName !== undefined) dto.attributionName = attributionName;
  return dto;
}

/**
 * Public contributor profile: explicitly approved attribution fields only —
 * never the email address, role, or account status.
 */
export function toPublicContributorDto(doc: UserFields): PublicContributorProfile {
  const dto: PublicContributorProfile = {
    id: String(doc._id),
    displayName: doc.displayName,
    memberSince: doc.createdAt.toISOString(),
  };
  const attributionName = optional(doc.attributionName);
  const bio = optional(doc.bio);
  if (attributionName !== undefined) dto.attributionName = attributionName;
  if (bio !== undefined) dto.bio = bio;
  return dto;
}
