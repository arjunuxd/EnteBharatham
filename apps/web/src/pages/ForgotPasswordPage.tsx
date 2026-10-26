import { ArrowLeft, MailCheck } from 'lucide-react';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { InlineNotice } from '../components/ui/States';
import { ApiError } from '../lib/api';
import { requestPasswordReset } from '../lib/account';

export function ForgotPasswordPage() {
  const emailId = useId();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = 'Reset your password — EnteBharatham';
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 429) {
        setError('Too many attempts. Please wait a few minutes and try again.');
      } else {
        setError('We could not send the reset email right now. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative overflow-hidden border-b border-line bg-cream">
      <div
        className="pointer-events-none absolute -right-28 -top-24 h-[24rem] w-[24rem] rounded-full border border-terracotta/10"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-36 left-1/4 h-[20rem] w-[20rem] rounded-full bg-forest/[0.04] blur-3xl"
        aria-hidden="true"
      />
      <div className="container-page relative py-12 sm:py-16">
        <div className="mx-auto max-w-md">
          <Link to="/login" className="link-quiet inline-flex items-center gap-2 text-sm">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to sign in
          </Link>

          <div className="mt-8">
            <p className="eyebrow flex items-center gap-3">
              <span className="h-px w-7 bg-terracotta" aria-hidden="true" />
              Account recovery
            </p>
            <h1 className="display-title mt-4">Reset your password</h1>
            <p className="body-copy mt-4">
              Enter the email address on your account. If it matches an account, we will send a
              single-use link that expires in one hour.
            </p>
          </div>

          {sent ? (
            <div className="mt-8">
              <InlineNotice tone="success" live="status">
                <span className="flex items-start gap-3">
                  <MailCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                  <span>
                    If an account exists for{' '}
                    <strong className="font-semibold">{email.trim()}</strong>, a password reset
                    email has been sent. Check your inbox and spam folder.
                  </span>
                </span>
              </InlineNotice>
              <p className="mt-4 text-sm text-earth-ink">
                The link can be used once. If it expires,{' '}
                <button type="button" onClick={() => setSent(false)} className="link-underline">
                  request another
                </button>
                .
              </p>
            </div>
          ) : (
            <form
              className="mt-8 rounded-2xl border border-line/80 bg-paper p-6 shadow-panel sm:p-7"
              onSubmit={handleSubmit}
            >
              {error !== null && (
                <p
                  role="alert"
                  className="mb-5 rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger"
                >
                  {error}
                </p>
              )}

              <label htmlFor={emailId} className="field-label">
                Email address
              </label>
              <input
                id={emailId}
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="input"
                placeholder="you@example.com"
              />
              <p className="field-hint">
                For privacy, we show the same confirmation whether or not an account exists.
              </p>

              <button type="submit" disabled={submitting} className="btn-primary mt-6 w-full">
                {submitting ? 'Sending reset link…' : 'Send reset link'}
              </button>
            </form>
          )}

          <div className="mt-8 border-t border-line pt-6 text-sm text-earth-ink">
            <p>
              Remembered your password?{' '}
              <Link to="/login" className="link-underline">
                Sign in
              </Link>
            </p>
            <p className="mt-2">
              Need to verify your email instead?{' '}
              <Link to="/verify-email" className="link-underline">
                Resend a verification link
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
