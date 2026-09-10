/// <reference lib="webworker" />
import { build, files, version } from '$service-worker';
const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = 'barn-' + version;
const assets = [...build, ...files].filter((path) => !path.endsWith('.map'));
sw.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll([...build, '/']);
      // A missing replaceable menu or icon must not prevent the core shell installing.
      await Promise.allSettled(files.map((path) => cache.add(path)));
    })(),
  );
});
sw.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys())
        if (name.startsWith('barn-') && name !== CACHE) await caches.delete(name);
      await sw.clients.claim();
    })(),
  );
});
sw.addEventListener('fetch', (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (
    request.method !== 'GET' ||
    url.origin !== sw.location.origin ||
    url.pathname.startsWith('/api/')
  )
    return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      if (url.pathname.startsWith('/_app/immutable/')) {
        const hit = await cache.match(request);
        if (hit) return hit;
      }
      try {
        const response = await fetch(request);
        if (response.ok && (assets.includes(url.pathname) || request.mode === 'navigate'))
          await cache.put(request, response.clone());
        return response;
      } catch {
        const hit = await cache.match(request);
        if (hit) return hit;
        if (request.mode === 'navigate') {
          const shell = await cache.match('/');
          if (shell) return shell;
        }
        return new Response('This resource is unavailable offline.', { status: 503 });
      }
    })(),
  );
});
