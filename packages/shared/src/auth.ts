/**
 * Account, role, and session-related contracts shared between the API and
 * the web app. Roles are server-assigned only — registration input can never
 * choose them.
 */

export const USER_ROLES = ['contributor', 'moderator', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ACCOUNT_STATUSES = ['active', 'suspended'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

/** Safe account shape returned by /auth/register, /auth/login, and /auth/me. */
export interface AuthUserPublic {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  accountStatus: AccountStatus;
  bio?: string;
  attributionName?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Public contributor profile. Deliberately excludes email, role, and account
 * status — only explicitly public attribution fields are exposed.
 */
export interface PublicContributorProfile {
  id: string;
  displayName: string;
  attributionName?: string;
  bio?: string;
  memberSince: string;
}
