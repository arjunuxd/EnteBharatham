/**
 * Provenance contracts (Phase 6).
 *
 * Provenance answers "where did this come from, and who says so?" It is kept
 * deliberately separate from consent (may we publish?), rights (may we
 * reuse?), visibility (who may see it?), and community context (whose
 * knowledge is it?).
 *
 * A provenance entry records a *claim*. `isVerified` marks entries a reviewer
 * has checked — it is never set by the contributor, and it never means the
 * story is historically true.
 */

import type { SourceType } from './heritage.js';
import type { UserRole } from './auth.js';

/** Roles that can be attributed for a source (collector, recorder, …). */
export const PROVENANCE_SOURCE_ROLES = [
  'collector',
  'recorder',
  'translator',
  'transcriber',
  'source_holder',
  'other',
] as const;
export type ProvenanceSourceRole = (typeof PROVENANCE_SOURCE_ROLES)[number];

/**
 * Review state of a record's provenance block.
 * `verified` means "a reviewer checked that the attribution is internally
 * consistent with what the contributor stated" — it is not a claim of
 * historical authenticity.
 */
export const PROVENANCE_REVIEW_STATUSES = [
  'unreviewed',
  'in_review',
  'verified',
  'disputed',
] as const;
export type ProvenanceReviewStatus = (typeof PROVENANCE_REVIEW_STATUSES)[number];

/** How a contributor wishes to be credited. */
export const ATTRIBUTION_PREFERENCES = ['named', 'pseudonymous', 'anonymous'] as const;
export type AttributionPreference = (typeof ATTRIBUTION_PREFERENCES)[number];

/**
 * The provenance state shown to the public. It never claims verification:
 * - `contributor_provided` — the contributor supplied the provenance.
 * - `review_observed` — a moderator reviewed the provenance for consistency.
 * - `community_confirmed` — the community confirmed the attribution.
 */
export const PROVENANCE_CLAIM_STATES = [
  'contributor_provided',
  'review_observed',
  'community_confirmed',
] as const;
export type ProvenanceClaimState = (typeof PROVENANCE_CLAIM_STATES)[number];

/** Record-level provenance block (owner/moderator view). */
export interface ProvenanceBlock {
  /** Language the material was originally told/written in. */
  originalLanguage?: string;
  /** Community or regional context the material comes from. */
  communityContext?: string;
  attributionPreference: AttributionPreference;
  /** Whether the contributor permits anonymous publication. */
  permitAnonymity: boolean;
  reviewStatus: ProvenanceReviewStatus;
  /** Internal reviewer note — never serialized publicly. */
  reviewerNotes?: string;
  reviewedAt?: string;
}

/** Public provenance summary (safe for the public API). */
export interface ProvenancePublic {
  claimState: ProvenanceClaimState;
  attributionPreference: AttributionPreference;
  originalLanguage?: string;
  communityContext?: string;
}

/** A single auditable provenance change. */
export interface ProvenanceChange {
  field: string;
  previous?: string;
  next?: string;
}

/** One entry in a record's provenance history. */
export interface ProvenanceHistoryEntry {
  id: string;
  changedAt: string;
  changedById?: string;
  changedByRole?: UserRole;
  reason?: string;
  changes: ProvenanceChange[];
}

/** A contributor's declaration that a similar record is a distinct variant. */
export interface VariantDeclaration {
  id: string;
  relatedRecordId: string;
  note: string;
  createdAt: string;
}

/** Source entry as seen by the owner and moderators. */
export interface ProvenanceSourceEntry {
  sourceType: SourceType;
  description: string;
  reference?: string;
  collectedOn?: string;
  context?: string;
  /** Internal note — never public. */
  notes?: string;
  originalLanguage?: string;
  communityContext?: string;
  collector?: string;
  recorder?: string;
  translator?: string;
  transcriber?: string;
  mediaReferences?: string[];
  /** Whether this source entry may be shown on the public record. */
  isPublic: boolean;
  /** Set by a reviewer only; never contributor-supplied. */
  isVerified: boolean;
}
