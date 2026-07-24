importScripts('./background-content-sync.js');

const SW_VERSION = 'encisomath-offline-v0.25.032';
const APP_CACHE = `${SW_VERSION}-app`;
const RUNTIME_CACHE = `${SW_VERSION}-runtime`;
const EXTERNAL_CACHE = `${SW_VERSION}-external`;
const MEDIA_CACHE = 'encisomath-media-v1';
const CONTENT_SYNC_TAG = 'encisomath-content-sync';
const CONTENT_PERIODIC_TAG = 'encisomath-content-periodic';
const OFFLINE_DB_NAME = 'encisomath-offline-v1';
const OFFLINE_KV_STORE = 'kv';
const CONTENT_CONFIG_KEY = 'background-content-config';
const CONTENT_STATUS_KEY = 'background-content-status';

const PRECACHE_URLS = [
  './',
  './index.html',
  './app.js',
  './styles.css',
  './supabase-config.js',
  './supabase-adapter.js',
  './offline-engine.js',
  './background-content-sync.js',
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
  './vendor/pdfjs/pdf-compat.mjs',
  './vendor/pdfjs/pdf.min.mjs',
  './vendor/pdfjs/pdf.worker.compat.mjs',
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
    const obsoleteCaches = keys.filter((name) => name.startsWith('encisomath-') && !keep.has(name));
    const hadPreviousVersion = obsoleteCaches.some((name) => name !== MEDIA_CACHE);
    const media = await caches.open(MEDIA_CACHE);
    // Conserva los PDFs e imágenes que el usuario ya abrió en versiones
    // anteriores antes de eliminar las cachés runtime versionadas.
    for (const key of obsoleteCaches) {
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

    // La recarga se ordena desde el propio Service Worker para alcanzar incluso
    // instalaciones que todavía ejecutan un app.js antiguo sin recarga automática.
    if (hadPreviousVersion) {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      await Promise.allSettled(windows.map(async (client) => {
        try { client.postMessage({ type: 'ENCISOMATH_UPDATE_ACTIVATED', version: SW_VERSION }); }
        catch (_) {}
        await new Promise((resolve) => setTimeout(resolve, 180));
        try {
          const target = new URL(client.url);
          target.searchParams.set('__em_update', SW_VERSION.replace('encisomath-offline-v', ''));
          await client.navigate(target.href);
        } catch (_) {}
      }));
    }
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
    const response = await fetch(new Request(request, { cache: 'no-store' }), { signal: controller.signal });
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
  const update = fetch(new Request(request, { cache: 'no-cache' })).then(async (response) => {
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



let offlineDbPromise = null;

function openOfflineDb() {
  if (offlineDbPromise) return offlineDbPromise;
  offlineDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DB_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('No se pudo abrir la copia offline.'));
    request.onblocked = () => reject(new Error('La copia offline está bloqueada.'));
  });
  return offlineDbPromise;
}

async function offlineKvGet(key) {
  const db = await openOfflineDb();
  if (!db.objectStoreNames.contains(OFFLINE_KV_STORE)) return null;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_KV_STORE, 'readonly');
    const request = tx.objectStore(OFFLINE_KV_STORE).get(key);
    request.onsuccess = () => resolve(request.result?.value ?? null);
    request.onerror = () => reject(request.error || new Error('No se pudo leer la configuración offline.'));
  });
}

async function offlineKvSet(key, value) {
  const db = await openOfflineDb();
  if (!db.objectStoreNames.contains(OFFLINE_KV_STORE)) return;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_KV_STORE, 'readwrite');
    tx.objectStore(OFFLINE_KV_STORE).put({ key, value, updatedAt: new Date().toISOString() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('No se pudo guardar la configuración offline.'));
    tx.onabort = () => reject(tx.error || new Error('Se canceló la configuración offline.'));
  });
}

function contentIndexKey(userId) {
  return `background-content-index:${String(userId || '')}`;
}

function contentPayloadKey(userId) {
  return `background-content-payload:${String(userId || '')}`;
}

async function notifyContentSyncClients(detail = {}) {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  windows.forEach((client) => {
    try { client.postMessage({ type: 'ENCISOMATH_CONTENT_SYNC_COMPLETE', ...detail }); } catch (_) {}
  });
}

function backgroundConnectionShouldWait() {
  const connection = self.navigator?.connection || self.navigator?.mozConnection || self.navigator?.webkitConnection;
  if (connection?.saveData) return true;
  return String(connection?.effectiveType || '').toLowerCase() === 'slow-2g';
}

async function hasReasonableStorageRoom() {
  try {
    const estimate = await self.navigator?.storage?.estimate?.();
    const quota = Number(estimate?.quota || 0);
    const usage = Number(estimate?.usage || 0);
    if (!quota) return true;
    return quota - usage >= 12 * 1024 * 1024;
  } catch (_) {
    return true;
  }
}

async function cacheNewContentUrl(url) {
  const href = String(url || '');
  if (!/^https?:\/\//i.test(href)) return { ok: true, existing: true };
  const cache = await caches.open(MEDIA_CACHE);
  const request = new Request(href, { method: 'GET', credentials: 'omit' });
  const existing = await cache.match(request, { ignoreSearch: false });
  if (existing) return { ok: true, existing: true };
  try {
    const response = await fetch(request);
    if (!response.ok && response.type !== 'opaque') return { ok: false, existing: false };
    await cache.put(request, response.clone());
    return { ok: true, existing: false };
  } catch (_) {
    return { ok: false, existing: false };
  }
}

async function processContentManifest(manifest, options = {}) {
  const config = options.config || await offlineKvGet(CONTENT_CONFIG_KEY);
  const userId = String(config?.userId || '');
  if (!config?.enabled || !userId || !manifest?.entries) {
    return { ok: false, reason: 'not-configured', changedCount: 0, downloadedCount: 0 };
  }

  const indexKey = contentIndexKey(userId);
  const previous = await offlineKvGet(indexKey);
  const currentEntries = manifest.entries && typeof manifest.entries === 'object' ? manifest.entries : {};
  if (!previous || options.baseline === true) {
    const baselineEntries = Object.fromEntries(Object.entries(currentEntries).map(([key, entry]) => [key, String(entry?.signature || '')]));
    const baseline = {
      version: Number(manifest.version || 1),
      studentCode: String(config.studentCode || ''),
      entries: baselineEntries,
      baselineAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await offlineKvSet(indexKey, baseline);
    const result = { ok: true, baseline: true, changedCount: 0, downloadedCount: 0, existingCount: 0, failedCount: 0 };
    await offlineKvSet(CONTENT_STATUS_KEY, { ...result, userId, completedAt: new Date().toISOString() });
    return result;
  }

  if (backgroundConnectionShouldWait() || !(await hasReasonableStorageRoom())) {
    const result = { ok: false, deferred: true, reason: 'device-conditions', changedCount: 0, downloadedCount: 0 };
    await offlineKvSet(CONTENT_STATUS_KEY, { ...result, userId, completedAt: new Date().toISOString() });
    return result;
  }

  const oldEntries = previous.entries && typeof previous.entries === 'object' ? previous.entries : {};
  const changed = Object.values(currentEntries).filter((entry) => String(oldEntries[entry.key] || '') !== String(entry.signature || ''));
  const removedKeys = Object.keys(oldEntries).filter((key) => !currentEntries[key]);
  const nextEntries = {};
  let downloadedCount = 0;
  let existingCount = 0;
  let failedCount = 0;
  let failedEntries = 0;

  for (const entry of Object.values(currentEntries)) {
    const signature = String(entry?.signature || '');
    const oldSignature = String(oldEntries[entry?.key] || '');
    if (oldSignature === signature) {
      nextEntries[entry.key] = signature;
      continue;
    }

    let entryOk = true;
    for (const url of Array.isArray(entry?.urls) ? entry.urls : []) {
      const cached = await cacheNewContentUrl(url);
      if (!cached.ok) {
        entryOk = false;
        failedCount += 1;
      } else if (cached.existing) {
        existingCount += 1;
      } else {
        downloadedCount += 1;
      }
    }
    if (entryOk) nextEntries[entry.key] = signature;
    else {
      failedEntries += 1;
      if (oldSignature) nextEntries[entry.key] = oldSignature;
    }
  }

  const index = {
    version: Number(manifest.version || 1),
    studentCode: String(config.studentCode || ''),
    entries: nextEntries,
    updatedAt: new Date().toISOString(),
    lastChangedCount: changed.length,
    lastDownloadedCount: downloadedCount
  };
  await offlineKvSet(indexKey, index);

  const allChangesReady = failedEntries === 0;
  if (options.portalPayload && allChangesReady && (changed.length || removedKeys.length)) {
    await offlineKvSet(contentPayloadKey(userId), {
      payload: options.portalPayload,
      studentCode: String(config.studentCode || ''),
      receivedAt: new Date().toISOString()
    });
  }

  const result = {
    ok: allChangesReady,
    baseline: false,
    changedCount: changed.length,
    removedCount: removedKeys.length,
    downloadedCount,
    existingCount,
    failedCount,
    failedEntries
  };
  await offlineKvSet(CONTENT_STATUS_KEY, { ...result, userId, completedAt: new Date().toISOString() });
  await notifyContentSyncClients(result);
  return result;
}

async function fetchStudentPortalPayload(config) {
  const baseUrl = String(config?.supabaseUrl || '').replace(/\/+$/, '');
  const key = String(config?.publishableKey || '');
  const studentCode = String(config?.studentCode || '');
  if (!baseUrl || !key || !studentCode) throw new Error('La descarga silenciosa no está configurada.');
  const response = await fetch(`${baseUrl}/rest/v1/rpc/encisomath_student_portal`, {
    method: 'POST',
    cache: 'no-store',
    credentials: 'omit',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-application-name': 'EncisoMath-LMS-Background'
    },
    body: JSON.stringify({ p_student_code: studentCode })
  });
  if (!response.ok) throw new Error(`Supabase respondió ${response.status}.`);
  const payload = await response.json();
  if (!payload || payload.ok === false) throw new Error(payload?.message || 'No se pudo consultar el contenido nuevo.');
  return payload;
}

async function runRemoteContentSync(options = {}) {
  const config = await offlineKvGet(CONTENT_CONFIG_KEY);
  if (!config?.enabled) return { ok: false, reason: 'not-configured', changedCount: 0, downloadedCount: 0 };
  try {
    const payload = await fetchStudentPortalPayload(config);
    const manifest = self.EncisoContentSync?.manifestFromPortalPayload?.(payload);
    if (!manifest) throw new Error('No se pudo construir el manifiesto de contenido.');
    return await processContentManifest(manifest, {
      config,
      baseline: options.baseline === true,
      portalPayload: payload
    });
  } catch (error) {
    const result = {
      ok: false,
      reason: 'network-or-server',
      error: String(error?.message || error || 'Error de descarga silenciosa'),
      changedCount: 0,
      downloadedCount: 0
    };
    await offlineKvSet(CONTENT_STATUS_KEY, {
      ...result,
      userId: String(config?.userId || ''),
      completedAt: new Date().toISOString()
    }).catch(() => {});
    return result;
  }
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
  if (event.data?.type === 'ENCISOMATH_CONTENT_MANIFEST' && event.data.manifest) {
    event.waitUntil(processContentManifest(event.data.manifest, { baseline: event.data.baseline === true })
      .then((result) => { try { event.ports?.[0]?.postMessage(result); } catch (_) {} }));
  }
  if (event.data?.type === 'ENCISOMATH_CONTENT_SYNC_NOW') {
    event.waitUntil(runRemoteContentSync({ baseline: event.data.baseline === true })
      .then((result) => { try { event.ports?.[0]?.postMessage(result); } catch (_) {} }));
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === CONTENT_SYNC_TAG) {
    event.waitUntil(runRemoteContentSync());
    return;
  }
  if (event.tag !== 'encisomath-sync') return;
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach((client) => client.postMessage({ type: 'ENCISOMATH_SYNC_REQUEST' }));
  })());
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag !== CONTENT_PERIODIC_TAG) return;
  event.waitUntil(runRemoteContentSync());
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
