import type { AuthUserPublic } from '@entebharatham/shared';
import type { Request, RequestHandler } from 'express';
import { getValidatedBody } from '../middleware/validate.js';
import { findOwnedDuplicateCandidates } from '../services/duplicate.service.js';
import { addFeedback, listFeedback, resolveFeedback } from '../services/feedback.service.js';
import {
  declareVariant,
  reviewProvenance,
  updateProvenance,
} from '../services/provenance.service.js';
import { getModerationQualityReport, getOwnedQualityReport } from '../services/quality.service.js';
import {
  objectIdParamSchema,
  type FeedbackCreateInput,
  type ProvenanceReviewInput,
  type ProvenanceUpdateInput,
  type VariantDeclarationInput,
} from '../validation/heritageWrite.schema.js';
import { AppError } from '../utils/AppError.js';

/**
 * Phase 6 handlers: deterministic quality checks, duplicate assistance,
 * provenance management, and structured review feedback.
 *
 * The authenticated user always comes from the session (`req.currentUser`),
 * never from the body. Ownership is enforced in the service layer, so one
 * contributor can never read or change another contributor's record.
 */

function requireUser(req: Request): AuthUserPublic {
  const user = req.currentUser;
  if (user === undefined) {
    throw new AppError(401, 'Please sign in to continue', 'UNAUTHENTICATED');
  }
  return user;
}

function parseId(raw: string | string[] | undefined, label = 'record id'): string {
  if (typeof raw !== 'string') {
    throw new AppError(400, `Invalid ${label}`, 'VALIDATION_ERROR');
  }
  const parsed = objectIdParamSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError(400, `Invalid ${label}`, 'VALIDATION_ERROR');
  }
  return parsed.data;
}

/* --- Quality ------------------------------------------------------------ */

/** GET /api/v1/heritage/mine/:id/quality */
export const getOwnQualityHandler: RequestHandler = async (req, res, next) => {
  try {
    const report = await getOwnedQualityReport(requireUser(req), parseId(req.params.id));
    res.json({ quality: report });
  } catch (error) {
    next(error);
  }
};

/** GET /api/v1/moderation/submissions/:id/quality */
export const getSubmissionQualityHandler: RequestHandler = async (req, res, next) => {
  try {
    const report = await getModerationQualityReport(parseId(req.params.id));
    res.json({ quality: report });
  } catch (error) {
    next(error);
  }
};

/* --- Duplicates --------------------------------------------------------- */

/** GET /api/v1/heritage/mine/:id/duplicates */
export const getOwnDuplicatesHandler: RequestHandler = async (req, res, next) => {
  try {
    const result = await findOwnedDuplicateCandidates(requireUser(req), parseId(req.params.id));
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/* --- Provenance --------------------------------------------------------- */

/** PATCH /api/v1/heritage/mine/:id/provenance */
export const updateOwnProvenanceHandler: RequestHandler = async (req, res, next) => {
  try {
    const input = getValidatedBody<ProvenanceUpdateInput>(res);
    const updated = await updateProvenance(requireUser(req), parseId(req.params.id), input);
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

/** PATCH /api/v1/moderation/submissions/:id/provenance */
export const reviewProvenanceHandler: RequestHandler = async (req, res, next) => {
  try {
    const input = getValidatedBody<ProvenanceReviewInput>(res);
    const updated = await reviewProvenance(requireUser(req), parseId(req.params.id), input);
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

/** POST /api/v1/heritage/mine/:id/variants */
export const declareVariantHandler: RequestHandler = async (req, res, next) => {
  try {
    const input = getValidatedBody<VariantDeclarationInput>(res);
    const updated = await declareVariant(
      requireUser(req),
      parseId(req.params.id),
      input.relatedRecordId,
      input.note,
    );
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

/* --- Review feedback ---------------------------------------------------- */

/** GET /api/v1/heritage/mine/:id/feedback */
export const getOwnFeedbackHandler: RequestHandler = async (req, res, next) => {
  try {
    res.json(await listFeedback(requireUser(req), parseId(req.params.id)));
  } catch (error) {
    next(error);
  }
};

/** POST /api/v1/heritage/mine/:id/feedback */
export const addOwnFeedbackHandler: RequestHandler = async (req, res, next) => {
  try {
    const input = getValidatedBody<FeedbackCreateInput>(res);
    const thread = await addFeedback(requireUser(req), parseId(req.params.id), input);
    res.status(201).json(thread);
  } catch (error) {
    next(error);
  }
};

/** GET /api/v1/moderation/submissions/:id/feedback */
export const getSubmissionFeedbackHandler: RequestHandler = async (req, res, next) => {
  try {
    res.json(await listFeedback(requireUser(req), parseId(req.params.id)));
  } catch (error) {
    next(error);
  }
};

/** POST /api/v1/moderation/submissions/:id/feedback */
export const addSubmissionFeedbackHandler: RequestHandler = async (req, res, next) => {
  try {
    const input = getValidatedBody<FeedbackCreateInput>(res);
    const thread = await addFeedback(requireUser(req), parseId(req.params.id), input);
    res.status(201).json(thread);
  } catch (error) {
    next(error);
  }
};

/** POST /api/v1/moderation/submissions/:id/feedback/:feedbackId/resolve */
export const resolveFeedbackHandler: RequestHandler = async (req, res, next) => {
  try {
    const thread = await resolveFeedback(
      requireUser(req),
      parseId(req.params.feedbackId, 'feedback id'),
    );
    res.json(thread);
  } catch (error) {
    next(error);
  }
};
