import { ArrowLeft, BadgeCheck, MailCheck } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { InlineNotice } from '../components/ui/States';
import { ApiError } from '../lib/api';
import { confirmEmailVerification, requestEmailVerification } from '../lib/account';

type ConfirmStatus = 'confirming' | 'success' | 'invalidToken' | 'error';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = (searchParams.get('token') ?? '').trim();
  const emailId = useId();
  const started = useRef(false);

  const [status, setStatus] = useState<ConfirmStatus>('confirming');
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSent, setRequestSent] = useState(false);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    document.title = 'Verify your email — EnteBharatham';
  }, []);

  useEffect(() => {
    if (token === '' || started.current) return;
    started.current = true;

    confirmEmailVerification(token)
      .then(() => setStatus('success'))
      .catch((caught: unknown) => {
        if (caught instanceof ApiError && caught.code === 'TOKEN_INVALID') {
          setStatus('invalidToken');
          return;
        }
        setStatus('error');
        setError(
          caught instanceof ApiError && caught.status === 429
            ? 'Too many attempts. Please wait a few minutes and try again.'
            : 'We could not verify your email right now. Please try again.',
        );
      });
  }, [token]);

  const retryConfirmation = async () => {
    if (status === 'confirming') return;
    setStatus('confirming');
    setError(null);
    try {
      await confirmEmailVerification(token);
      setStatus('success');
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'TOKEN_INVALID') {
        setStatus('invalidToken');
        return;
      }
      setStatus('error');
      setError(
        caught instanceof ApiError && caught.status === 429
          ? 'Too many attempts. Please wait a few minutes and try again.'
          : 'We could not verify your email right now. Please try again.',
      );
    }
  };

  const handleRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (requesting) return;
    setRequestError(null);
    setRequesting(true);
    try {
      await requestEmailVerification(email);
      setRequestSent(true);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 429) {
        setRequestError('Too many attempts. Please wait a few minutes and try again.');
      } else {
        setRequestError('We could not send a verification email right now. Please try again.');
      }
    } finally {
      setRequesting(false);
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
            <h1 className="display-title mt-4">Verify your email address</h1>
            <p className="body-copy mt-4">
              Confirming your address keeps your account recovery details accurate. Verification is
              separate from signing in.
            </p>
          </div>

          {token === '' && (
            <div className="mt-8">
              {requestSent ? (
                <div>
                  <InlineNotice tone="success" live="status">
                    <span className="flex items-start gap-3">
                      <MailCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                      <span>
                        If an unverified account exists for{' '}
                        <strong className="font-semibold">{email.trim()}</strong>, a verification
                        email has been sent.
                      </span>
                    </span>
                  </InlineNotice>
                  <button
                    type="button"
                    onClick={() => setRequestSent(false)}
                    className="link-underline mt-4 text-sm"
                  >
                    Use a different email address
                  </button>
                </div>
              ) : (
                <form
                  className="rounded-2xl border border-line/80 bg-paper p-6 shadow-panel sm:p-7"
                  onSubmit={handleRequest}
                >
                  {requestError !== null && (
                    <p
                      role="alert"
                      className="mb-5 rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger"
                    >
                      {requestError}
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
                    We only send a message if there is an unverified account with this address.
                  </p>

                  <button type="submit" disabled={requesting} className="btn-primary mt-6 w-full">
                    {requesting ? 'Sending verification email…' : 'Send verification email'}
                  </button>
                </form>
              )}
            </div>
          )}

          {token !== '' && status === 'confirming' && (
            <div className="mt-8">
              <InlineNotice tone="info" live="status">
                Confirming your email address…
              </InlineNotice>
            </div>
          )}

          {token !== '' && status === 'success' && (
            <div className="mt-8">
              <InlineNotice tone="success" live="status">
                <span className="flex items-start gap-3">
                  <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                  <span>Your email address is verified. Thank you.</span>
                </span>
              </InlineNotice>
              <Link to="/dashboard" className="btn-primary mt-5 w-full">
                Go to your contributions
              </Link>
            </div>
          )}

          {token !== '' && status === 'invalidToken' && (
            <div className="mt-8 space-y-4">
              <InlineNotice tone="error" live="alert">
                This verification link is invalid or has expired. Verification links can only be
                used once.
              </InlineNotice>
              <Link to="/verify-email" className="btn-primary">
                Request a new verification email
              </Link>
            </div>
          )}

          {token !== '' && status === 'error' && (
            <div className="mt-8 space-y-4">
              <InlineNotice tone="error" live="alert">
                {error ?? 'We could not verify your email right now. Please try again.'}
              </InlineNotice>
              <button
                type="button"
                onClick={() => void retryConfirmation()}
                className="btn-primary"
              >
                Try again
              </button>
              <p className="text-sm text-earth-ink">
                If the problem continues,{' '}
                <Link to="/verify-email" className="link-underline">
                  request a new verification email
                </Link>
                .
              </p>
            </div>
          )}

          <p className="mt-8 border-t border-line pt-6 text-sm text-earth-ink">
            Need to reset your password instead?{' '}
            <Link to="/forgot-password" className="link-underline">
              Reset your password
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
