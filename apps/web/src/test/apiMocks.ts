import type {
  AuditEventPublic,
  AuthUserPublic,
  ContributorRecordDetail,
  ContributorRecordSummary,
  HeritageRecordPublic,
  HeritageRecordSummary,
  ModerationSubmissionDetail,
  ModerationSubmissionSummary,
  PaginatedResponse,
  QualitySummary,
} from '@entebharatham/shared';

/** Minimal fetch Response stand-in for tests. */
export function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

/** Error-envelope response matching the API's central error handler. */
export function errorResponse(status: number, message: string, code?: string, details?: unknown) {
  return jsonResponse(
    {
      error: {
        message,
        ...(code !== undefined ? { code } : {}),
        ...(details !== undefined ? { details } : {}),
      },
    },
    status,
  );
}

/** Quality summary with no findings — used by record mocks. */
export function cleanQuality(): QualitySummary {
  return { blockerCount: 0, warningCount: 0, infoCount: 0, blocking: false, codes: [] };
}

export function recordSummary(
  overrides: Partial<HeritageRecordSummary> = {},
): HeritageRecordSummary {
  return {
    id: 'record-1',
    slug: 'demo-record',
    title: 'Demo Record',
    summary: 'Demo summary',
    heritageType: 'folk_story',
    languages: ['Malayalam'],
    region: { country: 'India', state: 'Kerala' },
    tags: ['demo'],
    isFictionalSample: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function paginatedRecords(
  items: HeritageRecordSummary[],
  overrides: Partial<PaginatedResponse<HeritageRecordSummary>> = {},
): PaginatedResponse<HeritageRecordSummary> {
  return {
    items,
    page: 1,
    limit: 12,
    total: items.length,
    totalPages: items.length > 0 ? 1 : 0,
    ...overrides,
  };
}

export function publicRecord(overrides: Partial<HeritageRecordPublic> = {}): HeritageRecordPublic {
  return {
    ...recordSummary(),
    content: 'Demo content',
    contributors: [{ name: 'Demo Author (fictional)', role: 'contributor' }],
    sources: [
      {
        sourceType: 'oral_account',
        description: 'Fictional source description',
        collectedOn: '2026-01-15',
        context: 'Fictional context',
      },
    ],
    consent: {
      allowAttribution: true,
      allowRedistribution: false,
      verification: 'documented',
    },
    license: { rightsStatus: 'unknown' },
    provenance: { claimState: 'contributor_provided', attributionPreference: 'named' },
    ...overrides,
  };
}

export function authUser(overrides: Partial<AuthUserPublic> = {}): AuthUserPublic {
  return {
    id: 'user-1',
    email: 'contributor@example.com',
    displayName: 'Demo Contributor',
    role: 'contributor',
    accountStatus: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** Standard /auth/me, /auth/login, /auth/register response. */
export function sessionResponse(user: AuthUserPublic = authUser()) {
  return { user, csrfToken: 'test-csrf-token' };
}

export function contributorSummary(
  overrides: Partial<ContributorRecordSummary> = {},
): ContributorRecordSummary {
  return {
    id: 'record-1',
    slug: 'demo-draft',
    title: 'Demo Draft',
    summary: 'Demo summary',
    heritageType: 'folk_story',
    status: 'draft',
    visibility: 'private',
    languages: ['Malayalam'],
    isFictionalSample: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    quality: cleanQuality(),
    ...overrides,
  };
}

export function contributorDetail(
  overrides: Partial<ContributorRecordDetail> = {},
): ContributorRecordDetail {
  return {
    ...contributorSummary(),
    content: 'Once upon a time in a coastal village…',
    tags: ['village'],
    region: { country: 'India', state: 'Kerala' },
    contributors: [{ name: 'Storyteller', role: 'storyteller', isPublicAttribution: true }],
    sources: [
      {
        sourceType: 'oral_account',
        description: 'Told by the community elder',
        isPublic: true,
        isVerified: false,
      },
    ],
    consent: {
      permissionToPublish: false,
      allowAttribution: true,
      allowRedistribution: false,
      verification: 'unverified',
    },
    license: { rightsStatus: 'unknown' },
    provenance: {
      attributionPreference: 'named',
      permitAnonymity: false,
      reviewStatus: 'unreviewed',
    },
    provenanceHistory: [],
    variantDeclarations: [],
    qualityReport: {
      findings: [],
      blockerCount: 0,
      warningCount: 0,
      infoCount: 0,
      blocking: false,
      checkedAt: '2026-01-02T00:00:00.000Z',
    },
    ...overrides,
  };
}

export function moderationSummary(
  overrides: Partial<ModerationSubmissionSummary> = {},
): ModerationSubmissionSummary {
  return {
    id: 'record-1',
    slug: 'demo-submission',
    title: 'Demo Submission',
    heritageType: 'folk_story',
    status: 'pending_review',
    visibility: 'public',
    languages: ['Malayalam'],
    permissionToPublish: true,
    consentVerification: 'documented',
    rightsStatus: 'confirmed',
    hasRestrictions: false,
    isFictionalSample: false,
    submittedAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
    quality: cleanQuality(),
    ...overrides,
  };
}

export function moderationDetail(
  overrides: Partial<ModerationSubmissionDetail> = {},
): ModerationSubmissionDetail {
  return {
    ...contributorDetail({
      status: 'pending_review',
      visibility: 'public',
      consent: {
        permissionToPublish: true,
        allowAttribution: true,
        allowRedistribution: false,
        verification: 'documented',
      },
      license: { rightsStatus: 'confirmed' },
    }),
    createdBy: 'user-2',
    ...overrides,
  };
}

export function auditEvent(overrides: Partial<AuditEventPublic> = {}): AuditEventPublic {
  return {
    id: 'audit-1',
    action: 'record.approved',
    actorId: 'user-9',
    actorRole: 'moderator',
    recordId: 'record-1',
    metadata: { statusAfter: 'published' },
    createdAt: '2026-02-02T00:00:00.000Z',
    ...overrides,
  };
}

/** Generic paginated envelope for workflow list endpoints. */
export function paginatedItems<T>(
  items: T[],
  overrides: Partial<PaginatedResponse<T>> = {},
): PaginatedResponse<T> {
  return {
    items,
    page: 1,
    limit: 12,
    total: items.length,
    totalPages: items.length > 0 ? 1 : 0,
    ...overrides,
  };
}
