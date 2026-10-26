import { z } from 'zod';

/**
 * Canonical pagination schema for future list endpoints.
 * Limits are capped to prevent unbounded queries.
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQueryInput = z.infer<typeof paginationQuerySchema>;
