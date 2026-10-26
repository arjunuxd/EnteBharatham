import { buildAccountLink, passwordResetEmail, verificationEmail } from './templates.js';
import type { EmailTransport } from './transport.js';

/**
 * Account email orchestration: builds the correct template and delegates
 * delivery. It never logs message bodies or links (which contain single-use
 * tokens). Callers decide whether a delivery failure is fatal; account
 * recovery requests deliberately treat it as non-fatal so responses stay
 * enumeration-safe.
 */
export class EmailService {
  constructor(
    private transport: EmailTransport,
    private appBaseUrl: string,
  ) {}

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const link = buildAccountLink(this.appBaseUrl, '/verify-email', token);
    await this.transport.send(verificationEmail(to, link));
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const link = buildAccountLink(this.appBaseUrl, '/reset-password', token);
    await this.transport.send(passwordResetEmail(to, link));
  }

  async close(): Promise<void> {
    await this.transport.close?.();
  }
}
