import type { UserRole } from '@entebharatham/shared';
import { UserModel } from '../models/User.js';
import { hashPassword } from '../services/auth.service.js';
import { recordAuditEvent } from '../services/audit.service.js';

/**
 * Creates (or promotes) a moderator/admin account from environment
 * variables. Used only by the `bootstrapAdmin` CLI script — there is no HTTP
 * endpoint that can create privileged accounts.
 *
 * - Idempotent: an existing account with the email is updated in place
 *   (role, display name, and optionally the password) rather than duplicated.
 * - The password is never printed, never logged, and never returned.
 */
export async function bootstrapAdminAccount(input: {
  email: string;
  password: string;
  displayName: string;
  role: Exclude<UserRole, 'contributor'>;
}): Promise<{ created: boolean; email: string; role: string }> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const passwordHash = await hashPassword(input.password);

  const existing = await UserModel.findOne({ email: normalizedEmail }).exec();

  if (existing === null) {
    await UserModel.create({
      email: normalizedEmail,
      displayName: input.displayName,
      passwordHash,
      role: input.role,
      accountStatus: 'active',
    });
    await recordAuditEvent({
      action: 'user.role_changed',
      actorRole: input.role,
      metadata: { email: normalizedEmail, roleAfter: input.role, bootstrap: 'created' },
    });
    return { created: true, email: normalizedEmail, role: input.role };
  }

  existing.displayName = input.displayName;
  existing.passwordHash = passwordHash;
  existing.role = input.role;
  existing.accountStatus = 'active';
  await existing.save();

  await recordAuditEvent({
    action: 'user.role_changed',
    actorRole: input.role,
    metadata: { email: normalizedEmail, roleAfter: input.role, bootstrap: 'updated' },
  });
  return { created: false, email: normalizedEmail, role: input.role };
}
