import type {
  ContributorRecordSummary,
  PaginatedResponse,
  QualitySummary,
  RecordStatus,
} from '@entebharatham/shared';
import { RECORD_STATUS } from '@entebharatham/shared';
import { ArrowRight, ClipboardCheck, FilePlus2, PenLine, Send, ShieldCheck } from 'lucide-react';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RecordRemovalActions } from '../components/RecordRemovalActions';
import { PageHeader } from '../components/ui/PageHeader';
import { Pagination } from '../components/ui/Pagination';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { ApiError } from '../lib/api';
import { heritageTypeLabel } from '../lib/heritage';
import { buildOwnListPath, createDraft, fetchOwnRecords, submitDraft } from '../lib/workflow';

type Status = 'loading' | 'ready' | 'error';

/** Human-readable lifecycle labels for the contributor's records. */
export const STATUS_LABELS: Record<RecordStatus, string> = {
  draft: 'Draft',
  pending_review: 'In review',
  changes_requested: 'Changes requested',
  published: 'Published',
  rejected: 'Rejected',
  archived: 'Archived',
};

/** Statuses a contributor may still edit (and therefore submit). */
const EDITABLE_STATUSES: readonly RecordStatus[] = ['draft', 'changes_requested'];

export function statusBadgeClass(status: RecordStatus): string {
  switch (status) {
    case 'draft':
      return 'border-line-strong bg-cream text-earth-ink';
    case 'pending_review':
      return 'border-warning/25 bg-warning-soft text-warning';
    case 'changes_requested':
      return 'border-terracotta/30 bg-terracotta-soft text-terracotta-deep';
    case 'published':
      return 'border-success/25 bg-success-soft text-success';
    case 'rejected':
      return 'border-danger/25 bg-danger-soft text-danger';
    case 'archived':
      return 'border-line-strong bg-ivory text-earth-ink';
  }
}

export function StatusBadge({ status }: { status: RecordStatus }) {
  return <span className={`badge ${statusBadgeClass(status)}`}>{STATUS_LABELS[status]}</span>;
}

const PAGE_SIZE = 10;

/**
 * Compact quality indicator for a list row. It shows how many automated
 * checks still need attention — never a score.
 */
export function QualityBadges({ quality }: { quality: QualitySummary }) {
  if (quality.blockerCount === 0 && quality.warningCount === 0) {
    return <span className="badge-success">Checks clear</span>;
  }
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {quality.blockerCount > 0 && (
        <span className="badge-danger">{quality.blockerCount} to fix</span>
      )}
      {quality.warningCount > 0 && (
        <span className="badge-warning">{quality.warningCount} recommended</span>
      )}
    </span>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const titleErrorId = useId();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<RecordStatus | ''>('');
  const [data, setData] = useState<PaginatedResponse<ContributorRecordSummary> | null>(null);
  const [loadStatus, setLoadStatus] = useState<Status>('loading');
  const [retryToken, setRetryToken] = useState(0);

  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [submitErrors, setSubmitErrors] = useState<Record<string, string>>({});
  const [listNotice, setListNotice] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoadStatus('loading');
    setSubmitErrors({});

    fetchOwnRecords(
      { page, limit: PAGE_SIZE, status: statusFilter === '' ? undefined : statusFilter },
      controller.signal,
    )
      .then((result) => {
        setData(result);
        setLoadStatus('ready');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadStatus('error');
      });

    return () => controller.abort();
  }, [page, statusFilter, retryToken]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (creating) return;
    setCreateError(null);

    const title = newTitle.trim();
    if (title.length < 3) {
      setCreateError('Title must be at least 3 characters.');
      return;
    }

    setCreating(true);
    try {
      // Minimal valid draft; the editor page collects the rest.
      const draft = await createDraft({ title, heritageType: 'other', languages: ['Malayalam'] });
      setNewTitle('');
      navigate(`/dashboard/drafts/${draft.id}`);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 429) {
        setCreateError('Too many drafts created recently. Please wait and try again.');
      } else {
        setCreateError('We could not create the draft. Please try again.');
      }
    } finally {
      setCreating(false);
    }
  };

  const handleSubmitForReview = async (record: ContributorRecordSummary) => {
    setSubmittingId(record.id);
    setSubmitErrors((current) => ({ ...current, [record.id]: '' }));
    try {
      await submitDraft(record.id);
      setRetryToken((token) => token + 1);
    } catch (caught) {
      let message = 'We could not submit this record. Please try again.';
      if (caught instanceof ApiError && caught.status === 422 && caught.details !== undefined) {
        const details = caught.details as { missing?: string[] };
        if (Array.isArray(details.missing) && details.missing.length > 0) {
          message = `Cannot submit yet — missing: ${details.missing.join(', ')}. Open the draft to complete it.`;
        }
      } else if (caught instanceof ApiError && caught.status === 409) {
        message = 'This record is no longer editable, so it cannot be submitted.';
      } else if (caught instanceof ApiError && caught.status === 429) {
        message = 'Too many submissions. Please wait a few minutes and try again.';
      }
      setSubmitErrors((current) => ({ ...current, [record.id]: message }));
    } finally {
      setSubmittingId(null);
    }
  };

  const handleRecordDeleted = (record: ContributorRecordSummary) => {
    setSubmitErrors((current) => {
      const next = { ...current };
      delete next[record.id];
      return next;
    });
    setListNotice(`“${record.title}” was deleted.`);
    if (data !== null && data.items.length <= 1 && page > 1) {
      setPage(page - 1);
    } else {
      setRetryToken((token) => token + 1);
    }
  };

  return (
    <div className="pb-20">
      <section className="relative overflow-hidden border-b border-line bg-cream">
        <div
          className="pointer-events-none absolute -right-24 -top-28 h-[24rem] w-[24rem] rounded-full border border-terracotta/10"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-36 left-1/3 h-[20rem] w-[20rem] rounded-full bg-forest/[0.04] blur-3xl"
          aria-hidden="true"
        />
        <div className="container-page relative pb-10 pt-10 sm:pb-12 sm:pt-14">
          <PageHeader
            eyebrow="Contributor workspace"
            title="Your contributions"
            border={false}
            description="Draft, edit, and submit heritage records for review. Submissions become public only after a moderator approves them."
            actions={
              <Link to="/dashboard/drafts/new" className="btn-primary btn-arrow">
                <FilePlus2 className="h-4 w-4" aria-hidden="true" />
                New draft
              </Link>
            }
          >
            {loadStatus === 'ready' && data !== null && (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-earth-ink">
                <span className="inline-flex items-center gap-2">
                  <span className="status-dot text-forest" aria-hidden="true" />
                  <strong className="font-semibold text-ink">{data.total}</strong>
                  {data.total === 1 ? 'record' : 'records'} in your workspace
                </span>
                <span className="hidden h-4 w-px bg-line-strong sm:block" aria-hidden="true" />
                <span className="text-xs">Drafts stay private until they are approved.</span>
              </div>
            )}
          </PageHeader>
        </div>
      </section>

      <div className="container-page mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="min-w-0 space-y-10">
          {/* ------------------------------------------------------ Create */}
          <section
            aria-labelledby="create-heading"
            className="relative overflow-hidden rounded-xl border border-line/90 bg-paper p-5 shadow-card sm:p-7"
          >
            <div
              className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-terracotta-soft/60 blur-2xl"
              aria-hidden="true"
            />
            <div className="relative">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-forest-soft text-forest">
                <PenLine className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="eyebrow mt-4">Start here</p>
              <h2 id="create-heading" className="mt-3 font-display text-2xl leading-snug text-ink">
                Begin a new record
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-earth-ink">
                A working title is enough to start. You can add the story, language, place, and
                sources in the editor.
              </p>
            </div>
            <form className="relative mt-6" onSubmit={handleCreate} aria-label="Create a new draft">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <label htmlFor="new-draft-title" className="field-label">
                    Start a new draft
                  </label>
                  <input
                    id="new-draft-title"
                    type="text"
                    required
                    minLength={3}
                    maxLength={200}
                    placeholder="Working title for your story"
                    value={newTitle}
                    onChange={(event) => setNewTitle(event.target.value)}
                    aria-describedby={createError !== null ? titleErrorId : undefined}
                    aria-invalid={createError !== null ? true : undefined}
                    className={`input ${createError !== null ? 'input-error' : ''}`}
                  />
                </div>
                <button
                  type="submit"
                  disabled={creating}
                  className="btn-primary shrink-0 sm:min-h-[3.125rem]"
                >
                  {creating ? 'Creating…' : 'Create draft'}
                  {!creating && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
              {createError !== null && (
                <p id={titleErrorId} role="alert" className="mt-2 text-xs font-medium text-danger">
                  {createError}
                </p>
              )}
            </form>
          </section>

          {/* ------------------------------------------------------ Records */}
          <section aria-labelledby="records-heading">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="eyebrow">Your archive</p>
                <h2
                  id="records-heading"
                  className="mt-3 font-display text-[clamp(1.75rem,2.4vw,2.1rem)] leading-none tracking-[-0.03em] text-ink"
                >
                  Your records
                </h2>
                {loadStatus === 'ready' && data !== null && (
                  <p className="mt-2 text-sm text-earth-ink" aria-live="polite">
                    {data.total === 1 ? '1 record' : `${data.total} records`}
                    {statusFilter === '' ? ' in your workspace' : ' matching this status'}
                  </p>
                )}
              </div>
              <div className="w-full sm:w-56">
                <label htmlFor="status-filter" className="field-label">
                  Filter by status
                </label>
                <select
                  id="status-filter"
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value as RecordStatus | '');
                    setPage(1);
                  }}
                  className="select"
                >
                  <option value="">All statuses</option>
                  {RECORD_STATUS.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6">
              {listNotice !== null && (
                <p role="status" className="mb-4 text-sm leading-6 text-success">
                  {listNotice}
                </p>
              )}

              {loadStatus === 'loading' && <LoadingState>Loading your records…</LoadingState>}

              {loadStatus === 'error' && (
                <ErrorState
                  title="We could not load your records."
                  description="Your drafts are safe. We could not load them just now."
                  onRetry={() => setRetryToken((token) => token + 1)}
                />
              )}

              {loadStatus === 'ready' && data !== null && (
                <>
                  {data.items.length === 0 ? (
                    <EmptyState
                      title="No records here yet"
                      description={
                        statusFilter === ''
                          ? 'You have not created any records yet. Start a draft above to contribute your first story.'
                          : 'No records match this status filter. Try another status to see your other work.'
                      }
                      action={
                        statusFilter === '' ? (
                          <Link to="/dashboard/drafts/new" className="btn-secondary">
                            Start a draft
                          </Link>
                        ) : (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setStatusFilter('')}
                          >
                            Show all statuses
                          </button>
                        )
                      }
                    />
                  ) : (
                    <ul className="space-y-4">
                      {data.items.map((record) => {
                        const editable = EDITABLE_STATUSES.includes(record.status);
                        const submitError = submitErrors[record.id];
                        return (
                          <li key={record.id}>
                            <article className="group rounded-xl border border-line/90 bg-paper p-5 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:border-forest/25 hover:shadow-lift sm:p-6">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0 space-y-1.5">
                                  <p className="micro-label text-terracotta-deep">
                                    {heritageTypeLabel(record.heritageType)}
                                  </p>
                                  <h3 className="break-words font-display text-[1.4rem] leading-[1.15] tracking-[-0.02em] text-ink">
                                    <Link
                                      to={`/dashboard/drafts/${record.id}`}
                                      className="transition-colors hover:text-forest"
                                    >
                                      {record.title}
                                    </Link>
                                  </h3>
                                  {record.summary !== undefined && record.summary !== '' && (
                                    <p className="max-w-2xl text-sm leading-6 text-earth-ink">
                                      {record.summary}
                                    </p>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <StatusBadge status={record.status} />
                                  <QualityBadges quality={record.quality} />
                                </div>
                              </div>

                              {record.status === 'changes_requested' && (
                                <p className="mt-4 flex items-start gap-2 rounded-lg border border-terracotta/25 bg-terracotta-soft px-3.5 py-2.5 text-sm leading-6 text-terracotta-deep">
                                  <PenLine className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                                  A moderator asked for changes. Review their feedback, edit the
                                  record, and submit it again.
                                </p>
                              )}

                              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-line/80 pt-4">
                                <Link
                                  to={`/dashboard/drafts/${record.id}`}
                                  className="btn-secondary btn-sm"
                                >
                                  {editable ? 'Edit' : 'View'}
                                </Link>
                                {editable && (
                                  <button
                                    type="button"
                                    onClick={() => void handleSubmitForReview(record)}
                                    disabled={submittingId === record.id}
                                    className="btn-primary btn-sm"
                                  >
                                    <Send className="h-3.5 w-3.5" aria-hidden="true" />
                                    {submittingId === record.id
                                      ? 'Submitting…'
                                      : 'Submit for review'}
                                  </button>
                                )}
                                <RecordRemovalActions
                                  recordId={record.id}
                                  title={record.title}
                                  status={record.status}
                                  onDeleted={() => handleRecordDeleted(record)}
                                />
                                <span className="ml-auto text-xs text-earth-ink">
                                  Updated {new Date(record.updatedAt).toLocaleDateString()}
                                </span>
                              </div>

                              {submitError !== undefined && submitError !== '' && (
                                <p role="alert" className="mt-3 text-sm text-danger">
                                  {submitError}
                                </p>
                              )}
                            </article>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {data.totalPages > 1 && (
                    <div className="mt-8">
                      <Pagination
                        page={data.page}
                        totalPages={data.totalPages}
                        total={data.total}
                        onChange={setPage}
                        label="Your records pagination"
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        </div>

        {/* ---------------------------------------------------------- Aside */}
        <aside className="space-y-6">
          <section className="rounded-xl border border-line/90 bg-paper p-5 shadow-card">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-forest-soft text-forest">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="mt-4 font-display text-lg leading-snug text-ink">What review checks</h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-earth-ink">
              <li className="flex gap-2.5">
                <ClipboardCheck
                  className="mt-0.5 h-4 w-4 shrink-0 text-terracotta-deep"
                  aria-hidden="true"
                />
                Permission to publish, recorded by you and checked by a moderator.
              </li>
              <li className="flex gap-2.5">
                <ClipboardCheck
                  className="mt-0.5 h-4 w-4 shrink-0 text-terracotta-deep"
                  aria-hidden="true"
                />
                Sources and attribution the reader can trace.
              </li>
              <li className="flex gap-2.5">
                <ClipboardCheck
                  className="mt-0.5 h-4 w-4 shrink-0 text-terracotta-deep"
                  aria-hidden="true"
                />
                Public visibility and a confirmed rights status.
              </li>
            </ul>
            <Link to="/about#principles" className="link-underline mt-5 inline-block text-sm">
              Read the archive principles
            </Link>
          </section>

          <section className="rounded-xl border border-line/90 bg-cream/90 p-5 shadow-card">
            <h2 className="font-display text-lg text-ink">Not sure where to begin?</h2>
            <p className="mt-2 text-sm leading-6 text-earth-ink">
              The contribution guide explains what to prepare, how consent works, and what happens
              after you submit.
            </p>
            <Link to="/contribute" className="link-underline mt-4 inline-block text-sm">
              How contributing works
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}

/** Exported for tests: path builder used by the dashboard listing. */
export function dashboardListPath(page: number, status: RecordStatus | ''): string {
  return buildOwnListPath({
    page,
    limit: PAGE_SIZE,
    ...(status === '' ? {} : { status }),
  });
}
