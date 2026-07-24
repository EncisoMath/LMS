((root) => {
  'use strict';

  const MANIFEST_VERSION = 1;
  const FILE_EXTENSION_RE = /\.(?:pdf|png|jpe?g|webp|gif|svg|avif|bmp|txt|csv|docx?|xlsx?|pptx?|zip|mp3|m4a|ogg|wav|mp4|webm)(?:$|[?#])/i;
  const OMIT_KEYS = new Set([
    'progressByAssignment', 'sortOrderByAssignment', 'objectUrl', 'localBlobKey',
    'cachedAt', 'lastAccessed', 'downloadProgress', 'uploadProgress'
  ]);

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function stringValue(value) {
    return String(value ?? '').trim();
  }

  function uniqueStrings(values) {
    return [...new Set(asArray(values).map(stringValue).filter(Boolean))].sort();
  }

  function portableValue(value, parent = null) {
    if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      if (value.startsWith('blob:')) return stringValue(parent?.sourceUrl || parent?.contentUrl || '');
      return value;
    }
    if (Array.isArray(value)) return value.map((item) => portableValue(item, null));
    if (typeof value !== 'object') return String(value);
    const output = {};
    Object.keys(value).sort().forEach((key) => {
      if (OMIT_KEYS.has(key) || key.startsWith('_')) return;
      output[key] = portableValue(value[key], value);
    });
    return output;
  }

  function stableStringify(value) {
    return JSON.stringify(portableValue(value));
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

  function normalizedHttpUrl(value) {
    const text = stringValue(value);
    if (!/^https?:\/\//i.test(text)) return '';
    try { return new URL(text).href; } catch (_) { return ''; }
  }

  function isDownloadableUrl(value) {
    const href = normalizedHttpUrl(value);
    if (!href) return false;
    try {
      const url = new URL(href);
      if (url.hostname.endsWith('.supabase.co') && url.pathname.includes('/storage/v1/object/')) return true;
      return FILE_EXTENSION_RE.test(`${url.pathname}${url.search}`);
    } catch (_) {
      return false;
    }
  }

  function collectDownloadableUrls(value, output = new Set(), parent = null) {
    if (value == null) return output;
    if (typeof value === 'string') {
      const source = value.startsWith('blob:') ? stringValue(parent?.sourceUrl || '') : value;
      const direct = normalizedHttpUrl(source);
      if (direct && isDownloadableUrl(direct)) output.add(direct);
      const matches = String(source).match(/https?:\/\/[^\s"'<>\)]+/gi) || [];
      matches.forEach((candidate) => {
        const cleaned = candidate.replace(/[;,]+$/, '');
        if (isDownloadableUrl(cleaned)) output.add(normalizedHttpUrl(cleaned));
      });
      return output;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => collectDownloadableUrls(item, output, null));
      return output;
    }
    if (typeof value === 'object') {
      Object.values(value).forEach((item) => collectDownloadableUrls(item, output, value));
    }
    return output;
  }

  function makeEntry(kind, id, canonical, urls) {
    const safeId = stringValue(id);
    if (!safeId) return null;
    const key = `${kind}:${safeId}`;
    const safeUrls = uniqueStrings([...urls].filter(isDownloadableUrl));
    return {
      key,
      kind,
      id: safeId,
      signature: hashString(stableStringify(canonical)),
      urls: safeUrls
    };
  }

  function assignmentIdsFromNormalized(item = {}) {
    return uniqueStrings([
      ...asArray(item.assignmentIds),
      ...asArray(item.targetAssignmentIds),
      item.assignmentId
    ]);
  }

  function manifestFromSnapshot(snapshot = {}) {
    const entries = {};
    const data = snapshot?.data && typeof snapshot.data === 'object' ? snapshot.data : {};

    asArray(data.classes).forEach((lesson) => {
      const id = stringValue(lesson?.id);
      if (!id) return;
      const contentUrl = stringValue(lesson.sourceContentUrl || lesson.contentUrl);
      const thumbnailUrl = stringValue(lesson.sourceThumbnailUrl || lesson.thumbnailUrl);
      const canonical = {
        id,
        title: stringValue(lesson.title),
        area: stringValue(lesson.area),
        subject: stringValue(lesson.subject),
        emoji: stringValue(lesson.emoji || '📘'),
        estimatedTime: stringValue(lesson.estimatedTime),
        period: Number(lesson.period || 1),
        status: stringValue(lesson.status || 'published'),
        createdAt: stringValue(lesson.createdAt),
        assignmentIds: assignmentIdsFromNormalized(lesson),
        contentUrl,
        thumbnailUrl,
        sourceFileName: stringValue(lesson.sourceFileName),
        pageCount: Number(lesson.pageCount || 0),
        contentType: stringValue(lesson.lessonType || lesson.type || 'Clase')
      };
      const urls = collectDownloadableUrls({ contentUrl, thumbnailUrl });
      const entry = makeEntry('lesson', id, canonical, urls);
      if (entry) entries[entry.key] = entry;
    });

    asArray(data.activities).forEach((activity) => {
      const id = stringValue(activity?.id);
      if (!id) return;
      const canonical = {
        id,
        title: stringValue(activity.title),
        lessonId: stringValue(activity.lessonId),
        period: Number(activity.period || 1),
        status: stringValue(activity.status || 'published'),
        createdAt: stringValue(activity.createdAt),
        startsAt: stringValue(activity.startsAt),
        dueAt: stringValue(activity.dueAt),
        assignmentIds: assignmentIdsFromNormalized(activity),
        contentType: stringValue(activity.contentType || 'rich_text'),
        contentPayload: portableValue(activity.contentPayload || {}),
        reviewType: stringValue(activity.reviewType || 'rich_text'),
        reviewPayload: portableValue(activity.reviewPayload || {}),
        rubric: portableValue(activity.rubric || [])
      };
      const urls = collectDownloadableUrls({
        contentPayload: activity.contentPayload || {},
        reviewPayload: activity.reviewPayload || {}
      });
      const entry = makeEntry('activity', id, canonical, urls);
      if (entry) entries[entry.key] = entry;
    });

    return { version: MANIFEST_VERSION, entries };
  }

  function nestedRecord(row, name) {
    const value = row?.[name];
    if (Array.isArray(value)) return value[0] || null;
    return value && typeof value === 'object' ? value : row;
  }

  function manifestFromPortalPayload(payload = {}) {
    const lessonGroups = new Map();
    asArray(payload.lessons).forEach((row) => {
      const lesson = nestedRecord(row, 'lesson');
      const id = stringValue(lesson?.id);
      if (!id) return;
      if (!lessonGroups.has(id)) lessonGroups.set(id, { lesson, assignmentIds: new Set() });
      const group = lessonGroups.get(id);
      const assignmentId = stringValue(row?.assignment_id || row?.assignmentId);
      if (assignmentId && row?.visible !== false) group.assignmentIds.add(assignmentId);
    });

    const activityGroups = new Map();
    asArray(payload.activities).forEach((row) => {
      const activity = nestedRecord(row, 'activity');
      const id = stringValue(activity?.id);
      if (!id) return;
      if (!activityGroups.has(id)) activityGroups.set(id, { activity, assignmentIds: new Set() });
      const group = activityGroups.get(id);
      const assignmentId = stringValue(row?.assignment_id || row?.assignmentId);
      if (assignmentId) group.assignmentIds.add(assignmentId);
    });

    const entries = {};
    lessonGroups.forEach(({ lesson, assignmentIds }, id) => {
      const contentUrl = stringValue(lesson.content_url || lesson.contentUrl);
      const thumbnailUrl = stringValue(lesson.thumbnail_url || lesson.thumbnailUrl);
      const canonical = {
        id,
        title: stringValue(lesson.title),
        area: stringValue(lesson.area),
        subject: stringValue(lesson.subject_name || lesson.subject),
        emoji: stringValue(lesson.emoji || '📘'),
        estimatedTime: stringValue(lesson.estimated_time || lesson.estimatedTime),
        period: Number(lesson.period || 1),
        status: stringValue(lesson.status || 'published'),
        createdAt: stringValue(lesson.created_at || lesson.createdAt),
        assignmentIds: uniqueStrings([...assignmentIds]),
        contentUrl,
        thumbnailUrl,
        sourceFileName: stringValue(lesson.source_file_name || lesson.sourceFileName),
        pageCount: Number(lesson.page_count || lesson.pageCount || 0),
        contentType: stringValue(lesson.lesson_type || lesson.lessonType || lesson.type || 'Clase')
      };
      const entry = makeEntry('lesson', id, canonical, collectDownloadableUrls({ contentUrl, thumbnailUrl }));
      if (entry) entries[entry.key] = entry;
    });

    activityGroups.forEach(({ activity, assignmentIds }, id) => {
      const contentPayload = activity.content_payload || activity.contentPayload || {};
      const reviewPayload = activity.review_payload || activity.reviewPayload || {};
      const canonical = {
        id,
        title: stringValue(activity.title),
        lessonId: stringValue(activity.lesson_id || activity.lessonId),
        period: Number(activity.period || 1),
        status: stringValue(activity.status || 'published'),
        createdAt: stringValue(activity.created_at || activity.createdAt),
        startsAt: stringValue(activity.starts_at || activity.startsAt),
        dueAt: stringValue(activity.due_at || activity.dueAt),
        assignmentIds: uniqueStrings([...assignmentIds]),
        contentType: stringValue(activity.content_type || activity.contentType || 'rich_text'),
        contentPayload: portableValue(contentPayload),
        reviewType: stringValue(activity.review_type || activity.reviewType || 'rich_text'),
        reviewPayload: portableValue(reviewPayload),
        rubric: portableValue(activity.rubric || [])
      };
      const entry = makeEntry('activity', id, canonical, collectDownloadableUrls({ contentPayload, reviewPayload }));
      if (entry) entries[entry.key] = entry;
    });

    return { version: MANIFEST_VERSION, entries };
  }

  root.EncisoContentSync = Object.freeze({
    version: MANIFEST_VERSION,
    hashString,
    stableStringify,
    collectDownloadableUrls,
    manifestFromSnapshot,
    manifestFromPortalPayload
  });
})(globalThis);
