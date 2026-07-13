(() => {
  'use strict';

  const config = window.ENCISOMATH_SUPABASE || {};
  let client = null;
  let session = null;
  let profile = null;
  let assignments = [];
  let studentCodeToDbId = new Map();
  let studentDbIdToCode = new Map();

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

  function isConfigured() {
    return Boolean(config.url && config.publishableKey);
  }

  function normalizeError(error, fallback = 'Ocurrio un error al comunicarse con Supabase.') {
    if (!error) return new Error(fallback);
    if (error instanceof Error) return error;
    return new Error(error.message || error.error_description || fallback);
  }

  async function getSession() {
    const supabaseClient = getClient();
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw normalizeError(error, 'No se pudo recuperar la sesion.');
    session = data?.session || null;
    return session;
  }

  async function signIn(email, password) {
    const supabaseClient = getClient();
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: String(email || '').trim().toLowerCase(),
      password: String(password || '')
    });
    if (error) throw normalizeError(error, 'No se pudo iniciar sesion.');
    session = data?.session || null;
    return session;
  }

  async function signOut() {
    const supabaseClient = getClient();
    const { error } = await supabaseClient.auth.signOut();
    session = null;
    profile = null;
    assignments = [];
    studentCodeToDbId = new Map();
    studentDbIdToCode = new Map();
    if (error) throw normalizeError(error, 'No se pudo cerrar la sesion.');
  }

  function onAuthStateChange(callback) {
    const supabaseClient = getClient();
    return supabaseClient.auth.onAuthStateChange((event, nextSession) => {
      session = nextSession || null;
      if (typeof callback === 'function') callback(event, nextSession || null);
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
      username: code,
      fullName: student.display_name || `${student.last_name || ''}, ${student.first_name || ''}`.replace(/^,\s*/, '').trim(),
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

  async function loadApplicationData() {
    const supabaseClient = getClient();
    const activeSession = session || await getSession();
    if (!activeSession?.user?.id) throw new Error('No hay una sesion activa en Supabase.');

    const { data: profileRow, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id,external_code,username,role,full_name,email,photo_url,student_id,active,student:students(student_code)')
      .eq('id', activeSession.user.id)
      .single();
    if (profileError) throw normalizeError(profileError, 'No se pudo cargar el perfil.');
    profile = profileRow;
    const appUser = mapProfile(profileRow, activeSession.user);

    const { data: assignmentRows, error: assignmentError } = await supabaseClient
      .from('teaching_assignments')
      .select('id,teacher_id,subject_id,group_id,icon_url,cover_url,active,subject:subjects(area,name),group:academic_groups(id,grade,course,campus,label)')
      .eq('active', true)
      .order('id');
    if (assignmentError) throw normalizeError(assignmentError, 'No se pudieron cargar las asignaturas.');
    assignments = (assignmentRows || []).map((row) => mapAssignment(row, appUser));
    const assignmentIds = assignments.map((item) => item.id);
    const groupIds = [...new Set(assignments.map((item) => item.groupId).filter(Boolean))];

    await purgeLegacyDemoContent(assignmentIds);

    studentCodeToDbId = new Map();
    studentDbIdToCode = new Map();

    let enrollmentRows = [];
    if (groupIds.length) {
      const { data, error } = await supabaseClient
        .from('group_enrollments')
        .select('id,group_id,student_id,status,group:academic_groups(id,grade,course,campus,label),student:students(id,student_code,display_name,first_name,last_name,photo_url,active)')
        .in('group_id', groupIds)
        .eq('status', 'active');
      if (error) throw normalizeError(error, 'No se pudieron cargar las matriculas.');
      enrollmentRows = data || [];
    }
    const students = enrollmentRows.map(mapStudent).filter(Boolean).sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));

    let lessonRows = [];
    let activityRows = [];
    let activityProgressRows = [];
    let quizAssignmentRows = [];
    let quizAttemptRows = [];
    let attendanceRows = [];
    let rockstarRows = [];
    if (assignmentIds.length) {
      const [lessonsResult, activitiesResult, activityProgressResult, quizzesResult, attendanceResult, rockstarResult] = await Promise.all([
        supabaseClient
          .from('assignment_lessons')
          .select('assignment_id,sort_order,visible,lesson:lessons(id,period,area,subject_name,title,emoji,lesson_type,estimated_time,content_url,thumbnail_url,storage_pdf_path,storage_thumbnail_path,source_file_name,page_count,status)')
          .in('assignment_id', assignmentIds)
          .eq('visible', true),
        supabaseClient
          .from('activity_assignments')
          .select('assignment_id,sort_order,visible,activity:activities(id,owner_id,title,lesson_id,period,starts_at,due_at,content_type,content_payload,review_type,review_payload,rubric,status,created_at)')
          .in('assignment_id', assignmentIds)
          .eq('visible', true),
        supabaseClient
          .from('activity_student_records')
          .select('activity_id,assignment_id,student_id,score,graded_at,grading_group_id,submission_file,delivery_events:activity_delivery_events(status,occurred_at)')
          .in('assignment_id', assignmentIds),
        supabaseClient
          .from('quiz_assignments')
          .select('id,quiz_id,assignment_id,status,available_from,due_at,max_attempts,settings,quiz:quizzes(id,owner_id,title,emoji,mode,period,subject_name,area,status,payload)')
          .in('assignment_id', assignmentIds),
        supabaseClient
          .from('attendance_records')
          .select('assignment_id,student_id,attendance_date,status')
          .in('assignment_id', assignmentIds),
        supabaseClient
          .from('rockstar_events')
          .select('id,assignment_id,student_id,period,points,category,reason,occurred_at')
          .in('assignment_id', assignmentIds)
          .order('occurred_at', { ascending: true })
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

    const { data: preferencesRow, error: preferencesError } = await supabaseClient
      .from('user_preferences')
      .select('preferences')
      .eq('user_id', activeSession.user.id)
      .maybeSingle();
    if (preferencesError) throw normalizeError(preferencesError, 'No se pudieron cargar las preferencias.');

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
        recorded_by: session?.user?.id || (await getSession())?.user?.id
      }, { onConflict: 'assignment_id,student_id,attendance_date' })
      .select('id,assignment_id,student_id,attendance_date,status')
      .single();
    if (error) throw normalizeError(error, 'No se pudo guardar la asistencia.');
    return data;
  }

  async function addRockstarEvent(event) {
    const supabaseClient = getClient();
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
      created_by: session?.user?.id || (await getSession())?.user?.id,
      client_mutation_id: event.clientMutationId || event.mutationId || null
    };
    const query = row.client_mutation_id
      ? supabaseClient.from('rockstar_events').upsert(row, { onConflict: 'client_mutation_id' })
      : supabaseClient.from('rockstar_events').insert(row);
    const { data, error } = await query.select('id,occurred_at').single();
    if (error) throw normalizeError(error, 'No se pudo guardar el punto Rockstar.');
    return data;
  }

  async function createStudentAndEnroll({ studentCode, firstName, lastName, groupId }) {
    const supabaseClient = getClient();
    const code = String(studentCode || '').trim();
    if (!code) throw new Error('El codigo del estudiante es obligatorio.');
    let student = null;
    const existingResult = await supabaseClient
      .from('students')
      .select('id,student_code,display_name,first_name,last_name,photo_url,active')
      .eq('student_code', code)
      .maybeSingle();
    if (existingResult.error) throw normalizeError(existingResult.error, 'No se pudo buscar el estudiante.');
    if (existingResult.data) {
      const updateResult = await supabaseClient
        .from('students')
        .update({ first_name: firstName, last_name: lastName, active: true })
        .eq('id', existingResult.data.id)
        .select('id,student_code,display_name,first_name,last_name,photo_url,active')
        .single();
      if (updateResult.error) throw normalizeError(updateResult.error, 'No se pudo actualizar el estudiante.');
      student = updateResult.data;
    } else {
      const insertResult = await supabaseClient
        .from('students')
        .insert({ student_code: code, first_name: firstName, last_name: lastName, active: true })
        .select('id,student_code,display_name,first_name,last_name,photo_url,active')
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
      username: code,
      fullName: student.display_name,
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

  async function withdrawStudent({ groupId, studentCode }) {
    const supabaseClient = getClient();
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
    const activeSession = session || await getSession();
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
    const activeSession = session || await getSession();
    if (!activeSession?.user?.id) return;
    const { error } = await supabaseClient
      .from('user_preferences')
      .upsert({ user_id: activeSession.user.id, preferences: preferences || {}, client_mutation_id: options.clientMutationId || null }, { onConflict: 'user_id' });
    if (error) throw normalizeError(error, 'No se pudieron guardar las preferencias.');
  }

  async function uploadAssignmentImage({ assignmentId, type, file, mutationId = '', clientMutationId = '' }) {
    const supabaseClient = getClient();
    const activeSession = session || await getSession();
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

  async function createPdfLesson({ currentAssignment, targetAssignmentIds, title, period, pdfFile, thumbnailFile, pageCount = 1, lessonId: requestedLessonId = '', mutationId = '', clientMutationId = '' }) {
    const supabaseClient = getClient();
    const activeSession = session || await getSession();
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
      const pdfUpload = await supabaseClient.storage
        .from(config.storageBucket || 'lms-public')
        .upload(pdfPath, pdfFile, { cacheControl: '3600', upsert: Boolean(mutationId || clientMutationId), contentType: 'application/pdf' });
      if (pdfUpload.error) throw normalizeError(pdfUpload.error, 'No se pudo subir el PDF.');
      uploadedPaths.push(pdfPath);
      pdfUrl = supabaseClient.storage.from(config.storageBucket || 'lms-public').getPublicUrl(pdfPath).data?.publicUrl || '';

      if (thumbnailFile) {
        const extension = String(thumbnailFile.name || '').split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'webp';
        thumbnailPath = `${rootPath}/portada.${extension}`;
        const thumbUpload = await supabaseClient.storage
          .from(config.storageBucket || 'lms-public')
          .upload(thumbnailPath, thumbnailFile, { cacheControl: '3600', upsert: Boolean(mutationId || clientMutationId), contentType: thumbnailFile.type || 'image/webp' });
        if (thumbUpload.error) throw normalizeError(thumbUpload.error, 'No se pudo subir la portada.');
        uploadedPaths.push(thumbnailPath);
        thumbnailUrl = supabaseClient.storage.from(config.storageBucket || 'lms-public').getPublicUrl(thumbnailPath).data?.publicUrl || '';
      }

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


  function newActivityId() {
    const token = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    return `activity-${token}`;
  }

  async function uploadActivityFiles({ activityId, section, files = [], mutationId = '' }) {
    const supabaseClient = getClient();
    const activeSession = session || await getSession();
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
    const activeSession = session || await getSession();
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
    const activeSession = session || await getSession();
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
    const activeSession = session || await getSession();
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
    const activeSession = session || await getSession();
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
      const eventResult = stableMutationId
        ? await supabaseClient.from('activity_delivery_events').upsert(eventRows, { onConflict: 'client_mutation_id' })
        : await supabaseClient.from('activity_delivery_events').insert(eventRows);
      if (eventResult.error) throw normalizeError(eventResult.error, 'La nota se guardó, pero no se pudo registrar el seguimiento de entrega.');
    }

    if (newSubmission?.path && existingSubmissionFile?.path && existingSubmissionFile.path !== newSubmission.path) {
      await removeStorageFiles([existingSubmissionFile.path]);
    }
    return getActivityGradebook({ activityId, assignmentId });
  }

  async function deleteActivity({ activityId, assignmentId, mode = 'all' }) {
    const supabaseClient = getClient();
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
    const activeSession = session || await getSession();
    if (!activeSession?.user?.id) return;
    const row = {
      assignment_id: assignmentId,
      lesson_id: lessonId,
      user_id: activeSession.user.id,
      client_mutation_id: mutationId || clientMutationId || null
    };
    const result = row.client_mutation_id
      ? await supabaseClient.from('lesson_views').upsert(row, { onConflict: 'client_mutation_id' })
      : await supabaseClient.from('lesson_views').insert(row);
    const { error } = result;
    if (error) throw normalizeError(error, 'No se pudo registrar la apertura de la clase.');
  }

  async function startQuizAttempt({ quiz, assignmentId, clientMutationId = '' }) {
    const supabaseClient = getClient();
    const activeSession = session || await getSession();
    let quizAssignmentId = quiz?._quizAssignmentIds?.[assignmentId] || quiz?._quizAssignmentId;
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
      result: { appVersion: '0.25.002', assignmentId, quizId: quiz.id },
      client_mutation_id: clientMutationId || null
    };
    const attemptQuery = clientMutationId
      ? supabaseClient.from('quiz_attempts').upsert(attemptRow, { onConflict: 'client_mutation_id' })
      : supabaseClient.from('quiz_attempts').insert(attemptRow);
    const { data, error } = await attemptQuery.select('id,started_at').single();
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
    if (!attemptId) return;
    const supabaseClient = getClient();
    const safeAnswers = Array.isArray(answers) ? answers : [];
    const score = safeAnswers.reduce((total, answer) => total + numericAnswerScore(answer), 0);
    const maxScore = safeAnswers.reduce((total, answer) => total + numericAnswerMax(answer), 0);
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
          appVersion: '0.25.002',
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
      const securityResult = clientMutationId
        ? await supabaseClient.from('quiz_security_events').upsert(eventRows, { onConflict: 'client_mutation_id' })
        : await supabaseClient.from('quiz_security_events').insert(eventRows);
      if (securityResult.error) throw normalizeError(securityResult.error, 'No se pudieron guardar los eventos de seguridad.');
    }
  }

  window.EncisoSupabase = Object.freeze({
    init,
    isConfigured,
    getClient,
    getSession,
    signIn,
    signOut,
    onAuthStateChange,
    loadApplicationData,
    saveAttendanceStatus,
    addRockstarEvent,
    createStudentAndEnroll,
    withdrawStudent,
    saveQuizzes,
    savePreferences,
    uploadAssignmentImage,
    resetAssignmentImage,
    createPdfLesson,
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
