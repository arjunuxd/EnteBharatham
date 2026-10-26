import type { ModerationSubmissionSummary, PaginatedResponse } from '@entebharatham/shared';
import { ArrowRight, ClipboardList, FileSearch, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { Pagination } from '../components/ui/Pagination';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { ApiError } from '../lib/api';
import { heritageTypeLabel } from '../lib/heritage';
import { fetchReviewQueue } from '../lib/workflow';
import { QualityBadges } from './DashboardPage';

type Status = 'loading' | 'ready' | 'error';

const PAGE_SIZE = 12;

type IndicatorTone = 'neutral' | 'success' | 'warning' | 'danger';

const TONE_CLASS: Record<IndicatorTone, string> = {
  neutral: 'badge-neutral',
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-danger',
};

/** Compact consent/rights indicators so moderators can spot blockers in the queue. */
function QueueIndicators({ record }: { record: ModerationSubmissionSummary }) {
  const indicators: Array<{ label: string; tone: IndicatorTone }> = [
    {
      label: record.permissionToPublish ? 'Publish permission: yes' : 'Publish permission: MISSING',
      tone: record.permissionToPublish ? 'success' : 'danger',
    },
    {
      label: `Consent: ${record.consentVerification.replace('_', ' ')}`,
      tone: record.consentVerification === 'unverified' ? 'warning' : 'success',
    },
    {
      label: `Rights: ${record.rightsStatus}`,
      tone: record.rightsStatus === 'confirmed' ? 'success' : 'warning',
    },
    {
      label: `Visibility: ${record.visibility}`,
      tone: record.visibility === 'public' ? 'success' : 'warning',
    },
  ];
  if (record.hasRestrictions) {
    indicators.push({ label: 'Has restrictions', tone: 'warning' });
  }
  if (record.isFictionalSample) {
    indicators.push({ label: 'Fictional demo', tone: 'neutral' });
  }

  return (
    <ul className="flex flex-wrap gap-2" aria-label="Submission indicators">
      {indicators.map((indicator) => (
        <li key={indicator.label} className={TONE_CLASS[indicator.tone]}>
          {indicator.label}
        </li>
      ))}
    </ul>
  );
}

/** Moderator review queue: submissions awaiting a decision, newest first. */
export function ModerationQueuePage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedResponse<ModerationSubmissionSummary> | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [retryToken, setRetryToken] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    setLoadError(null);

    fetchReviewQueue(page, PAGE_SIZE, controller.signal)
      .then((result) => {
        setData(result);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        if (error instanceof ApiError && error.status === 403) {
          setLoadError('Your account does not have moderator access.');
        }
        setStatus('error');
      });

    return () => controller.abort();
  }, [page, retryToken]);

  return (
    <div className="pb-20">
      <section className="relative overflow-hidden border-b border-line bg-cream">
        <div
          className="pointer-events-none absolute -right-24 -top-28 h-[24rem] w-[24rem] rounded-full border border-terracotta/10"
          aria-hidden="true"
        />
        <div className="container-page relative pb-9 pt-10 sm:pb-11 sm:pt-14">
          <PageHeader
            eyebrow="Moderation"
            title="Review queue"
            border={false}
            description="Submissions awaiting a decision. Approval publishes only when consent, verification, visibility, and rights are all in place."
            actions={
              <>
                <Link to="/moderation/governance" className="btn-secondary">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  Governance
                </Link>
                <Link to="/moderation/audit" className="btn-ghost">
                  Audit log
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </>
            }
          />
        </div>
      </section>

      <div className="container-page mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <section aria-labelledby="queue-records-heading" className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
            <div>
              <h2
                id="queue-records-heading"
                className="font-display text-[clamp(1.75rem,2.4vw,2.1rem)] leading-none tracking-[-0.03em] text-ink"
              >
                Awaiting review
              </h2>
              {status === 'ready' && data !== null && (
                <p className="mt-1 text-sm text-earth-ink" aria-live="polite">
                  {data.total === 1 ? '1 submission' : `${data.total} submissions`} in the queue
                </p>
              )}
            </div>
          </div>

          <div className="mt-5">
            {status === 'loading' && <LoadingState>Loading the review queue…</LoadingState>}

            {status === 'error' && (
              <ErrorState
                title={loadError ?? 'We could not load the review queue.'}
                description={
                  loadError === null
                    ? 'We could not load the review queue just now. Please try again.'
                    : undefined
                }
                onRetry={loadError === null ? () => setRetryToken((token) => token + 1) : undefined}
              />
            )}

            {status === 'ready' && data !== null && (
              <>
                {data.items.length === 0 ? (
                  <EmptyState
                    title="The queue is empty — nothing is awaiting review."
                    description="New submissions will appear here when contributors send them for review."
                    action={
                      <Link to="/moderation/audit" className="btn-secondary">
                        Review the audit log
                      </Link>
                    }
                  />
                ) : (
                  <ul className="space-y-4">
                    {data.items.map((record) => (
                      <li key={record.id}>
                        <article className="rounded-xl border border-line/90 bg-paper p-5 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:border-forest/25 hover:shadow-lift sm:p-6">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 space-y-1.5">
                              <p className="micro-label text-terracotta-deep">
                                {heritageTypeLabel(record.heritageType)}
                              </p>
                              <h2 className="break-words font-display text-[1.4rem] leading-[1.15] tracking-[-0.02em] text-ink">
                                <Link
                                  to={`/moderation/submissions/${record.id}`}
                                  className="transition-colors hover:text-forest"
                                >
                                  {record.title}
                                </Link>
                              </h2>
                            </div>
                            <div className="text-left text-xs text-earth-ink sm:text-right">
                              {record.submittedAt !== undefined && (
                                <p>Submitted {new Date(record.submittedAt).toLocaleDateString()}</p>
                              )}
                              <p>Updated {new Date(record.updatedAt).toLocaleDateString()}</p>
                            </div>
                          </div>

                          <div className="mt-4">
                            <QueueIndicators record={record} />
                          </div>

                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line/80 pt-4">
                            <QualityBadges quality={record.quality} />
                            <Link
                              to={`/moderation/submissions/${record.id}`}
                              className="btn-primary btn-sm"
                            >
                              Review submission
                              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                            </Link>
                          </div>
                        </article>
                      </li>
                    ))}
                  </ul>
                )}

                {data.totalPages > 1 && (
                  <div className="mt-8">
                    <Pagination
                      page={data.page}
                      totalPages={data.totalPages}
                      total={data.total}
                      onChange={setPage}
                      label="Review queue pagination"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-xl border border-line/90 bg-paper p-5 shadow-card">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-forest-soft text-forest">
              <ClipboardList className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2 className="mt-4 font-display text-lg text-ink">Before you approve</h2>
            <ul className="mt-3 space-y-2.5 text-sm leading-6 text-earth-ink">
              <li>Permission to publish is explicitly recorded.</li>
              <li>Visibility is public and rights status is confirmed.</li>
              <li>Sources and attribution are enough for a reader to trace.</li>
              <li>Any restriction or sensitivity is understood and recorded.</li>
            </ul>
          </section>

          <section className="rounded-xl border border-line/90 bg-cream/90 p-5 shadow-card">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-terracotta-soft text-terracotta-deep">
              <FileSearch className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2 className="mt-4 font-display text-lg text-ink">Automated checks</h2>
            <p className="mt-2 text-sm leading-6 text-earth-ink">
              Quality findings describe completeness, not cultural value. Use them to ask a better
              question, not to rank a tradition.
            </p>
            <Link to="/about#principles" className="link-underline mt-4 inline-block text-sm">
              Review principles
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
