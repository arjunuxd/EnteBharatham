import type {
  AttributionPreference,
  ContributorRecordDetail,
  ProvenanceHistoryEntry,
  ProvenanceReviewStatus,
} from '@entebharatham/shared';
import { ATTRIBUTION_PREFERENCES, PROVENANCE_REVIEW_STATUSES } from '@entebharatham/shared';
import { History, Link2, Quote } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { InlineNotice } from './ui/States';

const ATTRIBUTION_LABELS: Record<AttributionPreference, string> = {
  named: 'Name me publicly',
  pseudonymous: 'Use a pseudonym',
  anonymous: 'Keep my name private',
};

const REVIEW_LABELS: Record<ProvenanceReviewStatus, string> = {
  unreviewed: 'Not reviewed yet',
  in_review: 'Under review',
  verified: 'Attribution reviewed for consistency',
  disputed: 'Disputed',
};

export interface ProvenanceEditorProps {
  detail: ContributorRecordDetail | null;
  /** Contributors may edit their own provenance while the record is editable. */
  canEdit?: boolean;
  /** Moderators may set the review status and an internal note. */
  canReview?: boolean;
  onSave?: (body: {
    originalLanguage?: string;
    communityContext?: string;
    attributionPreference: AttributionPreference;
    permitAnonymity: boolean;
  }) => void;
  onReview?: (body: { reviewStatus: ProvenanceReviewStatus; reviewerNotes?: string }) => void;
  saving?: boolean;
  error?: string | null;
}

/**
 * Provenance editor.
 *
 * Provenance describes where the material came from and who says so. It is
 * separate from consent and rights, and the reviewer-controlled parts
 * (verification, internal notes) are read-only for contributors.
 */
export function ProvenanceEditor({
  detail,
  canEdit = false,
  canReview = false,
  onSave,
  onReview,
  saving = false,
  error = null,
}: ProvenanceEditorProps) {
  const [originalLanguage, setOriginalLanguage] = useState('');
  const [communityContext, setCommunityContext] = useState('');
  const [attributionPreference, setAttributionPreference] =
    useState<AttributionPreference>('named');
  const [permitAnonymity, setPermitAnonymity] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<ProvenanceReviewStatus>('unreviewed');
  const [reviewerNotes, setReviewerNotes] = useState('');

  useEffect(() => {
    if (detail === null) return;
    setOriginalLanguage(detail.provenance.originalLanguage ?? '');
    setCommunityContext(detail.provenance.communityContext ?? '');
    setAttributionPreference(detail.provenance.attributionPreference);
    setPermitAnonymity(detail.provenance.permitAnonymity);
    setReviewStatus(detail.provenance.reviewStatus);
    setReviewerNotes(detail.provenance.reviewerNotes ?? '');
  }, [detail]);

  if (detail === null) {
    return (
      <section aria-labelledby="provenance-heading" className="card-paper p-5">
        <h2 id="provenance-heading" className="font-display text-xl text-ink">
          Provenance
        </h2>
        <p className="mt-2 text-sm text-earth-ink">Provenance details could not be loaded.</p>
      </section>
    );
  }

  const { provenance, provenanceHistory, variantDeclarations, sources } = detail;

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (onSave === undefined) return;
    const trimmedLanguage = originalLanguage.trim();
    const trimmedContext = communityContext.trim();
    onSave({
      ...(trimmedLanguage === '' ? {} : { originalLanguage: trimmedLanguage }),
      ...(trimmedContext === '' ? {} : { communityContext: trimmedContext }),
      attributionPreference,
      permitAnonymity,
    });
  };

  const handleReview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (onReview === undefined) return;
    const trimmedNotes = reviewerNotes.trim();
    onReview({
      reviewStatus,
      ...(trimmedNotes === '' ? {} : { reviewerNotes: trimmedNotes }),
    });
  };

  return (
    <section aria-labelledby="provenance-heading" className="card-paper p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-cream text-forest">
          <Quote className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <h2 id="provenance-heading" className="font-display text-xl text-ink">
            Provenance
          </h2>
          <p className="mt-1 text-sm leading-6 text-earth-ink">
            Where this material came from and who says so. This is separate from consent and rights.
          </p>
        </div>
      </div>

      <dl className="mt-5 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
        <div className="bg-cream/50 px-4 py-3">
          <dt className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-earth-ink">
            Review status
          </dt>
          <dd className="mt-1 text-sm text-ink">{REVIEW_LABELS[provenance.reviewStatus]}</dd>
        </div>
        <div className="bg-cream/50 px-4 py-3">
          <dt className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-earth-ink">
            Attribution
          </dt>
          <dd className="mt-1 text-sm text-ink">
            {ATTRIBUTION_LABELS[provenance.attributionPreference]}
          </dd>
        </div>
        {provenance.originalLanguage !== undefined && (
          <div className="bg-cream/50 px-4 py-3">
            <dt className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-earth-ink">
              Original language
            </dt>
            <dd className="mt-1 text-sm text-ink">{provenance.originalLanguage}</dd>
          </div>
        )}
        {provenance.communityContext !== undefined && (
          <div className="bg-cream/50 px-4 py-3">
            <dt className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-earth-ink">
              Community context
            </dt>
            <dd className="mt-1 text-sm text-ink">{provenance.communityContext}</dd>
          </div>
        )}
      </dl>

      {canEdit && onSave !== undefined && (
        <form className="mt-6 border-t border-line pt-5" onSubmit={handleSave}>
          <h3 className="font-sans text-sm font-semibold text-ink">Update provenance</h3>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="provenance-language" className="field-label">
                Original language of the material
              </label>
              <input
                id="provenance-language"
                type="text"
                maxLength={100}
                value={originalLanguage}
                onChange={(event) => setOriginalLanguage(event.target.value)}
                className="input"
              />
            </div>

            <div>
              <label htmlFor="provenance-community" className="field-label">
                Community or regional context
              </label>
              <input
                id="provenance-community"
                type="text"
                maxLength={200}
                value={communityContext}
                onChange={(event) => setCommunityContext(event.target.value)}
                className="input"
              />
            </div>
          </div>

          <div className="mt-4">
            <label htmlFor="provenance-attribution" className="field-label">
              How should you be credited?
            </label>
            <select
              id="provenance-attribution"
              value={attributionPreference}
              onChange={(event) =>
                setAttributionPreference(event.target.value as AttributionPreference)
              }
              className="select"
            >
              {ATTRIBUTION_PREFERENCES.map((option) => (
                <option key={option} value={option}>
                  {ATTRIBUTION_LABELS[option]}
                </option>
              ))}
            </select>
          </div>

          <label className="mt-4 flex items-start gap-3 text-sm text-earth-ink">
            <input
              type="checkbox"
              checked={permitAnonymity}
              onChange={(event) => setPermitAnonymity(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-forest"
            />
            <span>
              My name may be withheld when this record is published.
              <span className="mt-1 block text-xs leading-5 text-earth-ink">
                The platform never promises anonymity, and moderators still see who submitted it.
              </span>
            </span>
          </label>

          <button type="submit" disabled={saving} className="btn-primary btn-sm mt-5">
            {saving ? 'Saving…' : 'Save provenance'}
          </button>
        </form>
      )}

      {canReview && onReview !== undefined && (
        <form className="mt-6 border-t border-line pt-5" onSubmit={handleReview}>
          <h3 className="font-sans text-sm font-semibold text-ink">Reviewer assessment</h3>
          <p className="mt-1.5 text-xs leading-5 text-earth-ink">
            &ldquo;Reviewed&rdquo; means the attribution is consistent with what the contributor
            stated. It is not a claim that the story is historically true.
          </p>

          <div className="mt-4">
            <label htmlFor="provenance-review-status" className="field-label">
              Review status
            </label>
            <select
              id="provenance-review-status"
              value={reviewStatus}
              onChange={(event) => setReviewStatus(event.target.value as ProvenanceReviewStatus)}
              className="select"
            >
              {PROVENANCE_REVIEW_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {REVIEW_LABELS[option]}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4">
            <label htmlFor="provenance-reviewer-notes" className="field-label">
              Internal notes (never shown publicly)
            </label>
            <textarea
              id="provenance-reviewer-notes"
              rows={2}
              maxLength={1000}
              value={reviewerNotes}
              onChange={(event) => setReviewerNotes(event.target.value)}
              className="input"
            />
          </div>

          <button type="submit" disabled={saving} className="btn-secondary btn-sm mt-4">
            {saving ? 'Saving…' : 'Save reviewer assessment'}
          </button>
        </form>
      )}

      {sources.length > 0 && (
        <div className="mt-6 border-t border-line pt-5">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-earth-ink" aria-hidden="true" />
            <h3 className="font-sans text-sm font-semibold text-ink">Sources</h3>
          </div>
          <ul className="mt-3 space-y-2">
            {sources.map((source, index) => (
              <li key={index} className="rounded-lg border border-line bg-cream/40 p-3 text-sm">
                <p className="font-medium text-ink">
                  {source.sourceType.replace('_', ' ')} — {source.description}
                </p>
                <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-earth-ink">
                  <span>{source.isPublic ? 'Public source' : 'Private source'}</span>
                  <span>{source.isVerified ? 'Reviewed by a moderator' : 'Not yet reviewed'}</span>
                </p>
                {source.collector !== undefined && (
                  <p className="mt-1 text-xs text-earth-ink">Collector: {source.collector}</p>
                )}
                {source.recorder !== undefined && (
                  <p className="mt-1 text-xs text-earth-ink">Recorder: {source.recorder}</p>
                )}
                {source.translator !== undefined && (
                  <p className="mt-1 text-xs text-earth-ink">Translator: {source.translator}</p>
                )}
                {source.transcriber !== undefined && (
                  <p className="mt-1 text-xs text-earth-ink">Transcriber: {source.transcriber}</p>
                )}
                {source.mediaReferences !== undefined && source.mediaReferences.length > 0 && (
                  <p className="mt-1 text-xs text-earth-ink">
                    Media references: {source.mediaReferences.join(', ')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {variantDeclarations.length > 0 && (
        <div className="mt-6 border-t border-line pt-5">
          <h3 className="font-sans text-sm font-semibold text-ink">Declared variants</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-earth-ink">
            {variantDeclarations.map((variant) => (
              <li key={variant.id}>
                {variant.note}{' '}
                <span className="text-xs text-earth-ink">
                  ({new Date(variant.createdAt).toLocaleDateString()})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {provenanceHistory.length > 0 && (
        <div className="mt-6 border-t border-line pt-5">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-earth-ink" aria-hidden="true" />
            <h3 className="font-sans text-sm font-semibold text-ink">Provenance history</h3>
          </div>
          <ul className="mt-3 space-y-2">
            {provenanceHistory.map((entry: ProvenanceHistoryEntry) => (
              <li
                key={entry.id}
                className="rounded-lg border border-line bg-cream/40 p-3 text-xs text-earth-ink"
              >
                <p>{new Date(entry.changedAt).toLocaleString()}</p>
                <ul className="mt-1 space-y-0.5">
                  {entry.changes.map((change) => (
                    <li key={change.field}>
                      {change.field}: {change.previous ?? '—'} → {change.next ?? '—'}
                    </li>
                  ))}
                </ul>
                {entry.reason !== undefined && <p className="mt-1">Reason: {entry.reason}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error !== null && (
        <InlineNotice tone="error" live="alert" className="mt-5">
          {error}
        </InlineNotice>
      )}
    </section>
  );
}
