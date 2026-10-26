import { describe, expect, it } from 'vitest';
import { buildHeritageListPath, formatRegion, heritageTypeLabel } from './heritage';

describe('heritageTypeLabel', () => {
  it('maps controlled values to human-readable labels', () => {
    expect(heritageTypeLabel('folk_story')).toBe('Folk stories & oral narratives');
    expect(heritageTypeLabel('proverb')).toBe('Proverbs & sayings');
  });
});

describe('formatRegion', () => {
  it('joins available region parts in locality-to-country order', () => {
    expect(formatRegion({ country: 'India', state: 'Kerala', district: 'Ernakulam' })).toBe(
      'Ernakulam, Kerala, India',
    );
    expect(formatRegion({ country: 'India' })).toBe('India');
  });
});

describe('buildHeritageListPath', () => {
  it('always includes page and limit', () => {
    expect(buildHeritageListPath({ page: 1, limit: 12 })).toBe('/heritage?page=1&limit=12');
  });

  it('includes only provided filters', () => {
    const path = buildHeritageListPath({
      page: 2,
      limit: 12,
      heritageType: 'song',
      language: 'Malayalam',
      tags: ['demo', 'song'],
      q: 'lamp',
    });
    expect(path).toContain('page=2');
    expect(path).toContain('heritageType=song');
    expect(path).toContain('language=Malayalam');
    expect(path).toContain('tags=demo%2Csong');
    expect(path).toContain('q=lamp');
  });
});
