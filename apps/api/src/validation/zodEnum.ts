import { z } from 'zod';

/**
 * Converts a readonly const tuple (from `@entebharatham/shared`) into a Zod
 * enum. Zod 3 requires a mutable tuple type, hence the cast — the values
 * themselves stay the single source of truth in `@entebharatham/shared`.
 */
export function zodEnum<T extends readonly [string, ...string[]]>(values: T) {
  return z.enum(values as unknown as [T[number], ...T[number][]]);
}
