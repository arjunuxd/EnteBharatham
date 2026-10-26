import type {
  FeedbackKind,
  FeedbackMessagePublic,
  FeedbackThreadPublic,
  FeedbackVisibility,
} from '@entebharatham/shared';
import { FEEDBACK_KINDS } from '@entebharatham/shared';
import { MessageSquare } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { InlineNotice } from './ui/States';

const KIND_LABELS: Record<FeedbackKind, string> = {
  clarification: 'Clarification',
  correction: 'Correction',
  provenance: 'Provenance',
  rights: 'Rights',
  sensitive_content: 'Sensitive content',
  general: 'General',
};

const VISIBILITY_LABELS: Record<FeedbackVisibility, string> = {
  contributor: 'Visible to contributor',
  internal: 'Internal note',
};

export interface FeedbackThreadProps {
  thread: FeedbackThreadPublic | null;
  loading?: boolean;
  /** Whether the signed-in user may post moderator-style feedback. */
  canModerate?: boolean;
  /** Whether the signed-in user owns the record (contributor replies). */
  canReply?: boolean;
  onSubmit?: (body: {
    kind: FeedbackKind;
    message: string;
    visibility?: FeedbackVisibility;
    parentId?: string;
  }) => void;
  onResolve?: (messageId: string) => void;
  submitting?: boolean;
  resolvingId?: string | null;
  error?: string | null;
}

/**
 * Structured review-feedback thread.
 *
 * The thread is a conversation between a moderator and the contributor. A
 * moderator may additionally write internal notes; those are only ever shown
 * to moderators.
 */
export function FeedbackThread({
  thread,
  loading = false,
  canModerate = false,
  canReply = false,
  onSubmit,
  onResolve,
  submitting = false,
  resolvingId = null,
  error = null,
}: FeedbackThreadProps) {
  const [kind, setKind] = useState<FeedbackKind>('clarification');
  const [visibility, setVisibility] = useState<FeedbackVisibility>('contributor');
  const [message, setMessage] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (onSubmit === undefined) return;
    const trimmed = message.trim();
    if (trimmed.length < 10) return;
    onSubmit({
      kind,
      message: trimmed,
      ...(canModerate ? { visibility } : {}),
      ...(parentId !== null ? { parentId } : {}),
    });
    setMessage('');
    setParentId(null);
  };

  if (loading) {
    return (
      <section aria-labelledby="feedback-heading" className="card-paper p-5">
        <h2 id="feedback-heading" className="font-display text-xl text-ink">
          Review feedback
        </h2>
        <p role="status" className="mt-2 text-sm text-earth-ink">
          Loading the conversation…
        </p>
      </section>
    );
  }

  // Defence in depth: internal notes are filtered out for contributors even if
  // a server ever sends them by mistake.
  const messages: FeedbackMessagePublic[] = (thread?.messages ?? []).filter(
    (item) => canModerate || item.visibility === 'contributor',
  );

  return (
    <section aria-labelledby="feedback-heading" className="card-paper p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-cream text-forest">
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h2 id="feedback-heading" className="font-display text-xl text-ink">
              Review feedback
            </h2>
            {thread !== null && (
              <p className="mt-1 text-xs text-earth-ink">
                {thread.openContributorMessages} open message
                {thread.openContributorMessages === 1 ? '' : 's'}
                {canModerate ? ` · ${thread.openInternalMessages} open internal note` : ''}
              </p>
            )}
          </div>
        </div>
      </div>

      {messages.length === 0 ? (
        <p className="mt-5 rounded-lg border border-dashed border-line-strong bg-cream/60 px-4 py-3 text-sm text-earth-ink">
          No feedback yet on this record.
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {messages.map((item) => (
            <li
              key={item.id}
              className={`rounded-lg border px-4 py-3 text-sm ${
                item.visibility === 'internal'
                  ? 'border-warning/30 bg-warning-soft text-ink'
                  : 'border-line bg-white text-ink'
              }`}
            >
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-earth-ink">
                <span className="text-terracotta-deep">{KIND_LABELS[item.kind]}</span>
                <span>{item.authorRole === 'contributor' ? 'Contributor' : 'Moderator'}</span>
                {item.visibility === 'internal' && (
                  <span className="text-warning">{VISIBILITY_LABELS.internal}</span>
                )}
                {item.field !== undefined && <span>Field: {item.field}</span>}
                <span className="normal-case tracking-normal">
                  {new Date(item.createdAt).toLocaleString()}
                </span>
              </p>
              <p className="mt-2 whitespace-pre-line leading-6">{item.message}</p>
              {item.resolvedAt !== undefined && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-success">
                  <span className="status-dot" aria-hidden="true" />
                  Resolved
                </p>
              )}
              <p className="mt-2 flex flex-wrap gap-4 text-xs">
                {canReply && onSubmit !== undefined && (
                  <button
                    type="button"
                    onClick={() => setParentId(parentId === item.id ? null : item.id)}
                    className="link-quiet"
                  >
                    {parentId === item.id ? 'Cancel reply' : 'Reply'}
                  </button>
                )}
                {canModerate && onResolve !== undefined && item.resolvedAt === undefined && (
                  <button
                    type="button"
                    disabled={resolvingId === item.id}
                    onClick={() => onResolve(item.id)}
                    className="link-quiet disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {resolvingId === item.id ? 'Resolving…' : 'Mark resolved'}
                  </button>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}

      {onSubmit !== undefined && (canModerate || canReply) && (
        <form className="mt-6 border-t border-line pt-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="feedback-kind" className="field-label">
                Feedback type
              </label>
              <select
                id="feedback-kind"
                value={kind}
                onChange={(event) => setKind(event.target.value as FeedbackKind)}
                className="select"
              >
                {FEEDBACK_KINDS.map((option) => (
                  <option key={option} value={option}>
                    {KIND_LABELS[option]}
                  </option>
                ))}
              </select>
            </div>

            {canModerate && (
              <div>
                <label htmlFor="feedback-visibility" className="field-label">
                  Who can see this?
                </label>
                <select
                  id="feedback-visibility"
                  value={visibility}
                  onChange={(event) => setVisibility(event.target.value as FeedbackVisibility)}
                  className="select"
                >
                  <option value="contributor">{VISIBILITY_LABELS.contributor}</option>
                  <option value="internal">{VISIBILITY_LABELS.internal}</option>
                </select>
              </div>
            )}
          </div>

          <div className="mt-4">
            <label htmlFor="feedback-message" className="field-label">
              Message {parentId !== null ? '(reply)' : ''} (at least 10 characters)
            </label>
            <textarea
              id="feedback-message"
              rows={3}
              maxLength={2000}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="input"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || message.trim().length < 10}
            className="btn-primary btn-sm mt-4"
          >
            {submitting ? 'Posting…' : 'Post feedback'}
          </button>
        </form>
      )}

      {error !== null && (
        <InlineNotice tone="error" live="alert" className="mt-4">
          {error}
        </InlineNotice>
      )}
    </section>
  );
}
