import type {
  FeedbackKind,
  FeedbackThreadPublic,
  ModerationSubmissionDetail,
  ProvenanceReviewStatus,
  QualityReport,
} from '@entebharatham/shared';
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  MessageSquare,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FeedbackThread } from '../components/FeedbackThread';
import { ProvenanceEditor } from '../components/ProvenanceEditor';
import { QualityFindingsPanel } from '../components/QualityFindingsPanel';
import { ErrorState, InlineNotice, LoadingState } from '../components/ui/States';
import { ApiError } from '../lib/api';
import { heritageTypeLabel } from '../lib/heritage';
import {
  addSubmissionFeedback,
  fetchSubmissionFeedback,
  fetchSubmissionQuality,
  resolveFeedbackMessage,
  reviewProvenance,
} from '../lib/phase6';
import {
  approveSubmission,
  fetchSubmission,
  rejectSubmission,
  requestChanges,
} from '../lib/workflow';
import { QualityBadges, StatusBadge } from './DashboardPage';

type LoadStatus = 'loading' | 'ready' | 'notFound' | 'error';

type Decision = 'approve' | 'reject' | 'request_changes';

function humanize(value: string): string {
  return value.replace(/_/g, ' ');
}

/** Moderator review of one queued submission, with the three decisions. */
export function ModerationSubmissionPage() {
  const { id = '' } = useParams<{ id: string }>();

  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [record, setRecord] = useState<ModerationSubmissionDetail | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  const [pendingDecision, setPendingDecision] = useState<Decision | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [decisionNotice, setDecisionNotice] = useState<string | null>(null);
  const [changesReason, setChangesReason] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const [quality, setQuality] = useState<QualityReport | null>(null);
  const [qualityLoading, setQualityLoading] = useState(false);
  const [thread, setThread] = useState<FeedbackThreadPublic | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [provenanceSaving, setProvenanceSaving] = useState(false);
  const [provenanceError, setProvenanceError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoadStatus('loading');

    fetchSubmission(id, controller.signal)
      .then((detail) => {
        setRecord(detail);
        setLoadStatus('ready');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        if (error instanceof ApiError && error.status === 404) {
          setLoadStatus('notFound');
          return;
        }
        setLoadStatus('error');
      });

    return () => controller.abort();
  }, [id, retryToken]);

  // Quality report and feedback thread load independently of the submission
  // itself so a single failing call never blocks the review page.
  useEffect(() => {
    if (id === '') return;
    const controller = new AbortController();

    setQualityLoading(true);
    fetchSubmissionQuality(id, controller.signal)
      .then(setQuality)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setQuality(null);
      })
      .finally(() => setQualityLoading(false));

    setThreadLoading(true);
    fetchSubmissionFeedback(id, controller.signal)
      .then(setThread)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setThread(null);
      })
      .finally(() => setThreadLoading(false));

    return () => controller.abort();
  }, [id, retryToken]);

  const decide = async (decision: Decision, decisionReason: string) => {
    if (pendingDecision !== null || record === null) return;
    setDecisionError(null);
    setDecisionNotice(null);

    const trimmedReason = decisionReason.trim();
    if ((decision === 'reject' || decision === 'request_changes') && trimmedReason.length < 10) {
      setDecisionError('A reason of at least 10 characters is required for this decision.');
      return;
    }

    setPendingDecision(decision);
    try {
      let updated: ModerationSubmissionDetail;
      if (decision === 'approve') {
        updated = await approveSubmission(record.id);
      } else if (decision === 'reject') {
        updated = await rejectSubmission(record.id, trimmedReason);
      } else {
        updated = await requestChanges(record.id, trimmedReason);
      }
      setRecord(updated);
      setChangesReason('');
      setRejectReason('');
      setDecisionNotice(
        decision === 'approve'
          ? 'Submission approved and published.'
          : decision === 'reject'
            ? 'Submission rejected.'
            : 'Changes requested — the contributor can edit and resubmit.',
      );
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        if (caught.code === 'NOT_PUBLISHABLE' && caught.details !== undefined) {
          const details = caught.details as { missing?: string[] };
          setDecisionError(`Cannot approve yet — missing: ${(details.missing ?? []).join(', ')}.`);
        } else {
          setDecisionError('This submission is no longer awaiting review.');
        }
      } else if (caught instanceof ApiError && caught.status === 429) {
        setDecisionError('Too many decisions in a short time. Please wait and try again.');
      } else {
        setDecisionError('We could not record the decision. Please try again.');
      }
    } finally {
      setPendingDecision(null);
    }
  };

  const handleRejectForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void decide('reject', rejectReason);
  };

  const handleRequestChangesForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void decide('request_changes', changesReason);
  };

  const handlePostFeedback = async (body: {
    kind: FeedbackKind;
    message: string;
    visibility?: 'contributor' | 'internal';
    parentId?: string;
  }) => {
    if (feedbackSubmitting) return;
    setFeedbackError(null);
    setFeedbackSubmitting(true);
    try {
      setThread(await addSubmissionFeedback(id, body));
    } catch (caught) {
      setFeedbackError(
        caught instanceof ApiError && caught.status === 403
          ? 'You are not allowed to post feedback on this record.'
          : 'We could not post the feedback. Please try again.',
      );
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const handleResolveFeedback = async (messageId: string) => {
    if (resolvingId !== null) return;
    setFeedbackError(null);
    setResolvingId(messageId);
    try {
      setThread(await resolveFeedbackMessage(id, messageId));
    } catch (caught) {
      setFeedbackError(
        caught instanceof ApiError && caught.status === 409
          ? 'That message is already resolved.'
          : 'We could not resolve the message. Please try again.',
      );
    } finally {
      setResolvingId(null);
    }
  };

  const handleReviewProvenance = async (body: {
    reviewStatus: ProvenanceReviewStatus;
    reviewerNotes?: string;
  }) => {
    if (provenanceSaving) return;
    setProvenanceError(null);
    setProvenanceSaving(true);
    try {
      setRecord(await reviewProvenance(id, body));
    } catch (caught) {
      setProvenanceError(
        caught instanceof ApiError && caught.status === 403
          ? 'You are not allowed to review provenance.'
          : 'We could not save the reviewer assessment. Please try again.',
      );
    } finally {
      setProvenanceSaving(false);
    }
  };

  if (loadStatus === 'loading') {
    return (
      <div className="container-page py-14">
        <LoadingState>Loading submission…</LoadingState>
      </div>
    );
  }

  if (loadStatus === 'notFound') {
    return (
      <div className="container-reading py-16">
        <div className="rounded-xl border border-line/90 bg-paper px-6 py-10 shadow-card sm:px-10">
          <p className="eyebrow">Moderation</p>
          <h1 className="display-title mt-4">Submission not found</h1>
          <p className="body-copy mt-4">
            This submission does not exist or is no longer awaiting review.
          </p>
          <Link to="/moderation" className="btn-primary mt-8">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to the review queue
          </Link>
        </div>
      </div>
    );
  }

  if (loadStatus === 'error' || record === null) {
    return (
      <div className="container-reading py-16">
        <ErrorState
          title="We could not load this submission."
          description="We could not load this submission just now. Please try again."
          onRetry={() => setRetryToken((token) => token + 1)}
        />
      </div>
    );
  }

  const awaitingDecision = record.status === 'pending_review';

  return (
    <div className="pb-20">
      <section className="border-b border-line bg-cream">
        <div className="container-page pb-9 pt-10 sm:pb-11 sm:pt-14">
          <Link to="/moderation" className="link-quiet inline-flex items-center gap-2 text-sm">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Review queue
          </Link>

          <header className="mt-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 max-w-3xl">
                <p className="eyebrow flex items-center gap-3">
                  <span className="h-px w-7 bg-terracotta" aria-hidden="true" />
                  Submission review
                </p>
                <h1 className="display-title mt-4 break-words [overflow-wrap:anywhere]">
                  {record.title}
                </h1>
                <p className="mt-3 text-sm text-earth-ink">
                  {heritageTypeLabel(record.heritageType)} · status: {humanize(record.status)}
                  {record.submittedAt !== undefined && (
                    <> · submitted {new Date(record.submittedAt).toLocaleDateString()}</>
                  )}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={record.status} />
                <QualityBadges quality={record.quality} />
              </div>
            </div>
          </header>
        </div>
      </section>

      <div className="container-page">
        {decisionNotice !== null && (
          <div className="mt-6">
            <InlineNotice tone="success" live="status">
              {decisionNotice}
            </InlineNotice>
          </div>
        )}

        {record.review !== undefined && (
          <div className="mt-6 rounded-xl border border-line/90 bg-cream/90 px-5 py-4 shadow-card">
            <p className="font-display text-lg text-ink">
              Latest decision: {humanize(record.review.decision)}
            </p>
            {record.review.reason !== undefined && (
              <p className="mt-1 break-words text-sm leading-6 text-earth-ink [overflow-wrap:anywhere]">
                {record.review.reason}
              </p>
            )}
            <p className="mt-2 text-xs text-earth-ink">
              Reviewed {new Date(record.review.reviewedAt).toLocaleString()}
            </p>
          </div>
        )}

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
          <div className="min-w-0 space-y-8">
            {/* ------------------------------------------------ Submission */}
            <section
              aria-labelledby="details-heading"
              className="overflow-hidden rounded-xl border border-line/90 bg-paper shadow-card"
            >
              <div className="border-b border-line px-5 py-4 sm:px-6">
                <h2 id="details-heading" className="font-display text-xl text-ink">
                  Submission details
                </h2>
              </div>

              <div className="px-5 py-5 sm:px-6">
                <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
                  <div className="min-w-0">
                    <dt className="text-xs text-earth-ink">Summary</dt>
                    <dd className="mt-0.5 break-words leading-6 text-ink [overflow-wrap:anywhere]">
                      {record.summary ?? '—'}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-earth-ink">Languages</dt>
                    <dd className="mt-0.5 break-words text-ink [overflow-wrap:anywhere]">
                      {record.languages.join(', ')}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-earth-ink">Visibility</dt>
                    <dd className="mt-0.5 capitalize text-ink">{record.visibility}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-earth-ink">Publish permission</dt>
                    <dd className="mt-0.5 text-ink">
                      {record.consent.permissionToPublish ? 'Yes' : 'No'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-earth-ink">Consent verification</dt>
                    <dd className="mt-0.5 text-ink">{humanize(record.consent.verification)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-earth-ink">Rights status</dt>
                    <dd className="mt-0.5 break-words text-ink [overflow-wrap:anywhere]">
                      {record.license.rightsStatus}
                    </dd>
                  </div>
                  {record.consent.restrictions !== undefined && (
                    <div className="min-w-0 sm:col-span-2">
                      <dt className="text-xs text-earth-ink">Restrictions</dt>
                      <dd className="mt-0.5 break-words text-ink [overflow-wrap:anywhere]">
                        {record.consent.restrictions}
                      </dd>
                    </div>
                  )}
                </dl>

                {record.content !== undefined && record.content !== '' && (
                  <div className="mt-6 border-t border-line pt-5">
                    <h3 className="font-sans text-sm font-semibold text-ink">Content</h3>
                    <p className="prose-heritage mt-2 whitespace-pre-line break-words rounded-lg bg-cream/60 p-4 text-[0.9375rem] [overflow-wrap:anywhere]">
                      {record.content}
                    </p>
                  </div>
                )}

                {record.sources.length > 0 && (
                  <div className="mt-6 border-t border-line pt-5">
                    <h3 className="font-sans text-sm font-semibold text-ink">Sources</h3>
                    <ul className="mt-3 space-y-3">
                      {record.sources.map((source, index) => (
                        <li
                          key={index}
                          className="rounded-lg border border-line px-4 py-3 text-sm text-earth-ink"
                        >
                          <span className="font-semibold capitalize text-ink">
                            {humanize(source.sourceType)}
                          </span>{' '}
                          <span className="break-words [overflow-wrap:anywhere]">
                            — {source.description}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>

            <QualityFindingsPanel
              report={quality}
              loading={qualityLoading}
              title="Automated quality checks"
              emptyMessage="The automated checks found no issues with this submission."
            />

            <ProvenanceEditor
              detail={record}
              canReview
              onReview={(body) => {
                void handleReviewProvenance(body);
              }}
              saving={provenanceSaving}
              error={provenanceError}
            />

            <FeedbackThread
              thread={thread}
              loading={threadLoading}
              canModerate
              onSubmit={(body) => {
                void handlePostFeedback(body);
              }}
              onResolve={(messageId) => {
                void handleResolveFeedback(messageId);
              }}
              submitting={feedbackSubmitting}
              resolvingId={resolvingId}
              error={feedbackError}
            />
          </div>

          {/* ---------------------------------------------------- Decision */}
          <aside className="space-y-5 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7.5rem)] lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
            {awaitingDecision ? (
              <section
                aria-labelledby="decide-heading"
                className="overflow-hidden rounded-xl border border-line/90 bg-paper shadow-panel"
              >
                <div className="border-b border-line px-5 py-4">
                  <p className="eyebrow-forest">Decision</p>
                  <h2 id="decide-heading" className="mt-2 font-display text-xl text-ink">
                    Make a decision
                  </h2>
                </div>

                <div className="space-y-5 px-5 py-5">
                  {decisionError !== null && (
                    <InlineNotice tone="error" live="alert">
                      {decisionError}
                    </InlineNotice>
                  )}

                  <div>
                    <button
                      type="button"
                      onClick={() => void decide('approve', '')}
                      disabled={pendingDecision !== null}
                      className="btn-primary w-full"
                    >
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      {pendingDecision === 'approve' ? 'Approving…' : 'Approve & publish'}
                    </button>
                    <p className="mt-2 text-xs leading-5 text-earth-ink">
                      Approval publishes the record immediately. It is blocked when consent,
                      visibility, or rights are incomplete.
                    </p>
                  </div>

                  <form
                    className="space-y-2 border-t border-line pt-5"
                    onSubmit={handleRequestChangesForm}
                  >
                    <label htmlFor="changes-reason" className="field-label">
                      Request changes (reason, at least 10 characters)
                    </label>
                    <textarea
                      id="changes-reason"
                      rows={3}
                      maxLength={1000}
                      value={changesReason}
                      onChange={(event) => setChangesReason(event.target.value)}
                      className="input resize-y"
                      placeholder="What should the contributor revise?"
                    />
                    <button
                      type="submit"
                      disabled={pendingDecision !== null}
                      className="btn-secondary w-full"
                    >
                      <MessageSquare className="h-4 w-4" aria-hidden="true" />
                      {pendingDecision === 'request_changes' ? 'Sending…' : 'Request changes'}
                    </button>
                  </form>

                  <form className="space-y-2 border-t border-line pt-5" onSubmit={handleRejectForm}>
                    <label htmlFor="reject-reason" className="field-label">
                      Reject with reason (at least 10 characters)
                    </label>
                    <textarea
                      id="reject-reason"
                      rows={3}
                      maxLength={1000}
                      value={rejectReason}
                      onChange={(event) => setRejectReason(event.target.value)}
                      className="input resize-y"
                      placeholder="Why is this submission not acceptable?"
                    />
                    <button
                      type="submit"
                      disabled={pendingDecision !== null}
                      className="btn-quiet-danger w-full"
                    >
                      <XCircle className="h-4 w-4" aria-hidden="true" />
                      {pendingDecision === 'reject' ? 'Rejecting…' : 'Reject submission'}
                    </button>
                  </form>

                  <p className="border-t border-line pt-4 text-xs leading-5 text-earth-ink">
                    Decisions are recorded with your account and a timestamp in the audit log.
                  </p>
                </div>
              </section>
            ) : (
              <section
                aria-labelledby="decided-heading"
                className="rounded-xl border border-line/90 bg-cream/90 p-5 shadow-card"
              >
                <ClipboardCheck className="h-5 w-5 text-forest" aria-hidden="true" />
                <h2 id="decided-heading" className="mt-3 font-display text-lg text-ink">
                  Decision recorded
                </h2>
                <p className="mt-2 text-sm leading-6 text-earth-ink">
                  This submission is no longer awaiting review (current status:{' '}
                  {humanize(record.status)}).
                </p>
              </section>
            )}

            <section className="rounded-xl border border-line/90 bg-paper/80 p-5 shadow-card">
              <ShieldCheck className="h-5 w-5 text-forest" aria-hidden="true" />
              <h2 className="mt-3 font-display text-lg text-ink">Review with care</h2>
              <p className="mt-2 text-sm leading-6 text-earth-ink">
                A record is a community&apos;s account, not a claim to verify. Ask for evidence and
                context, and leave a clear reason the contributor can act on.
              </p>
              <Link to="/moderation/audit" className="link-underline mt-4 inline-block text-sm">
                Open the audit log
              </Link>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
