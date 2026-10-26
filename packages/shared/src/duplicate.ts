/**
 * Duplicate-assistance contracts (Phase 6).
 *
 * Duplicate detection is *assistance*, never an automatic merge or rejection.
 * Two records that resemble each other may be a regional variant, a
 * translation, an adaptation, or two independent tellings — all legitimate
 * cultural outcomes. The platform surfaces candidates and lets the contributor
 * and moderator decide.
 */

import type { HeritageType, Region } from './heritage.js';

export const DUPLICATE_REASON_CODES = [
  'identical_title',
  'similar_title',
  'same_type_and_region',
  'same_type_and_language',
  'shared_tags',
] as const;
export type DuplicateReasonCode = (typeof DUPLICATE_REASON_CODES)[number];

export interface DuplicateCandidate {
  id: string;
  slug: string;
  title: string;
  heritageType: HeritageType;
  languages: string[];
  region: Region;
  communityName?: string;
  summary?: string;
  /** Normalised similarity in the range 0–1. */
  similarity: number;
  reasons: DuplicateReasonCode[];
  /** Human-readable explanation of why this candidate was suggested. */
  explanation: string;
}

export interface DuplicateSuggestionResponse {
  recordId: string;
  candidates: DuplicateCandidate[];
  /** Caveats the caller should show alongside the candidates. */
  notes: string[];
}

/** Reasons a record was returned for a duplicate review (audit metadata). */
export const DUPLICATE_DETECTION_NOTES = [
  'Matching is limited to publicly published records. Private drafts, restricted records, and unpublished submissions are never listed.',
  'A similarity score compares titles and metadata only; it is not a judgement about authenticity, importance, or cultural value.',
  'Similar records are often legitimate regional variants, adaptations, translations, or independent tellings. Nothing is merged, rejected, or deleted automatically.',
  'If this record is a distinct variant or an independent account, record that so reviewers do not treat the pair as a copy.',
] as const;
