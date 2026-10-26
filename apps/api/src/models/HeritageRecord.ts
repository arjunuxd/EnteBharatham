import type {
  AttributionPreference,
  ContributorRole,
  ConsentVerification,
  HeritageType,
  ProvenanceReviewStatus,
  RecordStatus,
  RecordVisibility,
  ReviewDecision,
  RightsStatus,
  SourceType,
} from '@entebharatham/shared';
import {
  ATTRIBUTION_PREFERENCES,
  CONTRIBUTOR_ROLES,
  CONSENT_VERIFICATIONS,
  HERITAGE_TYPES,
  PROVENANCE_REVIEW_STATUSES,
  RECORD_STATUS,
  RECORD_VISIBILITY,
  REVIEW_DECISIONS,
  RIGHTS_STATUSES,
  SOURCE_TYPES,
} from '@entebharatham/shared';
import { Schema, model, type Types } from 'mongoose';

/**
 * Structural type for a stored heritage record (lean documents and writes).
 * The Mongoose schema below enforces the same shape at runtime; this
 * interface is the typed boundary used by services and mappers.
 */
export interface HeritageRecordFields {
  _id: Types.ObjectId;
  slug: string;
  title: string;
  summary?: string;
  content?: string;
  heritageType: HeritageType;
  languages: string[];
  region: {
    country: string;
    state?: string;
    district?: string;
    locality?: string;
  };
  communityName?: string;
  contributors: {
    name: string;
    role: ContributorRole;
    isPublicAttribution: boolean;
  }[];
  sources: {
    sourceType: SourceType;
    description: string;
    reference?: string;
    collectedOn?: string;
    context?: string;
    notes?: string;
    /** Language the material was originally told or written in. */
    originalLanguage?: string;
    /** Community or regional context the material comes from. */
    communityContext?: string;
    collector?: string;
    recorder?: string;
    translator?: string;
    transcriber?: string;
    /** Supporting media references (ids or public URLs). */
    mediaReferences?: string[];
    /**
     * Whether this source entry may be shown on the public record. Private
     * source details stay private when consent or safety requires it.
     */
    isPublic?: boolean;
    /**
     * Set by a reviewer after checking the entry against what the contributor
     * stated. It never means the underlying story is historically verified,
     * and it is never settable by the contributor.
     */
    isVerified?: boolean;
  }[];
  tags: string[];
  status: RecordStatus;
  visibility: RecordVisibility;
  /**
   * Account that created the record. Optional in the schema so the Phase 2
   * fictional seed fixtures (which predate accounts) stay valid; every record
   * created through the API has it set server-side from the session.
   */
  createdBy?: Types.ObjectId;
  /** Set server-side when the record is submitted for review. */
  submittedAt?: Date;
  /**
   * Latest review decision. Private to moderators and the record's owner —
   * never included in public API responses.
   */
  review?: {
    decision: ReviewDecision;
    reason?: string;
    reviewedAt: Date;
    reviewerId?: Types.ObjectId;
  };
  consent: {
    permissionToPublish: boolean;
    allowAttribution: boolean;
    allowRedistribution: boolean;
    restrictions?: string;
    basis?: string;
    verification: ConsentVerification;
  };
  license: {
    rightsStatus: RightsStatus;
    licenseName?: string;
    licenseUrl?: string;
    holder?: string;
    notes?: string;
  };
  /**
   * Record-level provenance (Phase 6). Kept separate from consent, rights,
   * and visibility: each answers a different question.
   *
   * Optional in the type because records created before Phase 6 have no
   * provenance block; the schema default fills it in for new records.
   */
  provenance?: {
    originalLanguage?: string;
    communityContext?: string;
    attributionPreference: AttributionPreference;
    permitAnonymity: boolean;
    reviewStatus: ProvenanceReviewStatus;
    /** Internal reviewer note — never serialized publicly. */
    reviewerNotes?: string;
    reviewedAt?: Date;
    reviewerId?: Types.ObjectId;
  };
  /**
   * Auditable provenance history. Entries are appended, never rewritten, so a
   * correction never silently erases the previous record.
   */
  provenanceHistory?: {
    _id?: Types.ObjectId;
    changedAt: Date;
    changedById?: Types.ObjectId;
    changedByRole?: string;
    reason?: string;
    changes: {
      _id?: Types.ObjectId;
      field: string;
      previous?: string;
      next?: string;
    }[];
  }[];
  /**
   * Declarations that a similar record is a distinct regional variant,
   * adaptation, or independent account. Variants are preserved, not merged.
   */
  variantDeclarations?: {
    _id?: Types.ObjectId;
    relatedRecordId: Types.ObjectId;
    note: string;
    createdAt: Date;
  }[];
  /** Parent record reference for translations */
  translationOf?: Types.ObjectId;
  /** Language for translated records */
  languageCode?: string;
  languageDisplay?: string;
  /** Which version/text the translation was made from. */
  translationSource?: string;
  isFictionalSample: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const contributorSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
    role: { type: String, enum: CONTRIBUTOR_ROLES, default: 'contributor' },
    isPublicAttribution: { type: Boolean, default: true },
  },
  { _id: false },
);

const sourceSchema = new Schema(
  {
    sourceType: { type: String, enum: SOURCE_TYPES, required: true },
    description: { type: String, required: true, trim: true, minlength: 1, maxlength: 1000 },
    reference: { type: String, trim: true, maxlength: 500 },
    collectedOn: { type: String, match: DATE_PATTERN, maxlength: 10 },
    context: { type: String, trim: true, maxlength: 300 },
    notes: { type: String, trim: true, maxlength: 1000 },
    originalLanguage: { type: String, trim: true, maxlength: 64 },
    communityContext: { type: String, trim: true, maxlength: 200 },
    collector: { type: String, trim: true, maxlength: 120 },
    recorder: { type: String, trim: true, maxlength: 120 },
    translator: { type: String, trim: true, maxlength: 120 },
    transcriber: { type: String, trim: true, maxlength: 120 },
    mediaReferences: {
      type: [String],
      default: [],
      validate: {
        validator: (value: string[]) => value.length <= 10,
        message: 'mediaReferences may contain at most 10 entries',
      },
    },
    // A source entry is public by default (it was already exposed before
    // Phase 6); contributors can mark an entry private at any time.
    isPublic: { type: Boolean, default: true },
    // Reviewer-set only. Never written from client input.
    isVerified: { type: Boolean, default: false },
  },
  { _id: false },
);

const provenanceChangeSchema = new Schema(
  {
    field: { type: String, required: true, trim: true, maxlength: 120 },
    previous: { type: String, trim: true, maxlength: 2000 },
    next: { type: String, trim: true, maxlength: 2000 },
  },
  { _id: false },
);

const provenanceHistorySchema = new Schema(
  {
    changedAt: { type: Date, required: true },
    changedById: { type: Schema.Types.ObjectId, ref: 'User' },
    changedByRole: { type: String, maxlength: 40 },
    reason: { type: String, trim: true, maxlength: 500 },
    changes: { type: [provenanceChangeSchema], default: [] },
  },
  { versionKey: false },
);

const variantDeclarationSchema = new Schema(
  {
    relatedRecordId: { type: Schema.Types.ObjectId, ref: 'HeritageRecord', required: true },
    note: { type: String, required: true, trim: true, minlength: 10, maxlength: 1000 },
    createdAt: { type: Date, required: true },
  },
  { versionKey: false },
);

const provenanceSchema = new Schema(
  {
    originalLanguage: { type: String, trim: true, maxlength: 64 },
    communityContext: { type: String, trim: true, maxlength: 200 },
    attributionPreference: {
      type: String,
      enum: ATTRIBUTION_PREFERENCES,
      default: 'named',
    },
    permitAnonymity: { type: Boolean, default: true },
    reviewStatus: {
      type: String,
      enum: PROVENANCE_REVIEW_STATUSES,
      default: 'unreviewed',
    },
    // Internal reviewer note — never serialized by the public mapper.
    reviewerNotes: { type: String, trim: true, maxlength: 1000 },
    reviewedAt: { type: Date },
    reviewerId: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false },
);

const regionSchema = new Schema(
  {
    country: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
      default: 'India',
    },
    state: { type: String, trim: true, maxlength: 100 },
    district: { type: String, trim: true, maxlength: 100 },
    locality: { type: String, trim: true, maxlength: 120 },
  },
  { _id: false },
);

const consentSchema = new Schema(
  {
    // Missing consent is never treated as consent: the field is required and
    // defaults to false, so a record cannot become publicly eligible without
    // an explicit affirmative value.
    permissionToPublish: { type: Boolean, required: true, default: false },
    allowAttribution: { type: Boolean, default: false },
    allowRedistribution: { type: Boolean, default: false },
    restrictions: { type: String, trim: true, maxlength: 2000 },
    basis: { type: String, trim: true, maxlength: 1000 },
    verification: { type: String, enum: CONSENT_VERIFICATIONS, default: 'unverified' },
  },
  { _id: false },
);

const licenseSchema = new Schema(
  {
    // Content licensing is separate from the MIT software license. Absence of
    // a license is never treated as permission to reuse.
    rightsStatus: { type: String, enum: RIGHTS_STATUSES, required: true, default: 'unknown' },
    licenseName: { type: String, trim: true, maxlength: 120 },
    licenseUrl: { type: String, trim: true, maxlength: 500 },
    holder: { type: String, trim: true, maxlength: 200 },
    notes: { type: String, trim: true, maxlength: 1000 },
  },
  { _id: false },
);

const reviewSchema = new Schema(
  {
    decision: { type: String, enum: REVIEW_DECISIONS, required: true },
    // Reason for rejection / change requests. Private: visible only to
    // moderators and the record's owner, never to the public API.
    reason: { type: String, trim: true, maxlength: 2000 },
    reviewedAt: { type: Date, required: true },
    reviewerId: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false },
);

const HeritageRecordSchema = new Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 120,
      match: SLUG_PATTERN,
    },
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 200 },
    summary: { type: String, trim: true, maxlength: 500 },
    content: { type: String, trim: true, maxlength: 50_000 },
    heritageType: { type: String, enum: HERITAGE_TYPES, required: true },
    languages: {
      type: [String],
      required: true,
      validate: {
        validator: (value: string[]) =>
          value.length >= 1 && value.length <= 10 && value.every((l) => l.trim().length >= 2),
        message: 'languages must contain 1-10 entries of at least 2 characters',
      },
    },
    region: { type: regionSchema, required: true, default: () => ({ country: 'India' }) },
    communityName: { type: String, trim: true, maxlength: 200 },
    contributors: {
      type: [contributorSchema],
      default: [],
      validate: {
        validator: (value: unknown[]) => value.length <= 20,
        message: 'contributors may contain at most 20 entries',
      },
    },
    sources: {
      type: [sourceSchema],
      default: [],
      validate: {
        validator: (value: unknown[]) => value.length <= 10,
        message: 'sources may contain at most 10 entries',
      },
    },
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: (value: string[]) =>
          value.length <= 20 && value.every((t) => t.trim().length >= 1 && t.length <= 40),
        message: 'tags may contain at most 20 entries of 1-40 characters',
      },
    },
    status: { type: String, enum: RECORD_STATUS, required: true, default: 'draft' },
    visibility: { type: String, enum: RECORD_VISIBILITY, required: true, default: 'private' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    submittedAt: { type: Date },
    review: { type: reviewSchema },
    consent: { type: consentSchema, required: true, default: () => ({}) },
    license: { type: licenseSchema, required: true, default: () => ({}) },
    provenance: { type: provenanceSchema, required: true, default: () => ({}) },
    provenanceHistory: { type: [provenanceHistorySchema], default: [] },
    variantDeclarations: { type: [variantDeclarationSchema], default: [] },
    translationOf: { type: Schema.Types.ObjectId, ref: 'HeritageRecord' },
    languageCode: { type: String, trim: true, maxlength: 32 },
    languageDisplay: { type: String, trim: true, maxlength: 100 },
    translationSource: { type: String, trim: true, maxlength: 500 },
    isFictionalSample: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Indexes for the public exploration query patterns: the full eligibility
// filter (including consent) plus type/language/tag/region filters and sort.
// Consent is part of every index because it is part of every public query; a
// missing or false consent flag must never rely on an in-memory filter.
HeritageRecordSchema.index({
  status: 1,
  visibility: 1,
  'consent.permissionToPublish': 1,
  createdAt: -1,
  _id: -1,
});
HeritageRecordSchema.index({
  status: 1,
  visibility: 1,
  'consent.permissionToPublish': 1,
  heritageType: 1,
  createdAt: -1,
});
HeritageRecordSchema.index({
  status: 1,
  visibility: 1,
  'consent.permissionToPublish': 1,
  languages: 1,
  createdAt: -1,
});
HeritageRecordSchema.index({
  status: 1,
  visibility: 1,
  'consent.permissionToPublish': 1,
  tags: 1,
});
// Text search index expanded for Phase 5 (title, summary, content). Language-specific
// stemming is limited; partial/multilingual behavior is documented as best-effort.
// Kept as a standalone text index because the duplicate detector also searches
// non-public records; MongoDB permits only one text index per collection.
HeritageRecordSchema.index({ title: 'text', summary: 'text', content: 'text' });
// Additional indexes to support discovery by region/community lookups.
HeritageRecordSchema.index({
  status: 1,
  visibility: 1,
  'consent.permissionToPublish': 1,
  'region.state': 1,
  createdAt: -1,
});
HeritageRecordSchema.index({
  status: 1,
  visibility: 1,
  'consent.permissionToPublish': 1,
  'region.district': 1,
  createdAt: -1,
});
HeritageRecordSchema.index({
  status: 1,
  visibility: 1,
  'consent.permissionToPublish': 1,
  communityName: 1,
});

// Contributor dashboard (own records, newest update first) and the moderation
// review queue (pending submissions in stable submission order).
HeritageRecordSchema.index({ createdBy: 1, updatedAt: -1, _id: -1 });
HeritageRecordSchema.index({ status: 1, submittedAt: -1, _id: -1 });
HeritageRecordSchema.index({ translationOf: 1, languageCode: 1 });

export const HeritageRecordModel = model<HeritageRecordFields>(
  'HeritageRecord',
  HeritageRecordSchema,
);
