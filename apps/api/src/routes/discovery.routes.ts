import { Router } from 'express';
import { z } from 'zod';
import { getDiscoveryFacetsHandler } from '../controllers/heritage.controller.js';
import type { RateLimiters } from '../middleware/rateLimit.js';
import { getDiscoveryFacets, getRelatedHeritage } from '../services/heritage.service.js';
import { AppError } from '../utils/AppError.js';
import { slugParamSchema } from '../validation/heritage.schema.js';

export function createDiscoveryRoutes(limiters: Pick<RateLimiters, 'publicRead'>): Router {
  const router = Router();

  router.get('/regions', limiters.publicRead, async (_req, res) => {
    const facets = await getDiscoveryFacets();
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.json({ regions: facets.regions });
  });

  router.get('/languages', limiters.publicRead, async (_req, res) => {
    const facets = await getDiscoveryFacets();
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.json({ languages: facets.languages });
  });

  router.get('/facets', limiters.publicRead, getDiscoveryFacetsHandler);

  router.get('/related/:slug', limiters.publicRead, async (req, res) => {
    const parsedSlug = slugParamSchema.safeParse(req.params.slug);
    if (!parsedSlug.success) {
      throw new AppError(400, 'That link is not valid', 'VALIDATION_ERROR');
    }
    const limitSchema = z.coerce.number().int().min(1).max(10).optional();
    const limitResult = limitSchema.safeParse(req.query.limit);
    const related = await getRelatedHeritage('', parsedSlug.data, {
      limit: limitResult.success ? limitResult.data : undefined,
    });
    res.set('Cache-Control', 'public, no-cache');
    res.json({ items: related });
  });

  return router;
}
