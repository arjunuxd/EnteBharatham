import { ArrowUpRight, CalendarDays, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { ApiError, apiGet } from '../../lib/api';

interface ProfileContribution {
  id: string;
  slug: string;
  title: string;
  createdAt: string;
}

interface PublicProfile {
  id: string;
  displayName: string;
  attributionName?: string;
  bio?: string;
  memberSince: string;
  publicProfileEnabled: boolean;
  contributions: ProfileContribution[];
}

interface ProfileResponse {
  profile: PublicProfile;
}

type ProfileStatus = 'loading' | 'ready' | 'notFound' | 'error';

function formatDate(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '?';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : '';
  return `${first}${last ?? ''}`.toUpperCase();
}

/**
 * Public contributor profile.
 *
 * Everything on this page comes from `GET /profiles/:userId`; the page adds no
 * inferred counts, reputation, or ranking. A profile that is not public
 * (including a missing account) is presented as unavailable rather than as an
 * error, which is also what the API reports.
 */
export function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [status, setStatus] = useState<ProfileStatus>('loading');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (userId === undefined) {
      setStatus('notFound');
      return;
    }

    const controller = new AbortController();
    setStatus('loading');
    setProfile(null);

    apiGet<ProfileResponse>(`/profiles/${encodeURIComponent(userId)}`, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        setProfile(response.profile);
        setStatus('ready');
        document.title = `${response.profile.displayName} — EnteBharatham`;
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return;
        if (caught instanceof ApiError && caught.status === 404) {
          setStatus('notFound');
          return;
        }
        setStatus('error');
      });

    return () => controller.abort();
  }, [userId, reloadKey]);

  if (status === 'loading') {
    return (
      <div className="container-page py-12 sm:py-16">
        <LoadingState className="mx-auto max-w-xl">Loading contributor profile…</LoadingState>
      </div>
    );
  }

  if (status === 'notFound') {
    return (
      <div className="container-page py-12 sm:py-16">
        <div className="mx-auto max-w-xl">
          <p className="eyebrow">Contributor profile</p>
          <h1 className="display-title mt-4">Profile not available</h1>
          <p className="body-copy mt-4">
            This contributor profile is not public, or the account could not be found.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/explore" className="btn-primary">
              Explore the archive
            </Link>
            <Link to="/" className="btn-secondary">
              Back to home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error' || profile === null) {
    return (
      <div className="container-page py-12 sm:py-16">
        <div className="mx-auto max-w-xl">
          <ErrorState
            title="We could not load this profile"
            description="The archive may be temporarily unavailable. Please try again."
            onRetry={() => setReloadKey((current) => current + 1)}
          />
        </div>
      </div>
    );
  }

  const memberSince = formatDate(profile.memberSince);
  const contributions = Array.isArray(profile.contributions) ? profile.contributions : [];
  const creditName =
    profile.attributionName !== undefined && profile.attributionName.trim() !== ''
      ? profile.attributionName
      : null;

  return (
    <div>
      <section className="relative overflow-hidden bg-midnight text-ivory">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(48rem_36rem_at_88%_-8%,rgb(79_70_229_/_0.35),transparent_62%),radial-gradient(34rem_26rem_at_0%_100%,rgb(251_115_88_/_0.16),transparent_66%)]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-[26rem] w-[26rem] rounded-full border border-ivory/10"
          aria-hidden="true"
        />
        <div className="container-page relative py-12 sm:py-16">
          <PageHeader
            tone="dark"
            eyebrow="Contributor"
            title={profile.displayName}
            description={
              profile.bio !== undefined && profile.bio.trim() !== '' ? profile.bio : undefined
            }
            breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Contributor profile' }]}
          >
            <dl className="flex flex-wrap gap-x-10 gap-y-4 border-t border-ivory/15 pt-6">
              {memberSince !== null && (
                <div>
                  <dt className="text-[0.625rem] font-bold uppercase tracking-[0.18em] text-ivory/60">
                    Member since
                  </dt>
                  <dd className="mt-1 flex items-center gap-2 text-sm text-ivory">
                    <CalendarDays className="h-4 w-4 text-gold" aria-hidden="true" />
                    {memberSince}
                  </dd>
                </div>
              )}
              {creditName !== null && (
                <div>
                  <dt className="text-[0.625rem] font-bold uppercase tracking-[0.18em] text-ivory/60">
                    Attribution name
                  </dt>
                  <dd className="mt-1 flex items-center gap-2 text-sm text-ivory">
                    <UserRound className="h-4 w-4 text-gold" aria-hidden="true" />
                    {creditName}
                  </dd>
                </div>
              )}
            </dl>
          </PageHeader>
        </div>
      </section>

      <section aria-labelledby="contributions-heading" className="section-shell">
        <div className="container-page grid gap-12 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-16">
          <aside
            aria-label="About this contributor"
            className="h-fit rounded-xl border border-line/90 bg-cream/80 p-6 shadow-card"
          >
            <div>
              <span
                className="flex h-16 w-16 items-center justify-center rounded-lg border border-line-strong bg-paper font-display text-2xl text-forest shadow-xs"
                aria-hidden="true"
              >
                {initials(profile.displayName)}
              </span>
              <p className="mt-5 font-display text-2xl leading-tight text-ink">
                {creditName ?? profile.displayName}
              </p>
              {creditName !== null && creditName !== profile.displayName && (
                <p className="mt-1 text-xs text-earth-ink">Account name: {profile.displayName}</p>
              )}
              <div className="mt-6 border-t border-line pt-5">
                <p className="text-xs leading-6 text-earth-ink">
                  Profiles show published records only. Private drafts and records pending review
                  are never listed here.
                </p>
              </div>
            </div>

            <Link to="/contribute" className="link-underline mt-6 inline-flex text-sm">
              Contribute a story
              <ArrowUpRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </aside>

          <div className="min-w-0">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
              <div>
                <p className="eyebrow">The public record</p>
                <h2 id="contributions-heading" className="display-section mt-3">
                  Published contributions
                </h2>
              </div>
              <p className="meta rounded-full border border-line bg-paper/60 px-3 py-1">
                {contributions.length === 1
                  ? '1 published record'
                  : `${contributions.length} published records`}
              </p>
            </div>

            {contributions.length === 0 ? (
              <EmptyState
                className="mt-8"
                title="No published records yet"
                description="Published contributions will appear here once a record has completed review."
                action={
                  <Link to="/explore" className="btn-secondary">
                    Explore the archive
                  </Link>
                }
              />
            ) : (
              <ul className="mt-5 space-y-3">
                {contributions.map((contribution, index) => {
                  const created = formatDate(contribution.createdAt);
                  return (
                    <li key={contribution.id}>
                      <Link
                        to={`/heritage/${contribution.slug}`}
                        className="group flex items-start gap-5 rounded-xl border border-line/80 bg-paper/70 px-5 py-4 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:border-forest/25 hover:bg-paper hover:shadow-lift"
                      >
                        <span
                          className="mt-1 font-display text-sm text-earth-ink"
                          aria-hidden="true"
                        >
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-display text-[1.35rem] leading-[1.2] tracking-[-0.02em] text-ink transition-colors group-hover:text-forest">
                            {contribution.title}
                          </span>
                          {created !== null && (
                            <span className="mt-1.5 block text-xs text-earth-ink">
                              Record entered {created}
                            </span>
                          )}
                        </span>
                        <ArrowUpRight
                          className="mt-1.5 h-4 w-4 shrink-0 text-earth-ink transition-colors group-hover:text-terracotta-deep"
                          aria-hidden="true"
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
