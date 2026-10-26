import { ArrowLeft, KeyRound } from 'lucide-react';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Field } from '../components/ui/Field';
import { InlineNotice } from '../components/ui/States';
import { ApiError } from '../lib/api';
import { confirmPasswordReset } from '../lib/account';

type Status = 'form' | 'submitting' | 'success' | 'invalidToken' | 'error';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = (searchParams.get('token') ?? '').trim();
  const passwordId = useId();
  const confirmId = useId();

  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [status, setStatus] = useState<Status>('form');
  const [formError, setFormError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Choose a new password — EnteBharatham';
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === 'submitting') return;

    setFormError(null);
    setPasswordError(null);
    setError(null);

    if (password.length < 8) {
      setPasswordError('Use at least 8 characters.');
      return;
    }
    if (password !== confirmation) {
      setFormError('The two passwords do not match.');
      return;
    }

    setStatus('submitting');
    try {
      await confirmPasswordReset(token, password);
      setStatus('success');
      setPassword('');
      setConfirmation('');
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'TOKEN_INVALID') {
        setStatus('invalidToken');
      } else {
        setStatus('error');
        setError(
          caught instanceof ApiError && caught.status === 429
            ? 'Too many attempts. Please wait a few minutes and try again.'
            : 'We could not reset your password right now. Please try again.',
        );
      }
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
            <h1 className="display-title mt-4">Choose a new password</h1>
            <p className="body-copy mt-4">
              Use at least 8 characters. When the password changes, other signed-in sessions for
              this account are signed out.
            </p>
          </div>

          {token === '' && (
            <div className="mt-8 space-y-4">
              <InlineNotice tone="error" live="alert">
                This reset link is incomplete. Open the link from your email again, or request a new
                one.
              </InlineNotice>
              <Link to="/forgot-password" className="btn-primary">
                Request a new link
              </Link>
            </div>
          )}

          {token !== '' && status === 'success' && (
            <div className="mt-8">
              <InlineNotice tone="success" live="status">
                <span className="flex items-start gap-3">
                  <KeyRound className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                  <span>
                    Your password has been reset. Sign in with your new password to continue.
                  </span>
                </span>
              </InlineNotice>
              <Link to="/login" className="btn-primary mt-5 w-full">
                Sign in
              </Link>
            </div>
          )}

          {token !== '' && status === 'invalidToken' && (
            <div className="mt-8 space-y-4">
              <InlineNotice tone="error" live="alert">
                This reset link is invalid or has expired. Reset links can only be used once.
              </InlineNotice>
              <Link to="/forgot-password" className="btn-primary">
                Request a new link
              </Link>
            </div>
          )}

          {(status === 'form' || status === 'submitting' || status === 'error') && token !== '' && (
            <form
              className="mt-8 rounded-2xl border border-line/80 bg-paper p-6 shadow-panel sm:p-7"
              onSubmit={handleSubmit}
              noValidate
            >
              {(formError !== null || error !== null) && (
                <p
                  role="alert"
                  className="mb-5 rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger"
                >
                  {formError ?? error}
                </p>
              )}

              <Field
                label="New password"
                htmlFor={passwordId}
                hint="At least 8 characters."
                error={passwordError ?? undefined}
                required
              >
                {(field) => (
                  <input
                    {...field}
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={128}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                )}
              </Field>

              <Field label="Confirm new password" htmlFor={confirmId} className="mt-5" required>
                {(field) => (
                  <input
                    {...field}
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={128}
                    required
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                  />
                )}
              </Field>

              <button
                type="submit"
                disabled={status === 'submitting'}
                className="btn-primary mt-6 w-full"
              >
                {status === 'submitting' ? 'Saving new password…' : 'Save new password'}
              </button>
            </form>
          )}

          <p className="mt-8 border-t border-line pt-6 text-sm text-earth-ink">
            Need a different account?{' '}
            <Link to="/register" className="link-underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
