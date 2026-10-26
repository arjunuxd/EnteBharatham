import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Transport boundary. Templates and token handling live elsewhere so an
 * operator can swap delivery (SMTP today, another provider later) without
 * touching account flows.
 */
export interface EmailTransport {
  send(message: EmailMessage): Promise<void>;
  /** Releases pooled connections. Optional for test transports. */
  close?(): Promise<void> | void;
}

/**
 * In-memory transport for development and tests. It never opens a socket and
 * records messages (including their links) only in process memory, which lets
 * tests exercise the full verification/reset workflow without a real mailbox.
 */
export class DevTestEmailTransport implements EmailTransport {
  private sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }

  getSent(): EmailMessage[] {
    return [...this.sent];
  }

  clear(): void {
    this.sent.length = 0;
  }
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  requireTLS: boolean;
  rejectUnauthorized: boolean;
  from: string;
  user?: string;
  pass?: string;
}

export class SmtpEmailTransport implements EmailTransport {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: SmtpConfig) {
    if (config.host.length === 0) {
      throw new Error('SMTP host is not configured');
    }
    this.from = config.from;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      requireTLS: config.requireTLS,
      // Never disable certificate validation: doing so would allow a
      // man-in-the-middle to capture SMTP credentials.
      tls: { rejectUnauthorized: config.rejectUnauthorized },
      pool: true,
      maxConnections: 3,
      maxMessages: 100,
      connectionTimeout: 15_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
      ...(config.user !== undefined && config.pass !== undefined
        ? { auth: { user: config.user, pass: config.pass } }
        : {}),
    });
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }

  close(): void {
    this.transporter.close();
  }
}

export interface EmailTransportConfig {
  provider: 'dev' | 'test' | 'smtp';
  host?: string;
  port: number;
  secure: boolean;
  requireTLS: boolean;
  rejectUnauthorized: boolean;
  from?: string;
  user?: string;
  pass?: string;
}

export function createEmailTransport(config: EmailTransportConfig): EmailTransport {
  if (config.provider === 'smtp') {
    return new SmtpEmailTransport({
      host: config.host ?? '',
      port: config.port,
      secure: config.secure,
      requireTLS: config.requireTLS,
      rejectUnauthorized: config.rejectUnauthorized,
      from: config.from ?? 'noreply@localhost',
      ...(config.user !== undefined ? { user: config.user } : {}),
      ...(config.pass !== undefined ? { pass: config.pass } : {}),
    });
  }
  return new DevTestEmailTransport();
}

/** Convenience builder from validated environment configuration. */
export function createEmailTransportFromEnv(env: {
  EMAIL_PROVIDER: 'dev' | 'test' | 'smtp';
  SMTP_HOST?: string;
  SMTP_PORT: number;
  SMTP_SECURE: boolean;
  SMTP_REQUIRE_TLS: boolean;
  SMTP_REJECT_UNAUTHORIZED: boolean;
  EMAIL_FROM?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
}): EmailTransport {
  return createEmailTransport({
    provider: env.EMAIL_PROVIDER,
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    requireTLS: env.SMTP_REQUIRE_TLS,
    rejectUnauthorized: env.SMTP_REJECT_UNAUTHORIZED,
    from: env.EMAIL_FROM,
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  });
}
