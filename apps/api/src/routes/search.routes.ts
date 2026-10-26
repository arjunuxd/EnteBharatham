import { Router } from 'express';
import {
  getSearchSuggestionsHandler,
  getDiscoveryFacetsHandler,
} from '../controllers/heritage.controller.js';
import type { RateLimiters } from '../middleware/rateLimit.js';

export function createSearchRoutes(limiters: Pick<RateLimiters, 'publicRead'>): Router {
  const router = Router();
  router.get('/suggestions', limiters.publicRead, getSearchSuggestionsHandler);
  router.get('/facets', limiters.publicRead, getDiscoveryFacetsHandler);
  return router;
}
