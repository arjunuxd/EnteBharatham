import type {
  ContributorAttribution,
  ContributorRecordDetail,
  ContributorRecordSummary,
  ContributorSource,
  ModerationSubmissionDetail,
  ModerationSubmissionSummary,
  OwnerConsent,
  OwnerLicense,
  ReviewInfoPublic,
} from '@entebharatham/shared';
import type { HeritageRecordFields } from '../models/HeritageRecord.js';
import { evaluateQuality, summarizeQuality } from './quality.service.js';
import {
  toProvenanceBlock,
  toProvenanceHistory,
  toVariantDeclarations,
} from './provenance.mapper.js';

/**
 * Explicit serialization for contributor and moderation views. Raw Mongoose
 * documents are never spread into responses; every field is picked, so
 * future internal columns cannot leak by accident.
 *
 * Review reasons and moderation decisions are included here (owner and
 * moderator views only) and are never produced by the public mapper.
 */

function optional(value: string | undefined): string | undefined {
  return value === undefined || value === '' ? undefined : value;
}

function toReviewInfo(doc: HeritageRecordFields): ReviewInfoPublic | undefined {
  if (doc.review === undefined) return undefined;
  const info: ReviewInfoPublic = {
    decision: doc.review.decision,
    reviewedAt: doc.review.reviewedAt.toISOString(),
  };
  const reason = optional(doc.review.reason);
  if (reason !== undefined) info.reason = reason;
  return info;
}

export function toContributorSummaryDto(doc: HeritageRecordFields): ContributorRecordSummary {
  const dto: ContributorRecordSummary = {
    id: String(doc._id),
    slug: doc.slug,
    title: doc.title,
    heritageType: doc.heritageType,
    status: doc.status,
    visibility: doc.visibility,
    languages: [...doc.languages],
    isFictionalSample: doc.isFictionalSample,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    quality: summarizeQuality(evaluateQuality(doc, 'draft')),
  };
  const summary = optional(doc.summary);
  if (summary !== undefined) dto.summary = summary;
  if (doc.submittedAt !== undefined) dto.submittedAt = doc.submittedAt.toISOString();
  return dto;
}

export function toContributorDto(doc: HeritageRecordFields): ContributorRecordDetail {
  const contributors: ContributorAttribution[] = doc.contributors.map((contributor) => ({
    name: contributor.name,
    role: contributor.role,
    isPublicAttribution: contributor.isPublicAttribution,
  }));

  const sources: ContributorSource[] = doc.sources.map((source) => {
    const entry: ContributorSource = {
      sourceType: source.sourceType,
      description: source.description,
      isPublic: source.isPublic !== false,
      isVerified: source.isVerified === true,
    };
    const reference = optional(source.reference);
    const collectedOn = optional(source.collectedOn);
    const context = optional(source.context);
    const notes = optional(source.notes);
    const originalLanguage = optional(source.originalLanguage);
    const communityContext = optional(source.communityContext);
    const collector = optional(source.collector);
    const recorder = optional(source.recorder);
    const translator = optional(source.translator);
    const transcriber = optional(source.transcriber);
    if (reference !== undefined) entry.reference = reference;
    if (collectedOn !== undefined) entry.collectedOn = collectedOn;
    if (context !== undefined) entry.context = context;
    if (notes !== undefined) entry.notes = notes;
    if (originalLanguage !== undefined) entry.originalLanguage = originalLanguage;
    if (communityContext !== undefined) entry.communityContext = communityContext;
    if (collector !== undefined) entry.collector = collector;
    if (recorder !== undefined) entry.recorder = recorder;
    if (translator !== undefined) entry.translator = translator;
    if (transcriber !== undefined) entry.transcriber = transcriber;
    if (source.mediaReferences !== undefined && source.mediaReferences.length > 0) {
      entry.mediaReferences = [...source.mediaReferences];
    }
    return entry;
  });

  const consent: OwnerConsent = {
    permissionToPublish: doc.consent.permissionToPublish,
    allowAttribution: doc.consent.allowAttribution,
    allowRedistribution: doc.consent.allowRedistribution,
    verification: doc.consent.verification,
  };
  const restrictions = optional(doc.consent.restrictions);
  const basis = optional(doc.consent.basis);
  if (restrictions !== undefined) consent.restrictions = restrictions;
  if (basis !== undefined) consent.basis = basis;

  const license: OwnerLicense = { rightsStatus: doc.license.rightsStatus };
  const licenseName = optional(doc.license.licenseName);
  const licenseUrl = optional(doc.license.licenseUrl);
  const holder = optional(doc.license.holder);
  const licenseNotes = optional(doc.license.notes);
  if (licenseName !== undefined) license.licenseName = licenseName;
  if (licenseUrl !== undefined) license.licenseUrl = licenseUrl;
  if (holder !== undefined) license.holder = holder;
  if (licenseNotes !== undefined) license.notes = licenseNotes;

  const detail: ContributorRecordDetail = {
    ...toContributorSummaryDto(doc),
    content: optional(doc.content),
    communityName: optional(doc.communityName),
    tags: [...doc.tags],
    region: {
      country: doc.region.country,
      state: optional(doc.region.state),
      district: optional(doc.region.district),
      locality: optional(doc.region.locality),
    },
    contributors,
    sources,
    consent,
    license,
    provenance: toProvenanceBlock(doc),
    provenanceHistory: toProvenanceHistory(doc),
    variantDeclarations: toVariantDeclarations(doc),
    qualityReport: evaluateQuality(doc, 'draft'),
  };

  const review = toReviewInfo(doc);
  if (review !== undefined) detail.review = review;
  return detail;
}

export function toModerationSummaryDto(doc: HeritageRecordFields): ModerationSubmissionSummary {
  const dto: ModerationSubmissionSummary = {
    id: String(doc._id),
    slug: doc.slug,
    title: doc.title,
    heritageType: doc.heritageType,
    status: doc.status,
    visibility: doc.visibility,
    languages: [...doc.languages],
    permissionToPublish: doc.consent.permissionToPublish,
    consentVerification: doc.consent.verification,
    rightsStatus: doc.license.rightsStatus,
    hasRestrictions: doc.consent.restrictions !== undefined && doc.consent.restrictions !== '',
    isFictionalSample: doc.isFictionalSample,
    updatedAt: doc.updatedAt.toISOString(),
    quality: summarizeQuality(evaluateQuality(doc, 'draft')),
  };
  if (doc.createdBy !== undefined) dto.createdBy = String(doc.createdBy);
  if (doc.submittedAt !== undefined) dto.submittedAt = doc.submittedAt.toISOString();
  return dto;
}

export function toModerationDetailDto(doc: HeritageRecordFields): ModerationSubmissionDetail {
  const detail: ModerationSubmissionDetail = toContributorDto(doc);
  if (doc.createdBy !== undefined) detail.createdBy = String(doc.createdBy);
  return detail;
}
