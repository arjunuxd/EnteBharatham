import type { AuthUserPublic } from '@entebharatham/shared';
import type { Request, RequestHandler } from 'express';
import { getValidatedBody, getValidatedQuery } from '../middleware/validate.js';
import {
  createDraft,
  deleteOwnRecord,
  getOwnRecord,
  listOwnRecords,
  submitForReview,
  updateDraft,
} from '../services/contribution.service.js';
import type { StorageAdapter } from '../services/storage/index.js';
import type {
  CreateHeritageDraftInput,
  ContributorListQueryInput,
  UpdateHeritageDraftInput,
} from '../validation/heritageWrite.schema.js';
import { objectIdParamSchema } from '../validation/heritageWrite.schema.js';
import { AppError } from '../utils/AppError.js';

/**
 * Contributor-side handlers. The authenticated user always comes from the
 * session (`req.currentUser`) — never from the body — and ownership is
 * enforced in the service/database layer.
 */

function requireUser(req: Request): AuthUserPublic {
  const user = req.currentUser;
  if (user === undefined) {
    throw new AppError(401, 'Please sign in to continue', 'UNAUTHENTICATED');
  }
  return user;
}

function parseRecordId(raw: string | string[] | undefined): string {
  if (typeof raw !== 'string') {
    throw new AppError(400, 'That item reference is not valid', 'VALIDATION_ERROR');
  }
  const parsed = objectIdParamSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError(400, 'That item reference is not valid', 'VALIDATION_ERROR');
  }
  return parsed.data;
}

export const createDraftHandler: RequestHandler = async (req, res, next) => {
  try {
    const input = getValidatedBody<CreateHeritageDraftInput>(res);
    res.status(201).json(await createDraft(requireUser(req), input));
  } catch (error) {
    next(error);
  }
};

export const updateDraftHandler: RequestHandler = async (req, res, next) => {
  try {
    const input = getValidatedBody<UpdateHeritageDraftInput>(res);
    const updated = await updateDraft(requireUser(req), parseRecordId(req.params.id ?? ''), input);
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

export const submitDraftHandler: RequestHandler = async (req, res, next) => {
  try {
    const submitted = await submitForReview(requireUser(req), parseRecordId(req.params.id ?? ''));
    res.json(submitted);
  } catch (error) {
    next(error);
  }
};

export const listOwnRecordsHandler: RequestHandler = async (req, res, next) => {
  try {
    const query = getValidatedQuery<ContributorListQueryInput>(res);
    res.json(
      await listOwnRecords(requireUser(req), {
        page: query.page,
        limit: query.limit,
        ...(query.status !== undefined ? { status: query.status } : {}),
      }),
    );
  } catch (error) {
    next(error);
  }
};

export const getOwnRecordHandler: RequestHandler = async (req, res, next) => {
  try {
    res.json(await getOwnRecord(requireUser(req), parseRecordId(req.params.id ?? '')));
  } catch (error) {
    next(error);
  }
};

/**
 * Deletes an owned record that is still in a private/unpublished state. The
 * service performs the ownership and lifecycle check atomically and removes
 * attached media; the response carries no body on success.
 */
export function createDeleteOwnRecordHandler(storage?: StorageAdapter): RequestHandler {
  return async (req, res, next) => {
    try {
      await deleteOwnRecord(requireUser(req), parseRecordId(req.params.id ?? ''), storage);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
