import { HeritageRecordModel } from '../models/HeritageRecord.js';
import { PUBLIC_ELIGIBILITY_FILTER } from '../services/heritage.service.js';
import { TtlCache } from '../utils/ttlCache.js';

/** Cached sitemap; visibility changes clear it immediately. */
const sitemapCache = new TtlCache<string>(10 * 60 * 1000, 5);

export function invalidatePublicSitemapCache(): void {
  sitemapCache.clear();
}

/** Returns the cached sitemap for a base URL, generating it on a miss. */
export function getPublicSitemap(baseUrl: string): Promise<string> {
  return sitemapCache.getOrLoad(baseUrl, () => generatePublicSitemap(baseUrl));
}

export async function generatePublicSitemap(baseUrl: string): Promise<string> {
  const urls: string[] = [];

  // Static public routes
  const staticPaths = ['/', '/about', '/explore'];
  for (const p of staticPaths) {
    urls.push(createUrlEntry(baseUrl, p));
  }

  // Public heritage records
  const records = await HeritageRecordModel.find(PUBLIC_ELIGIBILITY_FILTER)
    .select('slug updatedAt')
    .maxTimeMS(10_000)
    .lean()
    .exec();

  for (const record of records) {
    if (record.slug) {
      urls.push(
        createUrlEntry(baseUrl, `/heritage/${record.slug}`, record.updatedAt?.toISOString()),
      );
    }
  }

  // Public profiles - only if they are public? Phase 4 has profiles; need to be careful
  // Exclude private profiles as per requirements

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;
  return xml;
}

function createUrlEntry(baseUrl: string, path: string, lastmod?: string): string {
  const loc = baseUrl.replace(/\/$/, '') + path;
  if (lastmod) {
    return `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${escapeXml(lastmod)}</lastmod>\n  </url>`;
  }
  return `  <url>\n    <loc>${escapeXml(loc)}</loc>\n  </url>`;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
