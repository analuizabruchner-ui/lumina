import { createHash } from 'node:crypto';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const base = process.env.GITHUB_ACTIONS === 'true' ? '/lumina/' : '/';

function offlinePrecache(appBase: string): Plugin {
  return {
    name: 'nox-offline-precache',
    apply: 'build',
    generateBundle(_options, bundle) {
      const assets = Object.keys(bundle)
        .filter((file) => file.endsWith('.html') || /^assets\/.*\.(js|css)$/.test(file))
        .map((file) => `${appBase}${file}`);
      const publicAssets = [
        'manifest.webmanifest',
        'logo.svg',
        'wordmark.svg',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/icon-maskable-512.png',
        'icons/apple-touch-icon.png',
        'fonts/Geist-Regular.ttf',
        'fonts/Geist-Medium.ttf',
        'fonts/Geist-SemiBold.ttf',
      ].map((asset) => `${appBase}${asset}`);
      const precache = [...new Set([appBase, `${appBase}index.html`, ...assets, ...publicAssets])];
      const precacheJson = JSON.stringify(precache);
      const sourceTemplate = `
const BASE = '__BASE__';
const CACHE_PREFIX = 'nox-lumina-precache-';
const CACHE = CACHE_PREFIX + '__REVISION__';
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (request.mode === 'navigate') {
      return (await cache.match(BASE + 'index.html')) || fetch(request).catch(() => Response.error());
    }

    const cached = await cache.match(url.pathname);
    if (cached) return cached;

    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  })());
});
`;
      const revision = createHash('sha256')
        .update(sourceTemplate)
        .update(appBase)
        .update(precacheJson)
        .digest('hex')
        .slice(0, 12);
      const source = sourceTemplate
        .replace('__BASE__', appBase)
        .replace('__REVISION__', revision)
        .replace('__PRECACHE__', precacheJson);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  base,
  plugins: [react(), offlinePrecache(base)],
  server: {
    watch: {
      ignored: ['**/public/fonts/**'],
    },
  },
});
