import { ArrowRight, LockKeyhole } from 'lucide-react';
import { useEffect, type FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthFrame } from '../components/AuthFrame';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../lib/api';

const LOGIN_INCLUDES = [
  'Private drafts you can return to',
  'Reviewer feedback in one place',
  'Clear consent and attribution on every record',
];

/**
 * Only same-origin relative destinations are honoured. Reject protocol-
 * relative paths (`//host`), backslash-normalised paths (`/\host`), and
 * control characters so a crafted `next` value cannot redirect off-site.
 */
function safeNext(raw: string | null): string {
  if (raw === null) return '/dashboard';
  const value = raw.trim();
  if (
    value.length === 0 ||
    value.length > 500 ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    // eslint-disable-next-line no-control-regex
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return '/dashboard';
  }
  try {
    const resolved = new URL(value, window.location.origin);
    if (resolved.origin !== window.location.origin) return '/dashboard';
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return '/dashboard';
  }
}

export function LoginPage() {
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const next = safeNext(searchParams.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = 'Sign in — EnteBharatham';
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      navigate(next, { replace: true });
    } catch (caught) {
      if (caught instanceof ApiError && (caught.status === 401 || caught.status === 400)) {
        setError('That email and password combination is not correct.');
      } else if (caught instanceof ApiError && caught.status === 429) {
        setError('Too many attempts. Please wait a few minutes and try again.');
      } else {
        setError('We could not sign you in right now. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthFrame
      eyebrow="Contributor sign in"
      title="Sign in"
      description="Return to your drafts, submissions, and reviewer conversations."
      asideTitle="Keep the story in the language it was given."
      asideDescription="Your account keeps drafts, review notes, and published records together — with attribution and consent always in view."
      asideItems={LOGIN_INCLUDES}
      asideFooter={
        <p>
          Every record stays open to correction.{' '}
          <Link
            to="/about#principles"
            className="font-semibold text-gold-light transition-colors hover:text-ivory"
          >
            Read the principles
          </Link>
        </p>
      }
      footer={
        <>
          New here?{' '}
          <Link to="/register" className="link-underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        {error !== null && (
          <p
            role="alert"
            className="mb-5 rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger"
          >
            {error}
          </p>
        )}

        <div>
          <label htmlFor="login-email" className="field-label">
            Email address
          </label>
          <input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="input"
          />
        </div>

        <div className="mt-5">
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <label htmlFor="login-password" className="text-[0.8125rem] font-semibold text-ink">
              Password
            </label>
            <Link
              to="/forgot-password"
              className="text-xs font-semibold text-forest hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="login-password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="input"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || status === 'loading'}
          className="btn-primary mt-6 w-full"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
          {!submitting && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
        </button>

        <p className="mt-5 flex items-start gap-2 rounded-lg border border-line/70 bg-cream/60 px-3 py-2.5 text-xs leading-5 text-earth-ink">
          <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-forest" aria-hidden="true" />
          Sessions use an httpOnly cookie. Drafts stay private until you submit them for review.
        </p>
      </form>
    </AuthFrame>
  );
}
