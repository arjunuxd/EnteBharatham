import { HERITAGE_TYPES } from '@entebharatham/shared';
import { describe, expect, it } from 'vitest';
import { heritageListQuerySchema, slugParamSchema } from '../src/validation/heritage.schema.js';

describe('heritageListQuerySchema', () => {
  it('applies pagination defaults', () => {
    const result = heritageListQuerySchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(12);
    expect(result.tags).toBeUndefined();
  });

  it('accepts a fully specified valid query', () => {
    const result = heritageListQuerySchema.parse({
      page: '2',
      limit: '24',
      heritageType: 'folk_story',
      language: 'Malayalam',
      region: 'Kerala',
      tags: 'demo, fictional',
      q: 'lantern',
    });
    expect(result.page).toBe(2);
    expect(result.limit).toBe(24);
    expect(result.tags).toEqual(['demo', 'fictional']);
  });

  it('coerces string pagination values', () => {
    expect(heritageListQuerySchema.parse({ page: '3', limit: '5' })).toMatchObject({
      page: 3,
      limit: 5,
    });
  });

  it('accepts every controlled heritage type', () => {
    for (const heritageType of HERITAGE_TYPES) {
      expect(heritageListQuerySchema.parse({ heritageType }).heritageType).toBe(heritageType);
    }
  });

  it('rejects an unknown heritage type', () => {
    expect(() => heritageListQuerySchema.parse({ heritageType: 'not-a-type' })).toThrow();
  });

  it('rejects a limit above the cap of 50', () => {
    expect(() => heritageListQuerySchema.parse({ limit: '51' })).toThrow();
    expect(() => heritageListQuerySchema.parse({ limit: '1000' })).toThrow();
  });

  it('rejects non-numeric and empty pagination values', () => {
    expect(() => heritageListQuerySchema.parse({ page: 'abc' })).toThrow();
    expect(() => heritageListQuerySchema.parse({ page: '0' })).toThrow();
    expect(() => heritageListQuerySchema.parse({ page: '' })).toThrow();
  });

  it('rejects unknown query parameters', () => {
    expect(() => heritageListQuerySchema.parse({ status: 'published' })).toThrow();
    expect(() => heritageListQuerySchema.parse({ visibility: 'public' })).toThrow();
  });

  it('rejects client attempts to supply operators in filters', () => {
    expect(() => heritageListQuerySchema.parse({ language: { $ne: null } })).toThrow();
    expect(() => heritageListQuerySchema.parse({ region: { $gt: '' } })).toThrow();
  });

  it('splits, trims, deduplicates, and caps tags', () => {
    const result = heritageListQuerySchema.parse({ tags: ' demo , demo , lamp ,, lamp , x , y ' });
    expect(result.tags).toEqual(['demo', 'lamp', 'x', 'y']);
  });

  it('rejects excessively long tags', () => {
    expect(() => heritageListQuerySchema.parse({ tags: 'x'.repeat(41) })).toThrow();
  });

  it('enforces search-length limits', () => {
    expect(() => heritageListQuerySchema.parse({ q: 'a' })).toThrow();
    expect(() => heritageListQuerySchema.parse({ q: 'x'.repeat(101) })).toThrow();
    expect(heritageListQuerySchema.parse({ q: 'ഗ്രാമം' }).q).toBe('ഗ്രാമം');
  });

  it('enforces language and region length limits', () => {
    expect(() => heritageListQuerySchema.parse({ language: 'a' })).toThrow();
    expect(() => heritageListQuerySchema.parse({ region: 'x'.repeat(65) })).toThrow();
  });
});

describe('slugParamSchema', () => {
  it('accepts a valid slug', () => {
    expect(slugParamSchema.parse('demo-fictional-lantern-of-willingtown')).toBe(
      'demo-fictional-lantern-of-willingtown',
    );
  });

  it('normalizes case and surrounding whitespace', () => {
    expect(slugParamSchema.parse('  Demo-Record  ')).toBe('demo-record');
  });

  it('rejects malformed slugs', () => {
    expect(() => slugParamSchema.parse('ab')).toThrow();
    expect(() => slugParamSchema.parse('has_underscore')).toThrow();
    expect(() => slugParamSchema.parse('double--hyphen')).toThrow();
    expect(() => slugParamSchema.parse('-leading-hyphen')).toThrow();
    expect(() => slugParamSchema.parse('trailing-hyphen-')).toThrow();
    expect(() => slugParamSchema.parse('space in slug')).toThrow();
    expect(() => slugParamSchema.parse('x'.repeat(121))).toThrow();
  });
});
