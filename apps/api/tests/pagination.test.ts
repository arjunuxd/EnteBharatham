import { describe, expect, it } from 'vitest';
import { paginationQuerySchema } from '../src/validation/pagination.schema.js';

describe('paginationQuerySchema', () => {
  it('applies defaults', () => {
    const result = paginationQuerySchema.parse({});
    expect(result).toEqual({ page: 1, limit: 20 });
  });

  it('coerces string query values to numbers', () => {
    const result = paginationQuerySchema.parse({ page: '3', limit: '50' });
    expect(result).toEqual({ page: 3, limit: 50 });
  });

  it('rejects a limit above the cap', () => {
    expect(() => paginationQuerySchema.parse({ limit: '500' })).toThrow();
  });

  it('rejects a page below 1', () => {
    expect(() => paginationQuerySchema.parse({ page: '0' })).toThrow();
  });

  it('rejects non-numeric values', () => {
    expect(() => paginationQuerySchema.parse({ page: 'abc' })).toThrow();
  });
});
