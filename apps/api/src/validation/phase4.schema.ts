import { z } from 'zod';
import { REPORT_CATEGORIES } from '@entebharatham/shared';

/**
 * Phase 4 input validation.
 *
 * Every schema is `.strict()` so unknown keys are rejected rather than passed
 * through to the database, identifiers are validated as Mongo ObjectIds before
 * a query, and user-supplied URLs are restricted to http/https.
 */

const objectId = z
  .string()
  .trim()
  .regex(/^[a-f0-9]{24}$/i, 'Invalid identifier')
  .transform((value) => value.toLowerCase());

export const reportSubmissionSchema = z
  .object({
    heritageRecordId: objectId,
    category: z.enum(REPORT_CATEGORIES),
    explanation: z.string().trim().max(1000).optional(),
  })
  .strict();

export const correctionProposalSchema = z
  .object({
    heritageRecordId: objectId,
    proposedChanges: z
      .record(z.string().trim().min(1).max(100), z.unknown())
      .refine(
        (changes) => Object.keys(changes).length > 0 && Object.keys(changes).length <= 30,
        'Propose between 1 and 30 field changes',
      ),
    rationale: z.string().trim().max(1000).optional(),
  })
  .strict();

export const withdrawalRequestSchema = z
  .object({
    heritageRecordId: objectId.optional(),
    mediaId: objectId.optional(),
    type: z.enum(['contributor_withdrawal', 'community_report', 'moderator_initiated']),
    reason: z.string().trim().min(10).max(1000),
    details: z.string().trim().max(2000).optional(),
  })
  .strict()
  .refine(
    (value) => value.heritageRecordId !== undefined || value.mediaId !== undefined,
    'A withdrawal must refer to a record or a media item',
  );

export const reportResolutionSchema = z
  .object({
    status: z.enum(['under_review', 'resolved', 'dismissed']),
    resolutionCategory: z.string().trim().max(200).optional(),
    decisionNote: z.string().trim().max(1000).optional(),
  })
  .strict();

export const correctionReviewSchema = z
  .object({
    status: z.enum(['under_review', 'approved', 'rejected']),
    decisionNote: z.string().trim().max(1000).optional(),
  })
  .strict();

export const withdrawalActionSchema = z
  .object({
    status: z.enum(['under_review', 'restricted', 'unpublished', 'removed', 'dismissed']),
    actionTaken: z.string().trim().max(1000).optional(),
  })
  .strict();

export const translationCreateSchema = z
  .object({
    parentRecordId: objectId,
    languageCode: z.string().trim().min(2).max(10),
    languageDisplay: z.string().trim().min(1).max(100),
    title: z.string().trim().min(1).max(200),
    summary: z.string().trim().max(500).optional(),
    content: z.string().trim().min(10).max(50000),
    translatorAttribution: z.string().trim().max(200).optional(),
    translationSource: z.string().trim().max(500).optional(),
    rightsStatus: z.string().trim().max(50).optional(),
    consentStatus: z.string().trim().max(50).optional(),
  })
  .strict();

export const profileUpdateSchema = z
  .object({
    displayName: z.string().trim().min(1).max(80).optional(),
    attributionName: z.string().trim().max(120).optional(),
    bio: z.string().trim().max(1000).optional(),
    publicProfileEnabled: z.boolean().optional(),
  })
  .strict();

export const emailVerificationRequestSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
  })
  .strict();

export const emailVerificationConfirmSchema = z
  .object({
    token: z.string().trim().min(10).max(200),
  })
  .strict();

export const passwordResetRequestSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
  })
  .strict();

export const passwordResetConfirmSchema = z
  .object({
    token: z.string().trim().min(10).max(200),
    newPassword: z.string().min(8).max(128),
  })
  .strict();

export type EmailVerificationRequestInput = z.infer<typeof emailVerificationRequestSchema>;
export type EmailVerificationConfirmInput = z.infer<typeof emailVerificationConfirmSchema>;
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetConfirmInput = z.infer<typeof passwordResetConfirmSchema>;
