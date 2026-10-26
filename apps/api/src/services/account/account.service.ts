import type { Types } from 'mongoose';
import { UserModel } from '../../models/User.js';
import { hashPassword } from '../auth.service.js';
import { recordAuditEvent } from '../audit.service.js';
import type { EmailService } from '../email/emailService.js';
import {
  consumeAccountToken,
  invalidateAccountTokens,
  issueAccountToken,
  revokeAccountToken,
} from './token.service.js';

/**
 * Account recovery workflows.
 *
 * All request endpoints return an identical response whether or not the email
 * belongs to an account. Delivery failures are logged as a fixed event (no
 * address, token, or transport detail) and never change the response.
 */

const GENERIC_VERIFICATION_RESPONSE = {
  message: 'If an account exists, a verification email has been sent',
};
const GENERIC_RESET_RESPONSE = {
  message: 'If an account exists, a password reset email has been sent',
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function requestEmailVerification(
  email: string,
  emailService: EmailService,
): Promise<{ message: string }> {
  const user = await UserModel.findOne({ email: normalizeEmail(email) }).exec();
  if (user === null || user.emailVerified) {
    return GENERIC_VERIFICATION_RESPONSE;
  }

  const token = await issueAccountToken(user._id, 'email_verification');
  try {
    await emailService.sendVerificationEmail(user.email, token);
  } catch {
    await revokeAccountToken(token, 'email_verification');
    console.error('[email] verification delivery failed');
  }
  return GENERIC_VERIFICATION_RESPONSE;
}

export async function confirmEmailVerification(
  token: string,
): Promise<{ ok: boolean; message: string }> {
  const userId = await consumeAccountToken(token, 'email_verification');
  if (userId === null) {
    return { ok: false, message: 'Invalid or expired verification link' };
  }

  const user = await UserModel.findOneAndUpdate(
    { _id: userId },
    { $set: { emailVerified: true, emailVerifiedAt: new Date() } },
    { new: true },
  ).exec();
  if (user === null) {
    return { ok: false, message: 'Invalid or expired verification link' };
  }

  await invalidateAccountTokens(user._id, 'email_verification');
  await recordAuditEvent({
    action: 'user.email_verified',
    actorId: String(user._id),
    actorRole: user.role,
    metadata: { stage: 'completed' },
  });
  return { ok: true, message: 'Email verified successfully' };
}

export async function requestPasswordReset(
  email: string,
  emailService: EmailService,
): Promise<{ message: string }> {
  const user = await UserModel.findOne({ email: normalizeEmail(email) }).exec();
  if (user === null || user.accountStatus !== 'active') {
    return GENERIC_RESET_RESPONSE;
  }

  const token = await issueAccountToken(user._id, 'password_reset');
  try {
    await emailService.sendPasswordResetEmail(user.email, token);
    await recordAuditEvent({
      action: 'user.password_reset_requested',
      actorId: String(user._id),
      actorRole: user.role,
    });
  } catch {
    await revokeAccountToken(token, 'password_reset');
    console.error('[email] password reset delivery failed');
  }
  return GENERIC_RESET_RESPONSE;
}

/**
 * Consumes a reset token and rotates the password. The credential version is
 * incremented so every existing session (for any device) stops authenticating
 * on its next request; all outstanding reset tokens are discarded.
 */
export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<{ ok: boolean; message: string }> {
  const userId = await consumeAccountToken(token, 'password_reset');
  if (userId === null) {
    return { ok: false, message: 'Invalid or expired reset link' };
  }

  const passwordHash = await hashPassword(newPassword);
  const user = await UserModel.findOneAndUpdate(
    { _id: userId, accountStatus: 'active' },
    { $inc: { credentialVersion: 1 }, $set: { passwordHash } },
    { new: true },
  ).exec();

  if (user === null) {
    return { ok: false, message: 'Invalid or expired reset link' };
  }

  await invalidateAccountTokens(user._id as Types.ObjectId, 'password_reset');
  await recordAuditEvent({
    action: 'user.password_reset_completed',
    actorId: String(user._id),
    actorRole: user.role,
  });
  return { ok: true, message: 'Password reset successfully' };
}
