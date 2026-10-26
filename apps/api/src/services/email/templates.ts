import type { EmailMessage } from './transport.js';

/**
 * Email templates are pure functions over already-validated inputs. They
 * never receive a password hash, session id, or unbounded user text. Links
 * are built with URL/URLSearchParams so a token cannot inject a different
 * origin or query parameter.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildAccountLink(baseUrl: string, path: string, token: string): string {
  const url = new URL(path, baseUrl);
  url.searchParams.set('token', token);
  return url.toString();
}

export function verificationEmail(to: string, link: string): EmailMessage {
  const safeLink = escapeHtml(link);
  return {
    to,
    subject: 'Verify your email - EnteBharatham',
    text: `Thank you for registering with EnteBharatham.\n\nVerify your email address by visiting:\n${link}\n\nThis link expires in 24 hours and can be used once. If you did not create an account, you can ignore this message.`,
    html: `<p>Thank you for registering with EnteBharatham.</p><p>Verify your email address by clicking <a href="${safeLink}">this link</a>.</p><p>This link expires in 24 hours and can be used once. If you did not create an account, you can ignore this message.</p>`,
  };
}

export function passwordResetEmail(to: string, link: string): EmailMessage {
  const safeLink = escapeHtml(link);
  return {
    to,
    subject: 'Reset your password - EnteBharatham',
    text: `We received a request to reset the password for your EnteBharatham account.\n\nReset your password here:\n${link}\n\nThis link expires in 1 hour and can be used once. If you did not request a reset, you can ignore this message; your password will not change.`,
    html: `<p>We received a request to reset the password for your EnteBharatham account.</p><p>Reset your password by clicking <a href="${safeLink}">this link</a>.</p><p>This link expires in 1 hour and can be used once. If you did not request a reset, you can ignore this message; your password will not change.</p>`,
  };
}
