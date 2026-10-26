import { HERITAGE_TYPES, type HeritageListQuery } from '@entebharatham/shared';
import { z } from 'zod';
import { zodEnum } from './zodEnum.js';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Slug path parameter: trimmed, lowercased, then validated. Malformed
 * identifiers are rejected with 400 rather than silently searched.
 */
export const slugParamSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Slug must be at least 3 characters')
  .max(120, 'Slug must be at most 120 characters')
  .regex(slugPattern, 'Slug must be lowercase letters, digits, and single hyphens');

/**
 * Query schema for GET /api/v1/heritage. `.strict()` rejects unknown
 * parameters. Page size is capped at 50 (content-heavy records; lower than
 * the generic pagination cap of 100) to bound response sizes.
 */
export const heritageListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
    heritageType: zodEnum(HERITAGE_TYPES).optional(),
    language: z.string().trim().min(2).max(64).optional(),
    region: z.string().trim().min(2).max(64).optional(),
    tags: z
      .string()
      .trim()
      .max(200)
      .optional()
      .transform((value) =>
        value === undefined
          ? undefined
          : [
              ...new Set(
                value
                  .split(',')
                  .map((tag) => tag.trim())
                  .filter((tag) => tag.length > 0),
              ),
            ].slice(0, 5),
      )
      .refine((tags) => tags === undefined || tags.every((tag) => tag.length <= 40), {
        message: 'Each tag must be at most 40 characters',
      }),
    q: z.string().trim().min(2, 'Search text must be at least 2 characters').max(100).optional(),
    sort: z.enum(['relevance', 'newest', 'title']).optional(),
    community: z.string().trim().min(2).max(200).optional(),
    translationLanguage: z.string().trim().min(2).max(64).optional(),
  })
  .strict();

export type HeritageListQueryInput = z.infer<typeof heritageListQuerySchema>;

/** Parsed query in the shape the service layer consumes. */
export function toHeritageListQuery(input: HeritageListQueryInput): HeritageListQuery {
  return {
    page: input.page,
    limit: input.limit,
    heritageType: input.heritageType,
    language: input.language,
    region: input.region,
    tags: input.tags,
    q: input.q,
    sort: input.sort,
    community: input.community,
    translationLanguage: input.translationLanguage,
  };
}
