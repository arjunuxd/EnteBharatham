import { createHash } from 'node:crypto';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { loadEnv, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const PUBLIC_PRECACHE = [
  '/',
  '/offline.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
];

function buildServiceWorker(precacheUrls: string[], version: string): string {
  return `/* EnteBharatham service worker — generated at build time. */
const CACHE_NAME = 'entebharatham-${version}';
const APP_SHELL_URL = '/';
const OFFLINE_URL = '/offline.html';
const PRECACHE_URLS = ${JSON.stringify(precacheUrls, null, 2)};

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            const response = await fetch(new Request(url, { cache: 'reload' }));
            if (response.ok) await cache.put(url, response);
          } catch {
            // A single unavailable public file must not block the whole install.
          }
        }),
      );
      if (self.registration.active === null) await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(APP_SHELL_URL, response.clone());
          }
          return response;
        } catch {
          return (
            (await caches.match(APP_SHELL_URL)) ||
            (await caches.match('/index.html')) ||
            (await caches.match(OFFLINE_URL)) ||
            Response.error()
          );
        }
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached !== undefined) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }
        return response;
      } catch {
        return Response.error();
      }
    })(),
  );
});
`;
}

/**
 * Emits a production service worker whose precache list is derived from the
 * actual build output. No extra dependency or manual revision list is needed.
 */
function serviceWorkerPlugin(): Plugin {
  return {
    name: 'entebharatham-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const bundleAssets = Object.keys(bundle)
        .filter((fileName) => fileName !== 'sw.js')
        .map((fileName) => `/${fileName}`);
      const precacheUrls = [...new Set([...PUBLIC_PRECACHE, ...bundleAssets])].sort();
      const version = createHash('sha256')
        .update(precacheUrls.join('|'))
        .digest('hex')
        .slice(0, 12);

      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: buildServiceWorker(precacheUrls, version),
      });
    },
  };
}

/** Extracts an origin for the CSP `connect-src` directive. */
function apiOrigin(apiBaseUrl: string): string {
  try {
    return new URL(apiBaseUrl).origin;
  } catch {
    return 'http://localhost:4000';
  }
}

/**
 * Injects a Content-Security-Policy meta tag into the production HTML shell.
 * Development is left untouched so Vite's HMR client (inline scripts and a
 * websocket) keeps working; the hosting layer sends the authoritative header
 * in production (see vercel.json).
 */
function contentSecurityPolicyPlugin(apiBaseUrl: string): Plugin {
  const connectSources = new Set(["'self'", apiOrigin(apiBaseUrl)]);
  const policy = [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "form-action 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "media-src 'self' https: blob:",
    `connect-src ${[...connectSources].join(' ')}`,
    "manifest-src 'self'",
    "worker-src 'self'",
  ].join('; ');

  return {
    name: 'entebharatham-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '</head>',
        `    <meta http-equiv="Content-Security-Policy" content="${policy}" />\n  </head>`,
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiBaseUrl = env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';

  return {
    plugins: [
      react(),
      tailwindcss(),
      serviceWorkerPlugin(),
      contentSecurityPolicyPlugin(apiBaseUrl),
    ],
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      globals: false,
    },
  };
});
