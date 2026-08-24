((root) => {
  'use strict';

  const MANIFEST_VERSION = 5;
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

  function activityStatusRows(source = {}) {
    const value = source?.activityGrades || source?.activity_grades || source?.activity_statuses || source?.activityStatuses || [];
    return Array.isArray(value) ? value : (Array.isArray(value?.records) ? value.records : []);
  }

  function studentProgressPortalCanonical(source = {}) {
    const progress = source?.student_progress || source?.studentProgress;
    if (!progress || typeof progress !== 'object') return null;
    const attendance = asArray(progress.attendance).map((row) => ({
      assignmentId: stringValue(row?.assignment_id || row?.assignmentId),
      date: stringValue(row?.attendance_date || row?.attendanceDate || row?.date).slice(0, 10),
      status: stringValue(row?.status || 'absent').toLowerCase()
    })).filter((row) => row.assignmentId && row.date)
      .sort((a, b) => `${a.assignmentId}|${a.date}`.localeCompare(`${b.assignmentId}|${b.date}`));
    const rockstars = asArray(progress.rockstars).map((row) => ({
      id: stringValue(row?.id),
      assignmentId: stringValue(row?.assignment_id || row?.assignmentId),
      period: Number(row?.period || 1),
      date: stringValue(row?.occurred_at || row?.occurredAt || row?.date).slice(0, 10),
      points: Number(row?.points ?? row?.delta ?? 0)
    })).filter((row) => row.assignmentId && row.date)
      .sort((a, b) => `${a.assignmentId}|${a.date}|${a.id}`.localeCompare(`${b.assignmentId}|${b.date}|${b.id}`));
    const targets = asArray(progress.rockstar_targets || progress.rockstarTargets).map((row) => ({
      assignmentId: stringValue(row?.assignment_id || row?.assignmentId),
      period: Number(row?.period || 1),
      target: Number(row?.target || 15)
    })).filter((row) => row.assignmentId)
      .sort((a, b) => `${a.assignmentId}|${a.period}`.localeCompare(`${b.assignmentId}|${b.period}`));
    const gradebookConfigs = asArray(progress.gradebook_configs || progress.gradebookConfigs).map((row) => ({
      assignmentId: stringValue(row?.assignment_id || row?.assignmentId),
      period: Number(row?.period || 1),
      config: row?.config && typeof row.config === 'object' && !Array.isArray(row.config) ? row.config : {}
    })).filter((row) => row.assignmentId)
      .sort((a, b) => `${a.assignmentId}|${a.period}`.localeCompare(`${b.assignmentId}|${b.period}`));
    const hasData = progress.ok === true
      || Array.isArray(progress.attendance)
      || Array.isArray(progress.rockstars)
      || Array.isArray(progress.rockstar_targets)
      || Array.isArray(progress.rockstarTargets)
      || Array.isArray(progress.gradebook_configs)
      || Array.isArray(progress.gradebookConfigs);
    return {
      available: progress.unavailable !== true && hasData,
      attendance,
      rockstars,
      targets,
      gradebookConfigs
    };
  }

  function studentProgressSnapshotCanonical(snapshot = {}) {
    const data = snapshot?.data && typeof snapshot.data === 'object' ? snapshot.data : {};
    const userId = stringValue(snapshot?.user?.id);
    const progress = data.studentProgress && typeof data.studentProgress === 'object' ? data.studentProgress : {};
    const attendance = Object.entries(snapshot?.attendance && typeof snapshot.attendance === 'object' ? snapshot.attendance : {})
      .map(([key, values]) => {
        const separator = key.indexOf('|');
        if (separator < 0) return null;
        const assignmentId = key.slice(0, separator);
        const date = key.slice(separator + 1, separator + 11);
        const status = stringValue(values?.[userId] || 'absent').toLowerCase();
        return assignmentId && date ? { assignmentId, date, status } : null;
      })
      .filter(Boolean)
      .sort((a, b) => `${a.assignmentId}|${a.date}`.localeCompare(`${b.assignmentId}|${b.date}`));
    const rockstars = asArray(data.rockstars).map((row) => ({
      id: stringValue(row?.id),
      assignmentId: stringValue(row?.assignmentId || row?.assignment_id),
      period: Number(row?.period || 1),
      date: stringValue(row?.date || row?.occurredAt || row?.occurred_at).slice(0, 10),
      points: Number(row?.delta ?? row?.points ?? 0)
    })).filter((row) => row.assignmentId && row.date)
      .sort((a, b) => `${a.assignmentId}|${a.date}|${a.id}`.localeCompare(`${b.assignmentId}|${b.date}|${b.id}`));
    const targets = Object.entries(progress.rockstarTargets && typeof progress.rockstarTargets === 'object' ? progress.rockstarTargets : {})
      .map(([key, target]) => {
        const match = String(key).match(/^(.*)\|period-([1-4])$/);
        if (!match) return null;
        return { assignmentId: match[1], period: Number(match[2]), target: Number(target || 15) };
      })
      .filter(Boolean)
      .sort((a, b) => `${a.assignmentId}|${a.period}`.localeCompare(`${b.assignmentId}|${b.period}`));
    const gradebookConfigs = Object.entries(progress.gradebookConfigs && typeof progress.gradebookConfigs === 'object' ? progress.gradebookConfigs : {})
      .map(([key, config]) => {
        const match = String(key).match(/^(.*)\|period-([1-4])$/);
        if (!match) return null;
        return {
          assignmentId: match[1],
          period: Number(match[2]),
          config: config && typeof config === 'object' && !Array.isArray(config) ? config : {}
        };
      })
      .filter(Boolean)
      .sort((a, b) => `${a.assignmentId}|${a.period}`.localeCompare(`${b.assignmentId}|${b.period}`));
    if (!attendance.length && !rockstars.length && !targets.length && !gradebookConfigs.length && progress.available !== true && progress.available !== false) return null;
    return {
      available: progress.available === true,
      attendance,
      rockstars,
      targets,
      gradebookConfigs
    };
  }

  function appendStudentProgressEntry(entries, canonical) {
    if (!canonical) return;
    const entry = makeEntry('student-progress', 'current', canonical, []);
    if (entry) entries[entry.key] = entry;
  }

  function statusActivityId(row = {}) {
    return stringValue(row.activityId || row.activity_id);
  }

  function statusAssignmentId(row = {}) {
    return stringValue(row.assignmentId || row.assignment_id);
  }

  function statusAllGraded(row = {}) {
    return row.allGraded === true || row.all_graded === true;
  }

  function statusStickerUrl(row = {}) {
    return stringValue(row.stickerUrl || row.sticker_url);
  }

  function appendActivityStatusEntries(entries, statuses = []) {
    statuses.forEach((row) => {
      const activityId = statusActivityId(row);
      const assignmentId = statusAssignmentId(row);
      if (!activityId || !assignmentId) return;
      const studentCode = stringValue(row.studentCode || row.student_code || 'student');
      const stickerUrl = statusStickerUrl(row);
      const id = `${activityId}:${assignmentId}:${studentCode}`;
      const canonical = {
        activityId,
        assignmentId,
        studentCode,
        score: row.score == null ? null : Number(row.score),
        observations: stringValue(row.observations),
        stickerUrl,
        gradedAt: stringValue(row.gradedAt || row.graded_at),
        allGraded: statusAllGraded(row)
      };
      const entry = makeEntry('activity-status', id, canonical, collectDownloadableUrls({ stickerUrl }));
      if (entry) entries[entry.key] = entry;
    });
  }

  function reviewPayloadHasContent(type, payload = {}) {
    if (payload?.hasContent === true) return true;
    const safeType = stringValue(type || 'rich_text');
    const files = asArray(payload?.files);
    if (safeType === 'pdf' || safeType === 'image') return files.some((file) => file?.url || file?.path || file?.sourceUrl);
    if (safeType === 'html_css') return Boolean(stringValue(payload?.html));
    return Boolean(stringValue(payload?.text).replace(/<[^>]*>/g, '').trim());
  }

  function safeActivityReview(activityId, assignmentIds, type, payload, statuses) {
    const releaseEnabled = payload?.releaseEnabled === true;
    const hasContent = reviewPayloadHasContent(type, payload);
    const allGraded = assignmentIds.some((assignmentId) => statuses.some((row) => (
      statusActivityId(row) === activityId && statusAssignmentId(row) === assignmentId && statusAllGraded(row)
    )));
    const available = releaseEnabled && hasContent && allGraded;
    return {
      releaseEnabled,
      hasContent,
      allGraded,
      available,
      payload: available ? payload : { releaseEnabled, hasContent }
    };
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
    const statuses = activityStatusRows(data);

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
      const assignmentIds = assignmentIdsFromNormalized(activity);
      const reviewType = stringValue(activity.reviewType || 'rich_text');
      const review = safeActivityReview(id, assignmentIds, reviewType, activity.reviewPayload || {}, statuses);
      const canonical = {
        id,
        title: stringValue(activity.title),
        lessonId: stringValue(activity.lessonId),
        period: Number(activity.period || 1),
        status: stringValue(activity.status || 'published'),
        createdAt: stringValue(activity.createdAt),
        startsAt: stringValue(activity.startsAt),
        dueAt: stringValue(activity.dueAt),
        assignmentIds,
        contentType: stringValue(activity.contentType || 'rich_text'),
        contentPayload: portableValue(activity.contentPayload || {}),
        reviewType,
        reviewPayload: portableValue(review.payload),
        reviewHasContent: review.hasContent,
        reviewAvailable: review.available,
        rubric: portableValue(activity.rubric || []),
        rubricByAssignment: portableValue(activity.rubricByAssignment || {})
      };
      const urls = collectDownloadableUrls({
        contentPayload: activity.contentPayload || {},
        reviewPayload: review.payload
      });
      const entry = makeEntry('activity', id, canonical, urls);
      if (entry) entries[entry.key] = entry;
    });

    appendActivityStatusEntries(entries, statuses);
    appendStudentProgressEntry(entries, studentProgressSnapshotCanonical(snapshot));
    return { version: MANIFEST_VERSION, entries };
  }

  function nestedRecord(row, name) {
    const value = row?.[name];
    if (Array.isArray(value)) return value[0] || null;
    return value && typeof value === 'object' ? value : row;
  }

  function manifestFromPortalPayload(payload = {}) {
    const statuses = activityStatusRows(payload);
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
      if (!activityGroups.has(id)) activityGroups.set(id, { activity, assignmentIds: new Set(), rubricByAssignment: new Map() });
      const group = activityGroups.get(id);
      const assignmentId = stringValue(row?.assignment_id || row?.assignmentId);
      if (assignmentId) {
        group.assignmentIds.add(assignmentId);
        const assignmentRubric = Array.isArray(row?.rubric) ? row.rubric : (Array.isArray(activity?.rubric) ? activity.rubric : []);
        group.rubricByAssignment.set(assignmentId, assignmentRubric);
      }
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

    activityGroups.forEach(({ activity, assignmentIds, rubricByAssignment }, id) => {
      const contentPayload = activity.content_payload || activity.contentPayload || {};
      const rawReviewPayload = activity.review_payload || activity.reviewPayload || {};
      const safeAssignmentIds = uniqueStrings([...assignmentIds]);
      const reviewType = stringValue(activity.review_type || activity.reviewType || 'rich_text');
      const review = safeActivityReview(id, safeAssignmentIds, reviewType, rawReviewPayload, statuses);
      const canonical = {
        id,
        title: stringValue(activity.title),
        lessonId: stringValue(activity.lesson_id || activity.lessonId),
        period: Number(activity.period || 1),
        status: stringValue(activity.status || 'published'),
        createdAt: stringValue(activity.created_at || activity.createdAt),
        startsAt: stringValue(activity.starts_at || activity.startsAt),
        dueAt: stringValue(activity.due_at || activity.dueAt),
        assignmentIds: safeAssignmentIds,
        contentType: stringValue(activity.content_type || activity.contentType || 'rich_text'),
        contentPayload: portableValue(contentPayload),
        reviewType,
        reviewPayload: portableValue(review.payload),
        reviewHasContent: review.hasContent,
        reviewAvailable: review.available,
        rubric: portableValue(activity.rubric || []),
        rubricByAssignment: portableValue(Object.fromEntries(rubricByAssignment || []))
      };
      const entry = makeEntry('activity', id, canonical, collectDownloadableUrls({ contentPayload, reviewPayload: review.payload }));
      if (entry) entries[entry.key] = entry;
    });

    appendActivityStatusEntries(entries, statuses);
    appendStudentProgressEntry(entries, studentProgressPortalCanonical(payload));
    return { version: MANIFEST_VERSION, entries };
  }

  function sanitizePortalPayload(payload = {}) {
    let clone;
    try { clone = JSON.parse(JSON.stringify(payload || {})); }
    catch (_) { clone = { ...(payload || {}) }; }
    const statuses = activityStatusRows(clone);
    const groupedAssignments = new Map();
    asArray(clone.activities).forEach((row) => {
      const activity = nestedRecord(row, 'activity');
      const id = stringValue(activity?.id);
      if (!id) return;
      if (!groupedAssignments.has(id)) groupedAssignments.set(id, new Set());
      const assignmentId = stringValue(row?.assignment_id || row?.assignmentId);
      if (assignmentId) groupedAssignments.get(id).add(assignmentId);
    });
    asArray(clone.activities).forEach((row) => {
      const activity = nestedRecord(row, 'activity');
      const id = stringValue(activity?.id);
      if (!id) return;
      const reviewType = stringValue(activity.review_type || activity.reviewType || 'rich_text');
      const rawPayload = activity.review_payload || activity.reviewPayload || {};
      const review = safeActivityReview(id, uniqueStrings([...(groupedAssignments.get(id) || [])]), reviewType, rawPayload, statuses);
      if (review.available) return;
      const lockedPayload = { releaseEnabled: review.releaseEnabled, hasContent: review.hasContent };
      if ('review_payload' in activity) activity.review_payload = lockedPayload;
      if ('reviewPayload' in activity) activity.reviewPayload = lockedPayload;
    });
    return clone;
  }

  root.EncisoContentSync = Object.freeze({
    version: MANIFEST_VERSION,
    hashString,
    stableStringify,
    collectDownloadableUrls,
    manifestFromSnapshot,
    manifestFromPortalPayload,
    sanitizePortalPayload
  });
})(globalThis);
