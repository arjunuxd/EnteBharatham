import {
  ATTRIBUTION_PREFERENCES,
  CONTRIBUTOR_ROLES,
  CONSENT_VERIFICATIONS,
  FEEDBACK_KINDS,
  FEEDBACK_MAX_LENGTH,
  FEEDBACK_MIN_LENGTH,
  FEEDBACK_VISIBILITIES,
  HERITAGE_TYPES,
  PROVENANCE_REVIEW_STATUSES,
  RECORD_STATUS,
  RECORD_VISIBILITY,
  RIGHTS_STATUSES,
  SOURCE_TYPES,
} from '@entebharatham/shared';
import { z } from 'zod';
import { zodEnum } from './zodEnum.js';

/**
 * Write validation for the contribution workflow.
 *
 * All schemas are `.strict()`: lifecycle fields (`status`, `createdBy`,
 * `review`, `submittedAt`), `isFictionalSample`, and any other unknown key
 * are rejected outright — clients cannot assign privileged state, and
 * ownership is always taken from the authenticated session server-side.
 */

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

/** Only http/https links may be stored as a licence URL. */
const httpUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Enter a valid http or https URL');

/** Mongo `_id` path parameter: malformed ids are a 400, not a silent miss. */
export const objectIdParamSchema = z
  .string()
  .regex(OBJECT_ID_PATTERN, 'That item reference is not valid');

export const regionInput = z
  .object({
    country: z.string().trim().min(1).max(100),
    state: z.string().trim().max(100).optional(),
    district: z.string().trim().max(100).optional(),
    locality: z.string().trim().max(120).optional(),
  })
  .strict();

export const contributorEntryInput = z
  .object({
    name: z.string().trim().min(1, 'Attribution name is required').max(120),
    role: zodEnum(CONTRIBUTOR_ROLES).optional(),
    isPublicAttribution: z.boolean().optional(),
  })
  .strict();

export const sourceEntryInput = z
  .object({
    sourceType: zodEnum(SOURCE_TYPES),
    description: z.string().trim().min(1, 'Source description is required').max(1000),
    reference: z.string().trim().max(500).optional(),
    collectedOn: z
      .string()
      .regex(DATE_PATTERN, 'Collection date must be YYYY-MM-DD')
      .max(10)
      .optional(),
    context: z.string().trim().max(300).optional(),
    notes: z.string().trim().max(1000).optional(),
    originalLanguage: z.string().trim().max(64).optional(),
    communityContext: z.string().trim().max(200).optional(),
    collector: z.string().trim().max(120).optional(),
    recorder: z.string().trim().max(120).optional(),
    translator: z.string().trim().max(120).optional(),
    transcriber: z.string().trim().max(120).optional(),
    mediaReferences: z
      .array(z.string().trim().min(1).max(500))
      .max(10, 'At most 10 media references are allowed')
      .optional(),
    // Whether this entry may be shown on the public record.
    isPublic: z.boolean().optional(),
    // `isVerified` is intentionally absent: it is set by a reviewer only and
    // is rejected as an unknown key by this strict schema.
  })
  .strict();

export const consentInput = z
  .object({
    permissionToPublish: z.boolean().optional(),
    allowAttribution: z.boolean().optional(),
    allowRedistribution: z.boolean().optional(),
    restrictions: z.string().trim().max(2000).optional(),
    basis: z.string().trim().max(1000).optional(),
    verification: zodEnum(CONSENT_VERIFICATIONS).optional(),
  })
  .strict();

export const licenseInput = z
  .object({
    rightsStatus: zodEnum(RIGHTS_STATUSES).optional(),
    licenseName: z.string().trim().max(120).optional(),
    licenseUrl: httpUrl.optional(),
    holder: z.string().trim().max(200).optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .strict();

const baseHeritageFields = {
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200),
  summary: z.string().trim().max(500, 'Summary must be at most 500 characters').optional(),
  content: z.string().trim().max(50_000, 'Content must be at most 50000 characters').optional(),
  heritageType: zodEnum(HERITAGE_TYPES),
  languages: z
    .array(z.string().trim().min(2, 'Each language must be at least 2 characters').max(64))
    .min(1, 'At least one language is required')
    .max(10, 'At most 10 languages are allowed'),
  region: regionInput.optional(),
  communityName: z.string().trim().max(200).optional(),
  contributors: z
    .array(contributorEntryInput)
    .max(20, 'At most 20 contributors are allowed')
    .optional(),
  sources: z.array(sourceEntryInput).max(10, 'At most 10 sources are allowed').optional(),
  tags: z
    .array(
      z
        .string()
        .trim()
        .min(1, 'Tags cannot be empty')
        .max(40, 'Tags must be at most 40 characters'),
    )
    .max(20, 'At most 20 tags are allowed')
    .optional(),
  visibility: zodEnum(RECORD_VISIBILITY).optional(),
  consent: consentInput.optional(),
  license: licenseInput.optional(),
};

/**
 * POST /api/v1/heritage — draft creation. Only content fields are accepted;
 * `status`, `createdBy`, and friends are absent by design (strict schema).
 */
export const createHeritageDraftSchema = z.object(baseHeritageFields).strict();

export type CreateHeritageDraftInput = z.infer<typeof createHeritageDraftSchema>;

/**
 * PATCH /api/v1/heritage/:id — draft editing. Identical field set, all
 * optional, and at least one field must be provided. Nested objects
 * (`consent`, `license`, `region`) are merged field-by-field by the service;
 * arrays replace wholesale.
 */
export const updateHeritageDraftSchema = z
  .object({
    title: baseHeritageFields.title.optional(),
    summary: baseHeritageFields.summary,
    content: baseHeritageFields.content,
    heritageType: baseHeritageFields.heritageType.optional(),
    languages: baseHeritageFields.languages.optional(),
    region: baseHeritageFields.region,
    communityName: baseHeritageFields.communityName,
    contributors: baseHeritageFields.contributors,
    sources: baseHeritageFields.sources,
    tags: baseHeritageFields.tags,
    visibility: baseHeritageFields.visibility,
    consent: baseHeritageFields.consent,
    license: baseHeritageFields.license,
  })
  .strict()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'At least one field must be provided',
  });

export type UpdateHeritageDraftInput = z.infer<typeof updateHeritageDraftSchema>;

/**
 * Rejection / change-request reasons. Kept short and mandatory — a review
 * decision without an explanation is never accepted.
 */
export const reviewReasonSchema = z
  .string()
  .trim()
  .min(10, 'A reason of at least 10 characters is required')
  .max(1000, 'Reason must be at most 1000 characters');

export const rejectSubmissionSchema = z.object({ reason: reviewReasonSchema }).strict();
export const requestChangesSchema = z.object({ reason: reviewReasonSchema }).strict();

/** Contributor dashboard list query. */
export const contributorListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
    status: zodEnum(RECORD_STATUS).optional(),
  })
  .strict();

export type ContributorListQueryInput = z.infer<typeof contributorListQuerySchema>;

/** Moderation queue list query. */
export const moderationListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
  })
  .strict();

export type ModerationListQueryInput = z.infer<typeof moderationListQuerySchema>;

/* ------------------------------------------------------------------------ */
/* Phase 6 — provenance, variants, and structured review feedback           */
/* ------------------------------------------------------------------------ */

/**
 * PATCH /api/v1/heritage/mine/:id/provenance — the contributor's own
 * provenance update.
 *
 * Strict: the reviewer-only fields (`provenance.reviewStatus`,
 * `provenance.reviewerNotes`, `sources[].isVerified`) are absent by design and
 * are rejected as unknown keys.
 */
export const provenanceUpdateSchema = z
  .object({
    originalLanguage: z.string().trim().max(64).optional(),
    communityContext: z.string().trim().max(200).optional(),
    attributionPreference: zodEnum(ATTRIBUTION_PREFERENCES).optional(),
    permitAnonymity: z.boolean().optional(),
    sources: z.array(sourceEntryInput).max(10, 'At most 10 sources are allowed').optional(),
    reason: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'At least one field must be provided',
  });

export type ProvenanceUpdateInput = z.infer<typeof provenanceUpdateSchema>;

/** Moderator provenance review. */
export const provenanceReviewSchema = z
  .object({
    reviewStatus: zodEnum(PROVENANCE_REVIEW_STATUSES),
    reviewerNotes: z.string().trim().max(1000).optional(),
  })
  .strict();

export type ProvenanceReviewInput = z.infer<typeof provenanceReviewSchema>;

/**
 * A variant declaration records that a similar record is a distinct regional
 * variant, adaptation, or independent account — never a copy to be merged.
 */
export const variantDeclarationSchema = z
  .object({
    relatedRecordId: z.string().regex(OBJECT_ID_PATTERN, 'Invalid related record id'),
    note: z
      .string()
      .trim()
      .min(10, 'A note of at least 10 characters is required')
      .max(1000, 'Note must be at most 1000 characters'),
  })
  .strict();

export type VariantDeclarationInput = z.infer<typeof variantDeclarationSchema>;

/**
 * Structured review feedback. `visibility: internal` is only honoured for
 * moderators — the service forces contributor-visible for contributors.
 */
export const feedbackCreateSchema = z
  .object({
    kind: zodEnum(FEEDBACK_KINDS),
    message: z
      .string()
      .trim()
      .min(
        FEEDBACK_MIN_LENGTH,
        `A message of at least ${FEEDBACK_MIN_LENGTH} characters is required`,
      )
      .max(FEEDBACK_MAX_LENGTH, `Message must be at most ${FEEDBACK_MAX_LENGTH} characters`),
    field: z.string().trim().max(120).optional(),
    visibility: zodEnum(FEEDBACK_VISIBILITIES).optional(),
    parentId: z.string().regex(OBJECT_ID_PATTERN, 'Invalid feedback id').optional(),
  })
  .strict();

export type FeedbackCreateInput = z.infer<typeof feedbackCreateSchema>;

/** Feedback id path parameter. */
export const feedbackIdParamSchema = z.object({ id: z.string().regex(OBJECT_ID_PATTERN) }).strict();
