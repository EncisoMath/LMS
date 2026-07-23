(() => {
  'use strict';

  const OFFLINE_VERSION = '0.25.022';
  const DB_NAME = 'encisomath-offline-v1';
  const DB_VERSION = 4;
  const STORES = Object.freeze({
    kv: 'kv',
    mutations: 'mutations',
    blobs: 'blobs',
    gradebooks: 'gradebooks'
  });
  const STATIC_EXTERNAL_URLS = [
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/dist/umd/supabase.js',
    'https://unpkg.com/@supabase/supabase-js@2.49.1/dist/umd/supabase.js',
    'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js',
    'https://unpkg.com/exceljs@4.4.0/dist/exceljs.min.js'
  ];

  const cloud = window.EncisoSupabase;
  if (!cloud) return;

  let dbPromise = null;
  let activeUserId = '';
  let activeSnapshot = null;
  let syncPromise = null;
  let prefetchPromise = null;
  let statusUpdateTimer = null;
  const objectUrls = new Map();

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORES.kv)) {
          db.createObjectStore(STORES.kv, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORES.mutations)) {
          const store = db.createObjectStore(STORES.mutations, { keyPath: 'id' });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('userId', 'userId', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.blobs)) {
          const store = db.createObjectStore(STORES.blobs, { keyPath: 'key' });
          store.createIndex('sourceUrl', 'sourceUrl', { unique: false });
          store.createIndex('lastAccessed', 'lastAccessed', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.gradebooks)) {
          const store = db.createObjectStore(STORES.gradebooks, { keyPath: 'key' });
          store.createIndex('userId', 'userId', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('No se pudo abrir IndexedDB.'));
      request.onblocked = () => reject(new Error('IndexedDB está bloqueada por otra pestaña.'));
    });
    return dbPromise;
  }

  async function withStore(storeName, mode, operation) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      let result;
      try {
        result = operation(store, tx);
      } catch (error) {
        reject(error);
        return;
      }
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error || new Error(`Falló la operación local en ${storeName}.`));
      tx.onabort = () => reject(tx.error || new Error(`Se canceló la operación local en ${storeName}.`));
    });
  }

  async function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Falló una consulta local.'));
    });
  }

  async function kvGet(key) {
    const db = await openDb();
    const tx = db.transaction(STORES.kv, 'readonly');
    const row = await requestResult(tx.objectStore(STORES.kv).get(key));
    return row?.value;
  }

  async function kvSet(key, value) {
    return withStore(STORES.kv, 'readwrite', (store) => {
      store.put({ key, value, updatedAt: new Date().toISOString() });
    });
  }

  async function kvDelete(key) {
    return withStore(STORES.kv, 'readwrite', (store) => store.delete(key));
  }

  function safeClone(value) {
    if (typeof structuredClone === 'function') {
      try { return structuredClone(value); } catch (_) {}
    }
    return JSON.parse(JSON.stringify(value));
  }

  function uuid() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    const bytes = new Uint8Array(16);
    globalThis.crypto?.getRandomValues?.(bytes);
    if (!bytes.some(Boolean)) {
      for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0'));
    return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function isOnline() {
    return navigator.onLine !== false;
  }

  function isNetworkError(error) {
    const message = String(error?.message || error || '').toLowerCase();
    return navigator.onLine === false
      || message.includes('failed to fetch')
      || message.includes('network')
      || message.includes('load failed')
      || message.includes('fetch')
      || message.includes('offline')
      || message.includes('timeout')
      || message.includes('connection');
  }

  function isAuthSessionError(error) {
    const code = String(error?.code || '').toUpperCase();
    const status = Number(error?.status || error?.statusCode || 0);
    const message = String(error?.message || error || '').toLowerCase();
    return code === 'AUTH_SESSION_REQUIRED'
      || status === 401
      || message.includes('auth session missing')
      || message.includes('invalid jwt')
      || message.includes('jwt expired')
      || message.includes('refresh token')
      || message.includes('session expired')
      || message.includes('sesión de supabase')
      || message.includes('sesion de supabase')
      || message.includes('no hay una sesión activa')
      || message.includes('no hay una sesion activa');
  }


  function escapeMarkup(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function offlineData() {
    return activeSnapshot?.data || {};
  }

  function offlineStudentByCode(code) {
    const safeCode = String(code || '');
    return (offlineData().students || []).find((student) => String(student.id || student.studentCode || student.code || '') === safeCode) || null;
  }

  function offlineStudentName(code) {
    const student = offlineStudentByCode(code);
    if (!student) return safeMutationText(code, 'Estudiante');
    const firstName = String(student.firstName || student.name || '').trim();
    const lastName = String(student.lastName || student.surname || '').trim();
    return [lastName, firstName].filter(Boolean).join(', ') || safeMutationText(code, 'Estudiante');
  }

  function safeMutationText(value, fallback = '') {
    const text = String(value || '').trim();
    return text && !text.startsWith('offline-') ? text : fallback;
  }

  function offlineActivityTitle(activityId, payload = {}) {
    const id = String(activityId || payload.activityId || payload.requestedActivityId || '');
    const activity = (offlineData().activities || []).find((item) => String(item.id || '') === id);
    return safeMutationText(payload.title || activity?.title, 'Actividad');
  }

  function offlineLessonTitle(lessonId, payload = {}) {
    const id = String(lessonId || payload.lessonId || payload.requestedLessonId || '');
    const lesson = (offlineData().classes || []).find((item) => String(item.id || '') === id);
    return safeMutationText(payload.title || lesson?.title, 'Clase');
  }

  function offlineQuizTitle(payload = {}) {
    const quiz = payload.quiz || (payload.quizzes || [])[0] || {};
    const id = String(quiz.id || payload.quizId || '');
    const stored = (offlineData().quizzes || []).find((item) => String(item.id || '') === id);
    return safeMutationText(quiz.title || stored?.title, 'Quiz');
  }

  function attendanceStatusLabel(status) {
    return ({ present: 'Asistió', absent: 'No asistió', excused: 'Excusa', excuse: 'Excusa', late: 'Llegó tarde', '': 'Sin estado' })[String(status || '')] || String(status || 'Sin estado');
  }

  function formatPendingTime(value) {
    const date = new Date(value || '');
    if (Number.isNaN(date.getTime())) return 'Hora no disponible';
    return date.toLocaleString('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: 'numeric', minute: '2-digit'
    });
  }

  function mutationStatusLabel(status) {
    return ({ pending: 'Pendiente', retry: 'Reintento pendiente', syncing: 'Sincronizando', 'auth-required': 'Reintento automático', conflict: 'Descartado' })[String(status || '')] || 'Pendiente';
  }

  function mutationPresentation(mutation) {
    const payload = mutation?.payload || {};
    const event = payload.event || {};
    let title = 'Cambio pendiente';
    let detail = 'Esperando sincronización con Supabase.';
    let icon = '↻';

    switch (mutation?.type) {
      case 'saveAttendanceStatus':
        title = 'Asistencia';
        detail = `${offlineStudentName(payload.studentCode)} · ${attendanceStatusLabel(payload.status)} · ${safeMutationText(payload.attendanceDate, 'Fecha pendiente')}`;
        icon = '✓';
        break;
      case 'addRockstarEvent': {
        const delta = Number(event.delta ?? payload.delta ?? 0);
        title = 'Puntos Rockstar';
        detail = `${offlineStudentName(event.studentId || payload.studentId)} · ${delta >= 0 ? '+' : ''}${delta} punto${Math.abs(delta) === 1 ? '' : 's'}`;
        icon = '★';
        break;
      }
      case 'createStudentAndEnroll':
        title = 'Nuevo estudiante';
        detail = `${[payload.lastName, payload.firstName].filter(Boolean).join(', ') || 'Estudiante'} · Código ${safeMutationText(payload.studentCode, 'sin código')}`;
        icon = '+';
        break;
      case 'updateStudent':
        title = 'Edición de estudiante';
        detail = `${[payload.lastName, payload.firstName].filter(Boolean).join(', ') || 'Estudiante'} · @${safeMutationText(payload.username, 'usuario pendiente')}`;
        icon = '✎';
        break;
      case 'withdrawStudent':
        title = 'Retiro de estudiante';
        detail = `${offlineStudentName(payload.studentCode)} · Código ${safeMutationText(payload.studentCode, 'sin código')}`;
        icon = '−';
        break;
      case 'saveQuizzes':
        title = 'Quizzes';
        detail = `${(payload.quizzes || []).length || 1} quiz${(payload.quizzes || []).length === 1 ? '' : 'zes'} por guardar`;
        icon = '?';
        break;
      case 'savePreferences':
        title = 'Configuración de la app';
        detail = 'Preferencias, periodos o configuración de NOTAS.';
        icon = '⚙';
        break;
      case 'uploadAssignmentImage':
        title = 'Imagen de asignatura';
        detail = `Archivo pendiente para ${safeMutationText(payload.type, 'la asignatura')}.`;
        icon = '▧';
        break;
      case 'resetAssignmentImage':
        title = 'Restablecer imagen';
        detail = 'Cambio de imagen de asignatura pendiente.';
        icon = '↺';
        break;
      case 'createPdfLesson':
        title = 'Nueva clase';
        detail = offlineLessonTitle(payload.lessonId, payload);
        icon = '▤';
        break;
      case 'updatePdfLesson':
        title = 'Editar clase';
        detail = offlineLessonTitle(payload.lessonId, payload);
        icon = '✎';
        break;
      case 'reorderLessons':
        title = 'Orden de clases';
        detail = `${(payload.lessonIds || []).length} clase${(payload.lessonIds || []).length === 1 ? '' : 's'} por ordenar`;
        icon = '↕';
        break;
      case 'deletePdfLesson':
        title = 'Eliminar clase';
        detail = offlineLessonTitle(payload.lessonId, payload);
        icon = '×';
        break;
      case 'createActivity':
        title = 'Nueva actividad';
        detail = offlineActivityTitle(payload.activityId, payload);
        icon = '＋';
        break;
      case 'updateActivity':
        title = 'Editar actividad';
        detail = offlineActivityTitle(payload.activityId, payload);
        icon = '✎';
        break;
      case 'reorderActivities':
        title = 'Orden de actividades';
        detail = `${(payload.activityIds || []).length} actividad${(payload.activityIds || []).length === 1 ? '' : 'es'} por ordenar`;
        icon = '↕';
        break;
      case 'deleteActivity':
        title = 'Eliminar actividad';
        detail = offlineActivityTitle(payload.activityId, payload);
        icon = '×';
        break;
      case 'saveActivityGrades': {
        const codes = [...new Set([payload.primaryStudentCode, ...(payload.selectedStudentCodes || [])].filter(Boolean))];
        const names = codes.slice(0, 3).map(offlineStudentName).join(' · ');
        title = 'Calificación de actividad';
        detail = `${offlineActivityTitle(payload.activityId, payload)} · ${names || `${codes.length || 1} estudiante(s)`}${codes.length > 3 ? ` · +${codes.length - 3} más` : ''}`;
        icon = '#';
        break;
      }
      case 'recordLessonView':
        title = 'Visualización de clase';
        detail = offlineLessonTitle(payload.lessonId, payload);
        icon = '◉';
        break;
      case 'submitQuizAttemptBundle':
        title = 'Intento de quiz';
        detail = offlineQuizTitle(payload);
        icon = '?';
        break;
      default:
        title = String(mutation?.type || 'Cambio pendiente');
        detail = 'Operación local todavía no enviada a Supabase.';
    }

    return {
      title,
      detail,
      icon,
      time: formatPendingTime(mutation?.createdAt),
      status: mutationStatusLabel(mutation?.status),
      statusClass: `is-${String(mutation?.status || 'pending').replace(/[^a-z0-9_-]/gi, '')}`,
      attempts: Number(mutation?.attempts || 0),
      error: String(mutation?.lastError || '').trim(),
      technicalType: String(mutation?.type || '')
    };
  }

  function pendingMutationListHTML(rows = []) {
    if (!rows.length) return '<p class="em-sync-empty">No hay cambios pendientes.</p>';
    return rows.map((mutation) => {
      const item = mutationPresentation(mutation);
      return `
        <article class="em-sync-pending-item ${escapeMarkup(item.statusClass)}">
          <span class="em-sync-pending-icon" aria-hidden="true">${escapeMarkup(item.icon)}</span>
          <div class="em-sync-pending-copy">
            <div class="em-sync-pending-title"><strong>${escapeMarkup(item.title)}</strong><span>${escapeMarkup(item.status)}</span></div>
            <p>${escapeMarkup(item.detail)}</p>
            <small>${escapeMarkup(item.time)}${item.attempts ? ` · ${item.attempts} intento${item.attempts === 1 ? '' : 's'}` : ''}</small>
            ${item.error ? `<em>${escapeMarkup(item.error)}</em>` : ''}
            <code>${escapeMarkup(item.technicalType)}</code>
          </div>
        </article>
      `;
    }).join('');
  }

  function hashString(input) {
    let hash = 2166136261;
    const text = String(input || '');
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function snapshotKey(userId = activeUserId) {
    return `snapshot:${userId || 'anonymous'}`;
  }

  function sessionKey() {
    return 'last-session';
  }

  function ensureOfflineMeta(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return snapshot;
    snapshot._offline = snapshot._offline && typeof snapshot._offline === 'object' ? snapshot._offline : {};
    snapshot._offline.version = OFFLINE_VERSION;
    snapshot._offline.cachedAt = snapshot._offline.cachedAt || nowIso();
    snapshot._offline.serverSyncedAt = snapshot._offline.serverSyncedAt || snapshot._offline.cachedAt;
    return snapshot;
  }

  function stripObjectUrls(value) {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(stripObjectUrls);
    const output = {};
    Object.entries(value).forEach(([key, item]) => {
      if (typeof item === 'string' && item.startsWith('blob:')) {
        output[key] = value.sourceUrl || '';
      } else {
        output[key] = stripObjectUrls(item);
      }
    });
    return output;
  }

  async function saveSnapshot(snapshot, options = {}) {
    if (!snapshot?.user) return;
    const userId = String(snapshot.user.authId || snapshot.user.id || activeUserId || '');
    if (!userId) return;
    activeUserId = userId;
    const safe = ensureOfflineMeta(safeClone(snapshot));
    safe._offline.cachedAt = nowIso();
    if (options.serverSyncedAt) safe._offline.serverSyncedAt = options.serverSyncedAt;
    const stored = stripObjectUrls(safe);
    await kvSet(snapshotKey(userId), stored);
    await kvSet('last-user-id', userId);
    activeSnapshot = safe;
  }

  async function loadSnapshot(userId = activeUserId) {
    const resolved = String(userId || await kvGet('last-user-id') || '');
    if (!resolved) return null;
    activeUserId = resolved;
    const snapshot = await kvGet(snapshotKey(resolved));
    if (!snapshot) return null;
    activeSnapshot = ensureOfflineMeta(snapshot);
    return activeSnapshot;
  }

  async function rememberSession(session) {
    if (!session?.user?.id) return;
    activeUserId = String(session.user.id);
    if (session.encisomathStudentPortal) {
      // El acceso estudiantil no debe sobrescribir ni borrar la sesión docente
      // persistente que puede seguir activa en este mismo dispositivo.
      await kvSet('last-user-id', activeUserId);
      return;
    }
    await kvSet(sessionKey(), {
      user: {
        id: session.user.id,
        email: session.user.email || '',
        role: session.user.role || 'authenticated',
        app_metadata: session.user.app_metadata || {},
        user_metadata: session.user.user_metadata || {}
      },
      access_token: session.access_token || '',
      refresh_token: session.refresh_token || '',
      expires_at: session.expires_at || 0,
      token_type: session.token_type || 'bearer',
      encisomathStudentPortal: Boolean(session.encisomathStudentPortal),
      encisomathRemember: session.encisomathRemember !== false,
      studentCode: session.studentCode || '',
      offline: true,
      cachedAt: nowIso()
    });
    await kvSet('last-user-id', activeUserId);
  }

  async function cachedSession() {
    const stored = await kvGet(sessionKey());
    if (!stored?.user?.id) return null;
    activeUserId = String(stored.user.id);
    return stored;
  }

  async function getServerNow() {
    try {
      const result = await cloud.getClient().rpc('encisomath_server_now');
      if (!result.error && result.data) return String(result.data);
    } catch (_) {}
    return nowIso();
  }

  async function blobGet(key) {
    const db = await openDb();
    const tx = db.transaction(STORES.blobs, 'readonly');
    return requestResult(tx.objectStore(STORES.blobs).get(key));
  }

  async function blobByUrl(url) {
    if (!url) return null;
    const db = await openDb();
    const tx = db.transaction(STORES.blobs, 'readonly');
    const index = tx.objectStore(STORES.blobs).index('sourceUrl');
    const rows = await requestResult(index.getAll(String(url)));
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  }

  async function blobPut({ key, blob, sourceUrl = '', name = '', type = '', kind = 'file' }) {
    if (!key || !(blob instanceof Blob)) return null;
    const row = {
      key,
      blob,
      sourceUrl: String(sourceUrl || ''),
      name: name || 'archivo',
      type: type || blob.type || '',
      size: Number(blob.size || 0),
      kind,
      updatedAt: nowIso(),
      lastAccessed: nowIso()
    };
    await withStore(STORES.blobs, 'readwrite', (store) => store.put(row));
    return row;
  }

  async function objectUrlForBlobRow(row) {
    if (!row?.key || !(row.blob instanceof Blob)) return '';
    if (objectUrls.has(row.key)) return objectUrls.get(row.key);
    const url = URL.createObjectURL(row.blob);
    objectUrls.set(row.key, url);
    return url;
  }

  async function objectUrlForKey(key) {
    return objectUrlForBlobRow(await blobGet(key));
  }

  async function descriptorFromFile(file, key, kind = 'file') {
    if (!(file instanceof Blob)) return null;
    await blobPut({ key, blob: file, name: file.name || 'archivo', type: file.type || '', kind });
    return {
      name: file.name || 'archivo',
      type: file.type || '',
      size: Number(file.size || 0),
      path: '',
      url: await objectUrlForKey(key),
      sourceUrl: '',
      offlineKey: key,
      pendingUpload: true
    };
  }

  async function cacheRemoteUrl(url, metadata = {}) {
    const sourceUrl = String(url || '');
    if (!/^https?:\/\//i.test(sourceUrl)) return null;
    const existing = await blobByUrl(sourceUrl);
    if (existing?.blob) return existing;
    const response = await fetch(sourceUrl, { cache: 'no-store', credentials: 'omit' });
    if (!response.ok) throw new Error(`No se pudo descargar ${metadata.name || sourceUrl}.`);
    const blob = await response.blob();
    return blobPut({
      key: `remote:${hashString(sourceUrl)}`,
      blob,
      sourceUrl,
      name: metadata.name || sourceUrl.split('/').pop() || 'archivo',
      type: metadata.type || blob.type || '',
      kind: metadata.kind || 'remote'
    });
  }

  async function hydrateDescriptor(descriptor) {
    if (!descriptor || typeof descriptor !== 'object') return descriptor;
    const copy = { ...descriptor };
    let row = null;
    if (copy.offlineKey) row = await blobGet(copy.offlineKey);
    if (!row && copy.url) row = await blobByUrl(copy.url);
    if (!row && copy.sourceUrl) row = await blobByUrl(copy.sourceUrl);
    if (row?.blob) {
      copy.sourceUrl = copy.sourceUrl || copy.url || row.sourceUrl || '';
      copy.offlineKey = row.key;
      copy.url = await objectUrlForBlobRow(row);
      copy.cachedOffline = true;
    }
    return copy;
  }

  async function hydrateSnapshot(snapshot) {
    if (!snapshot) return null;
    const copy = safeClone(snapshot);
    const assignments = copy.data?.assignments || [];
    for (const assignment of assignments) {
      for (const field of ['icon', 'cover']) {
        const offlineKey = assignment[`${field}OfflineKey`];
        if (offlineKey) {
          assignment[field] = await objectUrlForKey(offlineKey) || assignment[field];
          continue;
        }
        const current = assignment[field];
        if (!current) continue;
        const row = await blobByUrl(current);
        if (row?.blob) assignment[field] = await objectUrlForBlobRow(row);
      }
    }
    const people = [...(copy.data?.students || []), ...(copy.data?.users || [])];
    for (const person of people) {
      if (!person.photo) continue;
      const row = await blobByUrl(person.photo);
      if (row?.blob) person.photo = await objectUrlForBlobRow(row);
    }
    for (const lesson of copy.data?.classes || []) {
      if (lesson.offlinePdfKey) lesson.contentUrl = await objectUrlForKey(lesson.offlinePdfKey) || lesson.contentUrl;
      else if (lesson.contentUrl) {
        const row = await blobByUrl(lesson.contentUrl);
        if (row?.blob) {
          lesson.sourceContentUrl = lesson.contentUrl;
          lesson.offlinePdfKey = row.key;
          lesson.contentUrl = await objectUrlForBlobRow(row);
        }
      }
      if (lesson.offlineThumbnailKey) lesson.thumbnailUrl = await objectUrlForKey(lesson.offlineThumbnailKey) || lesson.thumbnailUrl;
      else if (lesson.thumbnailUrl) {
        const row = await blobByUrl(lesson.thumbnailUrl);
        if (row?.blob) {
          lesson.sourceThumbnailUrl = lesson.thumbnailUrl;
          lesson.offlineThumbnailKey = row.key;
          lesson.thumbnailUrl = await objectUrlForBlobRow(row);
        }
      }
    }
    for (const activity of copy.data?.activities || []) {
      const contentFiles = Array.isArray(activity.contentPayload?.files) ? activity.contentPayload.files : [];
      const reviewFiles = Array.isArray(activity.reviewPayload?.files) ? activity.reviewPayload.files : [];
      activity.contentPayload = { ...(activity.contentPayload || {}), files: await Promise.all(contentFiles.map(hydrateDescriptor)) };
      activity.reviewPayload = { ...(activity.reviewPayload || {}), files: await Promise.all(reviewFiles.map(hydrateDescriptor)) };
    }
    activeSnapshot = copy;
    return copy;
  }

  async function gradebookGet(activityId, assignmentId) {
    const key = `${activeUserId}|${activityId}|${assignmentId}`;
    const db = await openDb();
    const tx = db.transaction(STORES.gradebooks, 'readonly');
    const row = await requestResult(tx.objectStore(STORES.gradebooks).get(key));
    if (!row?.rows) return null;
    const rows = safeClone(row.rows);
    for (const record of rows) {
      record.submissionFile = await hydrateDescriptor(record.submissionFile || {});
    }
    return rows;
  }

  async function gradebookPut(activityId, assignmentId, rows) {
    const key = `${activeUserId}|${activityId}|${assignmentId}`;
    const safeRows = stripObjectUrls(safeClone(rows || []));
    return withStore(STORES.gradebooks, 'readwrite', (store) => store.put({
      key,
      userId: activeUserId,
      activityId,
      assignmentId,
      rows: safeRows,
      updatedAt: nowIso()
    }));
  }

  async function allMutations() {
    if (!activeUserId) return [];
    const db = await openDb();
    const tx = db.transaction(STORES.mutations, 'readonly');
    const rows = await requestResult(tx.objectStore(STORES.mutations).getAll());
    return (rows || []).filter((row) => row.userId === activeUserId);
  }

  async function pendingMutations() {
    const rows = await allMutations();
    return rows.filter((row) => ['pending', 'retry', 'syncing', 'auth-required'].includes(row.status)).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  }

  async function mutationPut(row) {
    return withStore(STORES.mutations, 'readwrite', (store) => store.put(row));
  }

  async function mutationDelete(id) {
    return withStore(STORES.mutations, 'readwrite', (store) => store.delete(id));
  }

  function mutationEntityKeys(type, payload = {}) {
    switch (type) {
      case 'saveAttendanceStatus':
        return [`attendance:${payload.assignmentId}:${payload.studentCode}:${payload.attendanceDate}`];
      case 'savePreferences':
        return [`preferences:${activeUserId}`];
      case 'uploadAssignmentImage':
      case 'resetAssignmentImage':
        return [`assignment:${payload.assignmentId}`];
      case 'createPdfLesson':
      case 'updatePdfLesson':
      case 'deletePdfLesson':
        return [`lesson:${payload.lessonId || payload.requestedLessonId || ''}`];
      case 'reorderLessons':
        return [`lesson-order:${payload.assignmentId || ''}`];
      case 'createActivity': {
        const id = payload.activityId || payload.requestedActivityId || '';
        return [`activity:${id}`, `activity-grade-root:${id}`];
      }
      case 'updateActivity':
      case 'deleteActivity':
        return [`activity:${payload.activityId || payload.requestedActivityId || ''}`];
      case 'reorderActivities':
        return [`activity-order:${payload.assignmentId || ''}`];
      case 'saveActivityGrades': {
        const codes = [...new Set([payload.primaryStudentCode, ...(payload.selectedStudentCodes || [])].filter(Boolean))];
        return codes.map((code) => `activity-grade:${payload.activityId}:${payload.assignmentId}:${code}`);
      }
      case 'saveQuizzes':
        return (payload.quizzes || []).map((quiz) => `quiz:${quiz.id}`);
      case 'updateStudent':
        return [
          `student:${payload.studentDbId || payload.currentStudentCode || payload.studentCode || ''}`,
          `enrollment:${payload.currentGroupId || ''}:${payload.currentStudentCode || ''}`,
          `enrollment:${payload.targetGroupId || payload.currentGroupId || ''}:${payload.studentCode || ''}`
        ];
      case 'withdrawStudent':
      case 'createStudentAndEnroll':
        return [`enrollment:${payload.groupId}:${payload.studentCode}`];
      default:
        return [];
    }
  }

  function mutationBaseServerTime(type, payload = {}) {
    const versions = activeSnapshot?._offline?.entityVersions || {};
    const keys = mutationEntityKeys(type, payload);
    const values = keys.map((key) => versions[key]).filter(Boolean).sort();
    return values[0] || activeSnapshot?._offline?.serverSyncedAt || '';
  }

  async function markMutationEntitiesSynced(type, payload = {}) {
    const keys = mutationEntityKeys(type, payload);
    if (!keys.length || !activeSnapshot) return;
    const serverTime = await getServerNow();
    activeSnapshot._offline = activeSnapshot._offline || {};
    activeSnapshot._offline.entityVersions = activeSnapshot._offline.entityVersions || {};
    keys.forEach((key) => { activeSnapshot._offline.entityVersions[key] = serverTime; });
    await saveSnapshot(activeSnapshot, { serverSyncedAt: activeSnapshot._offline.serverSyncedAt || serverTime });
  }

  async function queueMutation(type, payload, options = {}) {
    const mutation = {
      id: options.mutationId || uuid(),
      userId: activeUserId,
      type,
      payload,
      status: options.status || 'pending',
      createdAt: nowIso(),
      baseServerTime: mutationBaseServerTime(type, payload),
      attempts: 0,
      lastError: options.lastError || ''
    };
    await mutationPut(mutation);
    try {
      const registration = await navigator.serviceWorker?.ready;
      await registration?.sync?.register?.('encisomath-sync');
    } catch (_) {}
    scheduleStatusUpdate();
    dispatch('encisomath:offline-queued', { mutation: { ...mutation, payload: undefined } });
    return mutation;
  }

  function dispatch(name, detail = {}) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }

  function scheduleStatusUpdate() {
    clearTimeout(statusUpdateTimer);
    statusUpdateTimer = setTimeout(updateStatusChip, 60);
  }

  async function updateStatusChip() {
    const chip = ensureStatusChip();
    if (!chip) return;
    const mutations = await allMutations().catch(() => []);
    const pendingRows = mutations.filter((item) => ['pending', 'retry', 'syncing', 'auth-required'].includes(item.status));
    const pending = pendingRows.length;
    const conflicts = mutations.filter((item) => item.status === 'conflict').length;
    const offline = !isOnline();
    const firstPending = pendingRows[0] ? mutationPresentation(pendingRows[0]) : null;
    chip.classList.toggle('is-offline', offline);
    chip.classList.toggle('has-pending', pending > 0);
    chip.classList.toggle('has-conflict', conflicts > 0);
    chip.dataset.pending = String(pending);
    const pendingLabel = pending
      ? `${pending} pendiente${pending === 1 ? '' : 's'}${firstPending ? ` · ${firstPending.title}` : ''}`
      : 'Todo guardado';
    const activelySyncing = Boolean(syncPromise && pending > 0);
    chip.innerHTML = `<span class="em-offline-dot" aria-hidden="true"></span><strong>${offline ? 'Sin conexión' : (activelySyncing ? 'Sincronizando' : 'En línea')}</strong><small>${escapeMarkup(pendingLabel)}</small>`;
    const titleParts = [];
    if (firstPending) titleParts.push(`${firstPending.title}: ${firstPending.detail}`);
    if (conflicts) titleParts.push(`${conflicts} cambio(s) no aplicado(s) porque Supabase tenía una versión más reciente.`);
    titleParts.push('Toca para ver el centro de sincronización.');
    chip.title = titleParts.join(' ');
  }

  function ensureStatusChip() {
    let chip = document.getElementById('encisoOfflineStatus');
    if (chip) return chip;
    if (!document.body) return null;
    chip = document.createElement('button');
    chip.id = 'encisoOfflineStatus';
    chip.className = 'em-offline-status';
    chip.type = 'button';
    chip.addEventListener('click', openSyncCenter);
    document.body.appendChild(chip);
    return chip;
  }

  async function openSyncCenter() {
    const rows = await allMutations().catch(() => []);
    const pending = rows
      .filter((item) => ['pending', 'retry', 'syncing', 'auth-required'].includes(item.status))
      .map((item) => item.status === 'syncing' && !syncPromise ? { ...item, status: 'retry' } : item);
    const conflicts = rows.filter((item) => item.status === 'conflict');
    const requiresAuth = false;
    const meta = activeSnapshot?._offline || {};
    const overlay = document.createElement('div');
    overlay.className = 'em-sync-center-overlay';
    overlay.innerHTML = `
      <section class="em-sync-center" role="dialog" aria-modal="true" aria-labelledby="emSyncTitle">
        <button class="em-sync-close" type="button" aria-label="Cerrar">×</button>
        <p>ENCISOMATH OFFLINE</p>
        <h2 id="emSyncTitle">Centro de sincronización</h2>
        <div class="em-sync-summary">
          <article><small>Estado</small><strong>${isOnline() ? 'En línea' : 'Sin conexión'}</strong></article>
          <article><small>Pendientes</small><strong>${pending.length}</strong></article>
          <article><small>Conflictos</small><strong>${conflicts.length}</strong></article>
        </div>
        <p class="em-sync-last">Última sincronización: ${meta.serverSyncedAt ? new Date(meta.serverSyncedAt).toLocaleString('es-CO') : 'todavía no registrada'}.</p>
        <section class="em-sync-pending-section" aria-labelledby="emSyncPendingTitle">
          <div class="em-sync-section-head">
            <div><small>COLA LOCAL</small><h3 id="emSyncPendingTitle">Qué falta por sincronizar</h3></div>
            <span>${pending.length}</span>
          </div>
          <div class="em-sync-pending-list">${pendingMutationListHTML(pending)}</div>
        </section>
        <div class="em-sync-progress" id="emSyncProgress" hidden><i></i><span>Sincronizando…</span></div>
        <div class="em-sync-actions">
          <button type="button" id="emPrepareOffline">Descargar todo para trabajar offline</button>
          <button type="button" id="emSyncNow" ${isOnline() && pending.length ? '' : 'disabled'}>${pending.length ? 'Sincronizar ahora' : 'Todo sincronizado'}</button>
        </div>
        ${conflicts.length ? `<details><summary>${conflicts.length} cambio(s) descartado(s)</summary><div class="em-sync-conflicts">${conflicts.slice(-20).map((mutation) => { const item = mutationPresentation(mutation); return `<p><strong>${escapeMarkup(item.title)}</strong><span>${escapeMarkup(item.detail)}</span><span>${escapeMarkup(item.error || 'Supabase tenía una versión más reciente.')}</span></p>`; }).join('')}</div></details>` : ''}
      </section>
    `;
    const showProgress = (labelText, completed = 0, total = 0) => {
      const progress = overlay.querySelector('#emSyncProgress');
      const label = progress?.querySelector('span');
      if (!progress || !label) return;
      progress.hidden = false;
      const percent = total > 0 ? Math.max(0, Math.min(100, (Number(completed) || 0) / total * 100)) : 18;
      progress.style.setProperty('--em-sync-progress-value', `${percent}%`);
      label.textContent = labelText;
    };
    const progressHandler = (event) => {
      const detail = event.detail || {};
      if (detail.phase === 'gradebooks') showProgress(`Preparando calificaciones ${detail.completed || 0}/${detail.total || 0}…`, detail.completed, detail.total);
      if (detail.phase === 'files') showProgress(`Descargando archivos ${detail.completed || 0}/${detail.total || 0}…`, detail.completed, detail.total);
    };
    const syncProgressHandler = (event) => {
      const detail = event.detail || {};
      showProgress(detail.label || `Sincronizando cambios ${detail.index || 0}/${detail.total || 0}…`, detail.completed ?? Math.max(0, (detail.index || 1) - 1), detail.total);
    };
    window.addEventListener('encisomath:offline-progress', progressHandler);
    window.addEventListener('encisomath:sync-progress', syncProgressHandler);
    const close = () => {
      window.removeEventListener('encisomath:offline-progress', progressHandler);
      window.removeEventListener('encisomath:sync-progress', syncProgressHandler);
      overlay.remove();
    };
    overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
    overlay.querySelector('.em-sync-close')?.addEventListener('click', close);
    overlay.querySelector('#emReauthenticate')?.addEventListener('click', () => {
      close();
      dispatch('encisomath:request-login', { reason: 'sync-auth-required' });
    });
    overlay.querySelector('#emSyncNow')?.addEventListener('click', async () => {
      showProgress('Sincronizando cambios pendientes…', 0, pending.length);
      await syncNow({ manual: true }).catch(() => {});
      const remaining = await pendingMutations().catch(() => []);
      const discarded = (await allMutations().catch(() => [])).filter((item) => item.status === 'conflict');
      close();
      if (remaining.length || discarded.length) window.setTimeout(openSyncCenter, 40);
    });
    overlay.querySelector('#emPrepareOffline')?.addEventListener('click', async () => {
      const progress = overlay.querySelector('#emSyncProgress');
      const label = progress?.querySelector('span');
      if (progress) progress.hidden = false;
      if (label) label.textContent = 'Descargando datos y archivos…';
      let failed = false;
      await prefetchEverything(activeSnapshot, { force: true }).catch((error) => {
        failed = true;
        if (label) label.textContent = error?.message || 'No se pudo completar la descarga.';
      });
      if (!failed && label) {
        const meta = activeSnapshot?._offline || {};
        label.textContent = meta.fileFailedCount
          ? `Preparación completada. ${meta.fileFailedCount} archivo(s) se reintentarán al volver a sincronizar.`
          : `Preparación offline completada: ${meta.fileCachedCount || meta.fileCount || 0} archivo(s).`;
      }
    });
    document.body.appendChild(overlay);
  }

  async function requestPersistentStorage() {
    try {
      if (navigator.storage?.persist) await navigator.storage.persist();
    } catch (_) {}
  }

  function collectRemoteUrls(snapshot, gradebooks = []) {
    const values = [];
    const add = (url, name = '', kind = 'file') => {
      if (/^https?:\/\//i.test(String(url || ''))) values.push({ url: String(url), name, kind });
    };
    const scanText = (value, name = 'Recurso incrustado') => {
      const text = String(value || '');
      const matches = text.match(/https?:\/\/[^\s"'<>\)]+/gi) || [];
      matches.forEach((url) => add(url.replace(/[;,]+$/, ''), name, 'embedded'));
    };
    const scanObject = (value, label = 'Recurso') => {
      if (!value) return;
      if (typeof value === 'string') {
        scanText(value, label);
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((item) => scanObject(item, label));
        return;
      }
      if (typeof value === 'object') {
        Object.entries(value).forEach(([key, item]) => {
          if (typeof item === 'string' && /^https?:\/\//i.test(item)) add(item, `${label} ${key}`, 'embedded');
          else scanObject(item, `${label} ${key}`);
        });
      }
    };
    (snapshot?.data?.assignments || []).forEach((item) => {
      add(item.icon, 'Icono de asignatura', 'image');
      add(item.cover, 'Portada de asignatura', 'image');
    });
    (snapshot?.data?.students || []).forEach((item) => add(item.photo, `Foto ${item.fullName || item.id}`, 'image'));
    (snapshot?.data?.classes || []).forEach((item) => {
      add(item.contentUrl, item.sourceFileName || item.title || 'Clase PDF', 'lesson');
      add(item.thumbnailUrl, `Portada ${item.title || ''}`, 'image');
    });
    (snapshot?.data?.activities || []).forEach((item) => {
      (item.contentPayload?.files || []).forEach((file) => add(file.url, file.name || item.title, 'activity'));
      (item.reviewPayload?.files || []).forEach((file) => add(file.url, file.name || item.title, 'review'));
      scanObject(item.contentPayload, `Contenido ${item.title || 'actividad'}`);
      scanObject(item.reviewPayload, `Resultado ${item.title || 'actividad'}`);
    });
    (snapshot?.data?.quizzes || []).forEach((quiz) => scanObject(quiz, `Quiz ${quiz.title || quiz.id || ''}`));
    gradebooks.forEach((rows) => (rows || []).forEach((row) => add(row.submissionFile?.url, row.submissionFile?.name || 'Entregable', 'submission')));
    return [...new Map(values.map((item) => [item.url, item])).values()];
  }

  async function prefetchExternalScripts() {
    if (!('caches' in window)) return;
    const cache = await caches.open(`encisomath-offline-v${OFFLINE_VERSION}-external`);
    for (const url of STATIC_EXTERNAL_URLS) {
      try {
        const existing = await cache.match(url);
        if (existing) continue;
        const response = await fetch(url, { mode: 'no-cors', cache: 'reload' });
        await cache.put(url, response.clone());
      } catch (_) {}
    }
  }

  async function prefetchEverything(snapshot = activeSnapshot, options = {}) {
    if (!snapshot || !isOnline()) return;
    if (prefetchPromise && !options.force) return prefetchPromise;
    prefetchPromise = (async () => {
      await requestPersistentStorage();
      await prefetchExternalScripts();
      const activities = snapshot.data?.activities || [];
      const gradebooks = [];
      const pairs = [];
      activities.forEach((activity) => {
        const ids = Array.isArray(activity.assignmentIds) && activity.assignmentIds.length
          ? activity.assignmentIds
          : [activity.assignmentId].filter(Boolean);
        ids.forEach((assignmentId) => pairs.push({ activityId: activity.id, assignmentId }));
      });
      let completed = 0;
      const totalBase = pairs.length;
      for (const pair of pairs) {
        try {
          const rows = await cloud.getActivityGradebook(pair);
          await gradebookPut(pair.activityId, pair.assignmentId, rows);
          gradebooks.push(rows);
        } catch (_) {}
        completed += 1;
        dispatch('encisomath:offline-progress', { phase: 'gradebooks', completed, total: totalBase });
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      const files = collectRemoteUrls(snapshot, gradebooks);
      completed = 0;
      let cachedCount = 0;
      let failedCount = 0;
      const queue = files.slice();
      const workers = Array.from({ length: Math.min(3, queue.length || 1) }, async () => {
        while (queue.length) {
          const item = queue.shift();
          try {
            const cached = await cacheRemoteUrl(item.url, item);
            if (cached) cachedCount += 1;
            else failedCount += 1;
          } catch (_) {
            failedCount += 1;
          }
          completed += 1;
          dispatch('encisomath:offline-progress', { phase: 'files', completed, total: files.length, cachedCount, failedCount });
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      });
      await Promise.all(workers);
      try {
        navigator.serviceWorker?.controller?.postMessage({ type: 'CACHE_URLS', urls: files.map((item) => item.url) });
      } catch (_) {}
      const current = await loadSnapshot(activeUserId) || snapshot;
      current._offline = {
        ...(current._offline || {}),
        filesPreparedAt: nowIso(),
        fileCount: files.length,
        fileCachedCount: cachedCount,
        fileFailedCount: failedCount
      };
      await saveSnapshot(current);
      dispatch('encisomath:offline-ready', { fileCount: files.length, cachedCount, failedCount });
    })().finally(() => { prefetchPromise = null; });
    return prefetchPromise;
  }

  function currentSnapshot() {
    return activeSnapshot;
  }

  function isStudentPortalSnapshot() {
    return activeSnapshot?.user?.role === 'student' || String(activeUserId || '').startsWith('student:');
  }

  async function updateSnapshot(mutator) {
    const snapshot = activeSnapshot || await loadSnapshot(activeUserId);
    if (!snapshot) return null;
    await mutator(snapshot);
    await saveSnapshot(snapshot);
    return snapshot;
  }

  function assignmentForGroup(snapshot, groupId) {
    return (snapshot?.data?.assignments || []).find((item) => String(item.groupId) === String(groupId));
  }

  async function optimisticAttendance(payload) {
    await updateSnapshot(async (snapshot) => {
      const key = `${payload.assignmentId}|${payload.attendanceDate}`;
      snapshot.attendance = snapshot.attendance || {};
      snapshot.attendance[key] = snapshot.attendance[key] || {};
      if (payload.status) snapshot.attendance[key][payload.studentCode] = payload.status;
      else delete snapshot.attendance[key][payload.studentCode];
    });
  }

  async function optimisticRockstar(payload, mutationId) {
    await updateSnapshot(async (snapshot) => {
      snapshot.data.rockstars = snapshot.data.rockstars || [];
      if (snapshot.data.rockstars.some((item) => item.clientMutationId === mutationId)) return;
      snapshot.data.rockstars.push({
        ...payload,
        id: payload.id || `offline-${mutationId}`,
        occurredAt: payload.occurredAt || nowIso(),
        date: String(payload.occurredAt || nowIso()).slice(0, 10),
        clientMutationId: mutationId,
        pendingSync: true
      });
    });
  }

  async function optimisticStudent(payload) {
    let created = null;
    await updateSnapshot(async (snapshot) => {
      const assignment = assignmentForGroup(snapshot, payload.groupId) || {};
      const code = String(payload.studentCode || '');
      created = {
        id: code,
        dbId: `offline-${code}`,
        username: offlineGeneratedStudentUsername(payload.firstName, payload.lastName, code),
        fullName: `${payload.lastName || ''}, ${payload.firstName || ''}`.replace(/^,\s*/, '').trim(),
        firstName: payload.firstName || '',
        lastName: payload.lastName || '',
        grade: String(assignment.grade || ''),
        course: String(assignment.course || ''),
        sede: assignment.sede || 'Municipal',
        groupId: payload.groupId,
        enrollmentId: `offline-${uuid()}`,
        enrollmentStatus: 'active',
        photo: './assets/default-avatar.svg',
        active: true,
        pendingSync: true
      };
      const current = snapshot.data.students || [];
      const index = current.findIndex((item) => String(item.id) === code && String(item.groupId) === String(payload.groupId));
      if (index >= 0) current[index] = { ...current[index], ...created };
      else current.push(created);
      snapshot.data.students = current;
    });
    return created;
  }

  function offlineGeneratedStudentUsername(firstName = '', lastName = '', studentCode = '') {
    const clean = (value) => String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9._-]+/g, '');
    const first = clean(String(firstName || '').trim().split(/\s+/)[0] || '');
    const last = clean(String(lastName || '').trim().split(/\s+/)[0] || '');
    return `${first}${last.slice(0, 2)}` || clean(studentCode) || 'estudiante';
  }

  async function optimisticUpdateStudent(payload) {
    let updated = null;
    await updateSnapshot(async (snapshot) => {
      const oldCode = String(payload.currentStudentCode || '');
      const newCode = String(payload.studentCode || oldCode);
      const targetGroupId = String(payload.targetGroupId || payload.currentGroupId || '');
      const assignment = assignmentForGroup(snapshot, targetGroupId) || {};
      const identity = String(payload.studentDbId || '');
      const username = String(payload.username || '').trim().toLowerCase()
        || offlineGeneratedStudentUsername(payload.firstName, payload.lastName, newCode);

      (snapshot.data.students || []).forEach((student) => {
        const sameStudent = (identity && String(student.dbId || '') === identity)
          || (!identity && String(student.id || '') === oldCode);
        if (!sameStudent) return;
        Object.assign(student, {
          id: newCode,
          username,
          fullName: `${payload.lastName || ''}, ${payload.firstName || ''}`.replace(/^,\s*/, '').trim(),
          firstName: payload.firstName || '',
          lastName: payload.lastName || '',
          grade: String(assignment.grade || student.grade || ''),
          course: String(assignment.course || student.course || ''),
          sede: assignment.sede || student.sede || 'Municipal',
          groupId: targetGroupId,
          enrollmentStatus: 'active',
          active: true,
          pendingSync: true
        });
        updated = { ...student };
      });

      if (oldCode && newCode && oldCode !== newCode) {
        Object.values(snapshot.attendance || {}).forEach((attendance) => {
          if (!attendance || typeof attendance !== 'object' || !(oldCode in attendance)) return;
          attendance[newCode] = attendance[oldCode];
          delete attendance[oldCode];
        });
        (snapshot.data.rockstars || []).forEach((row) => {
          if (String(row.studentId || '') === oldCode) row.studentId = newCode;
        });
        (snapshot.data.activityGrades || []).forEach((row) => {
          if (String(row.studentCode || '') === oldCode) row.studentCode = newCode;
        });
        (snapshot.data.quizGrades || []).forEach((row) => {
          if (String(row.studentCode || '') === oldCode) row.studentCode = newCode;
        });
      }
    });
    return updated || {
      id: payload.studentCode || payload.currentStudentCode || '',
      dbId: payload.studentDbId || '',
      username: payload.username || '',
      firstName: payload.firstName || '',
      lastName: payload.lastName || '',
      groupId: payload.targetGroupId || payload.currentGroupId || '',
      pendingSync: true
    };
  }

  async function optimisticWithdraw(payload) {
    await updateSnapshot(async (snapshot) => {
      (snapshot.data.students || []).forEach((student) => {
        if (String(student.id) === String(payload.studentCode) && String(student.groupId) === String(payload.groupId)) {
          student.active = false;
          student.enrollmentStatus = 'withdrawn';
          student.pendingSync = true;
        }
      });
    });
  }

  async function optimisticQuizzes(payload) {
    await updateSnapshot(async (snapshot) => {
      const incoming = Array.isArray(payload.quizzes) ? payload.quizzes : [];
      const map = new Map((snapshot.data.quizzes || []).map((quiz) => [String(quiz.id), quiz]));
      incoming.forEach((quiz) => map.set(String(quiz.id), { ...quiz, pendingSync: true }));
      snapshot.data.quizzes = [...map.values()];
    });
  }

  async function optimisticPreferences(payload) {
    await updateSnapshot(async (snapshot) => {
      snapshot.preferences = safeClone(payload.preferences || {});
    });
  }

  async function optimisticAssignmentImage(payload, mutationId) {
    const key = `local:${mutationId}:assignment-${payload.type}`;
    const descriptor = await descriptorFromFile(payload.file, key, 'assignment-image');
    const localUrl = descriptor?.url || '';
    await updateSnapshot(async (snapshot) => {
      const assignment = (snapshot.data.assignments || []).find((item) => String(item.id) === String(payload.assignmentId));
      if (!assignment) return;
      assignment[payload.type === 'cover' ? 'cover' : 'icon'] = localUrl;
      assignment[`${payload.type}OfflineKey`] = key;
      assignment.pendingSync = true;
    });
    return localUrl;
  }

  async function optimisticResetAssignmentImage(payload) {
    await updateSnapshot(async (snapshot) => {
      const assignment = (snapshot.data.assignments || []).find((item) => String(item.id) === String(payload.assignmentId));
      if (!assignment) return;
      assignment[payload.type === 'cover' ? 'cover' : 'icon'] = payload.type === 'cover' ? '' : './assets/subject-statistics.svg';
      assignment.pendingSync = true;
    });
  }

  async function optimisticPdfLesson(payload, mutationId) {
    const lessonId = payload.lessonId || `lesson-${mutationId}`;
    payload.lessonId = lessonId;
    const pdfDescriptor = await descriptorFromFile(payload.pdfFile, `local:${mutationId}:lesson-pdf`, 'lesson-pdf');
    const thumbDescriptor = payload.thumbnailFile
      ? await descriptorFromFile(payload.thumbnailFile, `local:${mutationId}:lesson-thumb`, 'lesson-thumbnail')
      : null;
    const ids = [...new Set((payload.targetAssignmentIds || []).filter(Boolean))];
    const lesson = {
      id: lessonId,
      period: Number(payload.period || 1),
      area: payload.currentAssignment?.area || '',
      subject: payload.currentAssignment?.subject || '',
      title: String(payload.title || '').trim(),
      emoji: '📘',
      type: 'PDF',
      lessonType: 'PDF',
      estimatedTime: '',
      contentUrl: pdfDescriptor?.url || '',
      thumbnailUrl: thumbDescriptor?.url || '',
      offlinePdfKey: pdfDescriptor?.offlineKey || '',
      offlineThumbnailKey: thumbDescriptor?.offlineKey || '',
      storagePdfPath: '',
      storageThumbnailPath: '',
      sourceFileName: payload.pdfFile?.name || '',
      pageCount: Math.max(1, Number(payload.pageCount || 1)),
      status: 'published',
      assignmentId: ids[0] || '',
      assignmentIds: ids,
      sortOrder: Math.floor(Date.now() / 1000),
      sortOrderByAssignment: Object.fromEntries(ids.map((id, index) => [String(id), Math.floor(Date.now() / 1000) + index])),
      pendingSync: true
    };
    await updateSnapshot(async (snapshot) => {
      snapshot.data.classes = [...(snapshot.data.classes || []).filter((item) => item.id !== lessonId), lesson];
    });
    return lesson;
  }

  async function optimisticUpdatePdfLesson(payload, mutationId, serverResult = null) {
    const safeLessonId = String(payload.lessonId || '');
    if (!safeLessonId) return serverResult;
    const pdfDescriptor = payload.pdfFile instanceof Blob
      ? await descriptorFromFile(payload.pdfFile, `local:${mutationId}:lesson-pdf-update`, 'lesson-pdf')
      : null;
    const thumbDescriptor = payload.thumbnailFile instanceof Blob
      ? await descriptorFromFile(payload.thumbnailFile, `local:${mutationId}:lesson-thumb-update`, 'lesson-thumbnail')
      : null;
    let result = serverResult || null;
    await updateSnapshot(async (snapshot) => {
      const current = (snapshot.data.classes || []).find((item) => String(item.id) === safeLessonId);
      if (!current && !serverResult) return;
      const updated = serverResult ? { ...(current || {}), ...safeClone(serverResult) } : {
        ...(current || {}),
        id: safeLessonId,
        period: Number(payload.period || current?.period || 1),
        area: payload.currentAssignment?.area || current?.area || '',
        subject: payload.currentAssignment?.subject || current?.subject || '',
        title: String(payload.title || current?.title || '').trim(),
        contentUrl: pdfDescriptor?.url || current?.contentUrl || payload.existingContentUrl || '',
        thumbnailUrl: thumbDescriptor?.url || current?.thumbnailUrl || payload.existingThumbnailUrl || '',
        offlinePdfKey: pdfDescriptor?.offlineKey || current?.offlinePdfKey || '',
        offlineThumbnailKey: thumbDescriptor?.offlineKey || current?.offlineThumbnailKey || '',
        sourceFileName: payload.pdfFile?.name || current?.sourceFileName || payload.existingSourceFileName || '',
        pageCount: Math.max(1, Number(payload.pageCount || current?.pageCount || 1)),
        assignmentIds: [...new Set((payload.targetAssignmentIds || []).filter(Boolean))],
        sortOrderByAssignment: Object.fromEntries([...new Set((payload.targetAssignmentIds || []).filter(Boolean))].map((id, index) => [String(id), Number(current?.sortOrderByAssignment?.[id] || current?.sortOrder || Math.floor(Date.now() / 1000) + index)])),
        status: 'published',
        pendingSync: true
      };
      updated.assignmentId = updated.assignmentIds?.[0] || '';
      const list = snapshot.data.classes || [];
      const index = list.findIndex((item) => String(item.id) === safeLessonId);
      if (index >= 0) list[index] = updated;
      else list.push(updated);
      snapshot.data.classes = list;
      result = updated;
    });
    return result;
  }

  async function payloadFilesFromOffline(files, mutationId, section) {
    const descriptors = [];
    for (let index = 0; index < (files || []).length; index += 1) {
      const file = files[index];
      const descriptor = await descriptorFromFile(file, `local:${mutationId}:${section}:${index}`, section);
      if (descriptor) descriptors.push(descriptor);
    }
    return descriptors;
  }

  async function optimisticCreateActivity(payload, mutationId) {
    const activityId = payload.activityId || `activity-${mutationId}`;
    payload.activityId = activityId;
    const contentFiles = await payloadFilesFromOffline(payload.contentFiles, mutationId, 'activity-content');
    const reviewFiles = await payloadFilesFromOffline(payload.reviewFiles, mutationId, 'activity-review');
    const ids = [...new Set((payload.targetAssignmentIds || []).filter(Boolean))];
    const activity = {
      id: activityId,
      title: String(payload.title || '').trim(),
      lessonId: payload.lessonId || '',
      period: Number(payload.period || 1),
      startsAt: payload.startsAt || '',
      dueAt: payload.dueAt || '',
      contentType: payload.contentType || 'rich_text',
      contentPayload: {
        text: payload.contentText || '',
        html: payload.contentHtml || '',
        css: payload.contentCss || '',
        files: contentFiles,
        library: {
          assignmentId: String(payload.currentAssignment?.id || ''),
          subject: String(payload.currentAssignment?.subject || ''),
          area: String(payload.currentAssignment?.area || ''),
          grade: String(payload.currentAssignment?.grade || '')
        }
      },
      reviewType: payload.reviewType || 'rich_text',
      reviewPayload: { text: payload.reviewText || '', html: payload.reviewHtml || '', css: payload.reviewCss || '', files: reviewFiles },
      rubric: Array.isArray(payload.rubric) ? payload.rubric : [],
      status: 'published',
      assignmentId: ids[0] || '',
      assignmentIds: ids,
      sortOrder: Math.floor(Date.now() / 1000),
      sortOrderByAssignment: Object.fromEntries(ids.map((id, index) => [String(id), Math.floor(Date.now() / 1000) + index])),
      libraryAssignmentId: String(payload.currentAssignment?.id || ''),
      librarySubject: String(payload.currentAssignment?.subject || ''),
      libraryArea: String(payload.currentAssignment?.area || ''),
      libraryGrade: String(payload.currentAssignment?.grade || ''),
      createdAt: nowIso(),
      pendingSync: true,
      progressByAssignment: Object.fromEntries(ids.map((id) => [id, { total: 0, delivered: 0, graded: 0 }]))
    };
    await updateSnapshot(async (snapshot) => {
      snapshot.data.activities = [...(snapshot.data.activities || []).filter((item) => item.id !== activityId), activity];
    });
    return activity;
  }

  async function optimisticUpdateActivity(payload, mutationId) {
    const contentFiles = (payload.contentFiles || []).length
      ? await payloadFilesFromOffline(payload.contentFiles, mutationId, 'activity-content-update')
      : (payload.existingContentPayload?.files || []);
    const reviewFiles = (payload.reviewFiles || []).length
      ? await payloadFilesFromOffline(payload.reviewFiles, mutationId, 'activity-review-update')
      : (payload.existingReviewPayload?.files || []);
    let result = null;
    await updateSnapshot(async (snapshot) => {
      const activity = (snapshot.data.activities || []).find((item) => String(item.id) === String(payload.activityId));
      if (!activity) return;
      Object.assign(activity, {
        title: String(payload.title || '').trim(),
        lessonId: payload.lessonId || '',
        period: Number(payload.period || 1),
        startsAt: payload.startsAt || '',
        dueAt: payload.dueAt || '',
        contentType: payload.contentType,
        contentPayload: {
          text: payload.contentText || '',
          html: payload.contentHtml || '',
          css: payload.contentCss || '',
          files: contentFiles,
          library: {
            assignmentId: String(payload.existingContentPayload?.library?.assignmentId || payload.currentAssignment?.id || ''),
            subject: String(payload.existingContentPayload?.library?.subject || payload.currentAssignment?.subject || ''),
            area: String(payload.existingContentPayload?.library?.area || payload.currentAssignment?.area || ''),
            grade: String(payload.existingContentPayload?.library?.grade || payload.currentAssignment?.grade || '')
          }
        },
        reviewType: payload.reviewType,
        reviewPayload: { text: payload.reviewText || '', html: payload.reviewHtml || '', css: payload.reviewCss || '', files: reviewFiles },
        rubric: Array.isArray(payload.rubric) ? payload.rubric : [],
        assignmentIds: [...new Set((payload.targetAssignmentIds || []).filter(Boolean))],
        sortOrderByAssignment: Object.fromEntries([...new Set((payload.targetAssignmentIds || []).filter(Boolean))].map((id, index) => [String(id), Number(activity.sortOrderByAssignment?.[id] || activity.sortOrder || Math.floor(Date.now() / 1000) + index)])),
        libraryAssignmentId: String(payload.existingContentPayload?.library?.assignmentId || payload.currentAssignment?.id || activity.libraryAssignmentId || ''),
        librarySubject: String(payload.existingContentPayload?.library?.subject || payload.currentAssignment?.subject || activity.librarySubject || ''),
        libraryArea: String(payload.existingContentPayload?.library?.area || payload.currentAssignment?.area || activity.libraryArea || ''),
        libraryGrade: String(payload.existingContentPayload?.library?.grade || payload.currentAssignment?.grade || activity.libraryGrade || ''),
        pendingSync: true
      });
      activity.assignmentId = activity.assignmentIds[0] || '';
      result = activity;
    });
    return result;
  }

  async function optimisticReorderLessons(payload) {
    const assignmentId = String(payload.assignmentId || '');
    const ids = [...new Set((payload.lessonIds || []).map(String).filter(Boolean))];
    if (!assignmentId || !ids.length) return { assignmentId, lessonIds: ids };
    await updateSnapshot(async (snapshot) => {
      const byId = new Map((snapshot.data.classes || []).map((item) => [String(item.id), item]));
      ids.forEach((id, index) => {
        const lesson = byId.get(id);
        if (!lesson) return;
        lesson.sortOrderByAssignment = { ...(lesson.sortOrderByAssignment || {}), [assignmentId]: index + 1 };
        if (String(lesson.assignmentId || '') === assignmentId || (lesson.assignmentIds || []).includes(assignmentId)) lesson.sortOrder = index + 1;
        lesson.pendingSync = true;
      });
    });
    return { assignmentId, lessonIds: ids };
  }

  async function optimisticReorderActivities(payload) {
    const assignmentId = String(payload.assignmentId || '');
    const ids = [...new Set((payload.activityIds || []).map(String).filter(Boolean))];
    if (!assignmentId || !ids.length) return { assignmentId, activityIds: ids };
    await updateSnapshot(async (snapshot) => {
      const byId = new Map((snapshot.data.activities || []).map((item) => [String(item.id), item]));
      ids.forEach((id, index) => {
        const activity = byId.get(id);
        if (!activity) return;
        activity.sortOrderByAssignment = { ...(activity.sortOrderByAssignment || {}), [assignmentId]: index + 1 };
        if (String(activity.assignmentId || '') === assignmentId || (activity.assignmentIds || []).includes(assignmentId)) activity.sortOrder = index + 1;
        activity.pendingSync = true;
      });
    });
    return { assignmentId, activityIds: ids };
  }

  async function optimisticDeleteActivity(payload) {
    await updateSnapshot(async (snapshot) => {
      const activity = (snapshot.data.activities || []).find((item) => String(item.id) === String(payload.activityId));
      if (!activity) return;
      if (payload.mode === 'course') {
        activity.assignmentIds = (activity.assignmentIds || []).filter((id) => String(id) !== String(payload.assignmentId));
        activity.assignmentId = activity.assignmentIds[0] || '';
      } else {
        snapshot.data.activities = (snapshot.data.activities || []).filter((item) => String(item.id) !== String(payload.activityId));
        snapshot.data.activityGrades = (snapshot.data.activityGrades || []).filter((item) => String(item.activityId) !== String(payload.activityId));
      }
    });
  }

  async function optimisticDeleteLesson(payload) {
    await updateSnapshot(async (snapshot) => {
      const lesson = (snapshot.data.classes || []).find((item) => String(item.id) === String(payload.lessonId));
      if (!lesson) return;
      if (payload.mode === 'course') {
        lesson.assignmentIds = (lesson.assignmentIds || []).filter((id) => String(id) !== String(payload.assignmentId));
        lesson.assignmentId = lesson.assignmentIds[0] || '';
      } else {
        snapshot.data.classes = (snapshot.data.classes || []).filter((item) => String(item.id) !== String(payload.lessonId));
      }
    });
  }

  function seedOfflineGradebook(activityId, assignmentId) {
    const assignment = (activeSnapshot?.data?.assignments || []).find((item) => String(item.id) === String(assignmentId));
    const students = (activeSnapshot?.data?.students || []).filter((item) => item.active !== false && String(item.groupId) === String(assignment?.groupId));
    return students.map((student) => ({
      recordId: `offline-${activityId}-${assignmentId}-${student.id}`,
      activityId,
      assignmentId,
      studentDbId: student.dbId || '',
      studentCode: String(student.id || ''),
      firstName: student.firstName || '',
      lastName: student.lastName || '',
      fullName: student.fullName || `${student.lastName || ''}, ${student.firstName || ''}`,
      score: 40,
      observations: '',
      submissionFile: {},
      gradingGroupId: '',
      rubricScores: {},
      gradedAt: '',
      updatedAt: '',
      deliveryEvents: [],
      latestDeliveryStatus: '',
      pendingSync: false
    }));
  }

  async function optimisticSaveGrades(payload, mutationId) {
    let rows = await gradebookGet(payload.activityId, payload.assignmentId);
    if (!rows) rows = seedOfflineGradebook(payload.activityId, payload.assignmentId);
    const codes = [...new Set([payload.primaryStudentCode, ...(payload.selectedStudentCodes || [])].filter(Boolean))];
    const groupId = codes.length > 1 ? (payload.gradingGroupId || `offline-group-${mutationId}`) : '';
    if (groupId) payload.gradingGroupId = groupId;
    const submittedAt = nowIso();
    let submission = payload.existingSubmissionFile && typeof payload.existingSubmissionFile === 'object' ? { ...payload.existingSubmissionFile } : {};
    if (payload.submissionFile instanceof Blob) {
      submission = await descriptorFromFile(payload.submissionFile, `local:${mutationId}:submission`, 'submission') || submission;
    }
    rows.forEach((row) => {
      if (!codes.includes(String(row.studentCode))) return;
      row.score = Math.max(0, Math.min(100, Number(payload.scores?.[row.studentCode] ?? payload.scores?.[payload.primaryStudentCode] ?? 40)));
      row.observations = String(payload.observations || '');
      row.submissionFile = submission;
      row.gradingGroupId = groupId;
      row.rubricScores = payload.rubricScores && typeof payload.rubricScores === 'object' ? safeClone(payload.rubricScores) : {};
      row.gradedAt = submittedAt;
      row.updatedAt = submittedAt;
      row.pendingSync = true;
      if (payload.deliveryStatus) {
        row.deliveryEvents = [...(row.deliveryEvents || []), {
          id: `offline-event-${mutationId}-${row.studentCode}`,
          status: payload.deliveryStatus,
          note: String(payload.deliveryNote || ''),
          occurredAt: submittedAt,
          pendingSync: true
        }];
        row.latestDeliveryStatus = payload.deliveryStatus;
      }
    });
    const removed = [...new Set(payload.previousGroupStudentCodes || [])].filter((code) => !codes.includes(code));
    rows.forEach((row) => {
      if (removed.includes(String(row.studentCode))) row.gradingGroupId = '';
    });
    await gradebookPut(payload.activityId, payload.assignmentId, rows);
    await updateSnapshot(async (snapshot) => {
      const map = new Map((snapshot.data.activityGrades || []).map((item) => [`${item.activityId}|${item.assignmentId}|${item.studentCode}`, item]));
      rows.forEach((row) => {
        map.set(`${payload.activityId}|${payload.assignmentId}|${row.studentCode}`, {
          activityId: payload.activityId,
          assignmentId: payload.assignmentId,
          studentCode: row.studentCode,
          score: Number(row.score ?? 40),
          gradedAt: row.gradedAt || '',
          gradingGroupId: row.gradingGroupId || ''
        });
      });
      snapshot.data.activityGrades = [...map.values()];
    });
    return rows;
  }

  async function optimisticQuizBundle(payload) {
    const snapshot = activeSnapshot || await loadSnapshot(activeUserId);
    if (!snapshot) return;
    const studentCode = snapshot.user?.id || '';
    const score = (payload.answers || []).reduce((sum, answer) => sum + Number(answer?.score?.total ?? answer?.points?.total ?? answer?.points ?? 0), 0);
    const maxScore = (payload.answers || []).reduce((sum, answer) => sum + Number(answer?.score?.maxItem ?? answer?.points?.maxItem ?? 0) + Number(answer?.score?.maxTime ?? answer?.points?.maxTime ?? 0), 0);
    if (!maxScore || !studentCode) return;
    const normalized = Math.max(0, Math.min(100, (score / maxScore) * 100));
    await updateSnapshot(async (current) => {
      current.data.quizGrades = current.data.quizGrades || [];
      current.data.quizGrades.push({
        quizId: payload.quiz?.id || '',
        assignmentId: payload.assignmentId || '',
        studentCode,
        score: Math.round(normalized * 10) / 10,
        submittedAt: nowIso(),
        pendingSync: true
      });
    });
  }

  async function claimMutation(mutation) {
    try {
      const existing = await cloud.getClient().from('offline_mutation_receipts').select('status').eq('id', mutation.id).maybeSingle();
      if (!existing.error && existing.data?.status === 'applied') return 'applied';
      const result = await cloud.getClient().from('offline_mutation_receipts').upsert({
        id: mutation.id,
        user_id: activeUserId,
        mutation_type: mutation.type,
        status: 'processing',
        payload_hash: hashString(`${mutation.type}:${mutation.createdAt}`),
        last_error: null
      }, { onConflict: 'id', ignoreDuplicates: false }).select('status').single();
      if (result.error) return 'unknown';
      return result.data?.status || 'processing';
    } catch (_) {
      return 'unknown';
    }
  }

  async function finishMutationReceipt(mutation, status, error = '') {
    try {
      await cloud.getClient().from('offline_mutation_receipts').upsert({
        id: mutation.id,
        user_id: activeUserId,
        mutation_type: mutation.type,
        status,
        payload_hash: hashString(`${mutation.type}:${mutation.createdAt}`),
        applied_at: status === 'applied' ? nowIso() : null,
        last_error: error || null
      }, { onConflict: 'id', ignoreDuplicates: false });
    } catch (_) {}
  }

  async function serverRowUpdatedAfter(table, filters, baseServerTime) {
    if (!baseServerTime) return false;
    try {
      let query = cloud.getClient().from(table).select('updated_at').limit(1).order('updated_at', { ascending: false });
      Object.entries(filters || {}).forEach(([key, value]) => {
        if (Array.isArray(value)) query = query.in(key, value);
        else query = query.eq(key, value);
      });
      const result = await query;
      if (result.error) return false;
      const updatedAt = result.data?.[0]?.updated_at;
      return Boolean(updatedAt && String(updatedAt) > String(baseServerTime));
    } catch (_) {
      return false;
    }
  }

  async function mutationHasConflict(mutation, locallyAppliedKeys = new Set()) {
    const payload = mutation.payload || {};
    const keys = mutationEntityKeys(mutation.type, payload);
    if (mutation.type === 'saveActivityGrades' && locallyAppliedKeys.has(`activity-grade-root:${payload.activityId}`)) return false;
    if (keys.some((key) => locallyAppliedKeys.has(key))) return false;
    const base = mutation.baseServerTime || '';
    if (!base) return false;
    switch (mutation.type) {
      case 'saveAttendanceStatus': {
        const studentId = cloud.resolveStudentDbId(payload.studentCode);
        if (!studentId) return false;
        return serverRowUpdatedAfter('attendance_records', {
          assignment_id: payload.assignmentId,
          student_id: studentId,
          attendance_date: payload.attendanceDate
        }, base);
      }
      case 'savePreferences':
        return serverRowUpdatedAfter('user_preferences', { user_id: activeUserId }, base);
      case 'uploadAssignmentImage':
      case 'resetAssignmentImage':
        return serverRowUpdatedAfter('teaching_assignments', { id: payload.assignmentId }, base);
      case 'updateActivity':
      case 'deleteActivity':
        return serverRowUpdatedAfter('activities', { id: payload.activityId }, base);
      case 'saveActivityGrades': {
        const codes = [...new Set([payload.primaryStudentCode, ...(payload.selectedStudentCodes || [])].filter(Boolean))];
        const ids = codes.map((code) => cloud.resolveStudentDbId(code)).filter(Boolean);
        if (!ids.length) return false;
        return serverRowUpdatedAfter('activity_student_records', {
          activity_id: payload.activityId,
          assignment_id: payload.assignmentId,
          student_id: ids
        }, base);
      }
      case 'saveQuizzes': {
        const ids = (payload.quizzes || []).map((quiz) => quiz.id).filter(Boolean);
        if (!ids.length) return false;
        return serverRowUpdatedAfter('quizzes', { id: ids }, base);
      }
      case 'updateStudent':
        return serverRowUpdatedAfter('students', { id: payload.studentDbId }, base);
      case 'withdrawStudent': {
        const studentId = cloud.resolveStudentDbId(payload.studentCode);
        if (!studentId) return false;
        return serverRowUpdatedAfter('group_enrollments', { group_id: payload.groupId, student_id: studentId }, base);
      }
      case 'updatePdfLesson':
      case 'deletePdfLesson':
        return serverRowUpdatedAfter('lessons', { id: payload.lessonId }, base);
      default:
        return false;
    }
  }

  function restoreRemoteDescriptorUrls(value) {
    if (!value || typeof value !== 'object') return value;
    if (value instanceof Blob) return value;
    if (Array.isArray(value)) return value.map(restoreRemoteDescriptorUrls);
    const copy = {};
    Object.entries(value).forEach(([key, item]) => {
      if (key === 'url' && typeof item === 'string' && item.startsWith('blob:')) {
        copy[key] = value.sourceUrl || '';
      } else {
        copy[key] = restoreRemoteDescriptorUrls(item);
      }
    });
    return copy;
  }

  async function fileFromOfflineDescriptor(descriptor) {
    if (!descriptor?.offlineKey) return null;
    const row = await blobGet(descriptor.offlineKey);
    if (!row?.blob) return null;
    try {
      return new File([row.blob], descriptor.name || row.name || 'archivo', { type: descriptor.type || row.type || row.blob.type || '' });
    } catch (_) {
      const blob = row.blob;
      blob.name = descriptor.name || row.name || 'archivo';
      return blob;
    }
  }

  async function prepareReplayPayload(mutation) {
    const payload = restoreRemoteDescriptorUrls({ ...(mutation.payload || {}), mutationId: mutation.id, clientMutationId: mutation.id });
    if (mutation.type === 'updateActivity') {
      if (!(payload.contentFiles || []).length) {
        const descriptors = mutation.payload?.existingContentPayload?.files || [];
        const files = (await Promise.all(descriptors.map(fileFromOfflineDescriptor))).filter(Boolean);
        if (files.length) payload.contentFiles = files;
      }
      if (!(payload.reviewFiles || []).length) {
        const descriptors = mutation.payload?.existingReviewPayload?.files || [];
        const files = (await Promise.all(descriptors.map(fileFromOfflineDescriptor))).filter(Boolean);
        if (files.length) payload.reviewFiles = files;
      }
    }
    if (mutation.type === 'saveActivityGrades' && !(payload.submissionFile instanceof Blob)) {
      const localFile = await fileFromOfflineDescriptor(mutation.payload?.existingSubmissionFile);
      if (localFile) payload.submissionFile = localFile;
    }
    return payload;
  }

  async function replayMutation(mutation) {
    const payload = await prepareReplayPayload(mutation);
    switch (mutation.type) {
      case 'saveAttendanceStatus': return cloud.saveAttendanceStatus(payload);
      case 'addRockstarEvent': return cloud.addRockstarEvent({ ...(payload.event || payload), clientMutationId: mutation.id });
      case 'createStudentAndEnroll': return cloud.createStudentAndEnroll(payload);
      case 'updateStudent': return cloud.updateStudent(payload);
      case 'withdrawStudent': return cloud.withdrawStudent(payload);
      case 'saveQuizzes': return cloud.saveQuizzes(payload.quizzes || [], { clientMutationId: mutation.id });
      case 'savePreferences': return cloud.savePreferences(payload.preferences || {}, { clientMutationId: mutation.id });
      case 'uploadAssignmentImage': return cloud.uploadAssignmentImage(payload);
      case 'resetAssignmentImage': return cloud.resetAssignmentImage(payload);
      case 'createPdfLesson': return cloud.createPdfLesson(payload);
      case 'updatePdfLesson': return cloud.updatePdfLesson(payload);
      case 'reorderLessons': return cloud.reorderLessons(payload);
      case 'createActivity': return cloud.createActivity(payload);
      case 'updateActivity': return cloud.updateActivity(payload);
      case 'reorderActivities': return cloud.reorderActivities(payload);
      case 'saveActivityGrades': return cloud.saveActivityGrades(payload);
      case 'deleteActivity': return cloud.deleteActivity(payload);
      case 'deletePdfLesson': return cloud.deletePdfLesson(payload);
      case 'recordLessonView': return cloud.recordLessonView(payload);
      case 'submitQuizAttemptBundle': {
        let attemptId = payload.serverAttemptId || '';
        if (!attemptId) {
          const attempt = await cloud.startQuizAttempt({ quiz: payload.quiz, assignmentId: payload.assignmentId, clientMutationId: mutation.id });
          attemptId = attempt?.id || '';
        }
        return cloud.submitQuizAttempt({
          attemptId,
          quiz: payload.quiz,
          assignmentId: payload.assignmentId,
          answers: payload.answers,
          securityEvents: payload.securityEvents,
          terminatedReason: payload.terminatedReason,
          clientMutationId: mutation.id
        });
      }
      default:
        throw new Error(`Operación offline desconocida: ${mutation.type}`);
    }
  }

  async function syncNow(options = {}) {
    if (syncPromise) return syncPromise;
    if (!isOnline()) {
      scheduleStatusUpdate();
      return { applied: 0, conflicts: 0, failed: 0, offline: true };
    }
    syncPromise = (async () => {
      scheduleStatusUpdate();
      const queue = await pendingMutations();
      const summary = { applied: 0, conflicts: 0, failed: 0, total: queue.length };
      const locallyAppliedKeys = new Set();
      let index = 0;
      if (typeof options.onProgress === 'function') {
        try { options.onProgress({ index: 0, completed: 0, total: queue.length, label: queue.length ? 'Preparando cambios pendientes...' : 'No hay cambios pendientes.' }); } catch (_) {}
      }
      for (const mutation of queue) {
        index += 1;
        mutation.status = 'syncing';
        mutation.attempts = Number(mutation.attempts || 0) + 1;
        await mutationPut(mutation);
        const progressDetail = { index, completed: index - 1, total: queue.length, mutationType: mutation.type, label: `Sincronizando cambios ${index}/${queue.length}...` };
        dispatch('encisomath:sync-progress', progressDetail);
        if (typeof options.onProgress === 'function') {
          try { options.onProgress(progressDetail); } catch (_) {}
        }
        try {
          const conflict = await mutationHasConflict(mutation, locallyAppliedKeys);
          if (conflict) {
            mutation.status = 'conflict';
            mutation.lastError = 'Supabase tenía una versión más reciente; se conservó la versión del servidor.';
            await mutationPut(mutation);
            await finishMutationReceipt(mutation, 'conflict', mutation.lastError);
            summary.conflicts += 1;
            const completedDetail = { index, completed: index, total: queue.length, mutationType: mutation.type, label: `Cambios procesados ${index}/${queue.length}.` };
            dispatch('encisomath:sync-progress', completedDetail);
            if (typeof options.onProgress === 'function') { try { options.onProgress(completedDetail); } catch (_) {} }
            continue;
          }
          const receipt = await claimMutation(mutation);
          if (receipt === 'applied') {
            await mutationDelete(mutation.id);
            mutationEntityKeys(mutation.type, mutation.payload || {}).forEach((key) => locallyAppliedKeys.add(key));
            summary.applied += 1;
            const completedDetail = { index, completed: index, total: queue.length, mutationType: mutation.type, label: `Cambios procesados ${index}/${queue.length}.` };
            dispatch('encisomath:sync-progress', completedDetail);
            if (typeof options.onProgress === 'function') { try { options.onProgress(completedDetail); } catch (_) {} }
            continue;
          }
          await replayMutation(mutation);
          await finishMutationReceipt(mutation, 'applied');
          await mutationDelete(mutation.id);
          mutationEntityKeys(mutation.type, mutation.payload || {}).forEach((key) => locallyAppliedKeys.add(key));
          summary.applied += 1;
        } catch (error) {
          const authRequired = isAuthSessionError(error);
          mutation.status = 'retry';
          mutation.lastError = authRequired
            ? 'Supabase está renovando la sesión; se reintentará automáticamente.'
            : (error?.message || String(error || 'Error de sincronización'));
          await mutationPut(mutation);
          await finishMutationReceipt(mutation, 'error', mutation.lastError);
          summary.failed += 1;
          const completedDetail = { index, completed: index, total: queue.length, mutationType: mutation.type, label: `Cambios procesados ${index}/${queue.length}.` };
          dispatch('encisomath:sync-progress', completedDetail);
          if (typeof options.onProgress === 'function') { try { options.onProgress(completedDetail); } catch (_) {} }
          if (authRequired || isNetworkError(error)) break;
          continue;
        }
        const completedDetail = { index, completed: index, total: queue.length, mutationType: mutation.type, label: `Cambios procesados ${index}/${queue.length}.` };
        dispatch('encisomath:sync-progress', completedDetail);
        if (typeof options.onProgress === 'function') { try { options.onProgress(completedDetail); } catch (_) {} }
      }
      if (isOnline()) {
        try {
          const serverSyncedAt = await getServerNow();
          const fresh = await cloud.loadApplicationData();
          await saveSnapshot(fresh, { serverSyncedAt });
          const hydrated = await hydrateSnapshot(fresh);
          dispatch('encisomath:sync-complete', { snapshot: hydrated, summary });
          prefetchEverything(fresh).catch(() => {});
        } catch (_) {}
      }
      return summary;
    })().finally(() => {
      syncPromise = null;
      scheduleStatusUpdate();
    });
    return syncPromise;
  }

  function prepareMutationPayload(type, payload, mutationId) {
    const prepared = { ...payload, mutationId, clientMutationId: mutationId };
    if (type === 'createActivity' && !prepared.activityId) prepared.activityId = `activity-${mutationId}`;
    if (type === 'createPdfLesson' && !prepared.lessonId) prepared.lessonId = `lesson-${mutationId}`;
    if (type === 'saveActivityGrades') {
      const codes = [...new Set([prepared.primaryStudentCode, ...(prepared.selectedStudentCodes || [])].filter(Boolean))];
      if (codes.length > 1 && !prepared.gradingGroupId) prepared.gradingGroupId = uuid();
    }
    return prepared;
  }

  async function executeMutation(type, payload, onlineAction, optimisticAction, options = {}) {
    const mutationId = options.mutationId || uuid();
    const preparedPayload = prepareMutationPayload(type, payload, mutationId);
    let queueStatus = 'pending';
    let queueError = '';
    if (isOnline()) {
      try {
        const result = await onlineAction(preparedPayload);
        if (typeof optimisticAction === 'function') await optimisticAction(preparedPayload, mutationId, result, true);
        await markMutationEntitiesSynced(type, preparedPayload).catch(() => {});
        return result;
      } catch (error) {
        // Una sesión expirada no debe hacer perder el trabajo. La operación se
        // conserva localmente igual que cuando no hay conexión y se reintenta
        // después de volver a autenticar al docente.
        const authRequired = isAuthSessionError(error);
        if (!isNetworkError(error) && !authRequired && !options.queueOnAnyError) throw error;
        if (authRequired) {
          queueStatus = 'retry';
          queueError = 'Supabase está renovando la sesión; el cambio se reintentará automáticamente.';
        }
      }
    }
    const optimisticResult = typeof optimisticAction === 'function'
      ? await optimisticAction(preparedPayload, mutationId, null, false)
      : options.fallbackResult;
    await queueMutation(type, preparedPayload, { mutationId, status: queueStatus, lastError: queueError });
    return optimisticResult;
  }

  async function wrappedGetSession() {
    try {
      const liveSession = await cloud.getSession();
      if (liveSession?.user?.id) {
        await rememberSession(liveSession);
        return liveSession;
      }

      const cached = await cachedSession();
      if (!isOnline()) return cached;
      if (cached?.refresh_token && typeof cloud.restoreSession === 'function') {
        try {
          const restored = await cloud.restoreSession(cached);
          if (restored?.user?.id) {
            await rememberSession(restored);
            return restored;
          }
        } catch (error) {
          // Conservamos la copia local y dejamos que supabase-js vuelva a
          // intentar la renovación. Nunca enviamos al docente al login desde
          // una operación de sincronización.
        }
      }
      return cached || null;
    } catch (error) {
      const cached = await cachedSession();
      if (cached) return cached;
      throw error;
    }
  }

  async function wrappedSignIn(email, password) {
    const session = await cloud.signIn(email, password);
    await rememberSession(session);
    return session;
  }

  async function wrappedSignInStudentCode(studentCode, options = {}) {
    if (typeof cloud.signInStudentCode !== 'function') throw new Error('Esta versión no incluye acceso por código de estudiante.');
    const session = await cloud.signInStudentCode(studentCode, options);
    await rememberSession(session);
    return session;
  }

  async function wrappedSignOut() {
    let currentSession = null;
    try { currentSession = await cloud.getSession(); } catch (_) {}
    const leavingStudentPortal = Boolean(currentSession?.encisomathStudentPortal);
    try {
      return await cloud.signOut();
    } finally {
      activeUserId = '';
      activeSnapshot = null;
      if (!leavingStudentPortal) await kvDelete(sessionKey()).catch(() => {});
      scheduleStatusUpdate();
    }
  }

  function wrappedOnAuthStateChange(callback) {
    return cloud.onAuthStateChange(async (event, session) => {
      if (session?.user?.id) await rememberSession(session);
      if (typeof callback === 'function') callback(event, session);
    });
  }

  async function wrappedLoadApplicationData(options = {}) {
    const report = (progress, label, detail = {}) => {
      if (typeof options?.onProgress !== 'function') return;
      try { options.onProgress({ progress, label, ...detail }); } catch (_) {}
    };
    report(2, 'Comprobando la copia local y la conexión...');
    let session = null;
    try { session = await wrappedGetSession(); } catch (_) {}
    if (session?.user?.id) activeUserId = String(session.user.id);
    if (isOnline()) {
      try {
        const pending = await pendingMutations();
        if (pending.length) {
          report(6, `Sincronizando ${pending.length} cambio(s) pendiente(s)...`);
          await syncNow({
            bootstrap: true,
            onProgress(detail = {}) {
              const total = Math.max(1, Number(detail.total) || pending.length || 1);
              const completed = Math.max(0, Number(detail.completed ?? detail.index) || 0);
              report(6 + (completed / total) * 24, detail.label || `Sincronizando cambios ${completed}/${total}...`, detail);
            }
          });
          const synced = await loadSnapshot(activeUserId);
          if (synced) {
            report(88, 'Preparando la copia sincronizada...');
            const hydratedSynced = await hydrateSnapshot(synced);
            prefetchEverything(synced).catch(() => {});
            scheduleStatusUpdate();
            report(100, 'Sincronización completada.');
            return hydratedSynced;
          }
        }
        report(6, 'Consultando la hora del servidor...');
        const serverSyncedAt = await getServerNow();
        const fresh = await cloud.loadApplicationData({
          onProgress(detail = {}) {
            const cloudProgress = Math.max(0, Math.min(100, Number(detail.progress) || 0));
            report(8 + cloudProgress * .78, detail.label || 'Cargando datos de Supabase...', detail);
          }
        });
        report(89, 'Guardando una copia offline segura...');
        await saveSnapshot(fresh, { serverSyncedAt });
        report(95, 'Preparando archivos y datos para la aplicación...');
        const hydrated = await hydrateSnapshot(fresh);
        prefetchEverything(fresh).catch(() => {});
        scheduleStatusUpdate();
        report(100, 'Datos preparados.');
        return hydrated;
      } catch (error) {
        if (!isNetworkError(error)) {
          const cached = await loadSnapshot(activeUserId);
          if (!cached) throw error;
          report(82, 'Supabase no respondió. Abriendo la copia local...');
          const hydratedCached = await hydrateSnapshot(cached);
          report(100, 'Copia local preparada.');
          return hydratedCached;
        }
      }
    }
    report(45, 'Sin conexión. Abriendo la copia offline...');
    const cached = await loadSnapshot(activeUserId);
    if (!cached) throw new Error('Todavía no existe una copia offline. Abre EncisoMath una vez con internet para preparar el dispositivo.');
    scheduleStatusUpdate();
    const hydratedCached = await hydrateSnapshot(cached);
    report(100, 'Copia offline preparada.');
    return hydratedCached;
  }

  const wrapped = {
    init: cloud.init,
    isConfigured: cloud.isConfigured,
    getClient: cloud.getClient,
    getSession: wrappedGetSession,
    signIn: wrappedSignIn,
    signInStudentCode: wrappedSignInStudentCode,
    signOut: wrappedSignOut,
    onAuthStateChange: wrappedOnAuthStateChange,
    loadApplicationData: wrappedLoadApplicationData,

    saveAttendanceStatus(payload) {
      return executeMutation('saveAttendanceStatus', payload, cloud.saveAttendanceStatus, optimisticAttendance);
    },
    addRockstarEvent(event) {
      return executeMutation('addRockstarEvent', { event }, ({ event: safeEvent, clientMutationId }) => cloud.addRockstarEvent({ ...safeEvent, clientMutationId }), ({ event: safeEvent }, mutationId) => optimisticRockstar(safeEvent, mutationId), {
        fallbackResult: { id: `offline-${uuid()}`, occurred_at: event.occurredAt || nowIso() },
        queueOnAnyError: true
      });
    },
    createStudentAndEnroll(payload) {
      return executeMutation('createStudentAndEnroll', payload, cloud.createStudentAndEnroll, optimisticStudent);
    },
    updateStudent(payload) {
      return executeMutation('updateStudent', payload, cloud.updateStudent, optimisticUpdateStudent);
    },
    withdrawStudent(payload) {
      return executeMutation('withdrawStudent', payload, cloud.withdrawStudent, optimisticWithdraw);
    },
    saveQuizzes(quizzes = []) {
      return executeMutation('saveQuizzes', { quizzes }, ({ quizzes: list, clientMutationId }) => cloud.saveQuizzes(list, { clientMutationId }), optimisticQuizzes);
    },
    savePreferences(preferences) {
      return executeMutation('savePreferences', { preferences }, ({ preferences: prefs, clientMutationId }) => cloud.savePreferences(prefs, { clientMutationId }), optimisticPreferences);
    },
    uploadAssignmentImage(payload) {
      return executeMutation('uploadAssignmentImage', payload, cloud.uploadAssignmentImage, optimisticAssignmentImage);
    },
    resetAssignmentImage(payload) {
      return executeMutation('resetAssignmentImage', payload, cloud.resetAssignmentImage, optimisticResetAssignmentImage);
    },
    createPdfLesson(payload) {
      return executeMutation('createPdfLesson', payload, cloud.createPdfLesson, optimisticPdfLesson);
    },
    updatePdfLesson(payload) {
      return executeMutation('updatePdfLesson', payload, cloud.updatePdfLesson, optimisticUpdatePdfLesson);
    },
    reorderLessons(payload) {
      return executeMutation('reorderLessons', payload, cloud.reorderLessons, optimisticReorderLessons);
    },
    createActivity(payload) {
      return executeMutation('createActivity', payload, cloud.createActivity, optimisticCreateActivity);
    },
    updateActivity(payload) {
      return executeMutation('updateActivity', payload, cloud.updateActivity, optimisticUpdateActivity);
    },
    reorderActivities(payload) {
      return executeMutation('reorderActivities', payload, cloud.reorderActivities, optimisticReorderActivities);
    },
    async getActivityGradebook(payload) {
      if (isOnline()) {
        try {
          const rows = await cloud.getActivityGradebook(payload);
          await gradebookPut(payload.activityId, payload.assignmentId, rows);
          for (const row of rows) {
            if (row.submissionFile?.url) cacheRemoteUrl(row.submissionFile.url, { name: row.submissionFile.name || 'Entregable', kind: 'submission' }).catch(() => {});
          }
          return rows;
        } catch (error) {
          if (!isNetworkError(error)) throw error;
        }
      }
      const cached = await gradebookGet(payload.activityId, payload.assignmentId);
      if (cached) return cached;
      const seeded = seedOfflineGradebook(payload.activityId, payload.assignmentId);
      await gradebookPut(payload.activityId, payload.assignmentId, seeded);
      return seeded;
    },
    saveActivityGrades(payload) {
      return executeMutation('saveActivityGrades', payload, cloud.saveActivityGrades, optimisticSaveGrades);
    },
    deleteActivity(payload) {
      return executeMutation('deleteActivity', payload, cloud.deleteActivity, optimisticDeleteActivity, { fallbackResult: { mode: payload.mode || 'all' } });
    },
    deletePdfLesson(payload) {
      return executeMutation('deletePdfLesson', payload, cloud.deletePdfLesson, optimisticDeleteLesson, { fallbackResult: { mode: payload.mode || 'all' } });
    },
    recordLessonView(payload) {
      return executeMutation('recordLessonView', payload, cloud.recordLessonView, null, { fallbackResult: null });
    },
    async startQuizAttempt(payload) {
      // El portal por código no tiene una sesión Auth propia. Sus intentos se
      // validan mediante RPC y deben abrirse en el servidor antes de jugar;
      // no se fabrica un intento offline que después podría quedar huérfano.
      if (isStudentPortalSnapshot()) {
        if (!isOnline()) throw new Error('Necesitas conexión a internet para iniciar un quiz.');
        return cloud.startQuizAttempt(payload);
      }
      if (isOnline()) {
        try { return await cloud.startQuizAttempt(payload); } catch (error) { if (!isNetworkError(error)) throw error; }
      }
      const localId = `offline-attempt-${uuid()}`;
      await kvSet(`quiz-attempt:${localId}`, { ...payload, localId, createdAt: nowIso() });
      return { id: localId, started_at: nowIso(), offline: true };
    },
    async submitQuizAttempt(payload) {
      // Igual que el inicio: el resultado estudiantil se guarda de inmediato
      // en la RPC segura para preservar propiedad, intentos y calificación.
      if (isStudentPortalSnapshot()) {
        if (!isOnline()) throw new Error('Necesitas conexión a internet para entregar el quiz. No cierres esta pantalla.');
        return cloud.submitQuizAttempt(payload);
      }
      if (String(payload.attemptId || '').startsWith('offline-attempt-') || !isOnline()) {
        const stored = await kvGet(`quiz-attempt:${payload.attemptId}`) || {};
        const bundle = { ...stored, ...payload, serverAttemptId: '' };
        await executeMutation('submitQuizAttemptBundle', bundle, async (safe) => {
          let attemptId = safe.serverAttemptId || '';
          if (!attemptId) {
            const started = await cloud.startQuizAttempt({ quiz: safe.quiz, assignmentId: safe.assignmentId, clientMutationId: safe.clientMutationId });
            attemptId = started?.id || '';
          }
          return cloud.submitQuizAttempt({ ...safe, attemptId });
        }, optimisticQuizBundle);
        await kvDelete(`quiz-attempt:${payload.attemptId}`).catch(() => {});
        return;
      }
      try {
        return await cloud.submitQuizAttempt(payload);
      } catch (error) {
        if (!isNetworkError(error)) throw error;
        return executeMutation('submitQuizAttemptBundle', { ...payload, serverAttemptId: payload.attemptId }, async (safe) => cloud.submitQuizAttempt({ ...safe, attemptId: safe.serverAttemptId }), optimisticQuizBundle);
      }
    },
    resolveStudentDbId: cloud.resolveStudentDbId,

    syncNow,
    prefetchEverything,
    getOfflineStatus: async () => {
      const rows = await allMutations();
      return {
        online: isOnline(),
        pending: rows.filter((item) => ['pending', 'retry', 'syncing', 'auth-required'].includes(item.status)).length,
        conflicts: rows.filter((item) => item.status === 'conflict').length,
        snapshot: currentSnapshot()?._offline || {}
      };
    }
  };

  window.EncisoSupabase = Object.freeze(wrapped);
  window.EncisoOffline = Object.freeze({
    version: OFFLINE_VERSION,
    syncNow,
    prefetchEverything,
    loadSnapshot,
    saveSnapshot,
    getStatus: wrapped.getOfflineStatus,
    openSyncCenter
  });

  window.addEventListener('online', () => {
    scheduleStatusUpdate();
    syncNow({ automatic: true }).catch(() => {});
  });
  window.addEventListener('offline', scheduleStatusUpdate);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isOnline()) syncNow({ automatic: true }).catch(() => {});
  });
  window.addEventListener('load', () => {
    ensureStatusChip();
    scheduleStatusUpdate();
    prefetchExternalScripts().catch(() => {});
    window.setInterval(() => {
      if (isOnline() && document.visibilityState === 'visible') syncNow({ automatic: true }).catch(() => {});
    }, 60000);
  });
})();
