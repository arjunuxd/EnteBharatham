/**
 * Content-quality contracts (Phase 6).
 *
 * The quality system is deliberately *not* a score. There is no number that
 * "measures" how authentic, valuable, or culturally significant a record is —
 * such a number would imply a cultural ranking the platform is not entitled to
 * make. Instead the server produces a list of **findings**: stable codes, a
 * severity, a human-readable message, and actionable guidance.
 *
 * Severities:
 * - `blocker` — the record cannot be submitted or published until resolved.
 * - `warning` — a reviewer may assess it; it does not block publication.
 * - `info`    — context for the contributor or reviewer (e.g. a declared
 *               anonymity preference). Never blocking.
 */

import type { HeritageType } from './heritage.js';

export const QUALITY_SEVERITY = ['blocker', 'warning', 'info'] as const;
export type QualitySeverity = (typeof QUALITY_SEVERITY)[number];

/**
 * Stable finding codes. Codes are part of the API contract: they must not be
 * renamed, only added. `field` points at the record path the contributor has
 * to change.
 */
export const QUALITY_CHECK_CODES = [
  'title.missing',
  'title.too_short',
  'summary.missing',
  'summary.too_short',
  'content.missing',
  'content.too_short',
  'language.missing',
  'category.missing',
  'visibility.not_public',
  'consent.publish_permission_missing',
  'consent.verification_missing',
  'rights.unresolved',
  'provenance.source_missing',
  'provenance.attribution_missing',
  'provenance.collection_context_missing',
  'provenance.reference_malformed',
  'provenance.review_incomplete',
  'provenance.community_context_missing',
  'translation.metadata_incomplete',
  'media.reference_unsupported',
  'content.suspicious_markup',
  'duplicate.possible_duplicate',
  'duplicate.possible_variant',
  'attribution.anonymity_declared',
] as const;

export type QualityCheckCode = (typeof QUALITY_CHECK_CODES)[number];

export interface QualityFinding {
  code: QualityCheckCode;
  severity: QualitySeverity;
  /** Human-readable statement of the problem (no score, no judgement). */
  message: string;
  /** What the contributor or reviewer can do about it. */
  guidance: string;
  /** Record path to change, e.g. `sources[0].collectedOn`. */
  field?: string;
}

export interface QualityReport {
  findings: QualityFinding[];
  blockerCount: number;
  warningCount: number;
  infoCount: number;
  /** True when at least one blocker is present. */
  blocking: boolean;
  checkedAt: string;
}

/**
 * Compact quality summary for list rows. It carries counts and codes only —
 * never a weighted "quality score".
 */
export interface QualitySummary {
  blockerCount: number;
  warningCount: number;
  infoCount: number;
  blocking: boolean;
  /** Codes present in the report, in report order. */
  codes: QualityCheckCode[];
}

/**
 * Per-content-type completeness expectations.
 *
 * Oral traditions, dialects, and proverbs are deliberately *not* judged
 * against a conventional written-narrative template: a proverb is a complete
 * contribution at a handful of characters, and a dialect entry may consist of
 * a single expression with its context. `summaryRequired: false` means a
 * missing summary produces no finding at all for that type.
 */
export interface ContentTypeRequirement {
  summaryRequired: boolean;
  /** Hard minimum body length the server enforces for this type. */
  minimumContentLength: number;
  /** Recommended minimum content length (characters). Advisory only. */
  recommendedContentLength: number;
  /** Recommended minimum summary length (characters). Advisory only. */
  recommendedSummaryLength: number;
  /** Human label used in finding messages. */
  contentLabel: string;
}

export const CONTENT_TYPE_REQUIREMENTS: Record<HeritageType, ContentTypeRequirement> = {
  folk_story: {
    summaryRequired: true,
    minimumContentLength: 10,
    recommendedContentLength: 80,
    recommendedSummaryLength: 30,
    contentLabel: 'folk story',
  },
  oral_history: {
    summaryRequired: true,
    minimumContentLength: 10,
    recommendedContentLength: 120,
    recommendedSummaryLength: 40,
    contentLabel: 'oral history',
  },
  song: {
    summaryRequired: true,
    minimumContentLength: 10,
    recommendedContentLength: 40,
    recommendedSummaryLength: 20,
    contentLabel: 'song',
  },
  recipe: {
    summaryRequired: true,
    minimumContentLength: 10,
    recommendedContentLength: 60,
    recommendedSummaryLength: 20,
    contentLabel: 'recipe',
  },
  dialect: {
    // A dialect entry may be a single expression with its context.
    summaryRequired: false,
    minimumContentLength: 4,
    recommendedContentLength: 20,
    recommendedSummaryLength: 10,
    contentLabel: 'dialect entry',
  },
  proverb: {
    // Proverbs are complete at a few words.
    summaryRequired: false,
    minimumContentLength: 4,
    recommendedContentLength: 8,
    recommendedSummaryLength: 8,
    contentLabel: 'proverb',
  },
  custom: {
    summaryRequired: true,
    minimumContentLength: 10,
    recommendedContentLength: 40,
    recommendedSummaryLength: 20,
    contentLabel: 'custom',
  },
  craft: {
    summaryRequired: true,
    minimumContentLength: 10,
    recommendedContentLength: 80,
    recommendedSummaryLength: 30,
    contentLabel: 'craft tradition',
  },
  other: {
    summaryRequired: true,
    minimumContentLength: 10,
    recommendedContentLength: 40,
    recommendedSummaryLength: 20,
    contentLabel: 'record',
  },
};

/** Minimum length the server enforces for a usable title on every type. */
export const MINIMUM_TITLE_LENGTH = 3;

/** Minimum length the server enforces for submit-able body content. */
export const MINIMUM_CONTENT_LENGTH = 10;

/** Duplicate-assistance limits (bounded queries and bounded results). */
export const DUPLICATE_MATCH = {
  /** Maximum candidate rows read from the database per request. */
  maxCandidatesScanned: 60,
  /** Maximum candidate suggestions returned to the caller. */
  maxResults: 5,
  /** Similarity at or above this value is treated as a likely duplicate. */
  likelyDuplicateThreshold: 0.85,
  /** Similarity at or above this value is worth suggesting. */
  suggestionThreshold: 0.4,
} as const;
