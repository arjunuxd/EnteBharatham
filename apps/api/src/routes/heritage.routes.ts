import { Router } from 'express';
import {
  createDeleteOwnRecordHandler,
  createDraftHandler,
  getOwnRecordHandler,
  listOwnRecordsHandler,
  submitDraftHandler,
  updateDraftHandler,
} from '../controllers/contribution.controller.js';
import {
  addOwnFeedbackHandler,
  declareVariantHandler,
  getOwnDuplicatesHandler,
  getOwnFeedbackHandler,
  getOwnQualityHandler,
  updateOwnProvenanceHandler,
} from '../controllers/phase6.controller.js';
import {
  getHeritageBySlugHandler,
  listHeritageHandler,
  getRelatedHeritageHandler,
  getSearchSuggestionsHandler,
  getDiscoveryFacetsHandler,
} from '../controllers/heritage.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import type { RateLimiters } from '../middleware/rateLimit.js';
import {
  contributorListQuerySchema,
  createHeritageDraftSchema,
  feedbackCreateSchema,
  provenanceUpdateSchema,
  updateHeritageDraftSchema,
  variantDeclarationSchema,
} from '../validation/heritageWrite.schema.js';
import { heritageListQuerySchema } from '../validation/heritage.schema.js';
import type { StorageAdapter } from '../services/storage/index.js';

/**
 * Heritage routes: public read endpoints plus the authenticated contributor
 * workflow (draft create/edit, submit).
 *
 * Ordering matters: `/mine` is registered before `/:slug` so an anonymous
 * request for the literal slug "mine" cannot shadow the owner's list route,
 * and so `/mine/:id` is matched ahead of the slug handler.
 */
export function createHeritageRoutes(
  limiters: Pick<RateLimiters, 'publicRead' | 'createDraft' | 'submitForReview'>,
  storage?: StorageAdapter,
): Router {
  const router = Router();

  // Owner routes (authenticated; ownership enforced in the service layer).
  router.get(
    '/mine',
    requireAuth,
    validateQuery(contributorListQuerySchema),
    listOwnRecordsHandler,
  );
  router.get('/mine/:id', requireAuth, getOwnRecordHandler);
  router.post(
    '/',
    requireAuth,
    limiters.createDraft,
    validateBody(createHeritageDraftSchema),
    createDraftHandler,
  );
  router.patch('/:id', requireAuth, validateBody(updateHeritageDraftSchema), updateDraftHandler);
  router.post('/:id/submit', requireAuth, limiters.submitForReview, submitDraftHandler);
  router.delete('/:id', requireAuth, createDeleteOwnRecordHandler(storage));

  // Phase 6 owner routes: quality, duplicates, provenance, and the review
  // feedback thread. All of them are scoped to the caller's own record.
  router.get('/mine/:id/quality', requireAuth, getOwnQualityHandler);
  router.get('/mine/:id/duplicates', requireAuth, getOwnDuplicatesHandler);
  router.get('/mine/:id/feedback', requireAuth, getOwnFeedbackHandler);
  router.post(
    '/mine/:id/feedback',
    requireAuth,
    validateBody(feedbackCreateSchema),
    addOwnFeedbackHandler,
  );
  router.patch(
    '/mine/:id/provenance',
    requireAuth,
    validateBody(provenanceUpdateSchema),
    updateOwnProvenanceHandler,
  );
  router.post(
    '/mine/:id/variants',
    requireAuth,
    validateBody(variantDeclarationSchema),
    declareVariantHandler,
  );

  // Public routes (Phase 5 additions)
  router.get('/search/suggestions', limiters.publicRead, getSearchSuggestionsHandler);
  router.get('/facets', limiters.publicRead, getDiscoveryFacetsHandler);

  // Public routes (Phase 2).
  router.get('/', limiters.publicRead, validateQuery(heritageListQuerySchema), listHeritageHandler);
  router.get('/:slug/related', limiters.publicRead, getRelatedHeritageHandler);
  router.get('/:slug', limiters.publicRead, getHeritageBySlugHandler);

  return router;
}
