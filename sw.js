const SW_VERSION = 'encisomath-no-cache-v0.2.0';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith((async () => {
    try {
      const request = new Request(event.request, { cache: 'no-store' });
      return await fetch(request);
    } catch (error) {
      if (event.request.mode === 'navigate') {
        return new Response(`<!doctype html><meta charset="utf-8"><title>Sin conexión</title><body style="font-family:system-ui;padding:24px"><h1>EncisoMath</h1><p>No hay conexión. Esta PWA está configurada para no cachear, así los cambios publicados se reflejan sin reinstalar.</p></body>`, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }
      return new Response('', { status: 503, statusText: 'Sin conexión y sin caché' });
    }
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { title: 'EncisoMath', body: 'Tienes una notificación.' };
  event.waitUntil(
    self.registration.showNotification(data.title || 'EncisoMath', {
      body: data.body || 'Tienes una notificación.',
      icon: './assets/icon-192.png',
      badge: './assets/icon-192.png',
      tag: data.tag || 'encisomath'
    })
  );
});
