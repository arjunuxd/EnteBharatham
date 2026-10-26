import { ArrowRight } from 'lucide-react';
import { useEffect, type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthFrame } from '../components/AuthFrame';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../lib/api';

const ACCOUNT_INCLUDES = [
  'Private drafts you can edit and return to',
  'A record of every submission and its review status',
  'Reviewer feedback you can reply to',
  'A public contributor profile for your published records',
];

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = 'Create an account — EnteBharatham';
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await register({ displayName: displayName.trim(), email: email.trim(), password });
      navigate('/dashboard', { replace: true });
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        setError('An account with this email address already exists.');
      } else if (caught instanceof ApiError && caught.status === 400) {
        setError(
          'Please check your details: email, password (8+ characters), and name are required.',
        );
      } else if (caught instanceof ApiError && caught.status === 429) {
        setError('Too many attempts. Please wait a few minutes and try again.');
      } else {
        setError('We could not create your account right now. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthFrame
      eyebrow="Contributor registration"
      title="Create an account"
      description="Join as a contributor to prepare records for review. New accounts start with the contributor role."
      asideTitle="An archive is a relationship, not a database."
      asideDescription="A contributor account gives you a careful place to prepare a record before it enters the public archive."
      asideItems={ACCOUNT_INCLUDES}
      asideFooter={
        <p>
          An account never transfers rights to a story.{' '}
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
          Already have an account?{' '}
          <Link to="/login" className="link-underline">
            Sign in
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
          <label htmlFor="register-name" className="field-label">
            Display name
          </label>
          <input
            id="register-name"
            type="text"
            required
            maxLength={80}
            autoComplete="name"
            placeholder="How you would like to be credited"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className="input"
          />
          <p className="field-hint">The name shown on your public profile and on your records.</p>
        </div>

        <div className="mt-5">
          <label htmlFor="register-email" className="field-label">
            Email address
          </label>
          <input
            id="register-email"
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
          <label htmlFor="register-password" className="field-label">
            Password
          </label>
          <input
            id="register-password"
            type="password"
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="input"
          />
          <p className="field-hint">At least 8 characters.</p>
        </div>

        <button type="submit" disabled={submitting} className="btn-primary mt-6 w-full">
          {submitting ? 'Creating account…' : 'Create account'}
          {!submitting && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
        </button>

        <p className="mt-4 text-xs leading-5 text-earth-ink">
          Creating an account does not transfer rights to a story. Every record carries its own
          consent and rights details, and you choose how you are credited.
        </p>
      </form>
    </AuthFrame>
  );
}
