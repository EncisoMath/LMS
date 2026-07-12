const SW_VERSION = 'encisomath-no-cache-v0.24.324';

self.addEventListener('install', () => {
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

  const requestUrl = new URL(event.request.url);

  // Los recursos externos deben pasar directamente por el navegador.
  // Reconstruir respuestas opacas de CDN puede vaciar scripts como supabase.js.
  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith((async () => {
    try {
      return await fetch(new Request(event.request, { cache: 'reload' }));
    } catch (error) {
      if (event.request.mode === 'navigate') {
        return new Response(`<!doctype html><meta charset="utf-8"><title>Sin conexión</title><body style="font-family:system-ui;padding:24px;background:#02050a;color:#fff"><h1>EncisoMath</h1><p>No hay conexión. Conéctate a internet y vuelve a intentarlo.</p></body>`, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }
      return new Response('', { status: 503, statusText: 'Sin conexión' });
    }
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('push', (event) => {
  let data = { title: 'EncisoMath', body: 'Tienes una notificación.' };
  try {
    if (event.data) data = event.data.json();
  } catch (_) {
    if (event.data) data.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'EncisoMath', {
      body: data.body || 'Tienes una notificación.',
      icon: './assets/icon-192.png',
      badge: './assets/icon-192.png',
      tag: data.tag || 'encisomath'
    })
  );
});
