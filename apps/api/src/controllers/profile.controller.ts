import type { RequestHandler } from 'express';
import { getValidatedBody } from '../middleware/validate.js';
import { getPublicContributor, updateOwnProfile } from '../services/auth.service.js';
import { objectIdParamSchema } from '../validation/heritageWrite.schema.js';
import type { ProfileUpdateInput } from '../validation/auth.schema.js';
import { AppError } from '../utils/AppError.js';

/**
 * Profile handlers. Updates are restricted to the caller's own account and to
 * the fields permitted by the strict profile schema — role, account status,
 * and email are unreachable from these routes.
 */

export const updateProfileHandler: RequestHandler = async (req, res, next) => {
  try {
    const user = req.currentUser;
    if (user === undefined) {
      throw new AppError(401, 'Please sign in to continue', 'UNAUTHENTICATED');
    }
    const input = getValidatedBody<ProfileUpdateInput>(res);
    res.json(await updateOwnProfile(user.id, input));
  } catch (error) {
    next(error);
  }
};

/**
 * Public contributor profile. Unknown accounts and non-public-only profiles
 * share the same non-disclosing 404 shape as missing records.
 */
export const getPublicContributorHandler: RequestHandler = async (req, res, next) => {
  try {
    const parsed = objectIdParamSchema.safeParse(req.params.userId);
    if (!parsed.success) {
      throw new AppError(400, 'Invalid contributor id', 'VALIDATION_ERROR');
    }
    const contributor = await getPublicContributor(parsed.data);
    if (contributor === null) {
      throw new AppError(404, 'Contributor not found', 'NOT_FOUND');
    }
    res.json(contributor);
  } catch (error) {
    next(error);
  }
};
