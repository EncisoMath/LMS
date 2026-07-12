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
      status: lesson.status || 'published',
      assignmentId: row?.assignment_id || '',
      sortOrder: Number(row?.sort_order || 0)
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
    let quizAssignmentRows = [];
    let attendanceRows = [];
    let rockstarRows = [];
    if (assignmentIds.length) {
      const [lessonsResult, quizzesResult, attendanceResult, rockstarResult] = await Promise.all([
        supabaseClient
          .from('assignment_lessons')
          .select('assignment_id,sort_order,visible,lesson:lessons(id,period,area,subject_name,title,emoji,lesson_type,estimated_time,content_url,status)')
          .in('assignment_id', assignmentIds)
          .eq('visible', true),
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
      if (quizzesResult.error) throw normalizeError(quizzesResult.error, 'No se pudieron cargar los quizzes.');
      if (attendanceResult.error) throw normalizeError(attendanceResult.error, 'No se pudo cargar la asistencia.');
      if (rockstarResult.error) throw normalizeError(rockstarResult.error, 'No se pudieron cargar los puntos Rockstar.');
      lessonRows = (lessonsResult.data || []).filter((row) => !LEGACY_DEMO_LESSON_IDS.includes(nestedId(row, 'lesson')));
      quizAssignmentRows = (quizzesResult.data || []).filter((row) => !LEGACY_DEMO_QUIZ_IDS.includes(nestedId(row, 'quiz')));
      attendanceRows = attendanceResult.data || [];
      rockstarRows = rockstarResult.data || [];
    }

    const uniqueLessons = new Map();
    lessonRows.map(mapLesson).filter(Boolean).forEach((lesson) => {
      if (!uniqueLessons.has(lesson.id)) uniqueLessons.set(lesson.id, lesson);
    });

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
    const { data, error } = await supabaseClient
      .from('rockstar_events')
      .insert({
        assignment_id: event.assignmentId,
        student_id: studentId,
        period: Number(event.period || 1),
        points: Number(event.delta || 0),
        category: event.category || null,
        reason: event.reason || null,
        occurred_at: event.occurredAt || new Date().toISOString(),
        created_by: session?.user?.id || (await getSession())?.user?.id
      })
      .select('id,occurred_at')
      .single();
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

  async function saveQuizzes(quizzes = []) {
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
        payload: cleanQuizPayload(quiz)
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

  async function savePreferences(preferences) {
    const supabaseClient = getClient();
    const activeSession = session || await getSession();
    if (!activeSession?.user?.id) return;
    const { error } = await supabaseClient
      .from('user_preferences')
      .upsert({ user_id: activeSession.user.id, preferences: preferences || {} }, { onConflict: 'user_id' });
    if (error) throw normalizeError(error, 'No se pudieron guardar las preferencias.');
  }

  async function uploadAssignmentImage({ assignmentId, type, file }) {
    const supabaseClient = getClient();
    const activeSession = session || await getSession();
    if (!activeSession?.user?.id) throw new Error('No hay una sesion activa.');
    const extension = String(file?.name || '').split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
    const path = `${activeSession.user.id}/assignments/${assignmentId}/${type}-${Date.now()}.${extension}`;
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

  async function recordLessonView({ assignmentId, lessonId }) {
    const supabaseClient = getClient();
    const activeSession = session || await getSession();
    if (!activeSession?.user?.id) return;
    const { error } = await supabaseClient.from('lesson_views').insert({
      assignment_id: assignmentId,
      lesson_id: lessonId,
      user_id: activeSession.user.id
    });
    if (error) throw normalizeError(error, 'No se pudo registrar la apertura de la clase.');
  }

  async function startQuizAttempt({ quiz, assignmentId }) {
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
    const { data, error } = await supabaseClient
      .from('quiz_attempts')
      .insert({
        quiz_assignment_id: quizAssignmentId,
        user_id: activeSession.user.id,
        student_id: profile?.student_id || null,
        status: 'in_progress',
        result: { appVersion: '0.24.306', assignmentId, quizId: quiz.id }
      })
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

  async function submitQuizAttempt({ attemptId, quiz, assignmentId, answers, securityEvents, terminatedReason }) {
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
          appVersion: '0.24.306',
          assignmentId,
          quizId: quiz?.id || '',
          answerCount: safeAnswers.length,
          securityTerminated: Boolean(terminatedReason),
          securityTerminatedReason: terminatedReason || null
        }
      })
      .eq('id', attemptId);
    if (attemptResult.error) throw normalizeError(attemptResult.error, 'No se pudo finalizar el intento.');

    const eventRows = (Array.isArray(securityEvents) ? securityEvents : []).map((event) => ({
      attempt_id: attemptId,
      event_type: event.reason || 'suspicious_action',
      details: event
    }));
    if (eventRows.length) {
      const securityResult = await supabaseClient.from('quiz_security_events').insert(eventRows);
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
    recordLessonView,
    startQuizAttempt,
    submitQuizAttempt,
    resolveStudentDbId
  });
})();
