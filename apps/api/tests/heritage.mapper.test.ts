import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import type { HeritageRecordFields } from '../src/models/HeritageRecord.js';
import { toPublicDto, toSummaryDto } from '../src/services/heritage.mapper.js';

const INTERNAL_MARKERS = [
  'INTERNAL-SEED-NOTE',
  'INTERNAL-SEED-BASIS',
  'INTERNAL-SEED-LICENSE-NOTE',
  'INTERNAL-RESTRICTED-NOTE',
];

function buildRecord(overrides: Partial<HeritageRecordFields> = {}): HeritageRecordFields {
  return {
    _id: new Types.ObjectId(),
    slug: 'demo-record',
    title: 'Demo Record',
    summary: 'Demo summary',
    content: 'Demo content',
    heritageType: 'folk_story',
    languages: ['Malayalam', 'English'],
    region: { country: 'India', state: 'Kerala' },
    communityName: 'Fictional community',
    contributors: [
      { name: 'Public Contributor', role: 'storyteller', isPublicAttribution: true },
      { name: 'Hidden Contributor', role: 'recorder', isPublicAttribution: false },
    ],
    sources: [
      {
        sourceType: 'oral_account',
        description: 'Fictional source description',
        collectedOn: '2026-01-15',
        context: 'Fictional context',
        notes: 'INTERNAL-SEED-NOTE: internal source note',
      },
    ],
    tags: ['demo'],
    status: 'published',
    visibility: 'public',
    consent: {
      permissionToPublish: true,
      allowAttribution: true,
      allowRedistribution: false,
      restrictions: 'Demo restriction note',
      basis: 'INTERNAL-SEED-BASIS: internal consent basis',
      verification: 'documented',
    },
    license: {
      rightsStatus: 'unknown',
      notes: 'INTERNAL-SEED-LICENSE-NOTE: internal license note',
    },
    isFictionalSample: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  };
}

describe('toSummaryDto', () => {
  it('maps the public summary fields', () => {
    const dto = toSummaryDto(buildRecord());
    expect(dto).toEqual({
      id: expect.any(String),
      slug: 'demo-record',
      title: 'Demo Record',
      summary: 'Demo summary',
      heritageType: 'folk_story',
      languages: ['Malayalam', 'English'],
      region: { country: 'India', state: 'Kerala' },
      communityName: 'Fictional community',
      tags: ['demo'],
      isFictionalSample: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
  });

  it('never exposes internal fields or Mongoose internals', () => {
    const serialized = JSON.stringify(toSummaryDto(buildRecord()));
    expect(serialized).not.toContain('_id');
    expect(serialized).not.toContain('__v');
    expect(serialized).not.toContain('content');
    expect(serialized).not.toContain('consent');
    expect(serialized).not.toContain('sources');
    for (const marker of INTERNAL_MARKERS) {
      expect(serialized).not.toContain(marker);
    }
  });

  it('omits empty optional strings', () => {
    const dto = toSummaryDto(buildRecord({ summary: '', communityName: undefined }));
    expect(dto.summary).toBeUndefined();
    expect(dto.communityName).toBeUndefined();
    expect('summary' in JSON.parse(JSON.stringify(dto))).toBe(false);
  });
});

describe('toPublicDto', () => {
  it('includes public content, public contributors, and public sources', () => {
    const dto = toPublicDto(buildRecord());
    expect(dto.content).toBe('Demo content');
    expect(dto.contributors).toEqual([{ name: 'Public Contributor', role: 'storyteller' }]);
    expect(dto.sources).toEqual([
      {
        sourceType: 'oral_account',
        description: 'Fictional source description',
        collectedOn: '2026-01-15',
        context: 'Fictional context',
      },
    ]);
    expect(dto.consent).toEqual({
      allowAttribution: true,
      allowRedistribution: false,
      verification: 'documented',
      restrictions: 'Demo restriction note',
    });
    expect(dto.license).toEqual({ rightsStatus: 'unknown' });
  });

  it('excludes internal notes, consent basis, and non-public contributors', () => {
    const serialized = JSON.stringify(toPublicDto(buildRecord()));
    expect(serialized).not.toContain('Hidden Contributor');
    expect(serialized).not.toContain('isPublicAttribution');
    expect(serialized).not.toContain('"notes"');
    expect(serialized).not.toContain('basis');
    expect(serialized).not.toContain('_id');
    for (const marker of INTERNAL_MARKERS) {
      expect(serialized).not.toContain(marker);
    }
  });

  it('preserves Unicode content verbatim', () => {
    const malayalam = 'വിളക്കൂരിലെ വിളക്കുകഥ';
    const dto = toPublicDto(buildRecord({ title: malayalam, content: malayalam }));
    expect(dto.title).toBe(malayalam);
    expect(dto.content).toBe(malayalam);
    expect(JSON.parse(JSON.stringify(dto)).title).toBe(malayalam);
  });
});
