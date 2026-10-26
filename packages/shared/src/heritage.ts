/**
 * Controlled vocabularies and public API contracts for cultural-heritage
 * records. These constants are the single source of truth for category,
 * visibility, lifecycle, and rights values across the API, database schema,
 * and frontend filters — never duplicate the lists elsewhere.
 */

import type { ProvenancePublic } from './provenance.js';

export const HERITAGE_TYPES = [
  'folk_story',
  'oral_history',
  'song',
  'recipe',
  'dialect',
  'proverb',
  'custom',
  'craft',
  'other',
] as const;

export type HeritageType = (typeof HERITAGE_TYPES)[number];

export interface HeritageTypeOption {
  value: HeritageType;
  label: string;
  labelMalayalam: string;
}

export const HERITAGE_TYPE_OPTIONS: readonly HeritageTypeOption[] = [
  { value: 'folk_story', label: 'Folk stories & oral narratives', labelMalayalam: 'ജനകീയ കഥകൾ' },
  {
    value: 'oral_history',
    label: 'Oral histories & community memories',
    labelMalayalam: 'വാചിക ചരിത്രം',
  },
  { value: 'song', label: 'Traditional songs & music', labelMalayalam: 'പാരമ്പര്യ ഗാനങ്ങൾ' },
  { value: 'recipe', label: 'Recipes & food traditions', labelMalayalam: 'ഭക്ഷണ പാരമ്പര്യം' },
  { value: 'dialect', label: 'Dialects, vocabulary & expressions', labelMalayalam: 'ഭാഷാഭേദങ്ങൾ' },
  { value: 'proverb', label: 'Proverbs & sayings', labelMalayalam: 'പഴമൊഴികൾ' },
  {
    value: 'custom',
    label: 'Customs, rituals & festivals',
    labelMalayalam: 'ചടങ്ങുകളും ആഘോഷങ്ങളും',
  },
  { value: 'craft', label: 'Crafts & traditional skills', labelMalayalam: 'കരകൗശലം' },
  { value: 'other', label: 'Other cultural heritage', labelMalayalam: 'മറ്റ് സാംസ്കാരിക പൈതൃകം' },
];

export const RECORD_VISIBILITY = ['public', 'restricted', 'private'] as const;
export type RecordVisibility = (typeof RECORD_VISIBILITY)[number];

export const RECORD_STATUS = [
  'draft',
  'pending_review',
  'changes_requested',
  'published',
  'rejected',
  'archived',
] as const;
export type RecordStatus = (typeof RECORD_STATUS)[number];

export const SOURCE_TYPES = [
  'oral_account',
  'written_source',
  'community_archive',
  'contributor_submitted',
  'other',
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const CONTRIBUTOR_ROLES = [
  'storyteller',
  'translator',
  'recorder',
  'contributor',
  'other',
] as const;
export type ContributorRole = (typeof CONTRIBUTOR_ROLES)[number];

export const CONSENT_VERIFICATIONS = ['unverified', 'documented', 'community_confirmed'] as const;
export type ConsentVerification = (typeof CONSENT_VERIFICATIONS)[number];

export const RIGHTS_STATUSES = ['unknown', 'pending', 'confirmed'] as const;
export type RightsStatus = (typeof RIGHTS_STATUSES)[number];

export const MEDIA_TYPES = ['image', 'audio', 'document'] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const MEDIA_FORMATS = ['jpeg', 'png', 'webp', 'mp3', 'wav', 'm4a', 'aac', 'pdf'] as const;
export type MediaFormat = (typeof MEDIA_FORMATS)[number];

export const MEDIA_CATEGORIES = [
  'photograph',
  'scan',
  'audio_recording',
  'document',
  'other',
] as const;
export type MediaCategory = (typeof MEDIA_CATEGORIES)[number];

export const MEDIA_LIFECYCLE_STATES = [
  'pending',
  'uploaded',
  'published',
  'restricted',
  'removed',
] as const;
export type MediaLifecycleState = (typeof MEDIA_LIFECYCLE_STATES)[number];

export const REPORT_CATEGORIES = [
  'incorrect_misleading',
  'attribution_ownership',
  'missing_disputed_consent',
  'sensitive_restricted_knowledge',
  'privacy_concern',
  'harmful_inappropriate',
  'copyright_licensing',
  'other',
] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export const REPORT_STATUSES = ['open', 'under_review', 'resolved', 'dismissed'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const CORRECTION_STATUSES = ['proposed', 'under_review', 'approved', 'rejected'] as const;
export type CorrectionStatus = (typeof CORRECTION_STATUSES)[number];

export const WITHDRAWAL_REQUEST_TYPES = [
  'contributor_withdrawal',
  'community_report',
  'moderator_initiated',
] as const;
export type WithdrawalRequestType = (typeof WITHDRAWAL_REQUEST_TYPES)[number];

export const WITHDRAWAL_STATUSES = [
  'requested',
  'under_review',
  'restricted',
  'unpublished',
  'removed',
  'dismissed',
] as const;
export type WithdrawalStatus = (typeof WITHDRAWAL_STATUSES)[number];

export const TRANSLATION_STATUSES = [
  'draft',
  'pending_review',
  'published',
  'rejected',
  'archived',
] as const;
export type TranslationStatus = (typeof TRANSLATION_STATUSES)[number];

export interface Region {
  country: string;
  state?: string;
  district?: string;
  locality?: string;
}

export interface ContributorPublic {
  /** Preferred attribution — may be a pseudonym, not a legal identity. */
  name: string;
  role: ContributorRole;
}

export interface SourcePublic {
  sourceType: SourceType;
  description: string;
  collectedOn?: string;
  context?: string;
  originalLanguage?: string;
  communityContext?: string;
  collector?: string;
  recorder?: string;
  translator?: string;
  transcriber?: string;
}

export interface ConsentPublic {
  allowAttribution: boolean;
  allowRedistribution: boolean;
  verification: ConsentVerification;
  restrictions?: string;
}

export interface ContentLicensePublic {
  rightsStatus: RightsStatus;
  licenseName?: string;
  licenseUrl?: string;
  holder?: string;
}

export interface HeritageRecordSummary {
  id: string;
  slug: string;
  title: string;
  summary?: string;
  heritageType: HeritageType;
  languages: string[];
  region: Region;
  communityName?: string;
  tags: string[];
  isFictionalSample: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HeritageRecordPublic extends HeritageRecordSummary {
  content?: string;
  contributors: ContributorPublic[];
  sources: SourcePublic[];
  consent: ConsentPublic;
  license: ContentLicensePublic;
  /**
   * Public provenance summary. `claimState` states who supplied the
   * provenance — it never claims the record has been historically verified.
   */
  provenance: ProvenancePublic;
}

/**
 * Query parameters accepted by GET /api/v1/heritage (after validation).
 * `tags` is the parsed, deduplicated array form of the comma-separated
 * query parameter.
 */
export type HeritageSortOption = 'relevance' | 'newest' | 'title';

export interface HeritageListQuery {
  page: number;
  limit: number;
  heritageType?: HeritageType;
  language?: string;
  region?: string;
  tags?: string[];
  q?: string;
  sort?: HeritageSortOption;
  community?: string;
  translationLanguage?: string;
}
