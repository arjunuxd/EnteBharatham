import { z } from 'zod';

/** Query schema for GET /api/v1/health. */
export const healthQuerySchema = z.object({
  verbose: z.enum(['0', '1']).optional().default('0'),
});

export type HealthQuery = z.infer<typeof healthQuerySchema>;
