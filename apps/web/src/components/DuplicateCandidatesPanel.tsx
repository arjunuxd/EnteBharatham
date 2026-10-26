import type { DuplicateCandidate, DuplicateSuggestionResponse } from '@entebharatham/shared';
import { CopyCheck } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { InlineNotice } from './ui/States';

/**
 * Duplicate-assistance panel.
 *
 * Similar records are usually legitimate: a regional variant, a translation,
 * an adaptation, or an independent account. The panel therefore explains why
 * a record was surfaced and offers to record a variant declaration — it never
 * merges, rejects, or deletes anything.
 */

const REASON_LABELS: Record<string, string> = {
  identical_title: 'Identical title',
  similar_title: 'Similar title',
  same_type_and_region: 'Same category and region',
  same_type_and_language: 'Same category and language',
  shared_tags: 'Shared tags',
};

export interface DuplicateCandidatesPanelProps {
  result: DuplicateSuggestionResponse | null;
  loading?: boolean;
  /** Called with the related record id when the contributor declares a variant. */
  onDeclareVariant?: (relatedRecordId: string, note: string) => void;
  declaring?: boolean;
  error?: string | null;
}

export function DuplicateCandidatesPanel({
  result,
  loading = false,
  onDeclareVariant,
  declaring = false,
  error = null,
}: DuplicateCandidatesPanelProps) {
  const [note, setNote] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  if (loading) {
    return (
      <section aria-labelledby="duplicates-heading" className="card-paper p-5">
        <h2 id="duplicates-heading" className="font-display text-xl text-ink">
          Similar records
        </h2>
        <p role="status" className="mt-2 text-sm text-earth-ink">
          Looking for similar published records…
        </p>
      </section>
    );
  }

  if (result === null) {
    return (
      <section aria-labelledby="duplicates-heading" className="card-paper p-5">
        <h2 id="duplicates-heading" className="font-display text-xl text-ink">
          Similar records
        </h2>
        <p className="mt-2 text-sm text-earth-ink">Similar records could not be loaded.</p>
      </section>
    );
  }

  const candidates: DuplicateCandidate[] = result.candidates ?? [];
  const notes: string[] = result.notes ?? [];

  return (
    <section aria-labelledby="duplicates-heading" className="card-paper p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-cream text-forest">
          <CopyCheck className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id="duplicates-heading" className="font-display text-xl text-ink">
            Similar records
          </h2>
          <p className="mt-1 text-sm leading-6 text-earth-ink">
            A close match is not automatically a duplicate. Regional variants, translations, and
            independent tellings are all legitimate, so nothing is merged or removed here.
          </p>
        </div>
      </div>

      {candidates.length === 0 ? (
        <p className="mt-4 rounded-lg border border-success/25 bg-success-soft px-4 py-3 text-sm text-success">
          No similar published records were found.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {candidates.map((candidate) => (
            <li key={candidate.id} className="rounded-lg border border-line bg-cream/40 p-4">
              <p className="font-display text-lg leading-snug">
                <Link
                  to={`/heritage/${candidate.slug}`}
                  className="text-forest hover:text-terracotta-deep"
                >
                  {candidate.title}
                </Link>
              </p>
              <p className="mt-1 text-xs text-earth-ink">
                {candidate.heritageType.replace('_', ' ')} · {candidate.region.country}
                {candidate.region.state !== undefined ? `, ${candidate.region.state}` : ''}
              </p>
              <p className="mt-2 text-sm leading-6 text-earth-ink">{candidate.explanation}</p>
              <p className="mt-1.5 text-[0.6875rem] uppercase tracking-[0.1em] text-earth-ink">
                {candidate.reasons.map((reason) => REASON_LABELS[reason] ?? reason).join(' · ')}
              </p>
              {onDeclareVariant !== undefined && (
                <button
                  type="button"
                  onClick={() => {
                    setSelected(selected === candidate.id ? null : candidate.id);
                    setNote('');
                  }}
                  aria-expanded={selected === candidate.id}
                  className="link-quiet mt-3 text-sm"
                >
                  {selected === candidate.id
                    ? 'Cancel variant declaration'
                    : 'This is a distinct variant or independent account'}
                </button>
              )}
              {selected === candidate.id && onDeclareVariant !== undefined && (
                <div className="mt-3 border-t border-line pt-3">
                  <label htmlFor={`variant-note-${candidate.id}`} className="field-label">
                    How is it different? (at least 10 characters)
                  </label>
                  <textarea
                    id={`variant-note-${candidate.id}`}
                    rows={2}
                    maxLength={1000}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    className="input"
                  />
                  <button
                    type="button"
                    disabled={declaring || note.trim().length < 10}
                    onClick={() => {
                      onDeclareVariant(candidate.id, note.trim());
                      setSelected(null);
                      setNote('');
                    }}
                    className="btn-primary btn-sm mt-3"
                  >
                    {declaring ? 'Saving…' : 'Record as a distinct variant'}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {notes.length > 0 && (
        <ul className="mt-4 space-y-1 border-t border-line pt-4 text-xs leading-5 text-earth-ink">
          {notes.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-earth" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      )}

      {error !== null && (
        <InlineNotice tone="error" live="alert" className="mt-4">
          {error}
        </InlineNotice>
      )}
    </section>
  );
}
