import { Router } from 'express';
import {
  approveHandler,
  getSubmissionHandler,
  listAuditHandler,
  listQueueHandler,
  rejectHandler,
  requestChangesHandler,
} from '../controllers/moderation.controller.js';
import {
  addSubmissionFeedbackHandler,
  getSubmissionFeedbackHandler,
  getSubmissionQualityHandler,
  resolveFeedbackHandler,
  reviewProvenanceHandler,
} from '../controllers/phase6.controller.js';
import { requireRole } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import type { RateLimiters } from '../middleware/rateLimit.js';
import {
  feedbackCreateSchema,
  moderationListQuerySchema,
  provenanceReviewSchema,
  rejectSubmissionSchema,
  requestChangesSchema,
} from '../validation/heritageWrite.schema.js';

/**
 * Moderator-only routes. Every route is guarded by
 * `requireRole('moderator', 'admin')` — the role comes from the session's
 * user, loaded from the database, never from the request itself. Moderation
 * decisions also share one rate limiter so bulk automated actions are capped.
 */
export function createModerationRoutes(limiters: Pick<RateLimiters, 'moderationActions'>): Router {
  const router = Router();
  const moderatorOnly = requireRole('moderator', 'admin');

  router.get(
    '/submissions',
    moderatorOnly,
    validateQuery(moderationListQuerySchema),
    listQueueHandler,
  );
  router.get('/submissions/:id', moderatorOnly, getSubmissionHandler);
  router.post(
    '/submissions/:id/approve',
    moderatorOnly,
    limiters.moderationActions,
    approveHandler,
  );
  router.post(
    '/submissions/:id/reject',
    moderatorOnly,
    limiters.moderationActions,
    validateBody(rejectSubmissionSchema),
    rejectHandler,
  );
  router.post(
    '/submissions/:id/request-changes',
    moderatorOnly,
    limiters.moderationActions,
    validateBody(requestChangesSchema),
    requestChangesHandler,
  );

  // Phase 6 — quality report, structured feedback, and provenance review.
  router.get('/submissions/:id/quality', moderatorOnly, getSubmissionQualityHandler);
  router.get('/submissions/:id/feedback', moderatorOnly, getSubmissionFeedbackHandler);
  router.post(
    '/submissions/:id/feedback',
    moderatorOnly,
    limiters.moderationActions,
    validateBody(feedbackCreateSchema),
    addSubmissionFeedbackHandler,
  );
  router.post(
    '/submissions/:id/feedback/:feedbackId/resolve',
    moderatorOnly,
    limiters.moderationActions,
    resolveFeedbackHandler,
  );
  router.patch(
    '/submissions/:id/provenance',
    moderatorOnly,
    limiters.moderationActions,
    validateBody(provenanceReviewSchema),
    reviewProvenanceHandler,
  );

  router.get('/audit', moderatorOnly, validateQuery(moderationListQuerySchema), listAuditHandler);

  return router;
}
