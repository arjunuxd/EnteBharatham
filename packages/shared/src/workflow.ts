/**
 * DTO contracts for the contributor and moderation workflows. These shapes
 * are produced exclusively by server-side mappers: internal review notes and
 * moderation decisions are only ever serialized for authorized viewers.
 */

import type {
  ContributorRole,
  ConsentVerification,
  HeritageType,
  RecordStatus,
  RecordVisibility,
  Region,
  RightsStatus,
  SourceType,
} from './heritage.js';
import type { UserRole } from './auth.js';
import type { ProvenanceBlock, ProvenanceHistoryEntry, VariantDeclaration } from './provenance.js';
import type { QualityReport, QualitySummary } from './quality.js';
import type { FeedbackThreadPublic } from './feedback.js';

export const REVIEW_DECISIONS = ['approved', 'rejected', 'changes_requested'] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

/** Latest review decision, visible to the record's owner and to moderators. */
export interface ReviewInfoPublic {
  decision: ReviewDecision;
  reason?: string;
  reviewedAt: string;
}

/** Lifecycle transitions a moderator decision may perform. */
export const MODERATION_ACTIONS = ['approve', 'reject', 'request_changes'] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

export interface ContributorRecordSummary {
  id: string;
  slug: string;
  title: string;
  summary?: string;
  heritageType: HeritageType;
  status: RecordStatus;
  visibility: RecordVisibility;
  languages: string[];
  isFictionalSample: boolean;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  /** Server-computed quality summary (counts and codes, never a score). */
  quality: QualitySummary;
}

export interface ContributorSource {
  sourceType: SourceType;
  description: string;
  reference?: string;
  collectedOn?: string;
  context?: string;
  /** Internal note — never included in public responses. */
  notes?: string;
  originalLanguage?: string;
  communityContext?: string;
  collector?: string;
  recorder?: string;
  translator?: string;
  transcriber?: string;
  mediaReferences?: string[];
  /** Whether this source entry may appear on the public record. */
  isPublic: boolean;
  /** Set by a reviewer only; never contributor-supplied. */
  isVerified: boolean;
}

export interface ContributorAttribution {
  name: string;
  role: ContributorRole;
  isPublicAttribution: boolean;
}

export interface OwnerConsent {
  permissionToPublish: boolean;
  allowAttribution: boolean;
  allowRedistribution: boolean;
  verification: ConsentVerification;
  restrictions?: string;
  basis?: string;
}

export interface OwnerLicense {
  rightsStatus: RightsStatus;
  licenseName?: string;
  licenseUrl?: string;
  holder?: string;
  notes?: string;
}

/**
 * Full owner/moderator view of a draft or submission: editable content plus
 * consent, rights, provenance, and (for authorized viewers) the latest review
 * decision. Never served from public endpoints.
 */
export interface ContributorRecordDetail extends ContributorRecordSummary {
  content?: string;
  communityName?: string;
  tags: string[];
  region: Region;
  contributors: ContributorAttribution[];
  sources: ContributorSource[];
  consent: OwnerConsent;
  license: OwnerLicense;
  review?: ReviewInfoPublic;
  /** Record-level provenance block (owner/moderator view). */
  provenance: ProvenanceBlock;
  /** Auditable provenance change history (owner/moderator view). */
  provenanceHistory: ProvenanceHistoryEntry[];
  /** Declarations that similar records are distinct variants. */
  variantDeclarations: VariantDeclaration[];
  /** Full server-computed quality report. */
  qualityReport: QualityReport;
  /** Review feedback thread visible to this viewer. */
  feedback?: FeedbackThreadPublic;
}

/** Queue row for moderators: metadata + consent indicators, no full content. */
export interface ModerationSubmissionSummary {
  id: string;
  slug: string;
  title: string;
  heritageType: HeritageType;
  status: RecordStatus;
  visibility: RecordVisibility;
  languages: string[];
  permissionToPublish: boolean;
  consentVerification: ConsentVerification;
  rightsStatus: RightsStatus;
  hasRestrictions: boolean;
  isFictionalSample: boolean;
  createdBy?: string;
  submittedAt?: string;
  updatedAt: string;
  /** Server-computed quality summary (counts and codes, never a score). */
  quality: QualitySummary;
}

/** Moderator detail view: everything needed to make a review decision. */
export interface ModerationSubmissionDetail extends ContributorRecordDetail {
  createdBy?: string;
}

export const AUDIT_ACTIONS = [
  'user.registered',
  'record.submitted',
  'record.approved',
  'record.rejected',
  'record.changes_requested',
  'record.deleted',
  'user.role_changed',
  'media.uploaded',
  'media.removed',
  'report.submitted',
  'report.resolved',
  'report.dismissed',
  'correction.proposed',
  'correction.approved',
  'correction.rejected',
  'withdrawal.requested',
  'withdrawal.actioned',
  'provenance.updated',
  'provenance.reviewed',
  'feedback.added',
  'feedback.resolved',
  'variant.declared',
  'translation.created',
  'translation.published',
  'user.email_verified',
  'user.password_reset_requested',
  'user.password_reset_completed',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/**
 * Structured audit event. `metadata` is limited to short, safe strings —
 * never passwords, session identifiers, secrets, or full cultural content.
 */
export interface AuditEventPublic {
  id: string;
  action: AuditAction;
  actorId?: string;
  actorRole?: UserRole;
  recordId?: string;
  metadata?: Record<string, string>;
  createdAt: string;
}

export const EMAIL_VERIFICATION_PURPOSES = ['email_verification'] as const;
export type EmailVerificationPurpose = (typeof EMAIL_VERIFICATION_PURPOSES)[number];

export const PASSWORD_RESET_PURPOSES = ['password_reset'] as const;
export type PasswordResetPurpose = (typeof PASSWORD_RESET_PURPOSES)[number];

export interface HeritageMediaPublic {
  id: string;
  heritageRecordId: string;
  mediaType: 'image' | 'audio' | 'document';
  category: string;
  displayName: string;
  caption?: string;
  size: number;
  createdAt: string;
  // Do not expose storage keys, bucket names, paths, signed URLs, or internal metadata
}

export interface HeritageMediaOwner extends HeritageMediaPublic {
  verifiedMediaType: string;
  storageKey: string;
  lifecycleState: string;
  uploaderId?: string;
  moderationState?: string;
  rightsNote?: string;
  updatedAt: string;
}

export interface ReportSubmissionRequest {
  heritageRecordId: string;
  category: string;
  explanation?: string;
}

export interface ReportPublicSummary {
  id: string;
  heritageRecordId: string;
  /** Title of the reported record, for the moderator's context. */
  recordTitle?: string;
  category: string;
  status: string;
  createdAt: string;
}

export interface ReportDetail extends ReportPublicSummary {
  explanation?: string;
  reporterId?: string;
  assignedModeratorId?: string;
  resolutionCategory?: string;
  decisionNote?: string;
  reviewedAt?: string;
  updatedAt: string;
}

export interface CorrectionProposalRequest {
  heritageRecordId: string;
  proposedChanges: Record<string, unknown>;
  rationale?: string;
}

export interface CorrectionProposalPublic {
  id: string;
  heritageRecordId: string;
  /** Title of the record the correction refers to. */
  recordTitle?: string;
  status: string;
  proposedById?: string;
  rationale?: string;
  /** The proposed field changes (whitelisted fields only). */
  proposedChanges?: Record<string, unknown>;
  reviewerId?: string;
  createdAt: string;
  reviewedAt?: string;
  decisionNote?: string;
}

export interface WithdrawalRequestInput {
  heritageRecordId?: string;
  mediaId?: string;
  type: string;
  reason: string;
  details?: string;
}

export interface WithdrawalRequestPublic {
  id: string;
  heritageRecordId?: string;
  /** Title of the record the withdrawal refers to. */
  recordTitle?: string;
  mediaId?: string;
  type: string;
  status: string;
  reason: string;
  details?: string;
  requestedById?: string;
  reviewedById?: string;
  createdAt: string;
  reviewedAt?: string;
  actionTaken?: string;
}

export interface TranslationSummary {
  id: string;
  parentRecordId: string;
  languageCode: string;
  languageDisplay: string;
  title: string;
  status: string;
  translatorId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TranslationDetail extends TranslationSummary {
  summary?: string;
  content: string;
  translatorAttribution?: string;
  translationSource?: string;
  rightsStatus?: string;
  consentStatus?: string;
  provenance?: string;
  review?: ReviewInfoPublic;
}

export interface TranslationCreateRequest {
  parentRecordId: string;
  languageCode: string;
  languageDisplay: string;
  title: string;
  summary?: string;
  content: string;
  translatorAttribution?: string;
  translationSource?: string;
  rightsStatus?: string;
  consentStatus?: string;
}

export interface ContributorProfilePublic {
  id: string;
  displayName: string;
  attributionName?: string;
  bio?: string;
  memberSince: string;
  publicProfileEnabled: boolean;
}

export interface ContributorProfileDetail extends ContributorProfilePublic {
  email?: string;
}

export interface ProfileUpdateRequest {
  displayName?: string;
  attributionName?: string;
  bio?: string;
  publicProfileEnabled?: boolean;
}

export interface EmailVerificationRequest {
  email: string;
}

export interface EmailVerificationConfirm {
  token: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  newPassword: string;
}
