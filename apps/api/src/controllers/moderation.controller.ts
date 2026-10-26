import type { RequestHandler } from 'express';
import { getValidatedBody, getValidatedQuery } from '../middleware/validate.js';
import {
  approveSubmission,
  getQueuedSubmission,
  listReviewQueue,
  rejectSubmission,
  requestChanges,
} from '../services/moderation.service.js';
import { listAuditEvents } from '../services/audit.service.js';
import {
  objectIdParamSchema,
  type ModerationListQueryInput,
} from '../validation/heritageWrite.schema.js';
import { AppError } from '../utils/AppError.js';

/**
 * Moderator-only handlers. Role enforcement happens in the route via
 * `requireRole('moderator', 'admin')`; these handlers only perform the
 * workflow actions. Reasons for rejections and change requests are mandatory
 * (validated in the schema) so contributors always receive actionable
 * feedback.
 */

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

export const listQueueHandler: RequestHandler = async (req, res, next) => {
  try {
    const query = getValidatedQuery<ModerationListQueryInput>(res);
    res.json(await listReviewQueue({ page: query.page, limit: query.limit }));
  } catch (error) {
    next(error);
  }
};

export const getSubmissionHandler: RequestHandler = async (req, res, next) => {
  try {
    res.json(await getQueuedSubmission(parseRecordId(req.params.id ?? '')));
  } catch (error) {
    next(error);
  }
};

export const approveHandler: RequestHandler = async (req, res, next) => {
  try {
    const moderator = req.currentUser;
    if (moderator === undefined) {
      throw new AppError(401, 'Please sign in to continue', 'UNAUTHENTICATED');
    }
    res.json(await approveSubmission(moderator, parseRecordId(req.params.id ?? '')));
  } catch (error) {
    next(error);
  }
};

export const rejectHandler: RequestHandler = async (req, res, next) => {
  try {
    const moderator = req.currentUser;
    if (moderator === undefined) {
      throw new AppError(401, 'Please sign in to continue', 'UNAUTHENTICATED');
    }
    const { reason } = getValidatedBody<{ reason: string }>(res);
    res.json(await rejectSubmission(moderator, parseRecordId(req.params.id ?? ''), reason));
  } catch (error) {
    next(error);
  }
};

export const requestChangesHandler: RequestHandler = async (req, res, next) => {
  try {
    const moderator = req.currentUser;
    if (moderator === undefined) {
      throw new AppError(401, 'Please sign in to continue', 'UNAUTHENTICATED');
    }
    const { reason } = getValidatedBody<{ reason: string }>(res);
    res.json(await requestChanges(moderator, parseRecordId(req.params.id ?? ''), reason));
  } catch (error) {
    next(error);
  }
};

export const listAuditHandler: RequestHandler = async (req, res, next) => {
  try {
    const query = getValidatedQuery<ModerationListQueryInput>(res);
    res.json(await listAuditEvents({ page: query.page, limit: query.limit }));
  } catch (error) {
    next(error);
  }
};
