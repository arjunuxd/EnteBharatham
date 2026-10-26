import { z } from 'zod';

/**
 * Authentication and profile validation. All schemas are `.strict()`: unknown
 * keys (role, accountStatus, verification flags, password hashes) are
 * rejected with a validation error instead of being silently accepted —
 * mass assignment of privileged fields is impossible.
 */

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(5, 'Enter a valid email address')
  .max(254, 'Email must be at most 254 characters')
  .email('Enter a valid email address');

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters');

const displayNameSchema = z
  .string()
  .trim()
  .min(1, 'Display name is required')
  .max(80, 'Display name must be at most 80 characters');

export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    displayName: displayNameSchema,
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required').max(128),
  })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Permitted profile updates only. Role, account status, email, password
 * hashes, and verification flags are deliberately absent — sending them is a
 * 400, not a silent ignore.
 */
export const profileUpdateSchema = z
  .object({
    displayName: displayNameSchema.optional(),
    bio: z.string().trim().max(1000, 'Biography must be at most 1000 characters').optional(),
    attributionName: z
      .string()
      .trim()
      .max(120, 'Preferred attribution name must be at most 120 characters')
      .optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  });

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
