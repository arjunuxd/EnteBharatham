import type {
  ConsentVerification,
  HeritageType,
  ProvenanceReviewStatus,
  QualityCheckCode,
  QualityFinding,
  QualityReport,
  QualitySummary,
  RightsStatus,
  SourceType,
} from '@entebharatham/shared';
import {
  CONTENT_TYPE_REQUIREMENTS,
  HERITAGE_TYPES,
  MINIMUM_TITLE_LENGTH,
} from '@entebharatham/shared';
import { HeritageRecordModel } from '../models/HeritageRecord.js';
import { AppError } from '../utils/AppError.js';

/**
 * Deterministic content-quality checks (Phase 6).
 *
 * Design rules:
 *
 * - **No scores.** A finding says "this field is empty" and "here is what to
 *   do about it". There is no number that ranks a story's authenticity,
 *   importance, or cultural value — the platform is not entitled to make that
 *   judgement.
 * - **Deterministic.** The same record always produces the same findings.
 *   Nothing depends on the current time, a random seed, or a third-party
 *   service.
 * - **Content-type aware.** Oral traditions, dialects, and proverbs are not
 *   measured against a conventional written-narrative template. A proverb is
 *   a complete contribution at a handful of characters.
 * - **Server-side.** The checks run again on submission and approval; a
 *   client-supplied "quality" value is never trusted.
 */

/** The stage at which a record is being checked. */
export type QualityPhase = 'draft' | 'submission' | 'publication';

export interface QualitySourceInput {
  sourceType?: SourceType;
  description?: string;
  reference?: string;
  collectedOn?: string;
  context?: string;
  originalLanguage?: string;
  communityContext?: string;
  mediaReferences?: string[];
  isPublic?: boolean;
  isVerified?: boolean;
}

export interface QualityContributorInput {
  name?: string;
  isPublicAttribution?: boolean;
}

/**
 * The subset of a heritage record the quality checks look at. Accepting a
 * plain object (not a Mongoose document) keeps the checks unit-testable and
 * reusable for lean queries.
 */
export interface QualitySubject {
  title?: string;
  summary?: string;
  content?: string;
  heritageType?: HeritageType;
  languages?: string[];
  contributors?: QualityContributorInput[];
  sources?: QualitySourceInput[];
  consent?: {
    permissionToPublish?: boolean;
    verification?: ConsentVerification;
    allowAttribution?: boolean;
  };
  license?: { rightsStatus?: RightsStatus };
  visibility?: string;
  translationOf?: unknown;
  languageCode?: string;
  languageDisplay?: string;
  translationSource?: string;
  provenance?: {
    attributionPreference?: string;
    permitAnonymity?: boolean;
    reviewStatus?: ProvenanceReviewStatus;
    communityContext?: string;
    originalLanguage?: string;
  };
}

const DEFAULT_REQUIREMENTS = CONTENT_TYPE_REQUIREMENTS.other;

/** Markup that must never appear in submitted cultural material. */
const SUSPICIOUS_MARKUP: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  { pattern: /<\s*script\b/i, label: 'a script tag' },
  { pattern: /<\s*iframe\b/i, label: 'an iframe' },
  { pattern: /<\s*object\b/i, label: 'an object tag' },
  { pattern: /<\s*embed\b/i, label: 'an embed tag' },
  { pattern: /javascript\s*:/i, label: 'a javascript: URI' },
  { pattern: /\bon(?:error|load|click|mouseover|focus)\s*=/i, label: 'an inline event handler' },
];

/** A reference that looks like a URL but cannot be one. */
function looksLikeBrokenUrl(reference: string): boolean {
  if (!reference.includes('://')) {
    // A DOI or handle is acceptable; anything else is treated as free text.
    return false;
  }
  const scheme = reference.slice(0, reference.indexOf('://')).toLowerCase();
  if (scheme !== 'http' && scheme !== 'https') return true;
  const rest = reference.slice(reference.indexOf('://') + 3);
  const host = rest.split('/')[0] ?? '';
  if (host.length === 0) return true;
  return /\s/.test(host);
}

/** A media reference is either an absolute http(s) URL or a 24-hex media id. */
function isUsableMediaReference(reference: string): boolean {
  const trimmed = reference.trim();
  if (trimmed.length === 0) return false;
  if (/^https?:\/\/[^\s]+$/i.test(trimmed)) return true;
  return /^[a-f0-9]{24}$/i.test(trimmed);
}

function requirementFor(heritageType: unknown): ContentTypeRequirementLike {
  if (typeof heritageType === 'string' && heritageType in CONTENT_TYPE_REQUIREMENTS) {
    return CONTENT_TYPE_REQUIREMENTS[heritageType as HeritageType];
  }
  return DEFAULT_REQUIREMENTS;
}

type ContentTypeRequirementLike = (typeof CONTENT_TYPE_REQUIREMENTS)[HeritageType];

function finding(
  code: QualityCheckCode,
  severity: QualityFinding['severity'],
  message: string,
  guidance: string,
  field?: string,
): QualityFinding {
  const result: QualityFinding = { code, severity, message, guidance };
  if (field !== undefined) result.field = field;
  return result;
}

/**
 * Runs every applicable check for the given phase and returns the findings.
 *
 * `submission` blocks on the same conditions the existing submission gate
 * enforces (publish permission, consent verification, unknown rights, and a
 * minimum body length), so nothing that was previously submittable becomes
 * unsubmittable. `publication` additionally requires confirmed rights and
 * public visibility.
 */
export function evaluateQuality(
  subject: QualitySubject,
  phase: QualityPhase = 'draft',
  now: Date = new Date(),
): QualityReport {
  const findings: QualityFinding[] = [];
  const requirements = requirementFor(subject.heritageType);
  const typeLabel = requirements.contentLabel;

  const title = subject.title?.trim() ?? '';
  const summary = subject.summary?.trim() ?? '';
  const content = subject.content?.trim() ?? '';

  // --- Title -------------------------------------------------------------
  if (title.length === 0) {
    findings.push(
      finding(
        'title.missing',
        'blocker',
        `This ${typeLabel} has no title.`,
        'Add a short title that names the story, tradition, or expression.',
        'title',
      ),
    );
  } else if (title.length < MINIMUM_TITLE_LENGTH) {
    findings.push(
      finding(
        'title.too_short',
        'blocker',
        `The title is shorter than ${MINIMUM_TITLE_LENGTH} characters.`,
        'Use a title of at least three characters so the record is identifiable.',
        'title',
      ),
    );
  }

  // --- Summary -----------------------------------------------------------
  if (requirements.summaryRequired && summary.length === 0) {
    findings.push(
      finding(
        'summary.missing',
        'warning',
        `This ${typeLabel} has no summary.`,
        'A short summary helps readers and reviewers understand the contribution at a glance.',
        'summary',
      ),
    );
  } else if (
    requirements.summaryRequired &&
    summary.length > 0 &&
    summary.length < requirements.recommendedSummaryLength
  ) {
    findings.push(
      finding(
        'summary.too_short',
        'warning',
        `The summary is shorter than ${requirements.recommendedSummaryLength} characters.`,
        'Add a little more context, or remove the summary if it does not add anything.',
        'summary',
      ),
    );
  }

  // --- Content -----------------------------------------------------------
  if (content.length === 0) {
    findings.push(
      finding(
        'content.missing',
        'blocker',
        `This ${typeLabel} has no content.`,
        'Add the material itself — the text, telling, lyrics, or recipe.',
        'content',
      ),
    );
  } else if (content.length < requirements.minimumContentLength) {
    findings.push(
      finding(
        'content.too_short',
        'blocker',
        `The content is shorter than ${requirements.minimumContentLength} characters.`,
        `Add enough of the ${typeLabel} for it to stand on its own.`,
        'content',
      ),
    );
  } else if (content.length < requirements.recommendedContentLength) {
    findings.push(
      finding(
        'content.too_short',
        'warning',
        `The content is shorter than the recommended ${requirements.recommendedContentLength} characters for a ${typeLabel}.`,
        `Consider adding the surrounding context a reader would need. Short forms such as proverbs and single expressions are accepted as they are.`,
        'content',
      ),
    );
  }

  // --- Classification ----------------------------------------------------
  if (!Array.isArray(subject.languages) || subject.languages.length === 0) {
    findings.push(
      finding(
        'language.missing',
        'blocker',
        'No language is recorded for this record.',
        'Record the language the material was told or written in, even for a short form.',
        'languages',
      ),
    );
  }

  if (
    typeof subject.heritageType !== 'string' ||
    !(HERITAGE_TYPES as readonly string[]).includes(subject.heritageType)
  ) {
    findings.push(
      finding(
        'category.missing',
        'blocker',
        'No heritage category is recorded for this record.',
        'Choose the category that best describes the contribution.',
        'heritageType',
      ),
    );
  }

  // --- Consent and rights ------------------------------------------------
  if (subject.consent?.permissionToPublish !== true) {
    findings.push(
      finding(
        'consent.publish_permission_missing',
        'blocker',
        'Publication permission is not recorded.',
        'Confirm that you have permission to publish this material, or keep the record private.',
        'consent.permissionToPublish',
      ),
    );
  }
  if (
    subject.consent?.verification === undefined ||
    subject.consent.verification === 'unverified'
  ) {
    findings.push(
      finding(
        'consent.verification_missing',
        'blocker',
        'Consent verification is still "unverified".',
        'Describe how the permission was confirmed — the verification level is reviewed, not assumed.',
        'consent.verification',
      ),
    );
  }

  const rightsStatus = subject.license?.rightsStatus ?? 'unknown';
  if (phase === 'publication' ? rightsStatus !== 'confirmed' : rightsStatus === 'unknown') {
    findings.push(
      finding(
        'rights.unresolved',
        'blocker',
        'The rights status of this record is unresolved.',
        'Record who holds the rights and under what terms, or confirm that redistribution is not permitted.',
        'license.rightsStatus',
      ),
    );
  }

  if (phase === 'publication' && subject.visibility !== 'public') {
    findings.push(
      finding(
        'visibility.not_public',
        'blocker',
        'This record is not marked for public visibility.',
        'Set the visibility to "public" only if the material may be shown openly.',
        'visibility',
      ),
    );
  }

  // --- Provenance --------------------------------------------------------
  const sources = Array.isArray(subject.sources) ? subject.sources : [];
  const contributors = Array.isArray(subject.contributors) ? subject.contributors : [];

  if (sources.length === 0) {
    findings.push(
      finding(
        'provenance.source_missing',
        'warning',
        'No source or origin is recorded for this record.',
        'Describe where the material came from — who told it, when, and in what setting.',
        'sources',
      ),
    );
  }

  if (contributors.length === 0) {
    findings.push(
      finding(
        'provenance.attribution_missing',
        'warning',
        'No attribution is recorded for this record.',
        'Record the storyteller, translator, or recorder so the origin of the material is traceable.',
        'contributors',
      ),
    );
  }

  sources.forEach((source, index) => {
    const label = `sources[${index}]`;
    if ((source.collectedOn ?? '') === '' && (source.context ?? '').trim() === '') {
      findings.push(
        finding(
          'provenance.collection_context_missing',
          'warning',
          `Source ${index + 1} has neither a collection date nor collection context.`,
          'Add when the material was collected, or where and how it was recorded.',
          label,
        ),
      );
    }
    const reference = source.reference?.trim() ?? '';
    if (reference.length > 0 && looksLikeBrokenUrl(reference)) {
      findings.push(
        finding(
          'provenance.reference_malformed',
          'warning',
          `Source ${index + 1} has a source reference that cannot be opened.`,
          'Use a complete http(s) address, a DOI, or a written shelf reference.',
          `${label}.reference`,
        ),
      );
    }
    const mediaReferences = Array.isArray(source.mediaReferences) ? source.mediaReferences : [];
    mediaReferences.forEach((referenceValue, mediaIndex) => {
      if (!isUsableMediaReference(referenceValue)) {
        findings.push(
          finding(
            'media.reference_unsupported',
            'warning',
            `Source ${index + 1} references a media item that cannot be located.`,
            'Reference uploaded media by its identifier, or use a complete http(s) address.',
            `${label}.mediaReferences[${mediaIndex}]`,
          ),
        );
      }
    });
  });

  const provenance = subject.provenance;
  if (provenance !== undefined && provenance.reviewStatus !== undefined) {
    if (provenance.reviewStatus !== 'verified') {
      findings.push(
        finding(
          'provenance.review_incomplete',
          'warning',
          'The provenance of this record has not been reviewed.',
          'A moderator reviews the attribution for consistency with what you stated. It is not a claim of historical verification.',
          'provenance.reviewStatus',
        ),
      );
    }
    if ((provenance.communityContext ?? '').trim() === '') {
      findings.push(
        finding(
          'provenance.community_context_missing',
          'info',
          'No community or regional context is recorded.',
          'Adding the community helps readers understand whose knowledge this is.',
          'provenance.communityContext',
        ),
      );
    }
    if (provenance.attributionPreference === 'anonymous') {
      findings.push(
        finding(
          'attribution.anonymity_declared',
          'info',
          'This record is published with anonymous attribution.',
          'The named contributors stay out of the public record, as you requested.',
          'provenance.attributionPreference',
        ),
      );
    }
  }

  // --- Translation metadata ---------------------------------------------
  if (subject.translationOf !== undefined && subject.translationOf !== null) {
    const missing: string[] = [];
    if ((subject.languageCode ?? '').trim() === '') missing.push('languageCode');
    if ((subject.languageDisplay ?? '').trim() === '') missing.push('languageDisplay');
    if ((subject.translationSource ?? '').trim() === '') missing.push('translationSource');
    if (missing.length > 0) {
      findings.push(
        finding(
          'translation.metadata_incomplete',
          'warning',
          `This translation is missing: ${missing.join(', ')}.`,
          'Record which language it was translated into and which version it was translated from.',
          'translation',
        ),
      );
    }
  }

  // --- Suspicious markup -------------------------------------------------
  const markupTargets: Array<{ label: string; value: string }> = [
    { label: 'title', value: title },
    { label: 'summary', value: summary },
    { label: 'content', value: content },
  ];
  for (const target of markupTargets) {
    if (target.value.length === 0) continue;
    const hit = SUSPICIOUS_MARKUP.find((candidate) => candidate.pattern.test(target.value));
    if (hit !== undefined) {
      findings.push(
        finding(
          'content.suspicious_markup',
          'warning',
          `The ${target.label} contains ${hit.label}.`,
          'Cultural material is stored as plain text. Remove embedded markup and describe the material in words instead.',
          target.label,
        ),
      );
      break;
    }
  }

  const blockerCount = findings.filter((item) => item.severity === 'blocker').length;
  const warningCount = findings.filter((item) => item.severity === 'warning').length;
  const infoCount = findings.filter((item) => item.severity === 'info').length;

  return {
    findings,
    blockerCount,
    warningCount,
    infoCount,
    blocking: blockerCount > 0,
    checkedAt: now.toISOString(),
  };
}

/** Compact summary used in list rows. */
export function summarizeQuality(report: QualityReport): QualitySummary {
  return {
    blockerCount: report.blockerCount,
    warningCount: report.warningCount,
    infoCount: report.infoCount,
    blocking: report.blocking,
    codes: report.findings.map((item) => item.code),
  };
}

/** The record paths that block publication, derived from the findings. */
export function blockingFields(report: QualityReport): string[] {
  const fields: string[] = [];
  for (const item of report.findings) {
    if (item.severity !== 'blocker') continue;
    if (item.field !== undefined && !fields.includes(item.field)) fields.push(item.field);
  }
  return fields;
}

/**
 * Evaluates a record the caller owns. Ownership is enforced in the query, so
 * another contributor's record is indistinguishable from a missing one.
 */
export async function getOwnedQualityReport(
  user: { id: string },
  recordId: string,
  phase: QualityPhase = 'draft',
): Promise<QualityReport> {
  const doc = await HeritageRecordModel.findOne({ _id: recordId, createdBy: user.id })
    .lean()
    .exec();
  if (doc === null) {
    throw new AppError(404, 'Heritage record not found', 'NOT_FOUND');
  }
  return evaluateQuality(doc, phase);
}

/**
 * Evaluates a record for a moderator. The publication phase is the one that
 * decides whether the record may go live.
 */
export async function getModerationQualityReport(
  recordId: string,
  phase: QualityPhase = 'publication',
): Promise<QualityReport> {
  const doc = await HeritageRecordModel.findById(recordId).lean().exec();
  if (doc === null) {
    throw new AppError(404, 'Heritage record not found', 'NOT_FOUND');
  }
  return evaluateQuality(doc, phase);
}
