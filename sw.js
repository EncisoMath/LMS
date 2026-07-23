const SW_VERSION = 'encisomath-offline-v0.25.023';
const APP_CACHE = `${SW_VERSION}-app`;
const RUNTIME_CACHE = `${SW_VERSION}-runtime`;
const EXTERNAL_CACHE = `${SW_VERSION}-external`;
const MEDIA_CACHE = 'encisomath-media-v1';

const PRECACHE_URLS = [
  './',
  './index.html',
  './app.js',
  './styles.css',
  './supabase-config.js',
  './supabase-adapter.js',
  './offline-engine.js',
  './manifest.webmanifest',
  './assets/default-avatar.svg',
  './assets/default-profile.svg',
  './assets/app-icon-192.png',
  './assets/app-icon-512.png',
  './assets/apple-touch-icon-180.png',
  './assets/notification-icon-96.png',
  './assets/subject-statistics.svg',
  './assets/warn-exp1.png',
  './assets/warn-exp2.png',
  './assets/templates/educacity-planilla-base.xlsx',
  './assets/sounds/correct.mp3',
  './assets/sounds/item.mp3',
  './assets/sounds/type.mp3',
  './assets/sounds/wrong.mp3',
  './assets/music_quiz/20_1.mp3',
  './assets/music_quiz/20_2.mp3',
  './assets/music_quiz/20_3.mp3',
  './assets/music_quiz/30_1.mp3',
  './assets/music_quiz/30_2.mp3',
  './assets/music_quiz/30_3.mp3',
  './assets/music_quiz/60_1.mp3',
  './assets/music_quiz/60_2.mp3',
  './assets/music_quiz/90_1.mp3',
  './assets/music_quiz/90_2.mp3',
  './assets/music_quiz/120_1.mp3',
  './assets/music_quiz/120_2.mp3',
  './assets/music_quiz/results.mp3',
  './data/assignments.json',
  './data/classes.json',
  './data/quizzes.json',
  './data/rockstars.json',
  './data/students.json',
  './data/users.json',
  './vendor/pdfjs/pdf.min.mjs',
  './vendor/pdfjs/pdf.worker.min.mjs'
];

const EXTERNAL_SCRIPT_HOSTS = new Set([
  'cdn.jsdelivr.net',
  'unpkg.com'
]);

const EXTERNAL_BOOTSTRAP_URLS = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/dist/umd/supabase.js',
  'https://unpkg.com/@supabase/supabase-js@2.49.1/dist/umd/supabase.js',
  'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js',
  'https://unpkg.com/exceljs@4.4.0/dist/exceljs.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_CACHE);
    const external = await caches.open(EXTERNAL_CACHE);
    await Promise.allSettled(PRECACHE_URLS.map(async (url) => {
      const request = new Request(url, { cache: 'reload' });
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response);
    }));
    await Promise.allSettled(EXTERNAL_BOOTSTRAP_URLS.map(async (url) => {
      const request = new Request(url, { mode: 'no-cors', credentials: 'omit', cache: 'reload' });
      const response = await fetch(request);
      if (response.ok || response.type === 'opaque') await external.put(request, response);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([APP_CACHE, RUNTIME_CACHE, EXTERNAL_CACHE, MEDIA_CACHE]);
    const keys = await caches.keys();
    const media = await caches.open(MEDIA_CACHE);
    // Conserva los PDFs e imágenes que el usuario ya abrió en versiones
    // anteriores antes de eliminar las cachés runtime versionadas.
    for (const key of keys.filter((name) => name.startsWith('encisomath-') && !keep.has(name))) {
      try {
        const oldCache = await caches.open(key);
        const requests = await oldCache.keys();
        for (const request of requests) {
          const url = new URL(request.url);
          if (!isSupabaseStorageGet(url) || await media.match(request)) continue;
          const response = await oldCache.match(request);
          if (response) await media.put(request, response);
        }
      } catch (_) {}
      await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

function isSupabaseApiRequest(url) {
  if (!url.hostname.endsWith('.supabase.co')) return false;
  return url.pathname.includes('/rest/v1/')
    || url.pathname.includes('/auth/v1/')
    || url.pathname.includes('/functions/v1/')
    || url.pathname.includes('/realtime/v1/');
}

function isSupabaseStorageGet(url) {
  return url.hostname.endsWith('.supabase.co')
    && url.pathname.includes('/storage/v1/object/');
}

async function cacheMatchIgnoringSearch(cacheName, request) {
  const cache = await caches.open(cacheName);
  return cache.match(request, { ignoreSearch: true });
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(APP_CACHE);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timeout);
    if (response.ok) await cache.put('./index.html', response.clone());
    return response;
  } catch (_) {
    clearTimeout(timeout);
    return (await cache.match('./index.html', { ignoreSearch: true }))
      || (await cache.match('./', { ignoreSearch: true }))
      || new Response('<!doctype html><meta charset="utf-8"><title>EncisoMath offline</title><body style="font-family:system-ui;background:#000;color:#fff;padding:24px"><h1>EncisoMath</h1><p>La copia offline todavía no está preparada. Abre la aplicación una vez con internet.</p></body>', {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
  }
}

async function staleWhileRevalidate(request) {
  const cached = await cacheMatchIgnoringSearch(APP_CACHE, request)
    || await cacheMatchIgnoringSearch(RUNTIME_CACHE, request);
  const update = fetch(request).then(async (response) => {
    if (response.ok) {
      const runtime = await caches.open(RUNTIME_CACHE);
      await runtime.put(request, response.clone());
    }
    return response;
  }).catch(() => null);
  return cached || await update || new Response('', { status: 503, statusText: 'Sin conexión' });
}

async function externalCacheFirst(request, cacheName = EXTERNAL_CACHE) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreSearch: false });
  if (cached) return cached;
  try {
    const response = await fetch(request);
    await cache.put(request, response.clone());
    return response;
  } catch (_) {
    return new Response('', { status: 503, statusText: 'Recurso externo no disponible' });
  }
}


function mediaBaseRequest(request) {
  return new Request(request.url, { method: 'GET', credentials: 'omit' });
}

async function rangedResponseFromFull(response, rangeHeader) {
  const buffer = await response.clone().arrayBuffer();
  const size = buffer.byteLength;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(String(rangeHeader || '').trim());
  if (!match || !size) return response;
  let start = match[1] ? Number(match[1]) : 0;
  let end = match[2] ? Number(match[2]) : size - 1;
  if (!match[1] && match[2]) {
    const suffix = Math.max(0, Number(match[2]) || 0);
    start = Math.max(0, size - suffix);
    end = size - 1;
  }
  start = Math.max(0, Math.min(start, size - 1));
  end = Math.max(start, Math.min(end, size - 1));
  const headers = new Headers(response.headers);
  headers.delete('Content-Encoding');
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  headers.set('Content-Length', String(end - start + 1));
  return new Response(buffer.slice(start, end + 1), { status: 206, statusText: 'Partial Content', headers });
}

async function mediaCacheFirst(request) {
  const cache = await caches.open(MEDIA_CACHE);
  const baseRequest = mediaBaseRequest(request);
  let response = await cache.match(baseRequest, { ignoreSearch: false });
  if (!response) {
    try {
      const network = await fetch(baseRequest);
      if (!network.ok) return network;
      response = network.clone();
      await cache.put(baseRequest, network.clone());
    } catch (_) {
      return new Response('', { status: 503, statusText: 'Archivo no disponible sin conexión' });
    }
  }
  const range = request.headers.get('range');
  if (!range) return response;
  try { return await rangedResponseFromFull(response, range); }
  catch (_) { return response; }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (isSupabaseApiRequest(url)) {
    event.respondWith(fetch(request));
    return;
  }

  if (isSupabaseStorageGet(url)) {
    event.respondWith(mediaCacheFirst(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (EXTERNAL_SCRIPT_HOSTS.has(url.hostname)) {
    event.respondWith(externalCacheFirst(request));
    return;
  }

  if (url.protocol === 'https:' || url.protocol === 'http:') {
    event.respondWith(externalCacheFirst(request));
  }
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'CACHE_URLS' && Array.isArray(event.data.urls)) {
    event.waitUntil((async () => {
      const cache = await caches.open(MEDIA_CACHE);
      await Promise.allSettled(event.data.urls.map(async (url) => {
        const target = new URL(url, self.location.href);
        const request = new Request(target.href, { credentials: 'omit' });
        if (await cache.match(request)) return;
        let response;
        try { response = await fetch(request); }
        catch (_) { response = await fetch(new Request(target.href, { mode: 'no-cors', credentials: 'omit' })); }
        if (response.ok || response.type === 'opaque') await cache.put(request, response);
      }));
    })());
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag !== 'encisomath-sync') return;
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach((client) => client.postMessage({ type: 'ENCISOMATH_SYNC_REQUEST' }));
  })());
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
      icon: './assets/app-icon-192.png',
      badge: './assets/notification-icon-96.png',
      tag: data.tag || 'encisomath'
    })
  );
});
