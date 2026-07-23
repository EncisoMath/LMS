(() => {
  'use strict';

  const config = window.ENCISOMATH_SUPABASE || {};
  let client = null;
  let publicStudentClient = null;
  let session = null;
  let teacherSession = null;
  let sessionRefreshPromise = null;
  let profile = null;
  let assignments = [];
  let studentCodeToDbId = new Map();
  let studentDbIdToCode = new Map();
  let lastAuthVerifiedAt = 0;
  let lastAuthVerifiedUserId = '';
  let studentPortalSession = null;

  const STUDENT_PORTAL_LOCAL_KEY = 'encisomath:studentPortalCode';
  const STUDENT_PORTAL_SESSION_KEY = 'encisomath:studentPortalCodeSession';

  const LEGACY_DEMO_LESSON_IDS = [
    'bar-charts',
    'frequency-tables',
    'central-tendency',
    'probability-intro',
    'final-project',
    'boxplot',
    'dispersion-measures'
  ];
  const LEGACY_DEMO_QUIZ_IDS = ['quiz-demo-estadistica-p1'];
  const LEGACY_DEMO_CLEANUP_KEY = 'encisomath:legacyDemoCleanup:v0.24.308';

  function nestedId(row, key) {
    const value = row?.[key];
    const nested = Array.isArray(value) ? value[0] : value;
    return String(nested?.id || '');
  }

  async function purgeLegacyDemoContent(assignmentIds = []) {
    try {
      if (localStorage.getItem(LEGACY_DEMO_CLEANUP_KEY) === 'done') return true;
    } catch (_) {}

    const supabaseClient = getClient();
    const errors = [];
    const collect = (result, label) => {
      if (result?.error) errors.push(`${label}: ${result.error.message || 'error desconocido'}`);
    };

    if (assignmentIds.length) {
      collect(await supabaseClient
        .from('assignment_lessons')
        .delete()
        .in('assignment_id', assignmentIds)
        .in('lesson_id', LEGACY_DEMO_LESSON_IDS), 'assignment_lessons');

      collect(await supabaseClient
        .from('quiz_assignments')
        .delete()
        .in('assignment_id', assignmentIds)
        .in('quiz_id', LEGACY_DEMO_QUIZ_IDS), 'quiz_assignments');
    }

    collect(await supabaseClient.from('lessons').delete().in('id', LEGACY_DEMO_LESSON_IDS), 'lessons');
    collect(await supabaseClient.from('quizzes').delete().in('id', LEGACY_DEMO_QUIZ_IDS), 'quizzes');

    if (errors.length) {
      console.warn('No se pudo completar la limpieza automática del contenido demo:', errors);
      return false;
    }
    try { localStorage.setItem(LEGACY_DEMO_CLEANUP_KEY, 'done'); } catch (_) {}
    return true;
  }

  function assertConfigured() {
    if (!config.url || !config.publishableKey) {
      throw new Error('Falta configurar Supabase en supabase-config.js.');
    }
    if (!window.supabase?.createClient) {
      throw new Error('No se pudo cargar la libreria supabase-js.');
    }
  }

  function init() {
    if (client) return client;
    assertConfigured();
    client = window.supabase.createClient(config.url, config.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: config.authStorageKey || 'encisomath.supabase.auth.v1'
      },
      global: {
        headers: { 'x-application-name': 'EncisoMath-LMS' }
      }
    });
    return client;
  }

  function getClient() {
    return client || init();
  }

  function getStudentClient() {
    if (publicStudentClient) return publicStudentClient;
    assertConfigured();
    publicStudentClient = window.supabase.createClient(config.url, config.publishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: `${config.authStorageKey || 'encisomath.supabase.auth.v1'}.student-public`
      },
      global: {
        headers: { 'x-application-name': 'EncisoMath-LMS-Student' }
      }
    });
    return publicStudentClient;
  }

  function isConfigured() {
    return Boolean(config.url && config.publishableKey);
  }

  function normalizeError(error, fallback = 'Ocurrio un error al comunicarse con Supabase.') {
    if (!error) return new Error(fallback);
    if (error instanceof Error) return error;
    const normalized = new Error(error.message || error.error_description || fallback);
    if (error.code) normalized.code = error.code;
    if (error.status) normalized.status = error.status;
    if (error.statusCode) normalized.statusCode = error.statusCode;
    if (error.details) normalized.details = error.details;
    return normalized;
  }

  function authSessionError(message = 'La sesión se está recuperando automáticamente. El cambio quedará pendiente hasta que Supabase responda.') {
    const error = new Error(message);
    error.code = 'AUTH_SESSION_REQUIRED';
    error.status = 401;
    return error;
  }


  function normalizeStudentPortalCode(value) {
    return String(value || '').trim();
  }

  function readStoredStudentPortalState() {
    try {
      const sessionCode = normalizeStudentPortalCode(sessionStorage.getItem(STUDENT_PORTAL_SESSION_KEY) || '');
      if (sessionCode) return { code: sessionCode, remember: false };
      const localCode = normalizeStudentPortalCode(localStorage.getItem(STUDENT_PORTAL_LOCAL_KEY) || '');
      return { code: localCode, remember: Boolean(localCode) };
    } catch (_) {
      return { code: '', remember: false };
    }
  }

  function readStoredStudentPortalCode() {
    return readStoredStudentPortalState().code;
  }

  function storeStudentPortalCode(code, remember = true) {
    const safeCode = normalizeStudentPortalCode(code);
    clearStudentPortalAccess();
    if (!safeCode) return;
    try {
      (remember ? localStorage : sessionStorage).setItem(remember ? STUDENT_PORTAL_LOCAL_KEY : STUDENT_PORTAL_SESSION_KEY, safeCode);
    } catch (_) {}
  }

  function clearStudentPortalAccess() {
    studentPortalSession = null;
    try { localStorage.removeItem(STUDENT_PORTAL_LOCAL_KEY); } catch (_) {}
    try { sessionStorage.removeItem(STUDENT_PORTAL_SESSION_KEY); } catch (_) {}
  }

  function createStudentPortalSession(code, portalData = null, remember = true) {
    const safeCode = normalizeStudentPortalCode(code);
    return {
      user: {
        id: `student:${safeCode}`,
        email: '',
        role: 'student',
        app_metadata: { provider: 'student_code' },
        user_metadata: { student_code: safeCode }
      },
      access_token: '',
      refresh_token: '',
      expires_at: 0,
      token_type: 'student-code',
      encisomathStudentPortal: true,
      encisomathRemember: remember !== false,
      studentCode: safeCode,
      portalData
    };
  }

  function isUniqueViolation(error) {
    const code = String(error?.code || '').trim();
    const message = String(error?.message || error?.details || '').toLowerCase();
    return code === '23505' || message.includes('duplicate key value') || message.includes('unique constraint');
  }

  function selectWithMutationId(columns = '*') {
    const value = String(columns || '*').trim();
    if (!value || value === '*') return '*';
    const parts = value.split(',').map((part) => part.trim()).filter(Boolean);
    if (!parts.includes('client_mutation_id')) parts.push('client_mutation_id');
    return parts.join(',');
  }

  async function insertIdempotentByMutationId(table, rows, columns = '*', fallback = 'No se pudo guardar el cambio.') {
    const inputWasArray = Array.isArray(rows);
    const list = (inputWasArray ? rows : [rows]).filter(Boolean);
    if (!list.length) return inputWasArray ? [] : null;

    const mutationIds = [...new Set(list.map((row) => String(row?.client_mutation_id || '').trim()).filter(Boolean))];
    const selectedColumns = selectWithMutationId(columns);
    let existingRows = [];

    if (mutationIds.length) {
      const lookup = await getClient()
        .from(table)
        .select(selectedColumns)
        .in('client_mutation_id', mutationIds);
      if (lookup.error) throw normalizeError(lookup.error, fallback);
      existingRows = lookup.data || [];
    }

    const existingIds = new Set(existingRows.map((row) => String(row?.client_mutation_id || '')).filter(Boolean));
    const missingRows = list.filter((row) => {
      const mutationId = String(row?.client_mutation_id || '').trim();
      return !mutationId || !existingIds.has(mutationId);
    });
    let insertedRows = [];

    if (missingRows.length) {
      let insertQuery = getClient().from(table).insert(inputWasArray ? missingRows : missingRows[0]);
      if (selectedColumns) insertQuery = insertQuery.select(selectedColumns);
      const inserted = await insertQuery;
      if (inserted.error) {
        if (!isUniqueViolation(inserted.error) || missingRows.some((row) => !String(row?.client_mutation_id || '').trim())) {
          throw normalizeError(inserted.error, fallback);
        }
        const retryIds = [...new Set(missingRows.map((row) => String(row.client_mutation_id)).filter(Boolean))];
        const retryLookup = await getClient()
          .from(table)
          .select(selectedColumns)
          .in('client_mutation_id', retryIds);
        if (retryLookup.error) throw normalizeError(retryLookup.error, fallback);
        const foundIds = new Set((retryLookup.data || []).map((row) => String(row?.client_mutation_id || '')).filter(Boolean));
        if (retryIds.some((id) => !foundIds.has(id))) throw normalizeError(inserted.error, fallback);
        insertedRows = retryLookup.data || [];
      } else {
        insertedRows = inserted.data || [];
      }
    }

    const merged = [...existingRows, ...insertedRows];
    if (inputWasArray) return merged;
    const targetId = String(list[0]?.client_mutation_id || '').trim();
    return (targetId ? merged.find((row) => String(row?.client_mutation_id || '') === targetId) : null)
      || insertedRows[0]
      || existingRows[0]
      || null;
  }

  function cacheTeacherSession(nextSession) {
    teacherSession = nextSession?.user?.id ? nextSession : null;
    if (!readStoredStudentPortalCode()) session = teacherSession;
    return teacherSession;
  }

  async function refreshPersistentSession(candidateSession = null) {
    if (sessionRefreshPromise) return sessionRefreshPromise;
    sessionRefreshPromise = (async () => {
      const supabaseClient = getClient();
      let activeSession = candidateSession?.user?.id ? candidateSession : teacherSession;

      const currentResult = await supabaseClient.auth.getSession();
      if (!currentResult.error && currentResult.data?.session?.user?.id) {
        activeSession = currentResult.data.session;
      }
      if (!activeSession?.user?.id) return null;

      const expiresAt = Number(activeSession.expires_at || 0);
      const stillFresh = !expiresAt || expiresAt > Math.floor(Date.now() / 1000) + 120;
      if (stillFresh) return cacheTeacherSession(activeSession);

      // No enviamos manualmente el refresh_token. Supabase administra su
      // rotación y el bloqueo entre pestañas; así evitamos que dos guardados
      // simultáneos intenten consumir el mismo token.
      const refreshResult = await supabaseClient.auth.refreshSession();
      if (!refreshResult.error && refreshResult.data?.session?.user?.id) {
        lastAuthVerifiedUserId = String(refreshResult.data.session.user.id);
        lastAuthVerifiedAt = Date.now();
        return cacheTeacherSession(refreshResult.data.session);
      }

      // Otra pestaña o el refresco automático pudo haber ganado la carrera.
      await new Promise((resolve) => window.setTimeout(resolve, 350));
      const retryResult = await supabaseClient.auth.getSession();
      if (!retryResult.error && retryResult.data?.session?.user?.id) {
        lastAuthVerifiedUserId = String(retryResult.data.session.user.id);
        lastAuthVerifiedAt = Date.now();
        return cacheTeacherSession(retryResult.data.session);
      }

      throw authSessionError(refreshResult.error?.message || 'Supabase no pudo renovar la sesión en este momento. Se reintentará automáticamente.');
    })().finally(() => {
      sessionRefreshPromise = null;
    });
    return sessionRefreshPromise;
  }

  async function getSession() {
    const storedStudent = readStoredStudentPortalState();
    const studentCode = storedStudent.code;
    if (studentCode) {
      if (!studentPortalSession || studentPortalSession.studentCode !== studentCode) {
        studentPortalSession = createStudentPortalSession(studentCode, null, storedStudent.remember);
      }
      session = studentPortalSession;
      return session;
    }

    const supabaseClient = getClient();
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) {
      if (teacherSession?.user?.id) return teacherSession;
      throw normalizeError(error, 'No se pudo recuperar la sesión guardada.');
    }
    return cacheTeacherSession(data?.session || null);
  }

  async function restoreSession(storedSession = {}) {
    const supabaseClient = getClient();
    const currentResult = await supabaseClient.auth.getSession();
    if (!currentResult.error && currentResult.data?.session?.user?.id) {
      return cacheTeacherSession(currentResult.data.session);
    }

    const accessToken = String(storedSession?.access_token || '').trim();
    const refreshToken = String(storedSession?.refresh_token || '').trim();
    if (!accessToken || !refreshToken) return teacherSession;

    const { data, error } = await supabaseClient.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });
    if (!error && data?.session?.user?.id) return cacheTeacherSession(data.session);

    // Si el token fue rotado por otra pestaña, releemos el almacenamiento
    // oficial de supabase-js antes de considerar fallida la restauración.
    await new Promise((resolve) => window.setTimeout(resolve, 350));
    const retryResult = await supabaseClient.auth.getSession();
    if (!retryResult.error && retryResult.data?.session?.user?.id) {
      return cacheTeacherSession(retryResult.data.session);
    }

    throw authSessionError(error?.message || 'La sesión guardada se reintentará automáticamente.');
  }

  async function requireAuthenticatedSession() {
    const supabaseClient = getClient();
    let activeSession = null;
    const sessionResult = await supabaseClient.auth.getSession();
    if (!sessionResult.error && sessionResult.data?.session?.user?.id) {
      activeSession = sessionResult.data.session;
    } else if (teacherSession?.user?.id) {
      activeSession = teacherSession;
    }

    if (!activeSession?.user?.id) {
      throw authSessionError('Supabase está recuperando la sesión docente. El cambio se guardará y se reintentará automáticamente.');
    }

    const expiresAt = Number(activeSession.expires_at || 0);
    const expiresSoon = Boolean(expiresAt) && expiresAt <= Math.floor(Date.now() / 1000) + 120;
    if (expiresSoon) activeSession = await refreshPersistentSession(activeSession);
    if (!activeSession?.user?.id) {
      throw authSessionError('Supabase está recuperando la sesión docente. El cambio se guardará y se reintentará automáticamente.');
    }

    cacheTeacherSession(activeSession);
    lastAuthVerifiedUserId = String(activeSession.user.id);
    lastAuthVerifiedAt = Date.now();
    return activeSession;
  }

  async function signIn(email, password) {
    clearStudentPortalAccess();
    const supabaseClient = getClient();
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: String(email || '').trim().toLowerCase(),
      password: String(password || '')
    });
    if (error) {
      throw normalizeError(error, 'No se pudo iniciar sesión.');
    }
    const activeSession = cacheTeacherSession(data?.session || null);
    if (activeSession?.user?.id) {
      lastAuthVerifiedUserId = String(activeSession.user.id);
      lastAuthVerifiedAt = Date.now();
    }
    return activeSession;
  }

  async function signInStudentCode(studentCode, options = {}) {
    const code = normalizeStudentPortalCode(studentCode);
    if (!code) throw new Error('Escribe el usuario o código del estudiante.');
    const remember = options.remember !== false;

    // El portal estudiantil usa un cliente público separado. La sesión docente
    // permanece intacta y continúa renovándose en segundo plano.
    const { data, error } = await getStudentClient().rpc('encisomath_student_portal', { p_student_code: code });
    if (error) {
      const message = String(error.message || '').toLowerCase();
      if (error.code === 'PGRST202' || message.includes('encisomath_student_portal')) {
        throw new Error('Falta ejecutar en Supabase el archivo SUPABASE_STUDENT_USERNAME_v0.25.010.sql.');
      }
      throw normalizeError(error, 'No se pudo comprobar el usuario o código del estudiante.');
    }
    if (!data || data.ok === false) throw new Error(data?.message || 'No encontramos un estudiante activo con ese usuario o código.');
    const canonicalCode = normalizeStudentPortalCode(data?.student?.student_code || code);
    storeStudentPortalCode(canonicalCode, remember);
    studentPortalSession = createStudentPortalSession(canonicalCode, data, remember);
    session = studentPortalSession;
    return session;
  }

  async function signOut() {
    const supabaseClient = getClient();
    const leavingStudentPortal = Boolean(readStoredStudentPortalCode() || session?.encisomathStudentPortal);
    clearStudentPortalAccess();

    if (leavingStudentPortal) {
      const currentResult = await supabaseClient.auth.getSession().catch(() => ({ data: null }));
      cacheTeacherSession(currentResult?.data?.session || teacherSession || null);
      profile = null;
      assignments = [];
      studentCodeToDbId = new Map();
      studentDbIdToCode = new Map();
      return { preservedTeacherSession: Boolean(teacherSession?.user?.id) };
    }

    const { error } = await supabaseClient.auth.signOut();
    session = null;
    teacherSession = null;
    lastAuthVerifiedAt = 0;
    lastAuthVerifiedUserId = '';
    profile = null;
    assignments = [];
    studentCodeToDbId = new Map();
    studentDbIdToCode = new Map();
    if (error) throw normalizeError(error, 'No se pudo cerrar la sesión.');
    return { preservedTeacherSession: false };
  }

  function onAuthStateChange(callback) {
    const supabaseClient = getClient();
    return supabaseClient.auth.onAuthStateChange((event, nextSession) => {
      teacherSession = nextSession?.user?.id ? nextSession : null;
      const studentCode = readStoredStudentPortalCode();
      if (studentCode) {
        if (!studentPortalSession || studentPortalSession.studentCode !== studentCode) {
          studentPortalSession = createStudentPortalSession(studentCode, null, readStoredStudentPortalState().remember);
        }
        session = studentPortalSession;
        return;
      }
      session = teacherSession;
      if (typeof callback === 'function') callback(event, teacherSession);
    });
  }

  function mapProfile(row, authUser = null) {
    const externalCode = String(row?.external_code || row?.student?.student_code || row?.username || row?.id || '');
    return {
      id: externalCode,
      authId: row?.id || authUser?.id || '',
      dbStudentId: row?.student_id || null,
      username: row?.username || externalCode,
      role: row?.role || 'student',
      fullName: row?.full_name || authUser?.email || 'Usuario',
      email: row?.email || authUser?.email || '',
      photo: row?.photo_url || './assets/default-profile.svg',
      active: row?.active !== false
    };
  }

  function mapAssignment(row, appUser) {
    const subject = Array.isArray(row?.subject) ? row.subject[0] : row?.subject;
    const group = Array.isArray(row?.group) ? row.group[0] : row?.group;
    return {
      id: String(row?.id || ''),
      teacherId: appUser?.id || String(row?.teacher_id || ''),
      teacherAuthId: row?.teacher_id || '',
      subjectId: row?.subject_id || '',
      groupId: row?.group_id || group?.id || '',
      area: subject?.area || '',
      subject: subject?.name || '',
      grade: String(group?.grade ?? ''),
      course: String(group?.course ?? ''),
      sede: group?.campus || 'Municipal',
      groupLabel: group?.label || `${group?.grade ?? ''}-${group?.course ?? ''}`,
      icon: row?.icon_url || './assets/subject-statistics.svg',
      cover: row?.cover_url || '',
      active: row?.active !== false
    };
  }

  function mapStudent(enrollment) {
    const student = Array.isArray(enrollment?.student) ? enrollment.student[0] : enrollment?.student;
    const group = Array.isArray(enrollment?.group) ? enrollment.group[0] : enrollment?.group;
    if (!student) return null;
    const code = String(student.student_code || student.id || '');
    studentCodeToDbId.set(code, student.id);
    studentDbIdToCode.set(student.id, code);
    return {
      id: code,
      dbId: student.id,
      username: student.username || code,
      fullName: `${student.last_name || ''}, ${student.first_name || ''}`.replace(/^,\s*/, '').trim() || student.display_name || code,
      firstName: student.first_name || '',
      lastName: student.last_name || '',
      grade: String(group?.grade ?? ''),
      course: String(group?.course ?? ''),
      sede: group?.campus || 'Municipal',
      groupId: enrollment?.group_id || group?.id || '',
      enrollmentId: enrollment?.id || '',
      enrollmentStatus: enrollment?.status || 'active',
      photo: student.photo_url || './assets/default-avatar.svg',
      active: student.active !== false && enrollment?.status === 'active'
    };
  }

  function mapLesson(row) {
    const lesson = Array.isArray(row?.lesson) ? row.lesson[0] : row?.lesson;
    if (!lesson) return null;
    return {
      id: String(lesson.id || ''),
      period: Number(lesson.period || 1),
      area: lesson.area || '',
      subject: lesson.subject_name || '',
      title: lesson.title || '',
      emoji: lesson.emoji || '📘',
      type: lesson.lesson_type || 'Clase',
      estimatedTime: lesson.estimated_time || '',
      contentUrl: lesson.content_url || '',
      thumbnailUrl: lesson.thumbnail_url || '',
      storagePdfPath: lesson.storage_pdf_path || '',
      storageThumbnailPath: lesson.storage_thumbnail_path || '',
      sourceFileName: lesson.source_file_name || '',
      pageCount: Number(lesson.page_count || 1),
      lessonType: lesson.lesson_type || 'Clase',
      status: lesson.status || 'published',
      assignmentId: row?.assignment_id || '',
      assignmentIds: row?.assignment_id ? [row.assignment_id] : [],
      sortOrder: Number(row?.sort_order || 0)
    };
  }

  function mapActivity(row) {
    const activity = Array.isArray(row?.activity) ? row.activity[0] : row?.activity;
    if (!activity) return null;
    return {
      id: String(activity.id || ''),
      title: activity.title || 'Actividad',
      lessonId: activity.lesson_id || '',
      period: Number(activity.period || 1),
      startsAt: activity.starts_at || '',
      dueAt: activity.due_at || '',
      contentType: activity.content_type || 'rich_text',
      contentPayload: activity.content_payload && typeof activity.content_payload === 'object' ? activity.content_payload : {},
      reviewType: activity.review_type || 'rich_text',
      reviewPayload: activity.review_payload && typeof activity.review_payload === 'object' ? activity.review_payload : {},
      rubric: Array.isArray(activity.rubric) ? activity.rubric : [],
      status: activity.status || 'published',
      assignmentId: row?.assignment_id || '',
      assignmentIds: row?.assignment_id ? [row.assignment_id] : [],
      sortOrder: Number(row?.sort_order || 0),
      createdAt: activity.created_at || ''
    };
  }

  function cleanQuizPayload(quiz) {
    const payload = JSON.parse(JSON.stringify(quiz || {}));
    [
      '_quizAssignmentId', '_quizAssignmentIds', '_dbOwnerId', '_dbStatus',
      'assignmentIds', 'availableUntil', 'attempts'
    ].forEach((key) => delete payload[key]);
    return payload;
  }

  function mapQuizAssignments(rows) {
    const quizMap = new Map();
    (rows || []).forEach((row) => {
      const dbQuiz = Array.isArray(row?.quiz) ? row.quiz[0] : row?.quiz;
      if (!dbQuiz) return;
      const payload = dbQuiz.payload && typeof dbQuiz.payload === 'object' ? JSON.parse(JSON.stringify(dbQuiz.payload)) : {};
      const existing = quizMap.get(dbQuiz.id) || {
        ...payload,
        id: dbQuiz.id,
        title: dbQuiz.title || payload.title || 'Quiz',
        emoji: dbQuiz.emoji || payload.emoji || '🎮',
        mode: dbQuiz.mode || payload.mode || '',
        period: Number(dbQuiz.period || payload.period || 1),
        subject: dbQuiz.subject_name || payload.subject || '',
        area: dbQuiz.area || payload.area || '',
        status: dbQuiz.status || payload.status || 'draft',
        assignmentIds: [],
        _quizAssignmentIds: {},
        _dbOwnerId: dbQuiz.owner_id || ''
      };
      if (!existing.assignmentIds.includes(row.assignment_id)) existing.assignmentIds.push(row.assignment_id);
      existing._quizAssignmentIds[row.assignment_id] = row.id;
      existing._quizAssignmentId = existing._quizAssignmentId || row.id;
      existing.availableFrom = row.available_from || existing.availableFrom || '';
      existing.availableUntil = row.due_at || existing.availableUntil || '';
      existing.attempts = row.max_attempts || existing.attempts || 1;
      existing.assignmentSettings = { ...(existing.assignmentSettings || {}), [row.assignment_id]: row.settings || {} };
      quizMap.set(dbQuiz.id, existing);
    });
    return [...quizMap.values()];
  }

  function attendanceCache(rows) {
    const cache = {};
    (rows || []).forEach((row) => {
      const code = studentDbIdToCode.get(row.student_id);
      if (!code) return;
      const key = `${row.assignment_id}|${row.attendance_date}`;
      if (!cache[key]) cache[key] = {};
      cache[key][code] = row.status;
    });
    return cache;
  }

  function mapRockstarEvents(rows) {
    return (rows || []).map((row) => {
      const code = studentDbIdToCode.get(row.student_id);
      if (!code) return null;
      return {
        id: row.id,
        assignmentId: row.assignment_id,
        studentId: code,
        dbStudentId: row.student_id,
        period: Number(row.period || 1),
        date: String(row.occurred_at || '').slice(0, 10),
        occurredAt: row.occurred_at,
        delta: Number(row.points || 0),
        category: row.category || '',
        reason: row.reason || ''
      };
    }).filter(Boolean);
  }

  function normalizeStudentPeriodStartsByAssignment(value) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return Object.fromEntries(Object.entries(source).map(([assignmentId, starts]) => [String(assignmentId), starts && typeof starts === 'object' ? starts : {}]));
  }

  function mapStudentPortalQuizzes(source = {}) {
    const rawQuizzes = Array.isArray(source.quizzes)
      ? source.quizzes
      : (Array.isArray(source.quiz_assignments) ? source.quiz_assignments : []);
    const quizzes = rawQuizzes.some((row) => row?.quiz || row?.assignment_id)
      ? mapQuizAssignments(rawQuizzes)
      : rawQuizzes.map((quiz) => ({ ...quiz }));
    const attempts = Array.isArray(source.quiz_attempts)
      ? source.quiz_attempts
      : (Array.isArray(source.quizAttempts) ? source.quizAttempts : []);

    quizzes.forEach((quiz) => {
      const assignmentIds = new Set(Object.values(quiz?._quizAssignmentIds || {}).map(String));
      if (quiz?._quizAssignmentId) assignmentIds.add(String(quiz._quizAssignmentId));
      const relevant = attempts.filter((attempt) => assignmentIds.has(String(attempt?.quiz_assignment_id || attempt?.quizAssignmentId || '')));
      const completed = relevant.filter((attempt) => ['submitted', 'graded', 'abandoned'].includes(String(attempt?.status || '')));
      quiz.attemptsMade = completed.length;
      const scored = completed.filter((attempt) => Number(attempt?.max_score ?? attempt?.maxScore ?? 0) > 0);
      if (scored.length) {
        const best = scored.slice().sort((a, b) => {
          const aRatio = Number(a.score || 0) / Number(a.max_score ?? a.maxScore ?? 1);
          const bRatio = Number(b.score || 0) / Number(b.max_score ?? b.maxScore ?? 1);
          if (bRatio !== aRatio) return bRatio - aRatio;
          return String(b.submitted_at || b.submittedAt || b.started_at || '').localeCompare(String(a.submitted_at || a.submittedAt || a.started_at || ''));
        })[0];
        const score = Number(best.score || 0);
        const maxScore = Number(best.max_score ?? best.maxScore ?? 0);
        quiz.studentResult = {
          grade: Math.max(0, Math.min(10, (score / maxScore) * 10)),
          score,
          maxScore,
          submittedAt: best.submitted_at || best.submittedAt || ''
        };
      }
    });
    return quizzes;
  }

  function normalizeStudentPortalData(payload, requestedCode = '') {
    const source = payload && typeof payload === 'object' ? payload : {};
    if (source.ok === false) throw new Error(source.message || 'No encontramos un estudiante activo con ese usuario o código.');
    const rawStudent = source.student && typeof source.student === 'object' ? source.student : null;
    const enrollment = source.enrollment && typeof source.enrollment === 'object' ? source.enrollment : null;
    if (!rawStudent || !enrollment) throw new Error('Supabase no devolvió una matrícula activa para este estudiante.');

    studentCodeToDbId = new Map();
    studentDbIdToCode = new Map();
    const mappedStudent = mapStudent({ ...enrollment, student: rawStudent });
    if (!mappedStudent) throw new Error('No se pudo interpretar la información del estudiante.');
    const studentCode = normalizeStudentPortalCode(mappedStudent.id || requestedCode);
    const appUser = {
      id: studentCode,
      authId: `student:${studentCode}`,
      dbStudentId: mappedStudent.dbId || rawStudent.id || null,
      username: mappedStudent.username || studentCode,
      role: 'student',
      fullName: mappedStudent.fullName || 'Estudiante',
      email: '',
      photo: mappedStudent.photo || './assets/default-avatar.svg',
      active: mappedStudent.active !== false,
      groupId: mappedStudent.groupId || enrollment.group_id || '',
      grade: mappedStudent.grade || '',
      course: mappedStudent.course || '',
      sede: mappedStudent.sede || 'Municipal'
    };

    assignments = (Array.isArray(source.assignments) ? source.assignments : [])
      .map((row) => mapAssignment(row, null))
      .filter((item) => item.id && item.active !== false);

    const uniqueLessons = new Map();
    (Array.isArray(source.lessons) ? source.lessons : []).map(mapLesson).filter(Boolean).forEach((lesson) => {
      const existing = uniqueLessons.get(lesson.id);
      if (!existing) {
        uniqueLessons.set(lesson.id, lesson);
        return;
      }
      existing.assignmentIds = [...new Set([...(existing.assignmentIds || []), ...(lesson.assignmentIds || [])])];
      existing.sortOrder = Math.min(existing.sortOrder || 0, lesson.sortOrder || 0);
    });

    const uniqueActivities = new Map();
    (Array.isArray(source.activities) ? source.activities : []).map(mapActivity).filter(Boolean).forEach((activity) => {
      const existing = uniqueActivities.get(activity.id);
      if (!existing) {
        activity.progressByAssignment = {};
        uniqueActivities.set(activity.id, activity);
        return;
      }
      existing.assignmentIds = [...new Set([...(existing.assignmentIds || []), ...(activity.assignmentIds || [])])];
      existing.sortOrder = Math.min(existing.sortOrder || 0, activity.sortOrder || 0);
    });

    const quizzes = mapStudentPortalQuizzes(source).filter((quiz) => String(quiz.status || 'published') === 'published');
    const periodStartsByAssignment = normalizeStudentPeriodStartsByAssignment(
      source.academic_period_starts_by_assignment || source.academicPeriodStartsByAssignment || source.preferences?.academicPeriodStartsByAssignment
    );

    return {
      user: appUser,
      data: {
        users: [appUser],
        assignments,
        students: [mappedStudent],
        classes: [...uniqueLessons.values()],
        activities: [...uniqueActivities.values()],
        activityGrades: [],
        quizGrades: [],
        rockstars: [],
        quizzes
      },
      attendance: {},
      preferences: {
        ...(source.preferences && typeof source.preferences === 'object' ? source.preferences : {}),
        academicPeriodStartsByAssignment: periodStartsByAssignment
      }
    };
  }

  function reportApplicationLoadProgress(options, progress, label, detail = {}) {
    if (typeof options?.onProgress !== 'function') return;
    try {
      options.onProgress({
        progress: Math.max(0, Math.min(100, Number(progress) || 0)),
        label: String(label || ''),
        ...detail
      });
    } catch (_) {}
  }

  async function loadStudentApplicationData(studentCode = '', options = {}) {
    reportApplicationLoadProgress(options, 5, 'Validando el acceso del estudiante...');
    const code = normalizeStudentPortalCode(studentCode || readStoredStudentPortalCode());
    if (!code) throw new Error('La sesión del estudiante no contiene un código válido.');
    let payload = studentPortalSession?.studentCode === code ? studentPortalSession.portalData : null;
    if (!payload) {
      reportApplicationLoadProgress(options, 22, 'Consultando clases y actividades...');
      const { data, error } = await getStudentClient().rpc('encisomath_student_portal', { p_student_code: code });
      if (error) throw normalizeError(error, 'No se pudo cargar el portal del estudiante.');
      payload = data;
    }
    reportApplicationLoadProgress(options, 62, 'Cargando quizzes y calendario académico...');
    const { data: academicContext, error: academicContextError } = await getStudentClient().rpc('encisomath_student_academic_context', { p_student_code: code });
    if (academicContextError) {
      const message = String(academicContextError.message || '').toLowerCase();
      const missingFunction = academicContextError.code === 'PGRST202' || message.includes('encisomath_student_academic_context');
      if (missingFunction) throw new Error('Falta ejecutar SUPABASE_STUDENT_QUIZZES_PERIODS_v0.25.016.sql en Supabase.');
      throw normalizeError(academicContextError, 'No se pudieron cargar los quizzes y el calendario académico del estudiante.');
    }
    if (!academicContext || academicContext.ok === false) {
      throw new Error(academicContext?.message || 'No se pudo cargar el contexto académico del estudiante.');
    }
    payload = { ...payload, ...academicContext };
    reportApplicationLoadProgress(options, 78, 'Organizando el portal del estudiante...');
    const snapshot = normalizeStudentPortalData(payload, code);
    const remembered = studentPortalSession?.encisomathRemember ?? readStoredStudentPortalState().remember;
    studentPortalSession = createStudentPortalSession(snapshot.user.id, null, remembered);
    session = studentPortalSession;
    reportApplicationLoadProgress(options, 100, 'Portal del estudiante cargado.');
    return snapshot;
  }

  async function loadApplicationData(options = {}) {
    const studentCode = readStoredStudentPortalCode();
    if (studentCode) return loadStudentApplicationData(studentCode, options);
    reportApplicationLoadProgress(options, 3, 'Validando la sesión con Supabase...');
    const supabaseClient = getClient();
    const activeSession = await requireAuthenticatedSession();
    if (!activeSession?.user?.id) throw new Error('No hay una sesion activa en Supabase.');

    const { data: profileRow, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id,external_code,username,role,full_name,email,photo_url,student_id,active,student:students(student_code)')
      .eq('id', activeSession.user.id)
      .single();
    if (profileError) throw normalizeError(profileError, 'No se pudo cargar el perfil.');
    profile = profileRow;
    const appUser = mapProfile(profileRow, activeSession.user);
    reportApplicationLoadProgress(options, 12, 'Perfil cargado. Buscando asignaturas...');

    const { data: assignmentRows, error: assignmentError } = await supabaseClient
      .from('teaching_assignments')
      .select('id,teacher_id,subject_id,group_id,icon_url,cover_url,active,subject:subjects(area,name),group:academic_groups(id,grade,course,campus,label)')
      .eq('active', true)
      .order('id');
    if (assignmentError) throw normalizeError(assignmentError, 'No se pudieron cargar las asignaturas.');
    assignments = (assignmentRows || []).map((row) => mapAssignment(row, appUser));
    const assignmentIds = assignments.map((item) => item.id);
    const groupIds = [...new Set(assignments.map((item) => item.groupId).filter(Boolean))];
    reportApplicationLoadProgress(options, 22, 'Asignaturas cargadas. Preparando cursos...');

    await purgeLegacyDemoContent(assignmentIds);
    reportApplicationLoadProgress(options, 28, 'Datos base preparados. Cargando estudiantes...');

    studentCodeToDbId = new Map();
    studentDbIdToCode = new Map();

    let enrollmentRows = [];
    if (groupIds.length) {
      const { data, error } = await supabaseClient
        .from('group_enrollments')
        .select('id,group_id,student_id,status,group:academic_groups(id,grade,course,campus,label),student:students(id,student_code,username,display_name,first_name,last_name,photo_url,active)')
        .in('group_id', groupIds)
        .eq('status', 'active');
      if (error) throw normalizeError(error, 'No se pudieron cargar las matriculas.');
      enrollmentRows = data || [];
    }
    const students = enrollmentRows.map(mapStudent).filter(Boolean).sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));
    reportApplicationLoadProgress(options, 38, 'Estudiantes cargados. Consultando contenido académico...');

    let lessonRows = [];
    let activityRows = [];
    let activityProgressRows = [];
    let quizAssignmentRows = [];
    let quizAttemptRows = [];
    let attendanceRows = [];
    let rockstarRows = [];
    if (assignmentIds.length) {
      let completedAcademicQueries = 0;
      const academicQueryTotal = 6;
      const trackAcademicQuery = (query, label) => Promise.resolve(query).then((result) => {
        completedAcademicQueries += 1;
        reportApplicationLoadProgress(
          options,
          38 + (completedAcademicQueries / academicQueryTotal) * 34,
          label,
          { completed: completedAcademicQueries, total: academicQueryTotal }
        );
        return result;
      });
      const [lessonsResult, activitiesResult, activityProgressResult, quizzesResult, attendanceResult, rockstarResult] = await Promise.all([
        trackAcademicQuery(supabaseClient
          .from('assignment_lessons')
          .select('assignment_id,sort_order,visible,lesson:lessons(id,period,area,subject_name,title,emoji,lesson_type,estimated_time,content_url,thumbnail_url,storage_pdf_path,storage_thumbnail_path,source_file_name,page_count,status)')
          .in('assignment_id', assignmentIds)
          .eq('visible', true), 'Clases cargadas...'),
        trackAcademicQuery(supabaseClient
          .from('activity_assignments')
          .select('assignment_id,sort_order,visible,activity:activities(id,owner_id,title,lesson_id,period,starts_at,due_at,content_type,content_payload,review_type,review_payload,rubric,status,created_at)')
          .in('assignment_id', assignmentIds)
          .eq('visible', true), 'Actividades cargadas...'),
        trackAcademicQuery(supabaseClient
          .from('activity_student_records')
          .select('activity_id,assignment_id,student_id,score,graded_at,grading_group_id,submission_file,delivery_events:activity_delivery_events(status,occurred_at)')
          .in('assignment_id', assignmentIds), 'Avances de actividades cargados...'),
        trackAcademicQuery(supabaseClient
          .from('quiz_assignments')
          .select('id,quiz_id,assignment_id,status,available_from,due_at,max_attempts,settings,quiz:quizzes(id,owner_id,title,emoji,mode,period,subject_name,area,status,payload)')
          .in('assignment_id', assignmentIds), 'Quizzes cargados...'),
        trackAcademicQuery(supabaseClient
          .from('attendance_records')
          .select('assignment_id,student_id,attendance_date,status')
          .in('assignment_id', assignmentIds), 'Asistencia cargada...'),
        trackAcademicQuery(supabaseClient
          .from('rockstar_events')
          .select('id,assignment_id,student_id,period,points,category,reason,occurred_at')
          .in('assignment_id', assignmentIds)
          .order('occurred_at', { ascending: true }), 'Puntos Rockstar cargados...')
      ]);
      if (lessonsResult.error) throw normalizeError(lessonsResult.error, 'No se pudieron cargar las clases.');
      if (activitiesResult.error) throw normalizeError(activitiesResult.error, 'No se pudieron cargar las actividades.');
      if (activityProgressResult.error) throw normalizeError(activityProgressResult.error, 'No se pudo calcular el avance de las actividades.');
      if (quizzesResult.error) throw normalizeError(quizzesResult.error, 'No se pudieron cargar los quizzes.');
      if (attendanceResult.error) throw normalizeError(attendanceResult.error, 'No se pudo cargar la asistencia.');
      if (rockstarResult.error) throw normalizeError(rockstarResult.error, 'No se pudieron cargar los puntos Rockstar.');
      lessonRows = (lessonsResult.data || []).filter((row) => !LEGACY_DEMO_LESSON_IDS.includes(nestedId(row, 'lesson')));
      activityRows = activitiesResult.data || [];
      activityProgressRows = activityProgressResult.data || [];
      quizAssignmentRows = (quizzesResult.data || []).filter((row) => !LEGACY_DEMO_QUIZ_IDS.includes(nestedId(row, 'quiz')));
      attendanceRows = attendanceResult.data || [];
      rockstarRows = rockstarResult.data || [];

      const quizAssignmentIds = quizAssignmentRows.map((row) => row.id).filter(Boolean);
      if (quizAssignmentIds.length) {
        const quizAttemptsResult = await supabaseClient
          .from('quiz_attempts')
          .select('id,quiz_assignment_id,student_id,status,score,max_score,submitted_at,started_at')
          .in('quiz_assignment_id', quizAssignmentIds);
        if (quizAttemptsResult.error) {
          console.warn('No se pudieron cargar las notas de quizzes para la planilla.', quizAttemptsResult.error);
        } else {
          quizAttemptRows = quizAttemptsResult.data || [];
        }
      }
    }
    reportApplicationLoadProgress(options, 80, 'Organizando clases, actividades y calificaciones...');

    const uniqueLessons = new Map();
    lessonRows.map(mapLesson).filter(Boolean).forEach((lesson) => {
      const existing = uniqueLessons.get(lesson.id);
      if (!existing) {
        uniqueLessons.set(lesson.id, lesson);
        return;
      }
      const ids = new Set([...(existing.assignmentIds || []), ...(lesson.assignmentIds || [])]);
      existing.assignmentIds = [...ids];
      existing.sortOrder = Math.min(existing.sortOrder || 0, lesson.sortOrder || 0);
    });

    const uniqueActivities = new Map();
    activityRows.map(mapActivity).filter(Boolean).forEach((activity) => {
      const existing = uniqueActivities.get(activity.id);
      if (!existing) {
        uniqueActivities.set(activity.id, activity);
        return;
      }
      existing.assignmentIds = [...new Set([...(existing.assignmentIds || []), ...(activity.assignmentIds || [])])];
      existing.sortOrder = Math.min(existing.sortOrder || 0, activity.sortOrder || 0);
    });

    const progressByActivity = new Map();
    activityProgressRows.forEach((row) => {
      const activityId = String(row.activity_id || '');
      const assignmentId = String(row.assignment_id || '');
      if (!activityId || !assignmentId) return;
      if (!progressByActivity.has(activityId)) progressByActivity.set(activityId, {});
      const byAssignment = progressByActivity.get(activityId);
      const progress = byAssignment[assignmentId] || { total: 0, delivered: 0, graded: 0 };
      const file = row.submission_file && typeof row.submission_file === 'object' ? row.submission_file : {};
      const graded = Boolean(row.graded_at);
      const events = Array.isArray(row.delivery_events) ? row.delivery_events : [];
      const submittedStatuses = new Set(['delivered', 'late', 'incomplete', 'resubmit']);
      const delivered = Boolean(file.path || file.url || file.name) || events.some((event) => submittedStatuses.has(String(event?.status || '')));
      progress.total += 1;
      if (delivered) progress.delivered += 1;
      if (graded) progress.graded += 1;
      byAssignment[assignmentId] = progress;
    });
    uniqueActivities.forEach((activity, activityId) => {
      activity.progressByAssignment = progressByActivity.get(activityId) || {};
    });

    const activityGrades = activityProgressRows.map((row) => ({
      activityId: String(row.activity_id || ''),
      assignmentId: String(row.assignment_id || ''),
      studentCode: String(studentDbIdToCode.get(row.student_id) || row.student_id || ''),
      score: Number(row.score ?? 40),
      gradedAt: row.graded_at || '',
      gradingGroupId: row.grading_group_id || ''
    })).filter((row) => row.activityId && row.assignmentId && row.studentCode);


    const quizAssignmentMeta = new Map(quizAssignmentRows.map((row) => [String(row.id || ''), {
      quizId: String(row.quiz_id || nestedId(row, 'quiz') || ''),
      assignmentId: String(row.assignment_id || '')
    }]));
    const bestQuizGrades = new Map();
    quizAttemptRows.forEach((row) => {
      if (!['submitted', 'graded'].includes(String(row.status || ''))) return;
      const meta = quizAssignmentMeta.get(String(row.quiz_assignment_id || ''));
      const studentCode = String(studentDbIdToCode.get(row.student_id) || row.student_id || '');
      const maxScore = Number(row.max_score || 0);
      if (!meta?.quizId || !meta.assignmentId || !studentCode || maxScore <= 0) return;
      const score = Math.max(0, Math.min(100, (Number(row.score || 0) / maxScore) * 100));
      const key = `${meta.quizId}|${meta.assignmentId}|${studentCode}`;
      const candidate = {
        quizId: meta.quizId,
        assignmentId: meta.assignmentId,
        studentCode,
        score: Math.round(score * 10) / 10,
        submittedAt: row.submitted_at || row.started_at || ''
      };
      const current = bestQuizGrades.get(key);
      if (!current || candidate.score > current.score || (candidate.score === current.score && String(candidate.submittedAt) > String(current.submittedAt))) {
        bestQuizGrades.set(key, candidate);
      }
    });
    const quizGrades = [...bestQuizGrades.values()];

    reportApplicationLoadProgress(options, 91, 'Cargando preferencias de la cuenta...');
    const { data: preferencesRow, error: preferencesError } = await supabaseClient
      .from('user_preferences')
      .select('preferences')
      .eq('user_id', activeSession.user.id)
      .maybeSingle();
    if (preferencesError) throw normalizeError(preferencesError, 'No se pudieron cargar las preferencias.');
    reportApplicationLoadProgress(options, 100, 'Datos de Supabase cargados.');

    return {
      user: appUser,
      data: {
        users: [appUser],
        assignments,
        students,
        classes: [...uniqueLessons.values()],
        activities: [...uniqueActivities.values()],
        activityGrades,
        quizGrades,
        rockstars: mapRockstarEvents(rockstarRows),
        quizzes: mapQuizAssignments(quizAssignmentRows)
      },
      attendance: attendanceCache(attendanceRows),
      preferences: preferencesRow?.preferences || {}
    };
  }

  function resolveStudentDbId(studentCode) {
    return studentCodeToDbId.get(String(studentCode || '')) || null;
  }

  async function saveAttendanceStatus({ assignmentId, studentCode, attendanceDate, status }) {
    const supabaseClient = getClient();
    const activeSession = await requireAuthenticatedSession();
    const studentId = resolveStudentDbId(studentCode);
    if (!studentId) throw new Error(`No se encontro el estudiante ${studentCode} en Supabase.`);
    if (!status) {
      const { error } = await supabaseClient
        .from('attendance_records')
        .delete()
        .eq('assignment_id', assignmentId)
        .eq('student_id', studentId)
        .eq('attendance_date', attendanceDate);
      if (error) throw normalizeError(error, 'No se pudo quitar la asistencia.');
      return null;
    }
    const { data, error } = await supabaseClient
      .from('attendance_records')
      .upsert({
        assignment_id: assignmentId,
        student_id: studentId,
        attendance_date: attendanceDate,
        status,
        recorded_by: activeSession.user.id
      }, { onConflict: 'assignment_id,student_id,attendance_date' })
      .select('id,assignment_id,student_id,attendance_date,status')
      .single();
    if (error) throw normalizeError(error, 'No se pudo guardar la asistencia.');
    return data;
  }

  async function addRockstarEvent(event) {
    const supabaseClient = getClient();
    const activeSession = await requireAuthenticatedSession();
    const studentId = resolveStudentDbId(event?.studentId);
    if (!studentId) throw new Error(`No se encontro el estudiante ${event?.studentId || ''} en Supabase.`);
    const row = {
      assignment_id: event.assignmentId,
      student_id: studentId,
      period: Number(event.period || 1),
      points: Number(event.delta || 0),
      category: event.category || null,
      reason: event.reason || null,
      occurred_at: event.occurredAt || new Date().toISOString(),
      created_by: activeSession.user.id,
      client_mutation_id: event.clientMutationId || event.mutationId || null
    };

    // v0.25.005: la escritura Rockstar usa una RPC idempotente para evitar
    // depender de la inferencia ON CONFLICT de PostgREST. La RPC compara el
    // client_mutation_id y devuelve el evento existente si se trata de un
    // reintento de la cola offline.
    if (row.client_mutation_id) {
      const rpcResult = await supabaseClient.rpc('encisomath_add_rockstar_event', {
        p_assignment_id: row.assignment_id,
        p_student_id: row.student_id,
        p_period: row.period,
        p_points: row.points,
        p_category: row.category,
        p_reason: row.reason,
        p_occurred_at: row.occurred_at,
        p_client_mutation_id: row.client_mutation_id
      });
      if (!rpcResult.error) {
        const rpcRow = Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data;
        if (rpcRow) return rpcRow;
      }

      const rpcMessage = String(rpcResult.error?.message || '').toLowerCase();
      const missingRpc = rpcMessage.includes('could not find the function')
        || rpcMessage.includes('schema cache')
        || rpcMessage.includes('function public.encisomath_add_rockstar_event');
      if (!missingRpc) throw normalizeError(rpcResult.error, 'No se pudo guardar el punto Rockstar.');

      // Compatibilidad mientras se ejecuta la migracion v0.25.004.
      return insertIdempotentByMutationId(
        'rockstar_events',
        row,
        'id,occurred_at',
        'No se pudo guardar el punto Rockstar.'
      );
    }

    const { data, error } = await supabaseClient
      .from('rockstar_events')
      .insert(row)
      .select('id,occurred_at')
      .single();
    if (error) throw normalizeError(error, 'No se pudo guardar el punto Rockstar.');
    return data;
  }

  async function createStudentAndEnroll({ studentCode, firstName, lastName, groupId }) {
    const supabaseClient = getClient();
    await requireAuthenticatedSession();
    const code = String(studentCode || '').trim();
    if (!code) throw new Error('El codigo del estudiante es obligatorio.');
    let student = null;
    const existingResult = await supabaseClient
      .from('students')
      .select('id,student_code,username,display_name,first_name,last_name,photo_url,active')
      .eq('student_code', code)
      .maybeSingle();
    if (existingResult.error) throw normalizeError(existingResult.error, 'No se pudo buscar el estudiante.');
    if (existingResult.data) {
      const updateResult = await supabaseClient
        .from('students')
        .update({ first_name: firstName, last_name: lastName, active: true })
        .eq('id', existingResult.data.id)
        .select('id,student_code,username,display_name,first_name,last_name,photo_url,active')
        .single();
      if (updateResult.error) throw normalizeError(updateResult.error, 'No se pudo actualizar el estudiante.');
      student = updateResult.data;
    } else {
      const insertResult = await supabaseClient
        .from('students')
        .insert({ student_code: code, first_name: firstName, last_name: lastName, active: true })
        .select('id,student_code,username,display_name,first_name,last_name,photo_url,active')
        .single();
      if (insertResult.error) throw normalizeError(insertResult.error, 'No se pudo crear el estudiante.');
      student = insertResult.data;
    }

    const enrollmentResult = await supabaseClient
      .from('group_enrollments')
      .upsert({ group_id: groupId, student_id: student.id, status: 'active', withdrawn_on: null }, { onConflict: 'group_id,student_id' })
      .select('id,status')
      .single();
    if (enrollmentResult.error) throw normalizeError(enrollmentResult.error, 'No se pudo matricular el estudiante.');

    const assignment = assignments.find((item) => item.groupId === groupId);
    studentCodeToDbId.set(code, student.id);
    studentDbIdToCode.set(student.id, code);
    return {
      id: code,
      dbId: student.id,
      username: student.username || code,
      fullName: `${student.last_name || ''}, ${student.first_name || ''}`.replace(/^,\s*/, '').trim() || student.display_name || code,
      firstName: student.first_name,
      lastName: student.last_name,
      grade: String(assignment?.grade || ''),
      course: String(assignment?.course || ''),
      sede: assignment?.sede || 'Municipal',
      groupId,
      enrollmentId: enrollmentResult.data?.id || '',
      enrollmentStatus: 'active',
      photo: student.photo_url || './assets/default-avatar.svg',
      active: true
    };
  }

  async function updateStudent({
    studentDbId,
    currentStudentCode,
    currentGroupId,
    targetGroupId,
    studentCode,
    username,
    firstName,
    lastName
  }) {
    const supabaseClient = getClient();
    await requireAuthenticatedSession();
    const explicitStudentId = String(studentDbId || '').trim();
    const safeStudentId = (!explicitStudentId.startsWith('offline-') ? explicitStudentId : '')
      || String(resolveStudentDbId(currentStudentCode) || '').trim();
    if (!safeStudentId) throw new Error('El estudiante todavía está pendiente de sincronización. Espera a recuperar conexión antes de editarlo.');

    const { data, error } = await supabaseClient.rpc('encisomath_update_student', {
      p_student_id: safeStudentId,
      p_current_group_id: String(currentGroupId || ''),
      p_target_group_id: String(targetGroupId || currentGroupId || ''),
      p_student_code: String(studentCode || '').trim(),
      p_username: String(username || '').trim().toLowerCase(),
      p_first_name: String(firstName || '').trim(),
      p_last_name: String(lastName || '').trim()
    });
    if (error) {
      const message = String(error.message || '').toLowerCase();
      if (error.code === 'PGRST202' || message.includes('encisomath_update_student')) {
        throw new Error('Falta ejecutar en Supabase el archivo SUPABASE_STUDENT_USERNAME_v0.25.010.sql.');
      }
      throw normalizeError(error, 'No se pudo editar el estudiante.');
    }
    if (!data || data.ok === false) throw new Error(data?.message || 'No se pudo editar el estudiante.');

    const mapped = mapStudent({ ...(data.enrollment || {}), student: data.student || {} });
    if (!mapped) throw new Error('Supabase guardó el cambio, pero no devolvió el estudiante actualizado.');
    const oldCode = String(currentStudentCode || '');
    if (oldCode && oldCode !== mapped.id) studentCodeToDbId.delete(oldCode);
    studentCodeToDbId.set(mapped.id, mapped.dbId);
    studentDbIdToCode.set(mapped.dbId, mapped.id);
    return mapped;
  }

  async function withdrawStudent({ groupId, studentCode }) {
    const supabaseClient = getClient();
    await requireAuthenticatedSession();
    const studentId = resolveStudentDbId(studentCode);
    if (!studentId) throw new Error(`No se encontro el estudiante ${studentCode} en Supabase.`);
    const { error } = await supabaseClient
      .from('group_enrollments')
      .update({ status: 'withdrawn', withdrawn_on: new Date().toISOString().slice(0, 10) })
      .eq('group_id', groupId)
      .eq('student_id', studentId);
    if (error) throw normalizeError(error, 'No se pudo retirar el estudiante del grupo.');
  }

  async function saveQuizzes(quizzes = [], options = {}) {
    const supabaseClient = getClient();
    const activeSession = await requireAuthenticatedSession();
    if (!activeSession?.user?.id) throw new Error('No hay una sesion activa.');

    for (const quiz of quizzes) {
      const status = quiz.status === 'published' ? 'published' : 'draft';
      const quizRow = {
        id: String(quiz.id),
        owner_id: activeSession.user.id,
        title: quiz.title || 'Quiz',
        emoji: quiz.emoji || '🎮',
        mode: quiz.mode || '',
        period: Number(quiz.period || 1),
        subject_name: quiz.subject || '',
        area: quiz.area || '',
        status,
        payload: cleanQuizPayload(quiz),
        client_mutation_id: options.clientMutationId ? `${options.clientMutationId}:${quiz.id}` : null
      };
      const quizResult = await supabaseClient
        .from('quizzes')
        .upsert(quizRow, { onConflict: 'id' });
      if (quizResult.error) throw normalizeError(quizResult.error, `No se pudo guardar el quiz ${quiz.title || quiz.id}.`);

      const targetIds = (Array.isArray(quiz.assignmentIds) ? quiz.assignmentIds : [])
        .filter((id) => id && id !== '*');
      for (const assignmentId of targetIds) {
        const assignmentResult = await supabaseClient
          .from('quiz_assignments')
          .upsert({
            quiz_id: quiz.id,
            assignment_id: assignmentId,
            status,
            due_at: quiz.availableUntil || null,
            max_attempts: Number(quiz.attempts || 1),
            client_mutation_id: options.clientMutationId ? `${options.clientMutationId}:${quiz.id}:${assignmentId}` : null,
            settings: {
              shuffleQuestions: Boolean(quiz.shuffleQuestions),
              shuffleOptions: Boolean(quiz.shuffleOptions),
              showCorrectAfterAttempt: Boolean(quiz.showCorrectAfterAttempt)
            }
          }, { onConflict: 'quiz_id,assignment_id' });
        if (assignmentResult.error) throw normalizeError(assignmentResult.error, `No se pudo asignar el quiz al curso ${assignmentId}.`);
      }
    }
  }

  async function savePreferences(preferences, options = {}) {
    const supabaseClient = getClient();
    const activeSession = await requireAuthenticatedSession();
    if (!activeSession?.user?.id) return;
    const { error } = await supabaseClient
      .from('user_preferences')
      .upsert({ user_id: activeSession.user.id, preferences: preferences || {}, client_mutation_id: options.clientMutationId || null }, { onConflict: 'user_id' });
    if (error) throw normalizeError(error, 'No se pudieron guardar las preferencias.');
  }

  async function uploadAssignmentImage({ assignmentId, type, file, mutationId = '', clientMutationId = '' }) {
    const supabaseClient = getClient();
    const activeSession = await requireAuthenticatedSession();
    if (!activeSession?.user?.id) throw new Error('No hay una sesion activa.');
    const extension = String(file?.name || '').split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
    const stableMutation = mutationId || clientMutationId || '';
    const path = `${activeSession.user.id}/assignments/${assignmentId}/${type}-${stableMutation || Date.now()}.${extension}`;
    const uploadResult = await supabaseClient.storage
      .from(config.storageBucket || 'lms-public')
      .upload(path, file, { cacheControl: '3600', upsert: true, contentType: file.type || undefined });
    if (uploadResult.error) throw normalizeError(uploadResult.error, 'No se pudo subir la imagen.');
    const { data: publicData } = supabaseClient.storage.from(config.storageBucket || 'lms-public').getPublicUrl(path);
    const publicUrl = publicData?.publicUrl || '';
    const column = type === 'cover' ? 'cover_url' : 'icon_url';
    const updateResult = await supabaseClient
      .from('teaching_assignments')
      .update({ [column]: publicUrl })
      .eq('id', assignmentId);
    if (updateResult.error) throw normalizeError(updateResult.error, 'La imagen subio, pero no se pudo asociar a la asignatura.');
    return publicUrl;
  }

  async function resetAssignmentImage({ assignmentId, type }) {
    const supabaseClient = getClient();
    await requireAuthenticatedSession();
    const column = type === 'cover' ? 'cover_url' : 'icon_url';
    const { error } = await supabaseClient
      .from('teaching_assignments')
      .update({ [column]: null })
      .eq('id', assignmentId);
    if (error) throw normalizeError(error, 'No se pudo restablecer la imagen.');
  }

  function safeStorageName(value = 'archivo') {
    return String(value || 'archivo')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'archivo';
  }

  function newLessonId() {
    const token = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    return `lesson-${token}`;
  }

  function emitLessonUploadProgress(lessonId, progress, label, phase = '') {
    try {
      window.dispatchEvent(new CustomEvent('encisomath:lesson-upload-progress', {
        detail: {
          lessonId: String(lessonId || ''),
          progress: Math.max(0, Math.min(100, Math.round(Number(progress) || 0))),
          label: String(label || ''),
          phase: String(phase || '')
        }
      }));
    } catch (_) {}
  }

  async function uploadStorageObjectWithProgress({ activeSession, bucket, path, file, upsert = false, onProgress = null }) {
    if (!activeSession?.access_token) throw authSessionError();
    if (!(file instanceof Blob)) throw new Error('No se encontró el archivo que deseas subir.');
    const baseUrl = String(config.url || '').replace(/\/$/, '');
    const safeBucket = encodeURIComponent(String(bucket || 'lms-public'));
    const safePath = String(path || '').split('/').map((part) => encodeURIComponent(part)).join('/');
    const url = `${baseUrl}/storage/v1/object/${safeBucket}/${safePath}`;
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.responseType = 'json';
      xhr.setRequestHeader('Authorization', `Bearer ${activeSession.access_token}`);
      xhr.setRequestHeader('apikey', config.publishableKey);
      xhr.setRequestHeader('x-upsert', upsert ? 'true' : 'false');
      xhr.setRequestHeader('cache-control', '3600');
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.upload.addEventListener('progress', (event) => {
        if (!event.lengthComputable || typeof onProgress !== 'function') return;
        onProgress(Math.max(0, Math.min(1, event.loaded / Math.max(1, event.total))));
      });
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          if (typeof onProgress === 'function') onProgress(1);
          resolve(xhr.response || {});
          return;
        }
        const body = xhr.response && typeof xhr.response === 'object' ? xhr.response : {};
        const error = new Error(body.message || body.error || `Storage rechazó la subida (${xhr.status}).`);
        error.status = xhr.status;
        error.statusCode = xhr.status;
        error.code = body.error || body.statusCode || '';
        reject(error);
      });
      xhr.addEventListener('error', () => reject(new Error('La conexión se interrumpió mientras se subía el archivo.')));
      xhr.addEventListener('abort', () => reject(new Error('La subida del archivo fue cancelada.')));
      xhr.send(file);
    });
  }

  async function createPdfLesson({ currentAssignment, targetAssignmentIds, title, period, pdfFile, thumbnailFile, pageCount = 1, lessonId: requestedLessonId = '', mutationId = '', clientMutationId = '' }) {
    const supabaseClient = getClient();
    const activeSession = await requireAuthenticatedSession();
    if (!activeSession?.user?.id) throw new Error('No hay una sesión activa.');
    const ids = [...new Set((targetAssignmentIds || []).filter(Boolean))];
    if (!ids.length) throw new Error('La clase debe asignarse al menos a un curso.');
    const lessonId = String(requestedLessonId || '').trim() || newLessonId();
    const rootPath = `${activeSession.user.id}/lessons/${lessonId}`;
    const pdfExtension = String(pdfFile?.name || '').split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'pdf';
    const pdfPath = `${rootPath}/${safeStorageName(title)}.${pdfExtension}`;
    let thumbnailPath = '';
    let pdfUrl = '';
    let thumbnailUrl = '';
    const uploadedPaths = [];

    try {
      const bucket = config.storageBucket || 'lms-public';
      const pdfEnd = thumbnailFile ? 78 : 94;
      emitLessonUploadProgress(lessonId, 5, 'Subiendo PDF…', 'pdf');
      await uploadStorageObjectWithProgress({
        activeSession,
        bucket,
        path: pdfPath,
        file: pdfFile,
        upsert: Boolean(mutationId || clientMutationId),
        onProgress: (ratio) => emitLessonUploadProgress(lessonId, 5 + (pdfEnd - 5) * ratio, 'Subiendo PDF…', 'pdf')
      });
      uploadedPaths.push(pdfPath);
      pdfUrl = supabaseClient.storage.from(bucket).getPublicUrl(pdfPath).data?.publicUrl || '';

      if (thumbnailFile) {
        const extension = String(thumbnailFile.name || '').split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'webp';
        thumbnailPath = `${rootPath}/portada.${extension}`;
        emitLessonUploadProgress(lessonId, 80, 'Subiendo portada…', 'thumbnail');
        await uploadStorageObjectWithProgress({
          activeSession,
          bucket,
          path: thumbnailPath,
          file: thumbnailFile,
          upsert: Boolean(mutationId || clientMutationId),
          onProgress: (ratio) => emitLessonUploadProgress(lessonId, 80 + 14 * ratio, 'Subiendo portada…', 'thumbnail')
        });
        uploadedPaths.push(thumbnailPath);
        thumbnailUrl = supabaseClient.storage.from(bucket).getPublicUrl(thumbnailPath).data?.publicUrl || '';
      }
      emitLessonUploadProgress(lessonId, 96, 'Guardando la clase…', 'database');

      const lessonRow = {
        id: lessonId,
        period: Number(period || 1),
        area: currentAssignment?.area || '',
        subject_name: currentAssignment?.subject || '',
        title: String(title || '').trim(),
        emoji: '📘',
        lesson_type: 'PDF',
        estimated_time: '',
        content_url: pdfUrl,
        thumbnail_url: thumbnailUrl || null,
        storage_pdf_path: pdfPath,
        storage_thumbnail_path: thumbnailPath || null,
        source_file_name: pdfFile?.name || '',
        page_count: Math.max(1, Number(pageCount || 1)),
        status: 'published',
        created_by: activeSession.user.id,
        client_mutation_id: mutationId || clientMutationId || null
      };
      const lessonResult = await supabaseClient.from('lessons').upsert(lessonRow, { onConflict: 'id' });
      if (lessonResult.error) throw normalizeError(lessonResult.error, 'No se pudo crear el registro de la clase.');

      const linkRows = ids.map((assignmentId, index) => ({
        assignment_id: assignmentId,
        lesson_id: lessonId,
        sort_order: Math.floor(Date.now() / 1000) + index,
        visible: true
      }));
      const linkResult = await supabaseClient.from('assignment_lessons').upsert(linkRows, { onConflict: 'assignment_id,lesson_id' });
      if (linkResult.error) throw normalizeError(linkResult.error, 'El PDF subió, pero no se pudo asignar a los cursos.');

      emitLessonUploadProgress(lessonId, 100, 'Clase guardada', 'complete');
      return {
        id: lessonId,
        period: Number(period || 1),
        area: currentAssignment?.area || '',
        subject: currentAssignment?.subject || '',
        title: String(title || '').trim(),
        emoji: '📘',
        type: 'PDF',
        lessonType: 'PDF',
        estimatedTime: '',
        contentUrl: pdfUrl,
        thumbnailUrl,
        storagePdfPath: pdfPath,
        storageThumbnailPath: thumbnailPath,
        sourceFileName: pdfFile?.name || '',
        pageCount: Math.max(1, Number(pageCount || 1)),
        status: 'published',
        assignmentId: ids[0] || '',
        assignmentIds: ids,
        sortOrder: linkRows[0]?.sort_order || 0
      };
    } catch (error) {
      try { await supabaseClient.from('lessons').delete().eq('id', lessonId); } catch (_) {}
      if (uploadedPaths.length) {
        try { await supabaseClient.storage.from(config.storageBucket || 'lms-public').remove(uploadedPaths); } catch (_) {}
      }
      throw error;
    }
  }


  async function updatePdfLesson({
    lessonId,
    currentAssignment,
    targetAssignmentIds,
    title,
    period,
    pdfFile = null,
    thumbnailFile = null,
    pageCount = 1,
    existingContentUrl = '',
    existingThumbnailUrl = '',
    existingStoragePdfPath = '',
    existingStorageThumbnailPath = '',
    existingSourceFileName = '',
    mutationId = '',
    clientMutationId = ''
  }) {
    const supabaseClient = getClient();
    const activeSession = await requireAuthenticatedSession();
    if (!activeSession?.user?.id) throw new Error('No hay una sesión activa.');
    const safeLessonId = String(lessonId || '').trim();
    if (!safeLessonId) throw new Error('No se encontró la clase que deseas editar.');
    const ids = [...new Set((targetAssignmentIds || []).filter(Boolean))];
    if (!ids.length) throw new Error('La clase debe estar visible al menos en un curso.');
    const bucket = config.storageBucket || 'lms-public';
    const rootPath = `${activeSession.user.id}/lessons/${safeLessonId}`;
    const currentLessonResult = await supabaseClient
      .from('lessons')
      .select('content_url,thumbnail_url,storage_pdf_path,storage_thumbnail_path,source_file_name,page_count')
      .eq('id', safeLessonId)
      .maybeSingle();
    if (currentLessonResult.error) throw normalizeError(currentLessonResult.error, 'No se pudo consultar la clase que deseas editar.');
    const currentLesson = currentLessonResult.data || {};
    let pdfPath = String(existingStoragePdfPath || currentLesson.storage_pdf_path || '');
    let thumbnailPath = String(existingStorageThumbnailPath || currentLesson.storage_thumbnail_path || '');
    let pdfUrl = /^https?:\/\//i.test(String(existingContentUrl || '')) ? String(existingContentUrl) : String(currentLesson.content_url || '');
    let thumbnailUrl = /^https?:\/\//i.test(String(existingThumbnailUrl || '')) ? String(existingThumbnailUrl) : String(currentLesson.thumbnail_url || '');
    if (!pdfUrl && pdfPath) pdfUrl = supabaseClient.storage.from(bucket).getPublicUrl(pdfPath).data?.publicUrl || '';
    if (!thumbnailUrl && thumbnailPath) thumbnailUrl = supabaseClient.storage.from(bucket).getPublicUrl(thumbnailPath).data?.publicUrl || '';
    let sourceFileName = String(existingSourceFileName || currentLesson.source_file_name || '');
    if (!pdfFile && (!pageCount || Number(pageCount) <= 1) && Number(currentLesson.page_count || 0) > 1) pageCount = Number(currentLesson.page_count);
    const newlyUploaded = [];
    const obsoletePaths = [];

    try {
      const hasPdf = pdfFile instanceof Blob;
      const hasThumbnail = thumbnailFile instanceof Blob;
      if (hasPdf) {
        const extension = String(pdfFile.name || '').split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'pdf';
        const nextPath = `${rootPath}/${safeStorageName(title)}.${extension}`;
        const pdfEnd = hasThumbnail ? 76 : 92;
        emitLessonUploadProgress(safeLessonId, 5, 'Subiendo PDF nuevo…', 'pdf');
        await uploadStorageObjectWithProgress({
          activeSession,
          bucket,
          path: nextPath,
          file: pdfFile,
          upsert: true,
          onProgress: (ratio) => emitLessonUploadProgress(safeLessonId, 5 + (pdfEnd - 5) * ratio, 'Subiendo PDF nuevo…', 'pdf')
        });
        if (pdfPath && pdfPath !== nextPath) obsoletePaths.push(pdfPath);
        if (nextPath !== pdfPath) newlyUploaded.push(nextPath);
        pdfPath = nextPath;
        pdfUrl = supabaseClient.storage.from(bucket).getPublicUrl(pdfPath).data?.publicUrl || '';
        sourceFileName = pdfFile.name || sourceFileName;
      }
      if (!pdfPath || !pdfUrl) throw new Error('La clase no tiene un PDF válido para conservar.');

      if (hasThumbnail) {
        const extension = String(thumbnailFile.name || '').split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'webp';
        const nextPath = `${rootPath}/portada.${extension}`;
        emitLessonUploadProgress(safeLessonId, hasPdf ? 78 : 18, 'Subiendo portada nueva…', 'thumbnail');
        const start = hasPdf ? 78 : 18;
        const end = 94;
        await uploadStorageObjectWithProgress({
          activeSession,
          bucket,
          path: nextPath,
          file: thumbnailFile,
          upsert: true,
          onProgress: (ratio) => emitLessonUploadProgress(safeLessonId, start + (end - start) * ratio, 'Subiendo portada nueva…', 'thumbnail')
        });
        if (thumbnailPath && thumbnailPath !== nextPath) obsoletePaths.push(thumbnailPath);
        if (nextPath !== thumbnailPath) newlyUploaded.push(nextPath);
        thumbnailPath = nextPath;
        thumbnailUrl = supabaseClient.storage.from(bucket).getPublicUrl(thumbnailPath).data?.publicUrl || '';
      }

      emitLessonUploadProgress(safeLessonId, 96, 'Guardando cambios…', 'database');
      const updateResult = await supabaseClient
        .from('lessons')
        .update({
          period: Number(period || 1),
          area: currentAssignment?.area || '',
          subject_name: currentAssignment?.subject || '',
          title: String(title || '').trim(),
          content_url: pdfUrl,
          thumbnail_url: thumbnailUrl || null,
          storage_pdf_path: pdfPath,
          storage_thumbnail_path: thumbnailPath || null,
          source_file_name: sourceFileName,
          page_count: Math.max(1, Number(pageCount || 1)),
          status: 'published',
          client_mutation_id: mutationId || clientMutationId || null
        })
        .eq('id', safeLessonId);
      if (updateResult.error) throw normalizeError(updateResult.error, 'No se pudo actualizar la clase.');

      const currentLinksResult = await supabaseClient
        .from('assignment_lessons')
        .select('assignment_id,sort_order')
        .eq('lesson_id', safeLessonId);
      if (currentLinksResult.error) throw normalizeError(currentLinksResult.error, 'No se pudo consultar la visibilidad actual de la clase.');
      const currentLinks = currentLinksResult.data || [];
      const selectedSet = new Set(ids.map(String));
      const removeIds = currentLinks.map((row) => String(row.assignment_id || '')).filter((id) => id && !selectedSet.has(id));
      if (removeIds.length) {
        const removeResult = await supabaseClient.from('assignment_lessons').delete().eq('lesson_id', safeLessonId).in('assignment_id', removeIds);
        if (removeResult.error) throw normalizeError(removeResult.error, 'No se pudo actualizar la visibilidad de la clase.');
      }
      const sortMap = new Map(currentLinks.map((row) => [String(row.assignment_id || ''), Number(row.sort_order || 0)]));
      const baseSort = Math.floor(Date.now() / 1000);
      const linkRows = ids.map((assignmentId, index) => ({
        assignment_id: assignmentId,
        lesson_id: safeLessonId,
        sort_order: sortMap.get(String(assignmentId)) || baseSort + index,
        visible: true
      }));
      const linkResult = await supabaseClient.from('assignment_lessons').upsert(linkRows, { onConflict: 'assignment_id,lesson_id' });
      if (linkResult.error) throw normalizeError(linkResult.error, 'No se pudo asignar la clase a los cursos seleccionados.');

      if (obsoletePaths.length) await removeStorageFiles(obsoletePaths).catch(() => {});
      emitLessonUploadProgress(safeLessonId, 100, 'Cambios guardados', 'complete');
      return {
        id: safeLessonId,
        period: Number(period || 1),
        area: currentAssignment?.area || '',
        subject: currentAssignment?.subject || '',
        title: String(title || '').trim(),
        emoji: '📘',
        type: 'PDF',
        lessonType: 'PDF',
        estimatedTime: '',
        contentUrl: pdfUrl,
        thumbnailUrl,
        storagePdfPath: pdfPath,
        storageThumbnailPath: thumbnailPath,
        sourceFileName,
        pageCount: Math.max(1, Number(pageCount || 1)),
        status: 'published',
        assignmentId: ids[0] || '',
        assignmentIds: ids,
        sortOrder: linkRows[0]?.sort_order || 0
      };
    } catch (error) {
      const cleanup = newlyUploaded.filter((path) => path && path !== existingStoragePdfPath && path !== existingStorageThumbnailPath);
      if (cleanup.length) {
        try { await supabaseClient.storage.from(bucket).remove(cleanup); } catch (_) {}
      }
      throw error;
    }
  }


  function newActivityId() {
    const token = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    return `activity-${token}`;
  }

  async function uploadActivityFiles({ activityId, section, files = [], mutationId = '' }) {
    const supabaseClient = getClient();
    const activeSession = await requireAuthenticatedSession();
    const bucket = config.storageBucket || 'lms-public';
    const uploaded = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const extension = String(file?.name || '').split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
      const stableSection = mutationId ? `${section}-${mutationId}` : section;
      const path = `${activeSession.user.id}/activities/${activityId}/${stableSection}/${String(index + 1).padStart(2, '0')}-${safeStorageName(file?.name || `archivo.${extension}`)}`;
      const result = await supabaseClient.storage.from(bucket).upload(path, file, {
        cacheControl: '3600',
        upsert: Boolean(mutationId),
        contentType: file?.type || undefined
      });
      if (result.error) throw normalizeError(result.error, `No se pudo subir ${file?.name || 'el archivo'}.`);
      uploaded.push({
        name: file?.name || `archivo-${index + 1}`,
        type: file?.type || '',
        size: Number(file?.size || 0),
        path,
        url: supabaseClient.storage.from(bucket).getPublicUrl(path).data?.publicUrl || ''
      });
    }
    return uploaded;
  }

  async function createActivity({ currentAssignment, targetAssignmentIds, title, lessonId, period, startsAt, dueAt, contentType, contentText = '', contentHtml = '', contentCss = '', contentFiles = [], reviewType, reviewText = '', reviewHtml = '', reviewCss = '', reviewFiles = [], rubric = [], activityId: requestedActivityId = '', mutationId = '', clientMutationId = '' }) {
    const supabaseClient = getClient();
    const activeSession = await requireAuthenticatedSession();
    if (!activeSession?.user?.id) throw new Error('No hay una sesión activa.');
    const ids = [...new Set((targetAssignmentIds || []).filter(Boolean))];
    if (!ids.length) throw new Error('La actividad debe asignarse al menos a un curso.');
    const total = (rubric || []).reduce((sum, item) => sum + Number(item.percentage || 0), 0);
    if (Math.abs(total - 100) > .001) throw new Error('Los criterios de evaluación deben sumar exactamente 100%.');
    const activityId = String(requestedActivityId || '').trim() || newActivityId();
    const uploadedPaths = [];
    try {
      const assignmentUploads = await uploadActivityFiles({ activityId, section: 'assignment', files: contentFiles, mutationId: mutationId || clientMutationId });
      const reviewUploads = await uploadActivityFiles({ activityId, section: 'review', files: reviewFiles, mutationId: mutationId || clientMutationId });
      uploadedPaths.push(...assignmentUploads.map((item) => item.path), ...reviewUploads.map((item) => item.path));
      const contentPayload = { text: contentText, html: contentHtml, css: contentCss, files: assignmentUploads };
      const reviewPayload = { text: reviewText, html: reviewHtml, css: reviewCss, files: reviewUploads };
      const row = {
        id: activityId,
        owner_id: activeSession.user.id,
        title: String(title || '').trim(),
        lesson_id: lessonId || null,
        period: Number(period || 1),
        starts_at: startsAt || null,
        due_at: dueAt || null,
        content_type: contentType,
        content_payload: contentPayload,
        review_type: reviewType,
        review_payload: reviewPayload,
        rubric,
        status: 'published',
        client_mutation_id: mutationId || clientMutationId || null
      };
      const activityResult = await supabaseClient.from('activities').upsert(row, { onConflict: 'id' });
      if (activityResult.error) throw normalizeError(activityResult.error, 'No se pudo crear la actividad.');
      const linkRows = ids.map((assignmentId, index) => ({
        activity_id: activityId,
        assignment_id: assignmentId,
        sort_order: Math.floor(Date.now() / 1000) + index,
        visible: true
      }));
      const linksResult = await supabaseClient.from('activity_assignments').upsert(linkRows, { onConflict: 'activity_id,assignment_id' });
      if (linksResult.error) throw normalizeError(linksResult.error, 'La actividad se creó, pero no pudo asignarse a los cursos.');
      return {
        id: activityId,
        title: row.title,
        lessonId: row.lesson_id || '',
        period: row.period,
        startsAt: row.starts_at || '',
        dueAt: row.due_at || '',
        contentType: row.content_type,
        contentPayload,
        reviewType: row.review_type,
        reviewPayload,
        rubric,
        status: row.status,
        assignmentId: ids[0],
        assignmentIds: ids,
        sortOrder: linkRows[0]?.sort_order || 0,
        createdAt: new Date().toISOString()
      };
    } catch (error) {
      try { await supabaseClient.from('activity_assignments').delete().eq('activity_id', activityId); } catch (_) {}
      try { await supabaseClient.from('activities').delete().eq('id', activityId); } catch (_) {}
      if (uploadedPaths.length) {
        try { await supabaseClient.storage.from(config.storageBucket || 'lms-public').remove(uploadedPaths); } catch (_) {}
      }
      throw error;
    }
  }


  function storedActivityFiles(payload) {
    return Array.isArray(payload?.files) ? payload.files.filter((item) => item?.path) : [];
  }

  async function removeStorageFiles(paths = []) {
    const unique = [...new Set((paths || []).filter(Boolean))];
    if (!unique.length) return;
    const result = await getClient().storage.from(config.storageBucket || 'lms-public').remove(unique);
    if (result.error) console.warn('No se pudieron retirar algunos archivos de Storage.', result.error);
  }

  async function updateActivity({ activityId, targetAssignmentIds, title, lessonId, period, startsAt, dueAt, contentType, contentText = '', contentHtml = '', contentCss = '', contentFiles = [], existingContentPayload = {}, existingContentType = '', reviewType, reviewText = '', reviewHtml = '', reviewCss = '', reviewFiles = [], existingReviewPayload = {}, existingReviewType = '', rubric = [], mutationId = '', clientMutationId = '' }) {
    const supabaseClient = getClient();
    const activeSession = await requireAuthenticatedSession();
    if (!activeSession?.user?.id) throw new Error('No hay una sesión activa.');
    const safeActivityId = String(activityId || '').trim();
    if (!safeActivityId) throw new Error('No se encontró la actividad que deseas editar.');
    const ids = [...new Set((targetAssignmentIds || []).filter(Boolean))];
    if (!ids.length) throw new Error('La actividad debe asignarse al menos a un curso.');
    const total = (rubric || []).reduce((sum, item) => sum + Number(item.percentage || 0), 0);
    if (Math.abs(total - 100) > .001) throw new Error('Los criterios de evaluación deben sumar exactamente 100%.');

    const uploadedPaths = [];
    try {
      const contentUploads = contentFiles.length
        ? await uploadActivityFiles({ activityId: safeActivityId, section: 'assignment-update', files: contentFiles, mutationId: mutationId || clientMutationId || String(Date.now()) })
        : [];
      const reviewUploads = reviewFiles.length
        ? await uploadActivityFiles({ activityId: safeActivityId, section: 'review-update', files: reviewFiles, mutationId: mutationId || clientMutationId || String(Date.now()) })
        : [];
      uploadedPaths.push(...contentUploads.map((item) => item.path), ...reviewUploads.map((item) => item.path));

      const keepContentFiles = !contentUploads.length && contentType === existingContentType
        ? (Array.isArray(existingContentPayload?.files) ? existingContentPayload.files : [])
        : [];
      const keepReviewFiles = !reviewUploads.length && reviewType === existingReviewType
        ? (Array.isArray(existingReviewPayload?.files) ? existingReviewPayload.files : [])
        : [];
      const contentPayload = { text: contentText, html: contentHtml, css: contentCss, files: contentUploads.length ? contentUploads : keepContentFiles };
      const reviewPayload = { text: reviewText, html: reviewHtml, css: reviewCss, files: reviewUploads.length ? reviewUploads : keepReviewFiles };

      const updateResult = await supabaseClient
        .from('activities')
        .update({
          title: String(title || '').trim(),
          lesson_id: lessonId || null,
          period: Number(period || 1),
          starts_at: startsAt || null,
          due_at: dueAt || null,
          content_type: contentType,
          content_payload: contentPayload,
          review_type: reviewType,
          review_payload: reviewPayload,
          rubric,
          status: 'published',
          client_mutation_id: mutationId || clientMutationId || null
        })
        .eq('id', safeActivityId)
        .eq('owner_id', activeSession.user.id);
      if (updateResult.error) throw normalizeError(updateResult.error, 'No se pudo actualizar la actividad.');

      const currentLinks = await supabaseClient.from('activity_assignments').select('assignment_id').eq('activity_id', safeActivityId);
      if (currentLinks.error) throw normalizeError(currentLinks.error, 'No se pudieron revisar los cursos actuales de la actividad.');
      const currentIds = (currentLinks.data || []).map((row) => row.assignment_id);
      const removedIds = currentIds.filter((id) => !ids.includes(id));
      if (removedIds.length) {
        const removeResult = await supabaseClient.from('activity_assignments').delete().eq('activity_id', safeActivityId).in('assignment_id', removedIds);
        if (removeResult.error) throw normalizeError(removeResult.error, 'No se pudieron retirar los cursos anteriores.');
      }
      const linkRows = ids.map((assignmentId, index) => ({
        activity_id: safeActivityId,
        assignment_id: assignmentId,
        sort_order: Math.floor(Date.now() / 1000) + index,
        visible: true
      }));
      const linkResult = await supabaseClient.from('activity_assignments').upsert(linkRows, { onConflict: 'activity_id,assignment_id' });
      if (linkResult.error) throw normalizeError(linkResult.error, 'No se pudieron actualizar los cursos de la actividad.');

      const oldPaths = [
        ...storedActivityFiles(existingContentPayload).map((item) => item.path),
        ...storedActivityFiles(existingReviewPayload).map((item) => item.path)
      ];
      const retainedPaths = [
        ...storedActivityFiles(contentPayload).map((item) => item.path),
        ...storedActivityFiles(reviewPayload).map((item) => item.path)
      ];
      await removeStorageFiles(oldPaths.filter((path) => !retainedPaths.includes(path)));

      return {
        id: safeActivityId,
        title: String(title || '').trim(),
        lessonId: lessonId || '',
        period: Number(period || 1),
        startsAt: startsAt || '',
        dueAt: dueAt || '',
        contentType,
        contentPayload,
        reviewType,
        reviewPayload,
        rubric,
        status: 'published',
        assignmentId: ids[0] || '',
        assignmentIds: ids,
        sortOrder: linkRows[0]?.sort_order || 0,
        createdAt: new Date().toISOString()
      };
    } catch (error) {
      if (uploadedPaths.length) await removeStorageFiles(uploadedPaths);
      throw error;
    }
  }

  async function getActivityGradebook({ activityId, assignmentId }) {
    const supabaseClient = getClient();
    const recordsResult = await supabaseClient
      .from('activity_student_records')
      .select('id,activity_id,assignment_id,student_id,score,observations,submission_file,grading_group_id,rubric_scores,graded_at,updated_at,student:students(id,student_code,display_name,first_name,last_name)')
      .eq('activity_id', activityId)
      .eq('assignment_id', assignmentId);
    if (recordsResult.error) throw normalizeError(recordsResult.error, 'No se pudo cargar la lista de calificaciones.');
    const records = recordsResult.data || [];
    const recordIds = records.map((row) => row.id);
    let events = [];
    if (recordIds.length) {
      const eventsResult = await supabaseClient
        .from('activity_delivery_events')
        .select('id,activity_record_id,status,note,occurred_at,created_at')
        .in('activity_record_id', recordIds)
        .order('occurred_at', { ascending: true });
      if (eventsResult.error) throw normalizeError(eventsResult.error, 'No se pudo cargar el seguimiento de entregas.');
      events = eventsResult.data || [];
    }
    const eventMap = new Map();
    events.forEach((event) => {
      if (!eventMap.has(event.activity_record_id)) eventMap.set(event.activity_record_id, []);
      eventMap.get(event.activity_record_id).push({
        id: event.id,
        status: event.status,
        note: event.note || '',
        occurredAt: event.occurred_at || event.created_at || ''
      });
    });
    return records.map((row) => {
      const student = Array.isArray(row.student) ? row.student[0] : row.student;
      const firstName = student?.first_name || '';
      const lastName = student?.last_name || '';
      const fullName = student?.display_name || `${lastName}, ${firstName}`.replace(/^,\s*/, '').trim();
      const deliveryEvents = eventMap.get(row.id) || [];
      return {
        recordId: row.id,
        activityId: row.activity_id,
        assignmentId: row.assignment_id,
        studentDbId: row.student_id,
        studentCode: String(student?.student_code || row.student_id || ''),
        firstName,
        lastName,
        fullName,
        score: Number(row.score ?? 40),
        observations: row.observations || '',
        submissionFile: row.submission_file && typeof row.submission_file === 'object' ? row.submission_file : {},
        gradingGroupId: row.grading_group_id || '',
        rubricScores: row.rubric_scores && typeof row.rubric_scores === 'object' ? row.rubric_scores : {},
        gradedAt: row.graded_at || '',
        updatedAt: row.updated_at || '',
        deliveryEvents,
        latestDeliveryStatus: deliveryEvents.length ? deliveryEvents[deliveryEvents.length - 1].status : ''
      };
    }).sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'es'));
  }

  async function uploadActivitySubmission({ activityId, assignmentId, studentCode, file, mutationId = '' }) {
    if (!file) return null;
    const activeSession = await requireAuthenticatedSession();
    const bucket = config.storageBucket || 'lms-public';
    const path = `${activeSession.user.id}/activities/${activityId}/submissions/${assignmentId}/${safeStorageName(studentCode)}-${mutationId || Date.now()}-${safeStorageName(file.name || 'entrega')}`;
    const result = await getClient().storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: Boolean(mutationId),
      contentType: file.type || undefined
    });
    if (result.error) throw normalizeError(result.error, 'No se pudo subir el archivo de entrega.');
    return {
      name: file.name || 'Archivo de entrega',
      type: file.type || '',
      size: Number(file.size || 0),
      path,
      url: getClient().storage.from(bucket).getPublicUrl(path).data?.publicUrl || ''
    };
  }

  async function saveActivityGrades({ activityId, assignmentId, primaryStudentCode, selectedStudentCodes = [], previousGroupStudentCodes = [], gradingGroupId = '', scores = {}, rubricScores = {}, observations = '', existingSubmissionFile = {}, submissionFile = null, deliveryStatus = '', deliveryNote = '', mutationId = '', clientMutationId = '' }) {
    const supabaseClient = getClient();
    const activeSession = await requireAuthenticatedSession();
    if (!activeSession?.user?.id) throw new Error('No hay una sesión activa.');
    const codes = [...new Set([primaryStudentCode, ...(selectedStudentCodes || [])].filter(Boolean))];
    const dbRows = codes.map((code) => ({ code, studentId: resolveStudentDbId(code) }));
    if (dbRows.some((row) => !row.studentId)) throw new Error('No se encontró uno de los estudiantes seleccionados.');
    const groupId = codes.length > 1 ? (String(gradingGroupId || '').trim() || globalThis.crypto?.randomUUID?.() || null) : null;
    const stableMutationId = mutationId || clientMutationId || '';
    const newSubmission = await uploadActivitySubmission({ activityId, assignmentId, studentCode: primaryStudentCode, file: submissionFile, mutationId: stableMutationId });
    const submissionPayload = newSubmission || (existingSubmissionFile && typeof existingSubmissionFile === 'object' ? existingSubmissionFile : {});
    const gradedAt = new Date().toISOString();
    const rows = dbRows.map(({ code, studentId }) => ({
      activity_id: activityId,
      assignment_id: assignmentId,
      student_id: studentId,
      score: Math.max(0, Math.min(100, Number(scores[code] ?? scores[primaryStudentCode] ?? 40))),
      observations: String(observations || ''),
      submission_file: submissionPayload,
      grading_group_id: groupId,
      rubric_scores: rubricScores && typeof rubricScores === 'object' ? rubricScores : {},
      graded_by: activeSession.user.id,
      graded_at: gradedAt,
      client_mutation_id: stableMutationId ? `${stableMutationId}:${studentId}` : null
    }));
    const upsertResult = await supabaseClient
      .from('activity_student_records')
      .upsert(rows, { onConflict: 'activity_id,assignment_id,student_id' })
      .select('id,student_id');
    if (upsertResult.error) {
      if (newSubmission?.path) await removeStorageFiles([newSubmission.path]);
      throw normalizeError(upsertResult.error, 'No se pudo guardar la calificación.');
    }

    const removedCodes = [...new Set(previousGroupStudentCodes || [])].filter((code) => !codes.includes(code));
    const removedIds = removedCodes.map(resolveStudentDbId).filter(Boolean);
    if (removedIds.length) {
      const ungroupResult = await supabaseClient
        .from('activity_student_records')
        .update({ grading_group_id: null })
        .eq('activity_id', activityId)
        .eq('assignment_id', assignmentId)
        .in('student_id', removedIds);
      if (ungroupResult.error) throw normalizeError(ungroupResult.error, 'No se pudo actualizar el grupo de trabajo.');
    }

    if (deliveryStatus) {
      const eventRows = (upsertResult.data || []).map((row) => ({
        activity_record_id: row.id,
        status: deliveryStatus,
        note: String(deliveryNote || ''),
        occurred_at: gradedAt,
        created_by: activeSession.user.id,
        client_mutation_id: stableMutationId ? `${stableMutationId}:${row.id}` : null
      }));
      if (stableMutationId) {
        await insertIdempotentByMutationId(
          'activity_delivery_events',
          eventRows,
          'id',
          'La nota se guardó, pero no se pudo registrar el seguimiento de entrega.'
        );
      } else {
        const eventResult = await supabaseClient.from('activity_delivery_events').insert(eventRows);
        if (eventResult.error) throw normalizeError(eventResult.error, 'La nota se guardó, pero no se pudo registrar el seguimiento de entrega.');
      }
    }

    if (newSubmission?.path && existingSubmissionFile?.path && existingSubmissionFile.path !== newSubmission.path) {
      await removeStorageFiles([existingSubmissionFile.path]);
    }
    return getActivityGradebook({ activityId, assignmentId });
  }

  async function deleteActivity({ activityId, assignmentId, mode = 'all' }) {
    const supabaseClient = getClient();
    await requireAuthenticatedSession();
    const safeActivityId = String(activityId || '').trim();
    if (!safeActivityId) throw new Error('No se encontró la actividad que deseas eliminar.');

    const activityResult = await supabaseClient.from('activities').select('content_payload,review_payload').eq('id', safeActivityId).maybeSingle();
    if (activityResult.error) throw normalizeError(activityResult.error, 'No se pudo leer la actividad.');
    const submissionResult = await supabaseClient.from('activity_student_records').select('submission_file').eq('activity_id', safeActivityId);
    if (submissionResult.error) throw normalizeError(submissionResult.error, 'No se pudieron revisar los archivos de entrega.');
    const basePaths = [
      ...storedActivityFiles(activityResult.data?.content_payload).map((item) => item.path),
      ...storedActivityFiles(activityResult.data?.review_payload).map((item) => item.path),
      ...(submissionResult.data || []).map((row) => row.submission_file?.path).filter(Boolean)
    ];

    if (mode === 'course') {
      const unlink = await supabaseClient.from('activity_assignments').delete().eq('activity_id', safeActivityId).eq('assignment_id', assignmentId);
      if (unlink.error) throw normalizeError(unlink.error, 'No se pudo quitar la actividad de este curso.');
      const remaining = await supabaseClient.from('activity_assignments').select('assignment_id', { count: 'exact', head: true }).eq('activity_id', safeActivityId);
      if (remaining.error) throw normalizeError(remaining.error, 'No se pudo verificar si la actividad sigue compartida.');
      if (Number(remaining.count || 0) > 0) return { mode: 'course' };
    }

    const deleteResult = await supabaseClient.from('activities').delete().eq('id', safeActivityId);
    if (deleteResult.error) throw normalizeError(deleteResult.error, 'No se pudo eliminar la actividad.');
    await removeStorageFiles(basePaths);
    return { mode: 'all' };
  }

  async function deletePdfLesson({ lessonId, assignmentId, mode = 'all', storagePdfPath = '', storageThumbnailPath = '' }) {
    const supabaseClient = getClient();
    await requireAuthenticatedSession();
    const safeLessonId = String(lessonId || '').trim();
    if (!safeLessonId) throw new Error('No se encontró la clase que deseas eliminar.');

    if (mode === 'course') {
      if (!assignmentId) throw new Error('No se encontró el curso actual.');
      const unlinkResult = await supabaseClient
        .from('assignment_lessons')
        .delete()
        .eq('assignment_id', assignmentId)
        .eq('lesson_id', safeLessonId);
      if (unlinkResult.error) throw normalizeError(unlinkResult.error, 'No se pudo quitar la clase de este curso.');
      return { mode: 'course' };
    }

    const linksResult = await supabaseClient.from('assignment_lessons').delete().eq('lesson_id', safeLessonId);
    if (linksResult.error) throw normalizeError(linksResult.error, 'No se pudieron quitar las asignaciones de la clase.');
    const lessonResult = await supabaseClient.from('lessons').delete().eq('id', safeLessonId);
    if (lessonResult.error) throw normalizeError(lessonResult.error, 'No se pudo eliminar la clase.');

    const paths = [storagePdfPath, storageThumbnailPath].map((value) => String(value || '').trim()).filter(Boolean);
    if (paths.length) {
      const storageResult = await supabaseClient.storage.from(config.storageBucket || 'lms-public').remove(paths);
      if (storageResult.error) console.warn('[Supabase] La clase se eliminó, pero quedaron archivos huérfanos en Storage.', storageResult.error);
    }
    return { mode: 'all' };
  }

  async function recordLessonView({ assignmentId, lessonId, mutationId = '', clientMutationId = '' }) {
    const supabaseClient = getClient();
    const activeSession = await requireAuthenticatedSession();
    if (!activeSession?.user?.id) return;
    const row = {
      assignment_id: assignmentId,
      lesson_id: lessonId,
      user_id: activeSession.user.id,
      client_mutation_id: mutationId || clientMutationId || null
    };
    if (row.client_mutation_id) {
      await insertIdempotentByMutationId(
        'lesson_views',
        row,
        'id',
        'No se pudo registrar la apertura de la clase.'
      );
      return;
    }
    const { error } = await supabaseClient.from('lesson_views').insert(row);
    if (error) throw normalizeError(error, 'No se pudo registrar la apertura de la clase.');
  }

  async function startQuizAttempt({ quiz, assignmentId, clientMutationId = '' }) {
    let quizAssignmentId = quiz?._quizAssignmentIds?.[assignmentId] || quiz?._quizAssignmentId;
    if (session?.encisomathStudentPortal) {
      if (!quizAssignmentId) throw new Error('No se encontró la asignación de este quiz para tu curso.');
      const { data, error } = await getStudentClient().rpc('encisomath_student_start_quiz_attempt', {
        p_student_code: session.studentCode,
        p_quiz_assignment_id: String(quizAssignmentId)
      });
      if (error) {
        const message = String(error.message || '');
        if (error.code === 'PGRST202' || message.toLowerCase().includes('encisomath_student_start_quiz_attempt')) {
          throw new Error('Falta ejecutar SUPABASE_STUDENT_QUIZZES_PERIODS_v0.25.016.sql en Supabase.');
        }
        throw normalizeError(error, 'No se pudo iniciar el intento del quiz.');
      }
      if (!data || data.ok === false) throw new Error(data?.message || 'No se pudo iniciar el intento del quiz.');
      return data.attempt || data;
    }
    const supabaseClient = getClient();
    const activeSession = await requireAuthenticatedSession();
    if (!quizAssignmentId && quiz?.id && assignmentId) {
      const lookup = await supabaseClient
        .from('quiz_assignments')
        .select('id')
        .eq('quiz_id', quiz.id)
        .eq('assignment_id', assignmentId)
        .maybeSingle();
      if (lookup.error) throw normalizeError(lookup.error, 'No se encontró la asignación del quiz.');
      quizAssignmentId = lookup.data?.id || '';
      if (quizAssignmentId) {
        quiz._quizAssignmentIds = { ...(quiz._quizAssignmentIds || {}), [assignmentId]: quizAssignmentId };
        quiz._quizAssignmentId = quiz._quizAssignmentId || quizAssignmentId;
      }
    }
    if (!quizAssignmentId || !activeSession?.user?.id) return null;
    const attemptRow = {
      quiz_assignment_id: quizAssignmentId,
      user_id: activeSession.user.id,
      student_id: profile?.student_id || null,
      status: 'in_progress',
      result: { appVersion: '0.25.016', assignmentId, quizId: quiz.id },
      client_mutation_id: clientMutationId || null
    };
    if (clientMutationId) {
      return insertIdempotentByMutationId(
        'quiz_attempts',
        attemptRow,
        'id,started_at',
        'No se pudo iniciar el intento en Supabase.'
      );
    }
    const { data, error } = await supabaseClient
      .from('quiz_attempts')
      .insert(attemptRow)
      .select('id,started_at')
      .single();
    if (error) throw normalizeError(error, 'No se pudo iniciar el intento en Supabase.');
    return data;
  }

  function numericAnswerScore(answer) {
    return Number(answer?.score?.total ?? answer?.points?.total ?? answer?.points ?? 0) || 0;
  }

  function numericAnswerMax(answer) {
    return (Number(answer?.score?.maxItem ?? answer?.points?.maxItem ?? 0) || 0)
      + (Number(answer?.score?.maxTime ?? answer?.points?.maxTime ?? 0) || 0);
  }

  async function submitQuizAttempt({ attemptId, quiz, assignmentId, answers, securityEvents, terminatedReason, clientMutationId = '' }) {
    if (!attemptId) return null;
    const safeAnswers = Array.isArray(answers) ? answers : [];
    const score = safeAnswers.reduce((total, answer) => total + numericAnswerScore(answer), 0);
    const maxScore = safeAnswers.reduce((total, answer) => total + numericAnswerMax(answer), 0);
    if (session?.encisomathStudentPortal) {
      const { data, error } = await getStudentClient().rpc('encisomath_student_submit_quiz_attempt', {
        p_student_code: session.studentCode,
        p_attempt_id: String(attemptId),
        p_answers: safeAnswers,
        p_score: score,
        p_max_score: maxScore,
        p_result: {
          appVersion: '0.25.016',
          assignmentId,
          quizId: quiz?.id || '',
          answerCount: safeAnswers.length,
          securityTerminated: Boolean(terminatedReason),
          securityTerminatedReason: terminatedReason || null
        }
      });
      if (error) {
        const message = String(error.message || '');
        if (error.code === 'PGRST202' || message.toLowerCase().includes('encisomath_student_submit_quiz_attempt')) {
          throw new Error('Falta ejecutar SUPABASE_STUDENT_QUIZZES_PERIODS_v0.25.016.sql en Supabase.');
        }
        throw normalizeError(error, 'No se pudo guardar el resultado del quiz.');
      }
      if (!data || data.ok === false) throw new Error(data?.message || 'No se pudo guardar el resultado del quiz.');
      return data;
    }
    const supabaseClient = getClient();
    await requireAuthenticatedSession();
    const answerRows = safeAnswers.map((answer) => ({
      attempt_id: attemptId,
      question_id: String(answer.questionId || `q${Number(answer.index || 0) + 1}`),
      answer,
      is_correct: typeof answer.correct === 'boolean' ? answer.correct : null,
      points: numericAnswerScore(answer),
      answered_at: new Date().toISOString()
    }));
    if (answerRows.length) {
      const answersResult = await supabaseClient
        .from('quiz_answers')
        .upsert(answerRows, { onConflict: 'attempt_id,question_id' });
      if (answersResult.error) throw normalizeError(answersResult.error, 'No se pudieron guardar las respuestas del quiz.');
    }
    const submittedAt = new Date().toISOString();
    const attemptResult = await supabaseClient
      .from('quiz_attempts')
      .update({
        status: terminatedReason ? 'abandoned' : 'submitted',
        score,
        max_score: maxScore,
        submitted_at: submittedAt,
        result: {
          appVersion: '0.25.016',
          assignmentId,
          quizId: quiz?.id || '',
          answerCount: safeAnswers.length,
          securityTerminated: Boolean(terminatedReason),
          securityTerminatedReason: terminatedReason || null
        }
      })
      .eq('id', attemptId);
    if (attemptResult.error) throw normalizeError(attemptResult.error, 'No se pudo finalizar el intento.');

    const eventRows = (Array.isArray(securityEvents) ? securityEvents : []).map((event, index) => ({
      attempt_id: attemptId,
      event_type: event.reason || 'suspicious_action',
      details: event,
      client_mutation_id: clientMutationId ? `${clientMutationId}:${index}` : null
    }));
    if (eventRows.length) {
      if (clientMutationId) {
        await insertIdempotentByMutationId(
          'quiz_security_events',
          eventRows,
          'id',
          'No se pudieron guardar los eventos de seguridad.'
        );
      } else {
        const securityResult = await supabaseClient.from('quiz_security_events').insert(eventRows);
        if (securityResult.error) throw normalizeError(securityResult.error, 'No se pudieron guardar los eventos de seguridad.');
      }
    }
    return { score, maxScore, grade: maxScore > 0 ? Math.max(0, Math.min(10, (score / maxScore) * 10)) : 0 };
  }

  window.EncisoSupabase = Object.freeze({
    init,
    isConfigured,
    getClient,
    getSession,
    restoreSession,
    requireAuthenticatedSession,
    signIn,
    signInStudentCode,
    signOut,
    onAuthStateChange,
    loadApplicationData,
    saveAttendanceStatus,
    addRockstarEvent,
    createStudentAndEnroll,
    updateStudent,
    withdrawStudent,
    saveQuizzes,
    savePreferences,
    uploadAssignmentImage,
    resetAssignmentImage,
    createPdfLesson,
    updatePdfLesson,
    createActivity,
    updateActivity,
    getActivityGradebook,
    saveActivityGrades,
    deleteActivity,
    deletePdfLesson,
    recordLessonView,
    startQuizAttempt,
    submitQuizAttempt,
    resolveStudentDbId
  });
})();
