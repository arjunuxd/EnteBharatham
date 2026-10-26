import type { RequestHandler } from 'express';
import { getValidatedQuery } from '../middleware/validate.js';
import {
  getPublicHeritageBySlug,
  listPublicHeritage,
  getRelatedHeritage,
  getSearchSuggestions,
  getDiscoveryFacets,
} from '../services/heritage.service.js';
import { AppError } from '../utils/AppError.js';
import {
  slugParamSchema,
  toHeritageListQuery,
  type HeritageListQueryInput,
} from '../validation/heritage.schema.js';
import { z } from 'zod';

export const listHeritageHandler: RequestHandler = async (req, res) => {
  const input = getValidatedQuery<HeritageListQueryInput>(res);
  // `no-cache` allows conditional revalidation (Express adds an ETag) while
  // guaranteeing a withdrawn record is never served from a browser cache.
  res.set('Cache-Control', 'public, no-cache');
  res.json(await listPublicHeritage(toHeritageListQuery(input)));
};

export const getHeritageBySlugHandler: RequestHandler = async (req, res) => {
  const parsedSlug = slugParamSchema.safeParse(req.params.slug);
  if (!parsedSlug.success) {
    throw new AppError(400, 'That link is not valid', 'VALIDATION_ERROR');
  }

  const record = await getPublicHeritageBySlug(parsedSlug.data);
  if (record === null) {
    // Identical response for missing, restricted, and unpublished records so
    // the API never discloses that a non-public record exists.
    throw new AppError(404, 'Heritage record not found', 'NOT_FOUND');
  }

  res.set('Cache-Control', 'public, no-cache');
  res.json(record);
};

export const getRelatedHeritageHandler: RequestHandler = async (req, res) => {
  const parsedSlug = slugParamSchema.safeParse(req.params.slug);
  if (!parsedSlug.success) {
    throw new AppError(400, 'That link is not valid', 'VALIDATION_ERROR');
  }
  const limitSchema = z.coerce.number().int().min(1).max(10).optional();
  const limitResult = limitSchema.safeParse(req.query.limit);
  const limit = limitResult.success ? limitResult.data : undefined;

  const related = await getRelatedHeritage('', parsedSlug.data, { limit });
  res.set('Cache-Control', 'public, no-cache');
  res.json({ items: related });
};

export const getSearchSuggestionsHandler: RequestHandler = async (req, res) => {
  const qSchema = z.string().trim().min(2).max(100);
  const result = qSchema.safeParse(req.query.q);
  if (!result.success) {
    res.json({ titles: [], tags: [], regions: [], languages: [] });
    return;
  }
  const limitSchema = z.coerce.number().int().min(1).max(10).optional();
  const limitResult = limitSchema.safeParse(req.query.limit);
  const suggestions = await getSearchSuggestions(result.data, {
    limit: limitResult.success ? limitResult.data : undefined,
  });
  res.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=300');
  res.json(suggestions);
};

export const getDiscoveryFacetsHandler: RequestHandler = async (_req, res) => {
  const facets = await getDiscoveryFacets();
  // Counts are aggregate-only and safe to cache at the edge/browser briefly.
  res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
  res.json(facets);
};
