import { Router } from 'express';
import type { Env } from '../config/env.js';
import { loadEnv } from '../config/env.js';
import { getPublicSitemap } from '../sitemap/generator.js';

function resolveBaseUrl(env?: Env): string {
  if (env !== undefined) return env.APP_BASE_URL;
  try {
    return loadEnv().APP_BASE_URL;
  } catch {
    return 'http://localhost:5173';
  }
}

export function createSitemapRoutes(env?: Env): Router {
  const router = Router();
  const appBaseUrl = resolveBaseUrl(env);

  router.get('/sitemap.xml', async (_req, res, next) => {
    try {
      const xml = await getPublicSitemap(appBaseUrl);
      res.set('Content-Type', 'application/xml; charset=utf-8');
      res.set('Cache-Control', 'public, max-age=600, stale-while-revalidate=3600');
      res.send(xml);
    } catch (err) {
      next(err);
    }
  });

  router.get('/robots.txt', (_req, res) => {
    const content = [
      'User-agent: *',
      'Allow: /',
      'Disallow: /dashboard',
      'Disallow: /moderation',
      'Disallow: /api/',
      `Sitemap: ${appBaseUrl.replace(/\/$/, '')}/sitemap.xml`,
      '',
    ].join('\n');
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(content);
  });

  return router;
}
