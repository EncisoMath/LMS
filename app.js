(() => {
  'use strict';

  const APP_VERSION = '0.24.181';
  const QUIZ_SECURITY_ENABLED = false; // v0.24.166: modo seguro de Quizzes desactivado temporalmente
  const DATA_FILES = {
    users: './data/users.json',
    assignments: './data/assignments.json',
    students: './data/students.json',
    classes: './data/classes.json',
    rockstars: './data/rockstars.json',
    quizzes: './data/quizzes.json'
  };

  const DEFAULT_PREFS = {
    accent: '#1976D2',
    background: '#000000',
    effectsMotion: true,
    effectsMesh: true,
    visualOptimized: true,
    heroAnimations: false,
    tabTransitions: false,
    glassEffects: false,
    quizOptionEffects: true,
    quizFeedbackEffects: true,
    quizSounds: true
  };


  function prefEnabled(key) {
    return state?.prefs?.[key] !== false;
  }

  function booleanPrefChecked(key) {
    return prefEnabled(key) ? 'checked' : '';
  }
  const QUIZ_SOUND_PATHS = {
    correct: './assets/sounds/correct.mp3',
    wrong: './assets/sounds/wrong.mp3',
    type: './assets/sounds/type.mp3',
    item: './assets/sounds/item.mp3'
  };
  const QUIZ_SOUND_VOLUME = {
    correct: 0.82,
    wrong: 0.82,
    type: 0.72,
    item: 0.78
  };
  const quizSoundPreloadCache = new Map();

  function quizSoundsEnabled() {
    return prefEnabled('quizSounds');
  }

  function preloadQuizSounds() {
    if (!quizSoundsEnabled()) return;
    currentQuizMusicPath();
    Object.entries(QUIZ_SOUND_PATHS).forEach(([kind, src]) => {
      if (quizSoundPreloadCache.has(kind)) return;
      try {
        const audio = new Audio(src);
        audio.preload = 'auto';
        audio.volume = QUIZ_SOUND_VOLUME[kind] ?? 0.8;
        quizSoundPreloadCache.set(kind, audio);
      } catch (_) {}
    });
  }

  function playQuizSound(kind) {
    if (!quizSoundsEnabled()) return;
    const src = QUIZ_SOUND_PATHS[kind];
    if (!src) return;
    try {
      const audio = new Audio(src);
      audio.preload = 'auto';
      audio.volume = QUIZ_SOUND_VOLUME[kind] ?? 0.8;
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') playPromise.catch(() => {});
    } catch (_) {}
  }
  const QUIZ_MUSIC_PATHS = ['./assets/music_quiz/music1.mp3'];
  const QUIZ_MUSIC_VOLUME = 0.28;
  const QUIZ_MUSIC_FADE_MS = 280;
  let quizQuestionMusicAudio = null;
  let quizQuestionMusicKey = '';
  let quizQuestionMusicFadeTimer = null;

  function currentQuizMusicPath() {
    return QUIZ_MUSIC_PATHS[0];
  }

  function stopQuizQuestionMusic(fade = true) {
    const audio = quizQuestionMusicAudio;
    quizQuestionMusicAudio = null;
    quizQuestionMusicKey = '';
    if (quizQuestionMusicFadeTimer) {
      window.clearInterval(quizQuestionMusicFadeTimer);
      quizQuestionMusicFadeTimer = null;
    }
    if (!audio) return;
    const finish = () => {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch (_) {}
    };
    if (!fade) {
      finish();
      return;
    }
    const startVolume = Number.isFinite(audio.volume) ? audio.volume : QUIZ_MUSIC_VOLUME;
    const started = Date.now();
    quizQuestionMusicFadeTimer = window.setInterval(() => {
      const progress = Math.min(1, (Date.now() - started) / QUIZ_MUSIC_FADE_MS);
      try { audio.volume = Math.max(0, startVolume * (1 - progress)); } catch (_) {}
      if (progress >= 1) {
        window.clearInterval(quizQuestionMusicFadeTimer);
        quizQuestionMusicFadeTimer = null;
        finish();
      }
    }, 24);
  }

  function questionAllowsQuizMusic(question = getCurrentQuizQuestion()) {
    return Boolean(question);
  }

  function startQuizQuestionMusic(question = getCurrentQuizQuestion()) {
    if (!quizSoundsEnabled()) {
      stopQuizQuestionMusic(false);
      return;
    }
    const src = currentQuizMusicPath();
    if (!src) return;
    const quiz = getActiveQuiz();
    const key = `${quiz?.id || 'quiz'}:${src}`;
    if (quizQuestionMusicAudio && quizQuestionMusicKey === key) {
      try {
        quizQuestionMusicAudio.loop = true;
        quizQuestionMusicAudio.volume = QUIZ_MUSIC_VOLUME;
        if (quizQuestionMusicAudio.paused) {
          const playPromise = quizQuestionMusicAudio.play();
          if (playPromise && typeof playPromise.catch === 'function') playPromise.catch(() => {});
        }
      } catch (_) {}
      return;
    }
    stopQuizQuestionMusic(false);
    try {
      const audio = new Audio(src);
      audio.preload = 'auto';
      audio.loop = true;
      audio.volume = QUIZ_MUSIC_VOLUME;
      audio.currentTime = 0;
      quizQuestionMusicAudio = audio;
      quizQuestionMusicKey = key;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') playPromise.catch(() => {});
    } catch (_) {}
  }


  const WARNING_GAP_KEY = 'encisomath:warningBangGap';
  const WARNING_TUNE_KEY = 'encisomath:warningTune';
  const WARNING_TUNE_DEFAULTS = {
    gap: 0,
    iconX: -14,
    iconY: -22,
    markSize: 78,
    zoomMin: 100,
    zoomMax: 155,
    textX: 14,
    textY: 0
  };
  const WARNING_TUNE_FIELDS = [
    { key: 'gap', label: 'Separacion !', min: -18, max: 22, step: 1, unit: 'px' },
    { key: 'iconX', label: 'Mover ! horizontal', min: -32, max: 32, step: 1, unit: 'px' },
    { key: 'iconY', label: 'Mover ! vertical', min: -32, max: 32, step: 1, unit: 'px' },
    { key: 'markSize', label: 'Tamano !', min: 48, max: 78, step: 1, unit: 'px' },
    { key: 'zoomMin', label: 'Zoom minimo', min: 70, max: 120, step: 1, unit: '%' },
    { key: 'zoomMax', label: 'Zoom maximo', min: 100, max: 155, step: 1, unit: '%' },
    { key: 'textX', label: 'Mover texto horizontal', min: -36, max: 36, step: 1, unit: 'px' },
    { key: 'textY', label: 'Mover texto vertical', min: -30, max: 30, step: 1, unit: 'px' }
  ];

  const ROCKSTAR_SCORE_TUNE_KEY = 'encisomath:rockstarScoreTune';
  const ROCKSTAR_SCORE_TUNE_DEFAULTS = { x: -2, y: 6, zoom: 79 };
  const ROCKSTAR_SCORE_TUNE_FIELDS = [
    { key: 'x', label: 'Mover puntos horizontal', min: -70, max: 70, step: 1, unit: 'px' },
    { key: 'y', label: 'Mover puntos vertical', min: -36, max: 36, step: 1, unit: 'px' },
    { key: 'zoom', label: 'Zoom puntos', min: 70, max: 145, step: 1, unit: '%' }
  ];

  const SUBJECT_INFO_TUNE_KEY = 'encisomath:subjectInfoTune';
  const SUBJECT_INFO_TUNE_DEFAULTS = { x: 10, zoom: 137 };
  const SUBJECT_INFO_TUNE_FIELDS = [
    { key: 'x', label: 'Mover info horizontal', min: -90, max: 90, step: 1, unit: 'px' },
    { key: 'zoom', label: 'Zoom info', min: 70, max: 145, step: 1, unit: '%' }
  ];

  const QUIZ_FEEDBACK_TUNE_KEY = 'encisomath:quizFeedbackTune:v0.24.166';
  const QUIZ_FEEDBACK_TUNE_DEFAULTS = {
    bandRotation: -2,
    bandX: 0,
    bandY: 0,
    bandWidth: 132,
    bandHeight: 126,
    bandZoom: 100,
    emojiX: 0,
    emojiY: 0,
    emojiZoom: 100,
    titleX: 0,
    titleY: 0,
    titleSize: 45,
    titleWidth: 92,
    titlePreset: '900|normal',
    textX: 0,
    textY: 0,
    textSize: 15,
    textWidth: 92,
    textPreset: '500|normal',
    bounceDuration: 0
  };
  const QUIZ_FEEDBACK_AFTER_PAINT_DELAY_MS = 420;
  const QUIZ_FEEDBACK_AFTER_CHOICE_REVEAL_MS = 460;
  const QUIZ_FEEDBACK_NEUTRAL_DELAY_MS = 220;
  const QUIZ_FEEDBACK_TOTAL_DURATION_MS = 4200;
  const QUIZ_FEEDBACK_BAND_EXIT_START_MS = 3600;
  const QUIZ_TRANSITION_TUNE_KEY = 'encisomath:quizTransitionTune:v0.24.166';
  const QUIZ_TRANSITION_ENTER_MS = 650;
  const QUIZ_TRANSITION_WAIT_MS = 3000;
  const QUIZ_TRANSITION_EXIT_MS = 950;
  const QUIZ_TRANSITION_EXIT_START_MS = QUIZ_TRANSITION_ENTER_MS + QUIZ_TRANSITION_WAIT_MS;
  const QUIZ_TRANSITION_TOTAL_MS = QUIZ_TRANSITION_EXIT_START_MS + QUIZ_TRANSITION_EXIT_MS;
  const QUIZ_TRANSITION_FIRST_INFO_MS = 4000;
  const QUIZ_TRANSITION_FIRST_EXIT_START_MS = 6500;
  const QUIZ_TRANSITION_FIRST_TOTAL_MS = 7000;
  const QUIZ_TRANSITION_TUNE_DEFAULTS = { radials: true, sceneGlow: false, shapeGlow: true, continuous: false };
  const QUIZ_RANKING_PODIUM_TUNE_KEY = 'encisomath:rankingPodiumTune:v0.24.181';
  const QUIZ_RANKING_PODIUM_TUNE_DEFAULTS = {
    p1x: 5, p1y: -45, p1rot: 0,
    p2x: 38, p2y: -41, p2rot: -6,
    p3x: -29, p3y: -40, p3rot: 5,
    baseX: 0, baseY: -26, baseW: 100
  };
  const QUIZ_RANKING_PODIUM_TUNE_FIELDS = [
    { key: 'p1x', group: 'Puesto 1', label: 'Puesto 1 X', min: -90, max: 90, step: 1, unit: 'px' },
    { key: 'p1y', group: 'Puesto 1', label: 'Puesto 1 Y', min: -90, max: 90, step: 1, unit: 'px' },
    { key: 'p1rot', group: 'Puesto 1', label: 'Puesto 1 rotacion', min: -18, max: 18, step: 1, unit: 'deg' },
    { key: 'p2x', group: 'Puesto 2', label: 'Puesto 2 X', min: -90, max: 90, step: 1, unit: 'px' },
    { key: 'p2y', group: 'Puesto 2', label: 'Puesto 2 Y', min: -90, max: 90, step: 1, unit: 'px' },
    { key: 'p2rot', group: 'Puesto 2', label: 'Puesto 2 rotacion', min: -18, max: 18, step: 1, unit: 'deg' },
    { key: 'p3x', group: 'Puesto 3', label: 'Puesto 3 X', min: -90, max: 90, step: 1, unit: 'px' },
    { key: 'p3y', group: 'Puesto 3', label: 'Puesto 3 Y', min: -90, max: 90, step: 1, unit: 'px' },
    { key: 'p3rot', group: 'Puesto 3', label: 'Puesto 3 rotacion', min: -18, max: 18, step: 1, unit: 'deg' },
    { key: 'baseX', group: 'Base', label: 'Base X', min: -90, max: 90, step: 1, unit: 'px' },
    { key: 'baseY', group: 'Base', label: 'Base Y', min: -70, max: 70, step: 1, unit: 'px' },
    { key: 'baseW', group: 'Base', label: 'Ancho base', min: 70, max: 130, step: 1, unit: '%' }
  ];
  const QUIZ_FEEDBACK_TUNE_FIELDS = [
    { key: 'bandRotation', group: 'Banda', label: 'Rotacion banda', min: -18, max: 18, step: 1, unit: 'deg' },
    { key: 'bandX', group: 'Banda', label: 'Posicion X banda', min: -140, max: 140, step: 1, unit: 'px' },
    { key: 'bandY', group: 'Banda', label: 'Posicion Y banda', min: -160, max: 160, step: 1, unit: 'px' },
    { key: 'bandWidth', group: 'Banda', label: 'Ancho banda', min: 110, max: 180, step: 1, unit: 'vw' },
    { key: 'bandHeight', group: 'Banda', label: 'Alto banda', min: 70, max: 190, step: 1, unit: 'px' },
    { key: 'bandZoom', group: 'Banda', label: 'Zoom banda', min: 70, max: 140, step: 1, unit: '%' },
    { key: 'emojiX', group: 'Emoji', label: 'Emoji X', min: -140, max: 140, step: 1, unit: 'px' },
    { key: 'emojiY', group: 'Emoji', label: 'Emoji Y', min: -90, max: 90, step: 1, unit: 'px' },
    { key: 'emojiZoom', group: 'Emoji', label: 'Zoom emoji', min: 50, max: 190, step: 1, unit: '%' },
    { key: 'titleX', group: 'Titulo', label: 'Titulo X', min: -140, max: 140, step: 1, unit: 'px' },
    { key: 'titleY', group: 'Titulo', label: 'Titulo Y', min: -90, max: 90, step: 1, unit: 'px' },
    { key: 'titleSize', group: 'Titulo', label: 'Tamano titulo', min: 18, max: 54, step: 1, unit: 'px' },
    { key: 'titleWidth', group: 'Titulo', label: 'Ancho contenedor titulo', min: 24, max: 120, step: 1, unit: 'vw' },
    { key: 'textX', group: 'Subtitulo', label: 'Subtitulo X', min: -140, max: 140, step: 1, unit: 'px' },
    { key: 'textY', group: 'Subtitulo', label: 'Subtitulo Y', min: -90, max: 90, step: 1, unit: 'px' },
    { key: 'textSize', group: 'Subtitulo', label: 'Tamano subtitulo', min: 11, max: 30, step: 1, unit: 'px' },
    { key: 'textWidth', group: 'Subtitulo', label: 'Ancho contenedor subtitulo', min: 24, max: 120, step: 1, unit: 'vw' },
    { key: 'bounceDuration', group: 'Animacion', label: 'Duracion entrada banda', min: 260, max: 1600, step: 20, unit: 'ms' }
  ];

  const ACCENT_OPTIONS = [
    { label: 'Rojo intenso', value: '#D32F2F' },
    { label: 'Rosa magenta', value: '#C2185B' },
    { label: 'Púrpura real', value: '#7B1FA2' },
    { label: 'Violeta profundo', value: '#512DA8' },
    { label: 'Azul índigo', value: '#303F9F' },
    { label: 'Azul Enciso', value: '#1976D2' },
    { label: 'Azul cielo', value: '#0288D1' },
    { label: 'Cian profundo', value: '#0097A7' },
    { label: 'Verde azulado', value: '#00796B' },
    { label: 'Verde bosque', value: '#388E3C' },
    { label: 'Verde lima', value: '#689F38' },
    { label: 'Oliva dorado', value: '#AFB42B' },
    { label: 'Amarillo solar', value: '#FBC02D' },
    { label: 'Ámbar', value: '#FFA000' },
    { label: 'Naranja vivo', value: '#F57C00' },
    { label: 'Terracota', value: '#E64A19' }
  ];

  const BACKGROUND_OPTIONS = [
    { label: 'Negro total', value: '#000000' }
  ];

  const $app = document.getElementById('app');
  const $toast = document.getElementById('toast');

  const state = {
    data: { users: [], assignments: [], students: [], classes: [], rockstars: [], quizzes: [] },
    user: null,
    assignment: null,
    period: 1,
    classViewMode: localStorage.getItem('encisomath:classViewMode') || 'grid',
    rockstarPeriod: Number(localStorage.getItem('encisomath:rockstarPeriod') || 1),
    quizPeriod: Number(localStorage.getItem('encisomath:quizPeriod') || 1),
    quizActiveId: localStorage.getItem('encisomath:quizActiveId') || '',
    quizQuestionIndex: 0,
    quizFullscreenActive: false,
    quizSession: { phase: 'idle', answers: [], locked: false, selectedAnswerId: '', securityEvents: [], securityWarningOpen: false, securityTerminated: false },
    quizTimers: [],
    attendanceDate: todayISO(),
    filters: { grade: 'all', area: 'all', course: 'all' },
    studentSearch: '',
    prefs: { ...DEFAULT_PREFS, ...(readJSON('encisomath:prefs') || {}) },
    quizTransitionPanelOpen: true,
    quizRankingPodiumPanelOpen: true,
    appRoute: null,
    appHistoryReady: false,
    applyingHistoryRoute: false
  };

  const PERF_DEFAULTS_111_KEY = 'encisomath:perfDefaults:v0.24.124';
  // v0.24.124: la transición entre pestañas queda desactivada de forma fija;
  // los demás efectos respetan la configuración normal del usuario.
  state.prefs.tabTransitions = false;
  if (!localStorage.getItem(PERF_DEFAULTS_111_KEY)) {
    localStorage.setItem('encisomath:prefs', JSON.stringify(state.prefs));
    localStorage.setItem(PERF_DEFAULTS_111_KEY, '1');
  }

  let firstPaint = true;
  let transitionTimer = null;
  let warningMotionAnimations = [];

  const phrases = [
    'Cargando... acomodando los signos para que no se peleen.',
    'Factorizando la paciencia del profe.',
    'Buscando la x, aunque ella diga que no está perdida.',
    'Organizando triángulos, círculos y excusas de asistencia.',
    'Elevando la clase al cuadrado.',
    'Calculando la probabilidad de que todo cargue bonito.'
  ];

  const statusMap = {
    present: { emoji: '✅', label: 'Asistió', className: 'present' },
    absent: { emoji: '🔴', label: 'No asistió', className: 'absent' },
    excused: { emoji: '⚠️', label: 'Excusa', className: 'excused' }
  };

  document.addEventListener('DOMContentLoaded', boot);

  async function boot() {
    applyPreferences();
    applyQuizFeedbackTune();
    registerServiceWorker();
    bindQuizSecurityGuards();
    bindAppBackNavigation();
    mount(renderLoadingHTML('Preparando EncisoMath...'), null, { instant: true });
    try {
      state.data = await loadAllData();
      const session = readJSON('encisomath:session');
      if (session?.remember && session?.userId) {
        const user = findUser(session.userId);
        if (user) {
          state.user = user;
          mount(renderLoadingHTML(randomPhrase()));
          window.setTimeout(() => renderTeacherHome(), 760);
          return;
        }
      }
      renderLogin();
    } catch (error) {
      console.error(error);
      mount(`<main class="screen mobile-pad"><h1>No se pudo cargar EncisoMath</h1><p class="card-sub">Revisa que los archivos JSON existan en la carpeta <strong>data</strong>.</p><button class="primary-btn" onclick="location.reload()">Reintentar</button></main>`);
    }
  }

  async function loadAllData() {
    const bust = Date.now();
    const entries = await Promise.all(Object.entries(DATA_FILES).map(async ([key, url]) => {
      const response = await fetch(`${url}?v=${bust}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`No se pudo cargar ${url}`);
      return [key, await response.json()];
    }));
    return Object.fromEntries(entries);
  }

  function mount(markup, afterRender = null, options = {}) {
    const optimizedRoute = prefEnabled('visualOptimized') || !prefEnabled('effectsMotion') || !prefEnabled('tabTransitions');
    const paint = () => {
      $app.innerHTML = markup;
      $app.classList.remove('is-leaving');
      if (!optimizedRoute) $app.classList.add('is-entering');
      if (typeof afterRender === 'function') afterRender();
      window.setTimeout(() => $app.classList.remove('is-entering'), optimizedRoute ? 90 : 620);
      firstPaint = false;
    };

    window.clearTimeout(transitionTimer);
    if (firstPaint || options.instant || options.noTransition || optimizedRoute) {
      paint();
      return;
    }

    $app.classList.add('is-leaving');
    transitionTimer = window.setTimeout(paint, 285);
  }

  function bindAppBackNavigation() {
    if (state.appBackNavigationBound) return;
    state.appBackNavigationBound = true;
    window.addEventListener('popstate', handleAppPopState);
  }

  function normalizeAppRoute(route) {
    if (!route || typeof route !== 'object') return null;
    const screen = String(route.screen || '').trim();
    if (!screen) return null;
    if (screen === 'subject') {
      return {
        screen: 'subject',
        assignmentId: String(route.assignmentId || state.assignment?.id || ''),
        tab: normalizeSubjectTab(route.tab || state.activeSubjectTab || 'students')
      };
    }
    if (screen === 'lesson') {
      return {
        screen: 'lesson',
        assignmentId: String(route.assignmentId || state.assignment?.id || ''),
        lessonId: String(route.lessonId || '')
      };
    }
    if (['login', 'home', 'student'].includes(screen)) return { screen };
    return null;
  }

  function normalizeSubjectTab(tab) {
    const value = String(tab || 'students');
    return ['students', 'classes', 'rockstars', 'quizzes'].includes(value) ? value : 'students';
  }

  function appRouteKey(route) {
    const normalized = normalizeAppRoute(route);
    if (!normalized) return '';
    if (normalized.screen === 'subject') return `subject:${normalized.assignmentId}:${normalized.tab}`;
    if (normalized.screen === 'lesson') return `lesson:${normalized.assignmentId}:${normalized.lessonId}`;
    return normalized.screen;
  }

  function appHistoryState(route, rootGuard = false) {
    return {
      encisomathApp: true,
      encisomathRootGuard: Boolean(rootGuard),
      encisomathRoute: normalizeAppRoute(route),
      version: APP_VERSION
    };
  }

  function commitAppRoute(route, options = {}) {
    const normalized = normalizeAppRoute(route);
    if (!normalized) return;
    state.appRoute = normalized;
    if (options.noHistory || state.applyingHistoryRoute) return;
    if (state.quizFullscreenActive) return;
    if (!window.history || typeof window.history.pushState !== 'function') return;

    const key = appRouteKey(normalized);
    const currentKey = appRouteKey(state.lastCommittedAppRoute);
    if (state.appHistoryReady && key === currentKey && !options.forceHistory) return;

    try {
      if (!state.appHistoryReady) {
        window.history.replaceState(appHistoryState(normalized, true), '', window.location.href);
        window.history.pushState(appHistoryState(normalized, false), '', window.location.href);
        state.appHistoryReady = true;
      } else if (options.replaceHistory) {
        window.history.replaceState(appHistoryState(normalized, false), '', window.location.href);
      } else {
        window.history.pushState(appHistoryState(normalized, false), '', window.location.href);
      }
      state.lastCommittedAppRoute = normalized;
    } catch (error) {
      console.warn('No se pudo actualizar el historial interno de EncisoMath.', error);
    }
  }

  function handleAppPopState(event) {
    if (state.quizFullscreenActive) {
      // En quizzes no navegamos hacia atrás con el botón físico/gesto: se conserva el flujo del quiz.
      const route = state.appRoute || currentAppRouteFallback();
      try { window.history.pushState(appHistoryState(route, false), '', window.location.href); } catch (_) {}
      return;
    }

    const route = normalizeAppRoute(event.state?.encisomathRoute);
    if (!route) {
      const fallback = currentAppRouteFallback();
      try { window.history.pushState(appHistoryState(fallback, false), '', window.location.href); } catch (_) {}
      return;
    }

    state.applyingHistoryRoute = true;
    try {
      applyAppRoute(route);
      state.appRoute = route;
      state.lastCommittedAppRoute = route;
    } finally {
      state.applyingHistoryRoute = false;
    }

    if (event.state?.encisomathRootGuard) {
      window.setTimeout(() => {
        if (state.quizFullscreenActive) return;
        try {
          window.history.pushState(appHistoryState(route, false), '', window.location.href);
          state.lastCommittedAppRoute = route;
        } catch (_) {}
      }, 0);
    }
  }

  function currentAppRouteFallback() {
    if (!state.user) return { screen: 'login' };
    if (state.assignment?.id) {
      return { screen: 'subject', assignmentId: state.assignment.id, tab: normalizeSubjectTab(state.activeSubjectTab || 'students') };
    }
    return state.user.role === 'teacher' ? { screen: 'home' } : { screen: 'student' };
  }

  function applyAppRoute(route) {
    const normalized = normalizeAppRoute(route) || currentAppRouteFallback();
    if (!state.user && normalized.screen !== 'login') {
      renderLogin({ noHistory: true });
      return;
    }

    if (normalized.screen === 'login') {
      renderLogin({ noHistory: true });
      return;
    }

    if (normalized.screen === 'student') {
      renderStudentPlaceholder({ noHistory: true });
      return;
    }

    if (normalized.screen === 'home') {
      renderTeacherHome({ noHistory: true });
      return;
    }

    if (normalized.screen === 'subject') {
      const assignment = state.data.assignments.find((item) => item.id === normalized.assignmentId);
      if (!assignment) {
        renderTeacherHome({ noHistory: true });
        return;
      }
      state.assignment = assignment;
      renderSubjectDetail(normalized.tab, { noHistory: true });
      return;
    }

    if (normalized.screen === 'lesson') {
      const assignment = state.data.assignments.find((item) => item.id === normalized.assignmentId);
      const lesson = state.data.classes.find((item) => item.id === normalized.lessonId);
      if (!assignment || !lesson) {
        renderTeacherHome({ noHistory: true });
        return;
      }
      state.assignment = assignment;
      renderLesson(lesson, { noHistory: true });
    }
  }

  function renderLogin(options = {}) {
    commitAppRoute({ screen: 'login' }, options);
    const last = readJSON('encisomath:lastUser');
    const markup = `
      <main class="login-screen">
        ${animatedShapes('login')}
        <section class="login-card">
          <div class="logo-wrap" aria-label="EncisoMath">
            <div class="logo-mark">
              <div class="logo-top">Enciso</div>
              <div class="logo-math"><span class="x">√</span>Math<span class="plus">+</span></div>
            </div>
            <div class="logo-sub">AVA MATEMÁTICO</div>
          </div>

          <form id="loginForm" class="login-form">
            <label class="field-label" for="userId">Ingrese su ID de usuario</label>
            <input class="input" id="userId" name="userId" inputmode="numeric" autocomplete="username" value="${escapeHTML(last?.id || '')}" placeholder="Ejemplo: 0720" required />
            <div class="remember-row">
              <label><input type="checkbox" id="remember" checked /> Mantener sesión iniciada</label>
            </div>
            <button class="primary-btn full" type="submit">Iniciar sesión</button>
            <div class="last-user">
              <span>Último usuario</span>
              <button type="button" class="mini-btn" id="lastUserBtn">${last ? `${escapeHTML(last.name)} · ${escapeHTML(last.id)}` : 'Sin registro'}</button>
            </div>
            <p class="login-hint">Demo inicial: docente <strong>0720</strong>. Luego se cambian usuarios en <strong>data/users.json</strong>.</p>
          </form>
        </section>
      </main>
    `;

    mount(markup, () => {
      document.getElementById('lastUserBtn').addEventListener('click', () => {
        if (last?.id) document.getElementById('userId').value = last.id;
      });

      document.getElementById('loginForm').addEventListener('submit', (event) => {
        event.preventDefault();
        const id = normalizeID(document.getElementById('userId').value);
        const remember = document.getElementById('remember').checked;
        const user = findUser(id);
        if (!user) {
          toast('Usuario no encontrado. Prueba con 0720 o edita data/users.json.');
          return;
        }
        localStorage.setItem('encisomath:lastUser', JSON.stringify({ id: user.id, name: user.fullName }));
        if (remember) localStorage.setItem('encisomath:session', JSON.stringify({ userId: user.id, remember: true, at: Date.now() }));
        else localStorage.removeItem('encisomath:session');
        state.user = user;
        mount(renderLoadingHTML(randomPhrase()));
        window.setTimeout(() => {
          if (user.role === 'teacher') renderTeacherHome();
          else renderStudentPlaceholder();
        }, 820);
      });
    });
  }

  function renderLoadingHTML(text = randomPhrase()) {
    return `
      <main class="loading-screen">
        ${animatedShapes('loading')}
        <section class="loader-card">
          <div class="loader-orbit"><span>π</span><span>Σ</span><span>√</span></div>
          <div class="loading-phrase">${escapeHTML(text)}</div>
          <div class="loading-small">Versión ${APP_VERSION}</div>
        </section>
      </main>
    `;
  }

  function renderTeacherHome(options = {}) {
    commitAppRoute({ screen: 'home' }, options);
    state.assignment = null;
    const teacher = state.user;
    const assignments = getTeacherAssignments(teacher.id);
    const filtered = assignments.filter((item) => {
      return (state.filters.grade === 'all' || item.grade === state.filters.grade)
        && (state.filters.area === 'all' || item.area === state.filters.area)
        && (state.filters.course === 'all' || item.course === state.filters.course);
    });

    const grades = unique(assignments.map((item) => item.grade)).sort((a, b) => Number(b) - Number(a));
    const areas = unique(assignments.map((item) => item.area)).sort();
    const courses = unique(assignments.map((item) => item.course)).sort();

    const markup = `
      <main class="screen home-screen">
        <section class="twitter-profile">
          <div class="profile-cover animated-cover">
            ${coverMotionHTML('home')}
          </div>
          <div class="profile-info">
            <div class="profile-action-row">
              <button class="round-action" id="profileMenuBtn" aria-label="Opciones de perfil">•••</button>
              <button class="logout-pill" id="logoutBtn">Cerrar sesión</button>
            </div>
            <img class="profile-avatar" src="${escapeAttr(teacher.photo || './assets/default-avatar.svg')}" alt="Foto de perfil" />
            <div class="profile-copy">
              <span class="profile-kicker">Bienvenido</span>
              <h1>${escapeHTML(teacher.fullName)}</h1>
              <p class="profile-handle">@${escapeHTML(teacher.username || teacher.id)}</p>
              <p class="profile-bio">Docente · ${assignments.length} cargas asignadas</p>
              <div class="profile-meta">
                <span>🧮 Matemáticas</span>
                <span>🏫 Municipal</span>
                <span>📱 EncisoMath</span>
              </div>
            </div>
          </div>
        </section>

        <section class="section">
          <div class="section-head">
            <div>
              <p class="section-kicker">Panel docente</p>
              <h2 class="section-title">Asignaturas</h2>
            </div>
            <button class="mini-btn" id="notifyBtn">🔔 Prueba</button>
          </div>
          <div class="filter-row three">
            ${selectHTML('gradeFilter', 'Grado', grades, state.filters.grade)}
            ${selectHTML('areaFilter', 'Área', areas, state.filters.area)}
            ${selectHTML('courseFilter', 'Curso', courses, state.filters.course)}
          </div>
          <div id="assignmentsGrid" class="grid assignments-grid">
            ${filtered.map(assignmentCardHTML).join('') || `<div class="empty">No hay asignaturas con esos filtros.</div>`}
          </div>
        </section>
        ${bottomNav('profe')}
      </main>
    `;

    mount(markup, () => {
      document.getElementById('logoutBtn').addEventListener('click', logout);
      document.getElementById('notifyBtn').addEventListener('click', requestNotificationTest);
      document.getElementById('profileMenuBtn').addEventListener('click', (event) => {
        event.stopPropagation();
        openProfileMenuModal();
      });
      bindFilter('gradeFilter', 'grade', renderTeacherAssignmentGrid);
      bindFilter('areaFilter', 'area', renderTeacherAssignmentGrid);
      bindFilter('courseFilter', 'course', renderTeacherAssignmentGrid);

      bindAssignmentCards(assignments);
    });
  }

  function renderTeacherAssignmentGrid() {
    const teacher = state.user;
    const assignments = getTeacherAssignments(teacher.id);
    const filtered = assignments.filter((item) => {
      return (state.filters.grade === 'all' || item.grade === state.filters.grade)
        && (state.filters.area === 'all' || item.area === state.filters.area)
        && (state.filters.course === 'all' || item.course === state.filters.course);
    });
    const grid = document.getElementById('assignmentsGrid');
    if (!grid) return;
    grid.innerHTML = filtered.map(assignmentCardHTML).join('') || `<div class="empty">No hay asignaturas con esos filtros.</div>`;
    grid.classList.remove('grid-local-update');
    void grid.offsetWidth;
    grid.classList.add('grid-local-update');
    bindAssignmentCards(assignments);
  }

  function bindAssignmentCards(assignments = getTeacherAssignments(state.user?.id)) {
    document.querySelectorAll('[data-open-assignment]').forEach((button) => {
      button.addEventListener('click', () => {
        const assignment = assignments.find((item) => item.id === button.dataset.openAssignment);
        if (!assignment) return;
        state.assignment = assignment;
        renderSubjectDetail('students');
      });
    });
  }

  function renderSubjectDetail(tab = 'students', options = {}) {
    tab = normalizeSubjectTab(tab);
    const assignment = state.assignment;
    if (!assignment) return renderTeacherHome(options);
    commitAppRoute({ screen: 'subject', assignmentId: assignment.id, tab }, options);
    const coverStyle = coverBackgroundStyle(assignment);
    const iconSrc = getAssignmentIcon(assignment);

    const studentCount = getStudentsForAssignment(assignment).length;
    const markup = `
      <main class="screen subject-screen">
        <header class="topbar fixed-lock">
          <button class="icon-btn" id="backBtn" aria-label="Volver">←</button>
          <h1>${escapeHTML(assignment.subject)}</h1>
          <span class="spacer"></span>
          <button class="icon-btn" id="homeBtn" aria-label="Inicio">⌂</button>
        </header>
        <section class="subject-banner animated-cover ${getAssignmentCover(assignment) ? 'has-custom-cover' : 'is-default-cover'}" ${coverStyle} data-icon-hidden="${isSubjectIconVisible(assignment) ? 'false' : 'true'}">
          ${coverMotionHTML('subject')}
          <div class="subject-banner-shade" aria-hidden="true"></div>
          <button class="subject-menu-btn" id="subjectMenuBtn" aria-label="Gestor visual">•••</button>
          <div class="subject-banner-content">
            ${isSubjectIconVisible(assignment) ? `<img class="subject-icon xl" src="${escapeAttr(iconSrc)}" alt="Icono de asignatura" />` : ''}
            <div class="subject-copy">
              <p class="subject-kicker">${escapeHTML(assignment.area)}</p>
              <h2>${escapeHTML(assignment.subject)}</h2>
              <div class="subject-chips compact">
                <span>Grado ${escapeHTML(assignment.grade)}-${escapeHTML(assignment.course)}</span>
                <span>${escapeHTML(assignment.sede)}</span>
                <span>${studentCount} estudiantes</span>
              </div>
            </div>
          </div>
        </section>
        <div class="tab-row sticky-tabs">
          <button class="tab-btn ${tab === 'students' ? 'active' : ''}" id="studentsTab">👥 Estudiantes</button>
          <button class="tab-btn ${tab === 'classes' ? 'active' : ''}" id="classesTab">📚 Clases</button>
          <button class="tab-btn ${tab === 'rockstars' ? 'active' : ''}" id="rockstarsTab">🚀 Rockstars</button>
          <button class="tab-btn ${tab === 'quizzes' ? 'active' : ''}" id="quizzesTab">🎮 Quizzes</button>
        </div>
        <section id="tabContent" class="section tab-section"></section>
        ${bottomNav('profe')}
      </main>
    `;

    mount(markup, () => {
      document.getElementById('backBtn').addEventListener('click', renderTeacherHome);
      document.getElementById('homeBtn').addEventListener('click', renderTeacherHome);
      document.getElementById('studentsTab').addEventListener('click', () => setSubjectTab('students'));
      document.getElementById('classesTab').addEventListener('click', () => setSubjectTab('classes'));
      document.getElementById('rockstarsTab').addEventListener('click', () => setSubjectTab('rockstars'));
      document.getElementById('quizzesTab').addEventListener('click', () => setSubjectTab('quizzes'));
      document.getElementById('subjectMenuBtn').addEventListener('click', openVisualManagerModal);
      applySubjectInfoTune();
      setActiveSubjectTabMeta(tab);
      if (tab === 'students') renderStudentsTab({ animate: true });
      else if (tab === 'rockstars') renderRockstarsTab({ animate: true });
      else if (tab === 'quizzes') renderQuizzesTab({ animate: true });
      else renderClassesTab({ animate: true });
    });
  }

  function subjectInfoTunePanelHTML() {
    const tune = getSubjectInfoTune();
    const rows = SUBJECT_INFO_TUNE_FIELDS.map((field) => {
      const value = tune[field.key];
      return `
        <label class="subject-info-tune-row">
          <span class="subject-info-tune-head"><strong>${field.label}</strong><output data-subject-info-tune-value="${field.key}">${value}${field.unit}</output></span>
          <input type="range" min="${field.min}" max="${field.max}" step="${field.step}" value="${value}" data-subject-info-tune="${field.key}" />
        </label>
      `;
    }).join('');
    return `
      <section class="subject-info-tune-panel" aria-label="Ajuste temporal de informacion del banner">
        <div class="subject-info-tune-title">Ajuste temporal info banner</div>
        <div class="subject-info-tune-help">Pásame estos valores cuando la informacion de la asignatura quede bien.</div>
        ${rows}
        <button class="btn ghost small subject-info-tune-reset" type="button" id="subjectInfoTuneReset">Restablecer info</button>
      </section>
    `;
  }

  function bindSubjectInfoTunePanel() {
    document.querySelectorAll('[data-subject-info-tune]').forEach((input) => {
      input.addEventListener('input', () => {
        const key = input.dataset.subjectInfoTune;
        const value = Number(input.value);
        const tune = getSubjectInfoTune();
        tune[key] = value;
        saveSubjectInfoTune(tune);
        updateSubjectInfoTuneOutput(key, value);
        applySubjectInfoTune(tune);
      });
    });
    document.getElementById('subjectInfoTuneReset')?.addEventListener('click', () => {
      saveSubjectInfoTune({ ...SUBJECT_INFO_TUNE_DEFAULTS });
      document.querySelectorAll('[data-subject-info-tune]').forEach((input) => {
        const key = input.dataset.subjectInfoTune;
        input.value = SUBJECT_INFO_TUNE_DEFAULTS[key];
        updateSubjectInfoTuneOutput(key, SUBJECT_INFO_TUNE_DEFAULTS[key]);
      });
      applySubjectInfoTune({ ...SUBJECT_INFO_TUNE_DEFAULTS });
    });
  }

  function getSubjectInfoTune() {
    return { ...SUBJECT_INFO_TUNE_DEFAULTS };
  }

  function saveSubjectInfoTune(tune) {
    localStorage.setItem(SUBJECT_INFO_TUNE_KEY, JSON.stringify({
      x: Number(tune.x) || 0,
      zoom: Number(tune.zoom) || 100
    }));
  }

  function updateSubjectInfoTuneOutput(key, value) {
    const field = SUBJECT_INFO_TUNE_FIELDS.find((item) => item.key === key);
    const output = document.querySelector(`[data-subject-info-tune-value="${escapeSelector(key)}"]`);
    if (output && field) output.textContent = `${value}${field.unit}`;
  }

  function applySubjectInfoTune(tune = getSubjectInfoTune()) {
    const root = document.documentElement;
    const scale = (Number(tune.zoom) || 100) / 100;
    root.style.setProperty('--subject-info-x', `${Number(tune.x) || 0}px`);
    root.style.setProperty('--subject-info-scale', `${scale}`);
    root.style.setProperty('--subject-kicker-size', `${(0.66 * scale).toFixed(3)}rem`);
    root.style.setProperty('--subject-title-size', `${(1.00 * scale).toFixed(3)}rem`);
    root.style.setProperty('--subject-chip-size', `${(0.68 * scale).toFixed(3)}rem`);
  }

  function setActiveSubjectTabMeta(tab) {
    state.activeSubjectTab = tab;
    document.documentElement.dataset.activeSubjectTab = tab;
    document.body.dataset.activeSubjectTab = tab;
    const content = document.getElementById('tabContent');
    if (content) content.dataset.activeTab = tab;
  }

  function setSubjectTab(tab, options = {}) {
    tab = normalizeSubjectTab(tab);
    const content = document.getElementById('tabContent');
    if (state.activeSubjectTab === tab && content?.dataset.activeTab === tab) return;
    setActiveSubjectTabMeta(tab);
    document.getElementById('studentsTab')?.classList.toggle('active', tab === 'students');
    document.getElementById('classesTab')?.classList.toggle('active', tab === 'classes');
    document.getElementById('rockstarsTab')?.classList.toggle('active', tab === 'rockstars');
    document.getElementById('quizzesTab')?.classList.toggle('active', tab === 'quizzes');
    commitAppRoute({ screen: 'subject', assignmentId: state.assignment?.id || '', tab }, options);
    if (tab === 'students') renderStudentsTab({ animate: true });
    else if (tab === 'rockstars') renderRockstarsTab({ animate: true });
    else if (tab === 'quizzes') renderQuizzesTab({ animate: true });
    else renderClassesTab({ animate: true });
  }

  function openVisualManagerModal() {
    const assignment = state.assignment;
    if (!assignment) return;
    const iconSrc = getAssignmentIcon(assignment);
    const coverStyle = coverBackgroundStyle(assignment);
    openModal(`
      <div class="modal-card visual-modal">
        <button class="modal-close" data-close-modal aria-label="Cerrar">×</button>
        <div class="modal-title-row">
          <div>
            <p class="section-kicker">Gestor visual</p>
            <h2>${escapeHTML(assignment.subject)} ${escapeHTML(assignment.grade)}-${escapeHTML(assignment.course)}</h2>
          </div>
        </div>
        <div class="visual-manager-grid">
          <article class="manager-card">
            <h3>Portada de la asignatura</h3>
            <p>Esta imagen aparece en la vista interna y como franja en la cuadrícula.</p>
            <div class="manager-preview-cover animated-cover" ${coverStyle}>${coverMotionHTML('preview')}</div>
            <div class="manager-actions">
              <label class="primary-btn">Cambiar portada<input id="coverInput" type="file" accept="image/*" hidden /></label>
              <button class="danger-btn" id="resetCoverBtn">Restablecer</button>
            </div>
          </article>
          <article class="manager-card">
            <h3>Icono de la asignatura</h3>
            <p>Úsalo para diferenciar rápido cada carga académica.</p>
            <label class="toggle-row" for="showSubjectIconToggle">
              <span>Mostrar icono en el banner</span>
              <input id="showSubjectIconToggle" type="checkbox" ${isSubjectIconVisible(assignment) ? 'checked' : ''} />
            </label>
            <img class="manager-preview-icon" src="${escapeAttr(iconSrc)}" alt="Icono actual" />
            <div class="manager-actions">
              <label class="primary-btn">Cambiar icono<input id="iconInput" type="file" accept="image/*,.svg" hidden /></label>
              <button class="danger-btn" id="resetIconBtn">Restablecer</button>
            </div>
          </article>
        </div>
      </div>
    `, () => {
      document.getElementById('coverInput').addEventListener('change', (event) => saveImageOverride(event, 'cover'));
      document.getElementById('iconInput').addEventListener('change', (event) => saveImageOverride(event, 'icon'));
      document.getElementById('resetCoverBtn').addEventListener('click', () => resetAssignmentVisual('cover'));
      document.getElementById('resetIconBtn').addEventListener('click', () => resetAssignmentVisual('icon'));
      document.getElementById('showSubjectIconToggle').addEventListener('change', (event) => toggleSubjectIconVisibility(event.target.checked));
    });
  }

  function openProfileMenuModal() {
    openModal(`
      <div class="modal-card profile-menu-modal">
        <button class="modal-close" data-close-modal aria-label="Cerrar">×</button>
        <p class="section-kicker">Perfil y apariencia</p>
        <h2>Gestionar EncisoMath</h2>
        <div class="settings-group">
          <label class="settings-label" for="accentPicker">Color principal</label>
          <div class="color-picker-row">
            <input id="accentPicker" class="color-picker" type="color" value="${escapeAttr(state.prefs.accent)}" aria-label="Escoger color principal" />
            <div class="color-picker-meta">
              <input id="accentHex" class="input color-hex-input" value="${escapeAttr(state.prefs.accent)}" maxlength="7" spellcheck="false" aria-label="Color principal en hexadecimal" />
              <span id="accentPreview" class="color-preview" style="--preview-color:${escapeAttr(state.prefs.accent)}">Color actual</span>
            </div>
          </div>
          <p class="settings-help">Puedes escoger cualquier color medio o intenso. Se bloquean tonos casi negros y tonos casi blancos para conservar contraste.</p>
          <button class="ghost-btn" id="accentResetBtn" type="button">Restablecer Azul Enciso</button>
        </div>
        <div class="settings-group">
          <label class="settings-label" for="backgroundSelect">Fondo de la app</label>
          <select id="backgroundSelect" class="select dark-select">
            ${BACKGROUND_OPTIONS.map((item) => `<option value="${escapeAttr(item.value)}" ${state.prefs.background === item.value ? 'selected' : ''}>${escapeHTML(item.label)}</option>`).join('')}
          </select>
        </div>
        <div class="settings-group settings-effects-group">
          <label class="settings-label">Rendimiento y efectos</label>
          <label class="toggle-row" for="visualOptimizedToggle"><span>Visual optimizado sin modo plano</span><input id="visualOptimizedToggle" type="checkbox" ${booleanPrefChecked('visualOptimized')} /></label>
          <label class="toggle-row" for="heroAnimationsToggle"><span>Animación viva de heroes Rockstars/Quizzes</span><input id="heroAnimationsToggle" type="checkbox" ${booleanPrefChecked('heroAnimations')} /></label>
          <label class="toggle-row" for="glassEffectsToggle"><span>Blur / vidrio</span><input id="glassEffectsToggle" type="checkbox" ${booleanPrefChecked('glassEffects')} /></label>
          <label class="toggle-row" for="effectsMotionToggle"><span>Animaciones generales</span><input id="effectsMotionToggle" type="checkbox" ${booleanPrefChecked('effectsMotion')} /></label>
          <label class="toggle-row" for="effectsMeshToggle"><span>Mallas, brillos y fondos animados</span><input id="effectsMeshToggle" type="checkbox" ${booleanPrefChecked('effectsMesh')} /></label>
          <label class="toggle-row" for="quizOptionEffectsToggle"><span>Pop / shake en opciones de quiz</span><input id="quizOptionEffectsToggle" type="checkbox" ${booleanPrefChecked('quizOptionEffects')} /></label>
          <label class="toggle-row" for="quizFeedbackEffectsToggle"><span>Animación de banda Correcto / Incorrecto</span><input id="quizFeedbackEffectsToggle" type="checkbox" ${booleanPrefChecked('quizFeedbackEffects')} /></label>
          <label class="toggle-row" for="quizSoundsToggle"><span>Sonidos de quiz</span><input id="quizSoundsToggle" type="checkbox" ${booleanPrefChecked('quizSounds')} /></label>
          <p class="settings-help">Visual optimizado conserva el estilo neón/malla, pero deja los heroes como composiciones estáticas ricas y evita animaciones permanentes pesadas.</p>
        </div>
        <div class="profile-menu-actions">
          <button class="ghost-btn" id="profileSoonBtn">🪪 Gestionar perfil</button>
          <button class="ghost-btn" id="notifyMenuBtn">🔔 Probar notificación</button>
          <button class="danger-btn" id="logoutMenuBtn">Cerrar sesión</button>
        </div>
      </div>
    `, () => {
      const accentPicker = document.getElementById('accentPicker');
      const accentHex = document.getElementById('accentHex');
      const syncAccentPreview = (value) => {
        const normalized = normalizeHexColor(value) || state.prefs.accent;
        accentPicker.value = normalized;
        accentHex.value = normalized.toUpperCase();
        document.getElementById('accentPreview')?.style.setProperty('--preview-color', normalized);
      };
      const commitAccent = (value) => {
        const normalized = normalizeHexColor(value);
        if (!normalized || !isAllowedAccentColor(normalized)) {
          syncAccentPreview(state.prefs.accent);
          toast('Ese color queda demasiado oscuro o demasiado claro. Elige un tono medio o intenso.');
          return;
        }
        updatePreference('accent', normalized);
        syncAccentPreview(normalized);
      };
      accentPicker.addEventListener('input', (event) => syncAccentPreview(event.target.value));
      accentPicker.addEventListener('change', (event) => commitAccent(event.target.value));
      accentHex.addEventListener('change', (event) => commitAccent(event.target.value));
      document.getElementById('accentResetBtn').addEventListener('click', () => commitAccent(DEFAULT_PREFS.accent));
      document.getElementById('backgroundSelect').addEventListener('change', (event) => updatePreference('background', event.target.value));
      [
        ['visualOptimizedToggle', 'visualOptimized'],
        ['heroAnimationsToggle', 'heroAnimations'],
        ['glassEffectsToggle', 'glassEffects'],
        ['effectsMotionToggle', 'effectsMotion'],
        ['effectsMeshToggle', 'effectsMesh'],
        ['quizOptionEffectsToggle', 'quizOptionEffects'],
        ['quizFeedbackEffectsToggle', 'quizFeedbackEffects'],
        ['quizSoundsToggle', 'quizSounds']
      ].forEach(([id, key]) => {
        document.getElementById(id)?.addEventListener('change', (event) => updatePreference(key, event.target.checked));
      });
      document.getElementById('profileSoonBtn').addEventListener('click', () => toast('Gestión completa de perfil queda para la siguiente fase.'));
      document.getElementById('notifyMenuBtn').addEventListener('click', requestNotificationTest);
      document.getElementById('logoutMenuBtn').addEventListener('click', () => {
        closeModal();
        logout();
      });
    });
  }

  function renderStudentsTab(options = {}) {
    const assignment = state.assignment;
    const $content = document.getElementById('tabContent');
    if (!$content) return;
    setActiveSubjectTabMeta('students');

    $content.innerHTML = `
      <div class="date-card">
        <div><strong>Asistencia diaria</strong><br><span class="card-sub">${readableDate(state.attendanceDate)}</span></div>
        <input id="attendanceDate" type="date" value="${state.attendanceDate}" />
      </div>
      <div class="student-tools">
        <div class="search-wrap">
          <span aria-hidden="true">🔎</span>
          <input class="input search-input" id="studentSearch" placeholder="Buscar estudiante" value="${escapeAttr(state.studentSearch || '')}" />
        </div>
        <button class="primary-btn" id="openAddStudentBtn" type="button">Añadir</button>
      </div>
      <div id="studentList" class="student-list">
        ${studentListHTML()}
      </div>
    `;

    bindStudentTabEvents();
    if (options.animate) pulseElement($content, 'tab-enter');
  }

  function studentListHTML() {
    const assignment = state.assignment;
    const attendance = getAttendance(assignment.id, state.attendanceDate);
    const query = normalizeSearch(state.studentSearch || '');
    const students = getStudentsForAssignment(assignment).filter((student) => {
      if (!query) return true;
      return normalizeSearch(`${student.fullName} ${student.id} ${student.username || ''}`).includes(query);
    });
    return students.map((student) => studentCardHTML(student, attendance[student.id])).join('')
      || `<div class="empty">${query ? 'No hay estudiantes con ese filtro.' : 'Aún no hay estudiantes en este curso.'}</div>`;
  }

  function refreshStudentList() {
    const list = document.getElementById('studentList');
    if (!list) return;
    list.innerHTML = studentListHTML();
    bindStudentActionButtons();
  }

  function bindStudentTabEvents() {
    const assignment = state.assignment;
    document.getElementById('attendanceDate').addEventListener('change', (event) => {
      state.attendanceDate = event.target.value || todayISO();
      refreshStudentList();
    });

    document.getElementById('studentSearch').addEventListener('input', (event) => {
      state.studentSearch = event.target.value;
      refreshStudentList();
    });

    document.getElementById('openAddStudentBtn').addEventListener('click', openAddStudentModal);
    bindStudentActionButtons();
  }

  function bindStudentActionButtons() {
    const assignment = state.assignment;
    document.querySelectorAll('[data-student-id][data-status]').forEach((button) => {
      button.addEventListener('click', () => {
        const studentId = button.dataset.studentId;
        const status = button.dataset.status;
        const current = getAttendance(assignment.id, state.attendanceDate);
        current[studentId] = status;
        saveAttendance(assignment.id, state.attendanceDate, current);
        updateStudentCardAttendance(studentId, status);
      });
    });

    document.querySelectorAll('[data-delete-student]').forEach((button) => {
      button.addEventListener('click', () => {
        const student = getStudentsForAssignment(assignment).find((item) => item.id === button.dataset.deleteStudent);
        if (student) openDeleteStudentModal(student);
      });
    });
  }

  function openAddStudentModal() {
    const assignment = state.assignment;
    openModal(`
      <div class="modal-card add-student-modal">
        <button class="modal-close" data-close-modal aria-label="Cerrar">×</button>
        <p class="section-kicker">Nuevo estudiante</p>
        <h2>Añadir a ${escapeHTML(assignment.subject)} ${escapeHTML(assignment.grade)}-${escapeHTML(assignment.course)}</h2>
        <p class="card-sub">Se guardará localmente en esta asignatura, sede ${escapeHTML(assignment.sede)}.</p>
        <form id="newStudentModalForm" class="add-student-form">
          <label class="field-label" for="studentFirstName">Nombre</label>
          <input class="input" id="studentFirstName" autocomplete="off" placeholder="Ejemplo: Carlos Junior" required />
          <label class="field-label" for="studentLastName">Apellido</label>
          <input class="input" id="studentLastName" autocomplete="off" placeholder="Ejemplo: Acosta López" required />
          <button class="primary-btn full" type="submit">Añadir estudiante</button>
        </form>
      </div>
    `, () => {
      const first = document.getElementById('studentFirstName');
      first.focus();
      document.getElementById('newStudentModalForm').addEventListener('submit', (event) => {
        event.preventDefault();
        const firstName = document.getElementById('studentFirstName').value.trim();
        const lastName = document.getElementById('studentLastName').value.trim();
        if (!firstName || !lastName) return;
        addNewStudent(firstName, lastName);
      });
    });
  }

  function addNewStudent(firstName, lastName) {
    const assignment = state.assignment;
    const fullName = `${lastName}, ${firstName}`.replace(/\s+/g, ' ').trim();
    const student = {
      id: `local-${assignment.id}-${Date.now()}`,
      fullName,
      username: makeUsername(`${firstName} ${lastName}`),
      photo: './assets/default-avatar.svg',
      grade: assignment.grade,
      course: assignment.course,
      sede: assignment.sede
    };
    const key = `encisomath:addedStudents:${assignment.id}`;
    const list = readJSON(key) || [];
    list.push(student);
    localStorage.setItem(key, JSON.stringify(list));
    closeModal();
    toast(`Añadiste un nuevo estudiante: ${fullName}.`);
    state.studentSearch = '';
    renderStudentsTab({ animate: false });
  }

  function updateStudentCardAttendance(studentId, status) {
    const card = document.querySelector(`[data-student-card="${escapeSelector(studentId)}"]`);
    const info = statusMap[status];
    if (!card || !info) return;
    card.classList.remove('present', 'absent', 'excused', 'flash-present', 'flash-absent', 'flash-excused');
    card.classList.add(info.className, `flash-${info.className}`);
    const meta = card.querySelector('[data-attendance-meta]');
    if (meta) meta.textContent = `📅 Asistencia: ${info.emoji} ${info.label}`;
    card.querySelectorAll('.att-btn').forEach((button) => {
      button.classList.toggle('active', button.dataset.status === status);
    });
    card.addEventListener('animationend', () => card.classList.remove(`flash-${info.className}`), { once: true });
  }

  function openDeleteStudentModal(student) {
    const assignment = state.assignment;
    openModal(`
      <div class="modal-card danger-modal">
        <div class="danger-head">
          <span class="danger-red-mesh" aria-hidden="true"></span>
          <div class="warning-tune-stack">
            <div class="warning-icon warning-duo" aria-hidden="true">
              <span class="warning-bounce warning-bounce-a"><img class="warning-mark warning-mark-a" src="./assets/warn-exp2.png" alt="" /></span>
              <span class="warning-bounce warning-bounce-b"><img class="warning-mark warning-mark-b" src="./assets/warn-exp1.png" alt="" /></span>
            </div>

          </div>
          <div class="danger-copy">
            <h2>ELIMINARÁS ESTE ESTUDIANTE</h2>
            <p>Esta acción es irreversible.</p>
          </div>
          <button class="modal-close danger-close" data-close-modal aria-label="Cerrar">×</button>
        </div>
        <div class="danger-body">
          <div class="delete-target">
            <strong>${escapeHTML(student.fullName)}</strong>
            <span>ID ${escapeHTML(student.id)} · ${escapeHTML(assignment.sede)} · ${escapeHTML(assignment.grade)}° ${escapeHTML(assignment.course)}</span>
          </div>
          <div class="danger-actions">
            <button class="danger-confirm" id="confirmDeleteStudent">Sí, eliminar estudiante</button>
            <button class="ghost-btn" data-close-modal>Cancelar</button>
          </div>
        </div>
      </div>
    `, () => {
      document.getElementById('confirmDeleteStudent').addEventListener('click', () => deleteStudent(student));
      startDeleteWarningMotion();
    });
  }

  function warningTuneNumber(value, fallback, min, max) {
    const numeric = Number(value);
    const resolved = Number.isFinite(numeric) ? numeric : fallback;
    return Math.max(min, Math.min(max, Math.round(resolved)));
  }

  function getWarningTune() {
    return { ...WARNING_TUNE_DEFAULTS };
  }

  function saveWarningTune(tune) {
    localStorage.setItem(WARNING_TUNE_KEY, JSON.stringify(tune));
    localStorage.setItem(WARNING_GAP_KEY, String(tune.gap));
  }

  function warningTuneValueLabel(field, value) {
    return `${value}${field.unit}`;
  }

  function renderWarningTunePanel() {
    const tune = getWarningTune();
    return `
      <div class="warning-calibration-panel" aria-label="Panel temporal de ajuste del warning">
        <div class="warning-calibration-head">
          <strong>Ajuste temporal del warning</strong>
          <span>Pásame estos valores cuando quede bien.</span>
        </div>
        <div class="warning-calibration-grid">
          ${WARNING_TUNE_FIELDS.map((field) => `
            <label class="warning-tune-control" for="warningTune-${field.key}">
              <span>${field.label} <output id="warningTuneOut-${field.key}">${warningTuneValueLabel(field, tune[field.key])}</output></span>
              <input id="warningTune-${field.key}" data-warning-tune="${field.key}" type="range" min="${field.min}" max="${field.max}" step="${field.step}" value="${tune[field.key]}" />
            </label>
          `).join('')}
        </div>
        <button class="warning-tune-reset" type="button" id="warningTuneReset">Restablecer ajustes</button>
      </div>
    `;
  }

  function applyWarningTune(tune = getWarningTune()) {
    const zoomMid = Math.round((tune.zoomMin + tune.zoomMax) / 2);
    document.querySelectorAll('.danger-modal').forEach((modal) => {
      modal.style.setProperty('--warning-gap', `${tune.gap}px`);
      modal.style.setProperty('--warning-icon-x', `${tune.iconX}px`);
      modal.style.setProperty('--warning-icon-y', `${tune.iconY}px`);
      modal.style.setProperty('--warning-mark-size', `${tune.markSize}px`);
      modal.style.setProperty('--warning-zoom-min', (tune.zoomMin / 100).toFixed(3));
      modal.style.setProperty('--warning-zoom-mid', (zoomMid / 100).toFixed(3));
      modal.style.setProperty('--warning-zoom-max', (tune.zoomMax / 100).toFixed(3));
      modal.style.setProperty('--warning-text-x', `${tune.textX}px`);
      modal.style.setProperty('--warning-text-y', `${tune.textY}px`);
    });

    WARNING_TUNE_FIELDS.forEach((field) => {
      const input = document.getElementById(`warningTune-${field.key}`);
      const output = document.getElementById(`warningTuneOut-${field.key}`);
      if (input) input.value = String(tune[field.key]);
      if (output) output.textContent = warningTuneValueLabel(field, tune[field.key]);
    });
    return tune;
  }

  function initWarningTuneControls() {
    let tune = applyWarningTune(getWarningTune());
    document.querySelectorAll('[data-warning-tune]').forEach((slider) => {
      slider.addEventListener('input', () => {
        const field = WARNING_TUNE_FIELDS.find((item) => item.key === slider.dataset.warningTune);
        if (!field) return;
        tune = { ...tune, [field.key]: warningTuneNumber(slider.value, WARNING_TUNE_DEFAULTS[field.key], field.min, field.max) };
        if (tune.zoomMax < tune.zoomMin + 2) {
          if (field.key === 'zoomMin') tune.zoomMax = Math.min(155, tune.zoomMin + 2);
          if (field.key === 'zoomMax') tune.zoomMin = Math.max(70, tune.zoomMax - 2);
        }
        saveWarningTune(tune);
        applyWarningTune(tune);
        restartDeleteWarningAnimations(tune);
      });
    });

    const reset = document.getElementById('warningTuneReset');
    if (reset) {
      reset.addEventListener('click', () => {
        tune = { ...WARNING_TUNE_DEFAULTS };
        saveWarningTune(tune);
        applyWarningTune(tune);
        restartDeleteWarningAnimations(tune);
      });
    }
  }

  function restartDeleteWarningAnimations(tune = getWarningTune()) {
    warningMotionAnimations.forEach((animation) => animation.cancel());
    warningMotionAnimations = [];
    const mesh = document.querySelector('.danger-red-mesh');
    const markA = document.querySelector('.warning-bounce-a');
    const markB = document.querySelector('.warning-bounce-b');
    if (!Element.prototype.animate) return;

    if (mesh) {
      warningMotionAnimations.push(mesh.animate([
        { backgroundPosition: '0 0, 0 0' },
        { backgroundPosition: '48px 48px, 48px 48px' }
      ], {
        duration: 14000,
        iterations: Infinity,
        easing: 'linear'
      }));
    }

    const min = (tune.zoomMin / 100).toFixed(3);
    const mid = ((tune.zoomMin + tune.zoomMax) / 200).toFixed(3);
    const max = (tune.zoomMax / 100).toFixed(3);

    if (markA) {
      warningMotionAnimations.push(markA.animate([
        { transform: `scale(${min}) rotate(-8deg)`, offset: 0 },
        { transform: `scale(${max}) rotate(-8deg)`, offset: .46 },
        { transform: `scale(${mid}) rotate(-8deg)`, offset: .62 },
        { transform: `scale(${min}) rotate(-8deg)`, offset: 1 }
      ], {
        duration: 920,
        iterations: Infinity,
        easing: 'cubic-bezier(.34,1.56,.64,1)'
      }));
    }

    if (markB) {
      warningMotionAnimations.push(markB.animate([
        { transform: `scale(${min}) rotate(6deg)`, offset: 0 },
        { transform: `scale(${max}) rotate(6deg)`, offset: .44 },
        { transform: `scale(${mid}) rotate(6deg)`, offset: .60 },
        { transform: `scale(${min}) rotate(6deg)`, offset: 1 }
      ], {
        duration: 920,
        iterations: Infinity,
        delay: 80,
        easing: 'cubic-bezier(.34,1.56,.64,1)'
      }));
    }
  }

  function startDeleteWarningMotion() {
    const tune = applyWarningTune(getWarningTune());
    restartDeleteWarningAnimations(tune);
  }

  function deleteStudent(student) {
    const assignment = state.assignment;
    const addedKey = `encisomath:addedStudents:${assignment.id}`;
    const added = readJSON(addedKey) || [];
    const nextAdded = added.filter((item) => item.id !== student.id);
    localStorage.setItem(addedKey, JSON.stringify(nextAdded));

    const removedKey = `encisomath:removedStudents:${assignment.id}`;
    const removed = new Set(readJSON(removedKey) || []);
    removed.add(student.id);
    localStorage.setItem(removedKey, JSON.stringify([...removed]));

    const attendance = getAttendance(assignment.id, state.attendanceDate);
    delete attendance[student.id];
    saveAttendance(assignment.id, state.attendanceDate, attendance);

    closeModal();
    toast(`${student.fullName} fue retirado del listado local.`);
    renderStudentsTab({ animate: false });
  }

  function renderRockstarsTab(options = {}) {
    const assignment = state.assignment;
    const $content = document.getElementById('tabContent');
    if (!assignment || !$content) return;
    setActiveSubjectTabMeta('rockstars');

    $content.innerHTML = `
      <section class="rockstar-hero" aria-label="Rockstars de participación">
        <div class="rockstar-spotlights" aria-hidden="true">
          <span class="rockstar-spotlight spotlight-left"></span>
          <span class="rockstar-spotlight spotlight-right"></span>
          <span class="rockstar-spotlight spotlight-center"></span>
          <span class="rockstar-light-bulb bulb-left"></span>
          <span class="rockstar-light-bulb bulb-right"></span>
        </div>
        <div class="rockstar-rocket-stage" aria-hidden="true">
          <div class="rocket-wrap">
            <div class="rocket-emoji">🚀</div>
            <span class="flame-plume" aria-hidden="true"></span>
            <span class="flame flame-a"></span>
            <span class="flame flame-b"></span>
            <span class="flame flame-c"></span>
            <span class="flame flame-d"></span>
            <span class="smoke smoke-a"></span>
            <span class="smoke smoke-b"></span>
            <span class="spark spark-a"></span>
            <span class="spark spark-b"></span>
            <span class="spark spark-c"></span>
            <span class="spark spark-d"></span>
          </div>
        </div>
        <div class="rockstar-title-block is-centered-title">
          <div class="rockstar-title-neon" data-text="ROCKSTARS">ROCKSTARS</div>
        </div>
      </section>
      <div class="period-tabs rockstar-period-tabs" id="rockstarPeriodTabs">
        ${[1, 2, 3, 4].map((period) => `<button class="period-btn ${Number(state.rockstarPeriod) === period ? 'active' : ''}" data-rockstar-period="${period}">${period}°</button>`).join('')}
      </div>
      <div class="student-tools rockstar-tools">
        <div class="search-wrap">
          <span aria-hidden="true">🔎</span>
          <input class="input search-input" id="rockstarSearch" placeholder="Buscar estudiante" value="${escapeAttr(state.studentSearch || '')}" />
        </div>
      </div>
      <div id="rockstarList" class="student-list rockstar-list">
        ${rockstarListHTML()}
      </div>
    `;

    bindRockstarTabEvents();
    if (options.animate) pulseElement($content, 'tab-enter');
  }

  function rockstarListHTML() {
    const assignment = state.assignment;
    if (!assignment) return '';
    const attendance = getAttendance(assignment.id, todayISO());
    const query = normalizeSearch(state.studentSearch || '');
    const period = Number(state.rockstarPeriod);
    const pointMap = getRockstarPointMap(assignment.id, period);
    const students = getStudentsForAssignment(assignment).filter((student) => {
      if (!query) return true;
      return normalizeSearch(`${student.fullName} ${student.id} ${student.username || ''}`).includes(query);
    });
    return students.map((student) => {
      const points = pointMap.get(student.id) || 0;
      return rockstarCardHTML(student, points, attendance[student.id]);
    }).join('') || `<div class="empty">${query ? 'No hay rockstars con ese filtro.' : 'Aún no hay estudiantes en este curso.'}</div>`;
  }

  function bindRockstarTabEvents() {
    document.querySelectorAll('[data-rockstar-period]').forEach((button) => {
      button.addEventListener('click', () => setRockstarPeriod(Number(button.dataset.rockstarPeriod)));
    });

    document.getElementById('rockstarSearch')?.addEventListener('input', (event) => {
      state.studentSearch = event.target.value;
      refreshRockstarList();
    });

    applyRockstarScoreTune();
    bindRockstarActionButtons();
  }

  function rockstarScoreTunePanelHTML() {
    const tune = getRockstarScoreTune();
    const rows = ROCKSTAR_SCORE_TUNE_FIELDS.map((field) => {
      const value = tune[field.key];
      return `
        <label class="rockstar-score-tune-row">
          <span class="rockstar-score-tune-head"><strong>${field.label}</strong><output data-rockstar-score-tune-value="${field.key}">${value}${field.unit}</output></span>
          <input type="range" min="${field.min}" max="${field.max}" step="${field.step}" value="${value}" data-rockstar-score-tune="${field.key}" />
        </label>
      `;
    }).join('');
    return `
      <section class="rockstar-score-tune-panel" aria-label="Ajuste temporal del total de puntos">
        <div class="rockstar-score-tune-title">Ajuste temporal de puntos</div>
        <div class="rockstar-score-tune-help">Pásame estos valores cuando la posición quede bien.</div>
        ${rows}
        <button class="btn ghost small rockstar-score-tune-reset" type="button" id="rockstarScoreTuneReset">Restablecer puntos</button>
      </section>
    `;
  }

  function bindRockstarScoreTunePanel() {
    document.querySelectorAll('[data-rockstar-score-tune]').forEach((input) => {
      input.addEventListener('input', () => {
        const key = input.dataset.rockstarScoreTune;
        const value = Number(input.value);
        const tune = getRockstarScoreTune();
        tune[key] = value;
        saveRockstarScoreTune(tune);
        updateRockstarScoreTuneOutput(key, value);
        applyRockstarScoreTune(tune);
      });
    });
    document.getElementById('rockstarScoreTuneReset')?.addEventListener('click', () => {
      saveRockstarScoreTune({ ...ROCKSTAR_SCORE_TUNE_DEFAULTS });
      document.querySelectorAll('[data-rockstar-score-tune]').forEach((input) => {
        const key = input.dataset.rockstarScoreTune;
        input.value = ROCKSTAR_SCORE_TUNE_DEFAULTS[key];
        updateRockstarScoreTuneOutput(key, ROCKSTAR_SCORE_TUNE_DEFAULTS[key]);
      });
      applyRockstarScoreTune({ ...ROCKSTAR_SCORE_TUNE_DEFAULTS });
    });
  }

  function getRockstarScoreTune() {
    return { ...ROCKSTAR_SCORE_TUNE_DEFAULTS };
  }

  function saveRockstarScoreTune(tune) {
    localStorage.setItem(ROCKSTAR_SCORE_TUNE_KEY, JSON.stringify({
      x: Number(tune.x) || 0,
      y: Number(tune.y) || 0,
      zoom: Number(tune.zoom) || 100
    }));
  }

  function updateRockstarScoreTuneOutput(key, value) {
    const field = ROCKSTAR_SCORE_TUNE_FIELDS.find((item) => item.key === key);
    const output = document.querySelector(`[data-rockstar-score-tune-value="${escapeSelector(key)}"]`);
    if (output && field) output.textContent = `${value}${field.unit}`;
  }

  function applyRockstarScoreTune(tune = getRockstarScoreTune()) {
    const root = document.documentElement;
    root.style.setProperty('--rockstar-score-x', `${Number(tune.x) || 0}px`);
    root.style.setProperty('--rockstar-score-y', `${Number(tune.y) || 0}px`);
    root.style.setProperty('--rockstar-score-scale', `${(Number(tune.zoom) || 100) / 100}`);
  }

  function setRockstarPeriod(period) {
    if (![1, 2, 3, 4].includes(Number(period))) return;
    if (Number(state.rockstarPeriod) === Number(period)) return;
    const previous = document.querySelector(`[data-rockstar-period="${state.rockstarPeriod}"]`);
    const next = document.querySelector(`[data-rockstar-period="${period}"]`);
    previous?.classList.remove('active');
    next?.classList.add('active');
    pulseElement(previous, 'period-shift');
    pulseElement(next, 'period-shift');
    state.rockstarPeriod = Number(period);
    localStorage.setItem('encisomath:rockstarPeriod', String(state.rockstarPeriod));
    refreshRockstarList(true);
  }

  function refreshRockstarList(animate = false) {
    const list = document.getElementById('rockstarList');
    if (!list) return;
    list.innerHTML = rockstarListHTML();
    applyRockstarScoreTune();
    bindRockstarActionButtons();
    if (animate) pulseElement(list, 'class-grid-update');
  }

  function bindRockstarActionButtons() {
    document.querySelectorAll('[data-rockstar-delta]').forEach((button) => {
      button.addEventListener('pointerdown', () => {
        flashRockstarButton(button, Number(button.dataset.rockstarDelta), 150);
      }, { passive: true });
      button.addEventListener('click', () => {
        const studentId = button.dataset.rockstarStudent;
        const delta = Number(button.dataset.rockstarDelta);
        addRockstarDelta(studentId, delta);
        button.blur();
      });
    });
  }

  function flashRockstarButton(button, delta, duration = 150) {
    if (!button) return;
    const className = Number(delta) > 0 ? 'rock-hit-plus' : 'rock-hit-minus';
    button.classList.remove('rock-hit-plus', 'rock-hit-minus');
    void button.offsetWidth;
    button.classList.add(className);
    window.clearTimeout(button._rockstarHitTimer);
    button._rockstarHitTimer = window.setTimeout(() => {
      button.classList.remove(className);
    }, duration);
  }

  function addRockstarDelta(studentId, delta) {
    const assignment = state.assignment;
    if (!assignment || !studentId || ![-1, 1].includes(Number(delta))) return false;
    const attendance = getAttendance(assignment.id, todayISO());
    if (isRockstarLocked(attendance[studentId])) {
      toast('Estudiante sin puntos hoy por asistencia');
      return false;
    }
    const events = getLocalRockstarEvents(assignment.id);
    events.push({
      id: `rs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      assignmentId: assignment.id,
      studentId,
      period: Number(state.rockstarPeriod),
      date: todayISO(),
      delta: Number(delta)
    });
    saveLocalRockstarEvents(assignment.id, events);
    updateRockstarCard(studentId, Number(delta));
    return true;
  }

  function updateRockstarCard(studentId, delta = 0) {
    const assignment = state.assignment;
    const card = document.querySelector(`[data-rockstar-card="${escapeSelector(studentId)}"]`);
    if (!assignment || !card) return;
    const attendance = getAttendance(assignment.id, todayISO());
    const status = attendance[studentId];
    const locked = isRockstarLocked(status);
    const points = getRockstarPoints(assignment.id, studentId, state.rockstarPeriod);
    const tier = getRockstarTier(points);
    const visual = locked ? getSleepingTier() : tier;
    const badge = card.querySelector('[data-rockstar-badge]');
    const score = card.querySelector('[data-rockstar-score]');
    const meta = card.querySelector('[data-rockstar-meta]');
    card.className = `student-card rockstar-card ${visual.className}${locked ? ' rockstar-disabled' : ''}`;
    if (badge) {
      badge.textContent = visual.emoji;
      badge.className = `rockstar-avatar ${visual.className}`;
      pulseElement(badge, 'text-pop');
    }
    if (score) {
      score.textContent = String(points);
      score.className = `rockstar-score ${visual.className}`;
      pulseElement(score, 'text-pop');
    }
    pulseElement(card, locked ? 'flash-excused' : (Number(delta) < 0 ? 'flash-absent' : 'flash-present'));
  }

  function isRockstarLocked(status) {
    return status === 'absent' || status === 'excused';
  }

  function getSleepingTier() {
    return { emoji: '😴', label: 'No disponible', className: 'tier-sleep' };
  }

  function renderQuizzesTab(options = {}) {
    const assignment = state.assignment;
    const $content = document.getElementById('tabContent');
    if (!assignment || !$content) return;
    setActiveSubjectTabMeta('quizzes');
    const quizzes = getQuizzesForCurrentAssignment();
    const activeQuiz = getActiveQuiz(quizzes);
    $content.innerHTML = `
      <section class="quiz-hero" aria-label="Quizzes de la asignatura">
        <div class="quiz-hero-grid" aria-hidden="true"></div>
        <div class="quiz-podium" aria-hidden="true">
          <span class="quiz-tile tile-red">▲</span>
          <span class="quiz-tile tile-blue">◆</span>
          <span class="quiz-tile tile-yellow">●</span>
          <span class="quiz-tile tile-green">■</span>
        </div>
        <div class="quiz-title-block is-centered-title">
          <div class="quiz-title-neon" data-text="QUIZZES">QUIZZES</div>
        </div>
      </section>
      <div class="period-tabs quiz-period-tabs" id="quizPeriodTabs">
        ${[1, 2, 3, 4].map((period) => `<button class="period-btn ${Number(state.quizPeriod) === period ? 'active' : ''}" data-quiz-period="${period}">${period}°</button>`).join('')}
      </div>
      <div class="quiz-library" id="quizLibrary">
        ${quizzes.map((quiz) => quizCardButtonHTML(quiz, activeQuiz?.id === quiz.id)).join('') || `<div class="empty">Aún no hay quizzes para este periodo.</div>`}
      </div>
      <div class="quiz-launch-note" id="quizLaunchNote" ${activeQuiz ? '' : 'hidden'}>Toca un quiz para ver el aviso de inicio.</div>
    `;
    bindQuizTabEvents();
    if (options.animate) pulseElement($content, 'tab-enter');
  }

  function bindQuizTabEvents() {
    document.querySelectorAll('[data-quiz-period]').forEach((button) => {
      if (button.dataset.boundQuizPeriod === 'true') return;
      button.dataset.boundQuizPeriod = 'true';
      button.addEventListener('click', () => setQuizPeriod(Number(button.dataset.quizPeriod)));
    });
    document.querySelectorAll('[data-quiz-id]').forEach((button) => {
      if (button.dataset.boundQuizCard === 'true') return;
      button.dataset.boundQuizCard = 'true';
      button.addEventListener('click', () => {
        const quizId = button.dataset.quizId || '';
        if (!quizId) return;
        startQuiz(quizId);
      });
    });
  }

  function getBaseQuizzes() {
    const source = state.data.quizzes;
    if (Array.isArray(source)) return source;
    if (Array.isArray(source?.quizzes)) return source.quizzes;
    return [];
  }

  function getQuizzesForCurrentAssignment() {
    const assignment = state.assignment;
    if (!assignment) return [];
    return getBaseQuizzes().filter((quiz) => {
      if (Number(quiz.period || 1) !== Number(state.quizPeriod)) return false;
      const ids = Array.isArray(quiz.assignmentIds) ? quiz.assignmentIds : [];
      if (ids.includes('*') || ids.includes(assignment.id)) return true;
      if (quiz.subject && quiz.subject === assignment.subject) return true;
      if (quiz.area && quiz.area === assignment.area) return true;
      return !ids.length && !quiz.subject && !quiz.area;
    });
  }

  function isSupportedQuizQuestionType(type) {
    return ['multiple_choice', 'true_false', 'open', 'order', 'flip'].includes(String(type || ''));
  }

  function filterSupportedQuizQuestions(questions = []) {
    return (Array.isArray(questions) ? questions : []).filter((question) => isSupportedQuizQuestionType(question?.type));
  }

  function getActiveQuiz(quizzes = getQuizzesForCurrentAssignment()) {
    if (!quizzes.length) return null;
    const active = quizzes.find((quiz) => quiz.id === state.quizActiveId) || quizzes[0];
    state.quizActiveId = active.id;
    localStorage.setItem('encisomath:quizActiveId', active.id);
    active.questions = filterSupportedQuizQuestions(active.questions);
    if (state.quizQuestionIndex < 0 || state.quizQuestionIndex >= active.questions.length) state.quizQuestionIndex = 0;
    return active;
  }

  function quizCardButtonHTML(quiz, active) {
    const total = filterSupportedQuizQuestions(quiz.questions).length;
    return `
      <button class="quiz-card ${active ? 'active' : ''}" data-quiz-id="${escapeAttr(quiz.id)}">
        <span class="quiz-card-icon">${escapeHTML(quiz.emoji || '🎮')}</span>
        <span class="quiz-card-copy">
          <strong>${escapeHTML(quiz.title || 'Quiz sin título')}</strong>
          <small>${total} preguntas · ${escapeHTML(quiz.mode || 'Demo')}</small>
        </span>
        <span class="quiz-start-pill">Iniciar</span>
      </button>
    `;
  }

  function quizPlayerHTML(quiz, options = {}) {
    const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
    if (!questions.length) return `<div class="empty">Este quiz todavía no tiene preguntas.</div>`;
    const index = Math.max(0, Math.min(state.quizQuestionIndex, questions.length - 1));
    const question = questions[index];
    const fullscreen = Boolean(options.fullscreen);
    const promptSegments = [question.textA || question.prompt || '', question.textB || ''].map((value) => String(value || '').trim()).filter(Boolean);
    const promptText = promptSegments.join('\n\n');
    const sharedTextModifier = quizSharedTextModifier(promptText, '');
    const promptClass = quizPromptClass(promptText || '', sharedTextModifier);
    return `
      <section class="quiz-stage quiz-type-${escapeAttr(question.type || 'question')} ${fullscreen ? 'quiz-stage-fullscreen quiz-item-enter-ready' : ''}" data-quiz-stage="${escapeAttr(quiz.id)}" data-quiz-question-index="${index}" data-quiz-has-image="${question.image ? 'true' : 'false'}" data-quiz-image-preview-key="${escapeAttr(`${quiz.id || 'quiz'}:${question.id || index}`)}">
        <div class="quiz-stage-head">
          <div class="quiz-stage-meta-row">
            <div class="quiz-eyebrow">Pregunta ${index + 1} de ${questions.length} · ${escapeHTML(quizTypeLabel(question.type))}</div>
            <div class="quiz-stage-meta-actions">
              <span class="quiz-timer-pill">Item ${index + 1}</span>
              <button class="quiz-layout-tune-open quiz-quick-menu-btn" type="button" data-quiz-layout-tune-open aria-label="Abrir navegación del quiz">⚙️</button>
            </div>
          </div>
        </div>
        <div class="quiz-question-content">
          ${question.image ? `<div class="quiz-tune-box quiz-image-tune-box" data-quiz-tune-target="image">${quizImageHTML(question)}</div>` : ''}
          <h3 class="${promptClass} quiz-text-a quiz-tune-box" data-quiz-tune-target="textA">${escapeHTML(promptText)}</h3>
          <div class="quiz-answer-zone quiz-tune-box" data-quiz-tune-target="answers">
            ${quizQuestionBodyHTML(question)}
          </div>
        </div>
        <div class="quiz-answer-feedback" data-quiz-feedback hidden></div>
        ${quizLayoutTunePanelHTML(question.type, questions.length, index, Boolean(question.image), quiz.id || 'quiz', question.id || String(index))}
        ${!fullscreen ? `
        <div class="quiz-nav-row">
          <span>${index + 1}/${questions.length}</span>
          <button class="mini-btn quiz-next-main" data-quiz-next>Continuar →</button>
        </div>` : ''}
      </section>
    `;
  }

  function quizLengthModifier(text) {
    const length = String(text || '').trim().length;
    if (length > 190) return 'xs';
    if (length > 130) return 'sm';
    if (length > 85) return 'md';
    return '';
  }

  function quizLengthClass(text, prefix, forcedModifier = '') {
    const modifier = forcedModifier || quizLengthModifier(text);
    return modifier ? `${prefix}-${modifier}` : '';
  }

  function quizSharedTextModifier(textA, textB) {
    const a = String(textA || '');
    const b = String(textB || '');
    const longest = a.length >= b.length ? a : b;
    return quizLengthModifier(longest);
  }

  function quizPromptClass(prompt, forcedModifier = '') {
    const modifier = forcedModifier || quizLengthModifier(prompt);
    return `quiz-prompt${modifier ? ` quiz-prompt-${modifier}` : ''}`;
  }

  function shouldStackMultipleChoiceOptions(options = []) {
    const texts = (Array.isArray(options) ? options : []).map((option) => String(option?.text || '').trim());
    return texts.some((text) => text.length > 42 || text.split(/\s+/).length > 8);
  }

  const QUIZ_TYPOGRAPHY_STORAGE_KEY = 'encisomath:quizTypography:v0.24.168';
  const QUIZ_FONT_PRESETS = [
    { value: '300|normal', label: 'Montserrat Light' },
    { value: '400|normal', label: 'Montserrat Regular' },
    { value: '500|normal', label: 'Montserrat Medium' },
    { value: '600|normal', label: 'Montserrat SemiBold' },
    { value: '700|normal', label: 'Montserrat Bold' },
    { value: '800|normal', label: 'Montserrat ExtraBold' },
    { value: '900|normal', label: 'Montserrat Black' },
    { value: '400|italic', label: 'Montserrat Italic' },
    { value: '600|italic', label: 'Montserrat SemiBold Italic' },
    { value: '700|italic', label: 'Montserrat Bold Italic' },
    { value: '800|italic', label: 'Montserrat ExtraBold Italic' }
  ];
  const QUIZ_TYPOGRAPHY_DEFAULTS = {
    textPreset: '600|normal',
    optionPreset: '600|normal',
    textSize: 12,
    optionSize: 12
  };

  function normalizeQuizTypographyTune(tune = {}) {
    const presetValues = new Set(QUIZ_FONT_PRESETS.map((item) => item.value));
    const textPreset = presetValues.has(String(tune.textPreset || '')) ? String(tune.textPreset) : QUIZ_TYPOGRAPHY_DEFAULTS.textPreset;
    const optionPreset = presetValues.has(String(tune.optionPreset || '')) ? String(tune.optionPreset) : QUIZ_TYPOGRAPHY_DEFAULTS.optionPreset;
    const clamp = (value, min, max, fallback) => {
      const number = Number(value);
      return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.round(number))) : fallback;
    };
    return {
      textPreset,
      optionPreset,
      textSize: clamp(tune.textSize, 12, 28, QUIZ_TYPOGRAPHY_DEFAULTS.textSize),
      optionSize: clamp(tune.optionSize, 12, 28, QUIZ_TYPOGRAPHY_DEFAULTS.optionSize)
    };
  }

  function getQuizTypographyTune() {
    try {
      return normalizeQuizTypographyTune(JSON.parse(localStorage.getItem(QUIZ_TYPOGRAPHY_STORAGE_KEY) || '{}'));
    } catch (_) {
      return normalizeQuizTypographyTune({});
    }
  }

  function saveQuizTypographyTune(tune) {
    const safe = normalizeQuizTypographyTune(tune);
    try { localStorage.setItem(QUIZ_TYPOGRAPHY_STORAGE_KEY, JSON.stringify(safe)); } catch (_) {}
    return safe;
  }

  function quizPresetParts(value = '400|normal') {
    const [weight, style] = String(value || '').split('|');
    return {
      weight: Number.isFinite(Number(weight)) ? Number(weight) : 400,
      style: style === 'italic' ? 'italic' : 'normal'
    };
  }

  function quizFontPresetOptionsHTML(selectedValue = '') {
    return QUIZ_FONT_PRESETS.map((item) => `<option value="${escapeAttr(item.value)}" ${item.value === selectedValue ? 'selected' : ''}>${escapeHTML(item.label)}</option>`).join('');
  }

  function applyQuizTypographyTune(tune = getQuizTypographyTune()) {
    const safe = normalizeQuizTypographyTune(tune);
    const textPreset = quizPresetParts(safe.textPreset);
    const optionPreset = quizPresetParts(safe.optionPreset);
    const fontFamily = "'Montserrat', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    const target = document.documentElement;
    const setVarTarget = (node) => {
      if (!node || !node.style) return;
      node.style.setProperty('--enciso-quiz-font', fontFamily);
      node.style.setProperty('--quiz-global-font-family', fontFamily);
      node.style.setProperty('--quiz-global-text-weight', String(textPreset.weight));
      node.style.setProperty('--quiz-global-text-style', textPreset.style);
      node.style.setProperty('--quiz-global-text-size', `${safe.textSize}px`);
      node.style.setProperty('--quiz-text-font', `${safe.textSize}px`);
      node.style.setProperty('--quiz-text-a-font', `${safe.textSize}px`);
      node.style.setProperty('--quiz-text-b-font', `${safe.textSize}px`);
      node.style.setProperty('--quiz-global-option-weight', String(optionPreset.weight));
      node.style.setProperty('--quiz-global-option-style', optionPreset.style);
      node.style.setProperty('--quiz-global-option-size', `${safe.optionSize}px`);
    };
    setVarTarget(target);
    document.querySelectorAll('.quiz-stage, .quiz-fullscreen-layer, .quiz-layout-tune-panel, .quiz-feedback-tune-panel, .enciso-feedback-v95, .enciso-feedback-v99, .enciso-quiz-feedback-overlay-v95, .enciso-quiz-feedback-overlay-v99, .enciso-quiz-feedback-overlay-v100').forEach(setVarTarget);

    const applyInline = (selector, preset, size) => {
      document.querySelectorAll(selector).forEach((node) => {
        if (!node || !node.style) return;
        node.style.setProperty('font-family', fontFamily, 'important');
        node.style.setProperty('font-weight', String(preset.weight), 'important');
        node.style.setProperty('font-style', preset.style, 'important');
        node.style.setProperty('font-size', `${size}px`, 'important');
      });
    };
    applyInline([
      '.quiz-stage .quiz-text-a',
      '.quiz-stage .quiz-text-b',
      '.quiz-stage-fullscreen .quiz-text-a',
      '.quiz-stage-fullscreen .quiz-text-b',
      '.quiz-open-feedback'
    ].join(','), textPreset, safe.textSize);
    applyInline([
      '.kahoot-option',
      '.kahoot-answer-text',
      '.quiz-submit-btn',
      '.quiz-order-card',
      '.quiz-order-card strong',
      '.quiz-order-number',
      '.quiz-order-grip',
      '.quiz-order-submit'
    ].join(','), optionPreset, safe.optionSize);
    // v0.24.167: la pregunta abierta conserva tamaño de opciones,
    // pero el texto escrito por el usuario va en Montserrat Regular.
    applyInline('.quiz-open-input, textarea.quiz-open-input', { weight: 400, style: 'normal' }, safe.optionSize);
    document.querySelectorAll('[data-quiz-typography-value="textSize"]').forEach((node) => { node.textContent = `${safe.textSize}px`; });
    document.querySelectorAll('[data-quiz-typography-value="optionSize"]').forEach((node) => { node.textContent = `${safe.optionSize}px`; });
    return safe;
  }

  const QUIZ_LAYOUT_TUNE_FIELDS = [
    { key: 'image_h', label: 'Imagen alto %', min: 10, max: 70, step: 1, unit: '%' },
    { key: 'textA_h', label: 'Texto alto %', min: 10, max: 75, step: 1, unit: '%' },
    { key: 'answers_h', label: 'Opciones alto %', min: 10, max: 70, step: 1, unit: '%' }
  ];

  const QUIZ_LAYOUT_TUNE_DEFAULTS = {
    textA_y: 0, textA_h: 40, text_font: 12,
    image_y: 0, image_h: 30,
    answers_y: 0, answers_h: 30
  };

  const QUIZ_LAYOUT_TUNE_TYPE_DEFAULTS = {
    multiple_choice: { textA_y: 0, textA_h: 40, text_font: 12, image_y: 0, image_h: 30, answers_y: 0, answers_h: 30 },
    flip: { textA_y: 0, textA_h: 30, text_font: 12, image_y: 0, image_h: 30, answers_y: 0, answers_h: 40 },
    true_false: { textA_y: 0, textA_h: 40, text_font: 12, image_y: 0, image_h: 30, answers_y: 0, answers_h: 30 },
    open: { textA_y: 0, textA_h: 40, text_font: 12, image_y: 0, image_h: 30, answers_y: 0, answers_h: 30 },
    order: { textA_y: 0, textA_h: 30, text_font: 12, image_y: 0, image_h: 30, answers_y: 0, answers_h: 40 }
  };

  function rebalanceQuizLayoutTune(tune = {}, changedKey = 'image_h') {
    const min = 10;
    const max = 80;
    const safe = {
      image_h: Number.isFinite(Number(tune.image_h)) ? Number(tune.image_h) : 30,
      textA_h: Number.isFinite(Number(tune.textA_h)) ? Number(tune.textA_h) : 40,
      answers_h: Number.isFinite(Number(tune.answers_h)) ? Number(tune.answers_h) : 30
    };
    const clampPart = (value) => Math.max(min, Math.min(max, Math.round(Number(value) || min)));
    safe.image_h = clampPart(safe.image_h);
    safe.textA_h = clampPart(safe.textA_h);
    safe.answers_h = clampPart(safe.answers_h);
    if (changedKey === 'image_h') {
      safe.image_h = clampPart(safe.image_h);
      safe.answers_h = clampPart(safe.answers_h);
      safe.textA_h = 100 - safe.image_h - safe.answers_h;
      if (safe.textA_h < min) {
        safe.textA_h = min;
        safe.answers_h = Math.max(min, 100 - safe.image_h - safe.textA_h);
      }
    } else if (changedKey === 'answers_h') {
      safe.answers_h = clampPart(safe.answers_h);
      safe.image_h = clampPart(safe.image_h);
      safe.textA_h = 100 - safe.image_h - safe.answers_h;
      if (safe.textA_h < min) {
        safe.textA_h = min;
        safe.image_h = Math.max(min, 100 - safe.answers_h - safe.textA_h);
      }
    } else {
      safe.textA_h = clampPart(safe.textA_h);
      safe.image_h = clampPart(safe.image_h);
      safe.answers_h = 100 - safe.image_h - safe.textA_h;
      if (safe.answers_h < min) {
        safe.answers_h = min;
        safe.image_h = Math.max(min, 100 - safe.textA_h - safe.answers_h);
      }
    }
    const total = safe.image_h + safe.textA_h + safe.answers_h;
    if (total !== 100) safe.textA_h += 100 - total;
    return { ...tune, image_h: safe.image_h, textA_h: safe.textA_h, answers_h: safe.answers_h, text_font: 12, image_y: 0, textA_y: 0, answers_y: 0 };
  }

  const QUIZ_LAYOUT_TUNE_STORAGE_VERSION = 'v0.24.106';
  const QUIZ_LAYOUT_ORDER_TUNE_STORAGE_VERSION = 'v0.24.168';
  const QUIZ_CASCADE_TUNE_STORAGE_VERSION = 'v0.24.106';
  const QUIZ_CASCADE_TUNE_FIELDS = [
    { key: 'textA_y', label: 'Texto A subir Y', min: 0, max: 90, step: 1, unit: 'px' },
    { key: 'image_y', label: 'Imagen subir Y', min: 0, max: 90, step: 1, unit: 'px' },
    { key: 'textB_y', label: 'Texto B subir Y', min: 0, max: 90, step: 1, unit: 'px' },
    { key: 'answers_y', label: 'Opciones / respuesta subir Y', min: 0, max: 90, step: 1, unit: 'px' }
  ];
  const QUIZ_CASCADE_TUNE_DEFAULTS = {
    textA_y: 35,
    image_y: 35,
    textB_y: 35,
    answers_y: 85
  };

  function getQuizCascadeTuneDefaults(type = 'default', hasImage = false) {
    if (type === 'order') {
      return { textA_y: 35, image_y: 35, textB_y: 35, answers_y: 85 };
    }
    if (type === 'open') {
      return { textA_y: 35, image_y: 35, textB_y: 35, answers_y: 90 };
    }
    if (type === 'true_false') {
      return { textA_y: 25, image_y: 25, textB_y: 25, answers_y: 80 };
    }
    if (type === 'flip') {
      return { textA_y: 35, image_y: 35, textB_y: 35, answers_y: 85 };
    }
    if (type === 'multiple_choice') {
      return hasImage
        ? { textA_y: 40, image_y: 40, textB_y: 40, answers_y: 90 }
        : { textA_y: 10, image_y: 10, textB_y: 10, answers_y: 10 };
    }
    return { ...QUIZ_CASCADE_TUNE_DEFAULTS };
  }

  function getQuizCascadeProfile(type = 'default', hasImage = false) {
    if (type === 'multiple_choice') return hasImage ? 'multiple_choice_with_image' : 'multiple_choice_no_image';
    if (type === 'flip') return hasImage ? 'flip_with_image' : 'flip_no_image';
    return type || 'default';
  }

  let quizCascadeReplayTimer = null;

  function getQuizLayoutTuneDefaults(type = 'default') {
    return { ...QUIZ_LAYOUT_TUNE_DEFAULTS, ...(QUIZ_LAYOUT_TUNE_TYPE_DEFAULTS[type] || {}) };
  }

  function quizLayoutTuneKey(type = 'default') {
    const version = type === 'order' ? QUIZ_LAYOUT_ORDER_TUNE_STORAGE_VERSION : QUIZ_LAYOUT_TUNE_STORAGE_VERSION;
    return `encisomath:quizLayoutTune:${version}:${type || 'default'}`;
  }

  function getQuizLayoutTune(type = 'default') {
    try {
      const saved = JSON.parse(localStorage.getItem(quizLayoutTuneKey(type)) || '{}');
      return normalizeQuizLayoutTune(saved, type);
    } catch (_) {
      return normalizeQuizLayoutTune({}, type);
    }
  }

  function normalizeQuizLayoutTune(tune = {}, type = 'default') {
    const defaults = getQuizLayoutTuneDefaults(type);
    const normalized = { ...defaults, ...tune, text_font: 12, image_y: 0, textA_y: 0, answers_y: 0 };
    QUIZ_LAYOUT_TUNE_FIELDS.forEach((field) => {
      const raw = Number(normalized[field.key]);
      normalized[field.key] = Number.isFinite(raw) ? Math.max(field.min, Math.min(field.max, Math.round(raw))) : defaults[field.key];
    });
    return rebalanceQuizLayoutTune(normalized, 'image_h');
  }

  function saveQuizLayoutTune(type, tune) {
    const normalized = normalizeQuizLayoutTune(tune, type);
    try { localStorage.setItem(quizLayoutTuneKey(type), JSON.stringify(normalized)); } catch (_) {}
    return normalized;
  }

  function quizCascadeTuneKey(type = 'default', hasImage = false) {
    const profile = getQuizCascadeProfile(type, hasImage);
    return `encisomath:quizCascadeTune:${QUIZ_CASCADE_TUNE_STORAGE_VERSION}:${profile}`;
  }

  function normalizeQuizCascadeTune(tune = {}, type = 'default', hasImage = false) {
    const normalized = { ...getQuizCascadeTuneDefaults(type, hasImage) };
    QUIZ_CASCADE_TUNE_FIELDS.forEach((field) => {
      const raw = Number(tune[field.key]);
      normalized[field.key] = Number.isFinite(raw) ? Math.max(field.min, Math.min(field.max, raw)) : normalized[field.key];
    });
    return normalized;
  }

  function getQuizCascadeTune(type = 'default', hasImage = false) {
    try {
      return normalizeQuizCascadeTune(JSON.parse(localStorage.getItem(quizCascadeTuneKey(type, hasImage)) || '{}'), type, hasImage);
    } catch (_) {
      return normalizeQuizCascadeTune({}, type, hasImage);
    }
  }

  function saveQuizCascadeTune(type, tune, hasImage = false) {
    const normalized = normalizeQuizCascadeTune(tune, type, hasImage);
    try { localStorage.setItem(quizCascadeTuneKey(type, hasImage), JSON.stringify(normalized)); } catch (_) {}
    return normalized;
  }

  function applyQuizCascadeTune(type = 'default', tune = null, stageRef = null, hasImageOverride = null) {
    const stage = stageRef || document.querySelector(`.quiz-stage-fullscreen.quiz-type-${escapeSelector(type)}`) || document.querySelector(`.quiz-stage.quiz-type-${escapeSelector(type)}`) || document.querySelector('.quiz-stage');
    if (!stage) return;
    const hasImage = hasImageOverride === null ? stage.dataset.quizHasImage === 'true' : Boolean(hasImageOverride);
    const safe = normalizeQuizCascadeTune(tune || getQuizCascadeTune(type, hasImage), type, hasImage);
    stage.style.setProperty('--quiz-feedback-cascade-text-a-shift', `${safe.textA_y}px`);
    stage.style.setProperty('--quiz-feedback-cascade-image-shift', `${safe.image_y}px`);
    stage.style.setProperty('--quiz-feedback-cascade-text-b-shift', `${safe.textB_y}px`);
    stage.style.setProperty('--quiz-feedback-cascade-answer-shift', `${safe.answers_y}px`);
  }

  function replayQuizCascadePreview(trigger = null) {
    const panel = trigger?.closest('[data-quiz-layout-tune-panel]') || null;
    const stage = panel?.closest('.quiz-stage') || trigger?.closest('.quiz-stage') || document.querySelector('.quiz-stage-fullscreen') || document.querySelector('.quiz-stage');
    if (!stage) return;
    const feedback = stage.querySelector('[data-quiz-feedback]');
    if (quizCascadeReplayTimer) window.clearTimeout(quizCascadeReplayTimer);
    stage.classList.remove('quiz-feedback-visible', 'quiz-cascade-previewing');
    if (feedback) {
      feedback.hidden = true;
      feedback.innerHTML = '';
      feedback.className = 'quiz-answer-feedback';
    }
    if (panel) {
      panel.classList.remove('is-open');
      panel.setAttribute('aria-hidden', 'true');
      panel.hidden = true;
    }
    const playPreview = () => {
      void stage.offsetWidth;
      if (feedback) {
        feedback.hidden = false;
        feedback.innerHTML = '<div class="quiz-feedback-card is-correct quiz-feedback-preview-card"><span>✨</span><strong>Prueba</strong><p>Vista previa de cascada</p></div>';
        feedback.className = 'quiz-answer-feedback is-correct is-preview';
      }
      stage.classList.add('quiz-cascade-previewing', 'quiz-feedback-visible');
      quizCascadeReplayTimer = window.setTimeout(() => {
        stage.classList.remove('quiz-feedback-visible', 'quiz-cascade-previewing');
        if (feedback) {
          feedback.hidden = true;
          feedback.innerHTML = '';
          feedback.className = 'quiz-answer-feedback';
        }
        quizCascadeReplayTimer = null;
      }, 1800);
    };
    quizCascadeReplayTimer = window.setTimeout(playPreview, panel ? 420 : 0);
  }

  function quizImagePreviewKey(type = 'default') {
    return `encisomath:quizImagePreviewVisible:${type || 'default'}`;
  }

  function getQuizImagePreviewVisible(type = 'default') {
    try {
      return localStorage.getItem(quizImagePreviewKey(type)) !== 'false';
    } catch (_) {
      return true;
    }
  }

  function setQuizImagePreviewVisible(type = 'default', visible = true) {
    try { localStorage.setItem(quizImagePreviewKey(type), visible ? 'true' : 'false'); } catch (_) {}
    return Boolean(visible);
  }

  function quizLayoutTuneNavHTML(totalQuestions = 0, currentIndex = 0) {
    const total = Math.max(0, Number(totalQuestions) || 0);
    if (!total) return '';
    const buttons = Array.from({ length: total }, (_, index) => {
      const active = index === Number(currentIndex) ? 'active' : '';
      return `<button class="quiz-tune-jump-btn ${active}" type="button" data-quiz-jump="${index}">${index + 1}</button>`;
    }).join('');
    return `
      <div class="quiz-layout-tune-nav" aria-label="Navegación rápida de preguntas">
        <div class="quiz-layout-tune-nav-head">
          <strong>Preguntas</strong>
          <span>Salta a cualquier ítem, esté resuelto o no.</span>
        </div>
        <div class="quiz-layout-tune-nav-actions">
          <button class="btn ghost small" type="button" data-quiz-prev>← Anterior</button>
          <button class="btn ghost small" type="button" data-quiz-next>Siguiente →</button>
        </div>
        <div class="quiz-layout-tune-jumps">${buttons}</div>
      </div>
    `;
  }


  function quizTypographyQuickControlsHTML() {
    const tune = getQuizTypographyTune();
    return `
      <div class="quiz-typography-tune-box quiz-quick-typography-box" data-quiz-typography-box>
        <div class="quiz-layout-tune-nav-head">
          <strong>Texto y opciones</strong>
          <span>Ajusta la fuente y el tamaño visual del texto principal y de las respuestas.</span>
        </div>
        <div class="quiz-quick-font-grid">
          <label class="quiz-font-select-row">
            <span>Fuente del texto</span>
            <select data-quiz-typography-input="textPreset">${quizFontPresetOptionsHTML(tune.textPreset)}</select>
          </label>
          <label class="quiz-layout-tune-row quiz-quick-range-row">
            <span>Tamaño texto <b data-quiz-typography-value="textSize">${tune.textSize}px</b></span>
            <input type="range" min="12" max="28" step="1" value="${tune.textSize}" data-quiz-typography-input="textSize" />
          </label>
          <label class="quiz-font-select-row">
            <span>Fuente de opciones</span>
            <select data-quiz-typography-input="optionPreset">${quizFontPresetOptionsHTML(tune.optionPreset)}</select>
          </label>
          <label class="quiz-layout-tune-row quiz-quick-range-row">
            <span>Tamaño opciones <b data-quiz-typography-value="optionSize">${tune.optionSize}px</b></span>
            <input type="range" min="12" max="28" step="1" value="${tune.optionSize}" data-quiz-typography-input="optionSize" />
          </label>
        </div>
      </div>
    `;
  }

  function quizSoundQuickControlsHTML() {
    return `
      <div class="quiz-sound-tune-box quiz-quick-sound-box">
        <label class="toggle-row quiz-sound-toggle-row">
          <span>Sonidos del quiz</span>
          <input type="checkbox" data-quiz-sound-toggle ${booleanPrefChecked('quizSounds')} />
        </label>
        <small>Usa correct.mp3, wrong.mp3, type.mp3, item.mp3 y music1.mp3.</small>
      </div>
    `;
  }

  function quizLayoutTunePanelHTML(type = 'default', totalQuestions = 0, currentIndex = 0, hasImage = false, quizId = 'quiz', questionId = '') {
    if (!['multiple_choice', 'true_false', 'open', 'order', 'flip'].includes(type)) return '';
    const imageKey = `${quizId || 'quiz'}:${questionId || currentIndex}`;
    const imageToggleHTML = hasImage ? `
          <div class="quiz-layout-image-preview-row">
            <label class="quiz-layout-image-preview-toggle">
              <input type="checkbox" data-quiz-image-preview-toggle ${getQuizImagePreviewVisible(imageKey) ? 'checked' : ''} />
              <span>Mostrar imagen de esta pregunta</span>
            </label>
            <small>Al desactivarla, el texto usa el espacio de la imagen. No modifica el JSON ni borra el recurso.</small>
          </div>` : `
          <div class="quiz-layout-image-preview-row quiz-layout-image-preview-row-empty">
            <strong>Imagen</strong>
            <small>Esta pregunta no tiene imagen cargada.</small>
          </div>`;
    return `
      <section class="quiz-layout-tune-panel quiz-quick-menu-panel" data-quiz-layout-tune-panel data-quiz-layout-type="${escapeAttr(type)}" data-quiz-has-image="${hasImage ? 'true' : 'false'}" data-quiz-image-preview-key="${escapeAttr(imageKey)}" hidden aria-hidden="true">
        <div class="quiz-layout-tune-dialog quiz-quick-menu-dialog" role="dialog" aria-modal="true" aria-label="Navegación del quiz">
          <div class="quiz-layout-tune-dialog-head">
            <div>
              <strong>Navegación del quiz</strong>
              <small>Salta entre preguntas y controla la imagen de este ítem.</small>
            </div>
            <button class="quiz-layout-tune-close" type="button" data-quiz-layout-tune-close aria-label="Cerrar navegación">×</button>
          </div>
          ${quizLayoutTuneNavHTML(totalQuestions, currentIndex)}
          ${imageToggleHTML}
          ${quizTypographyQuickControlsHTML()}
          ${quizSoundQuickControlsHTML()}
        </div>
      </section>
    `;
  }


  function updateQuizLayoutMeasurements(stage) {
    if (!stage) return;
    const panel = stage.querySelector('[data-quiz-layout-tune-panel]');
    if (!panel) return;
    const targets = {
      image: stage.querySelector('[data-quiz-tune-target="image"]'),
      textA: stage.querySelector('[data-quiz-tune-target="textA"]'),
      answers: stage.querySelector('[data-quiz-tune-target="answers"]')
    };
    const labels = {
      image: 'Imagen',
      textA: 'Texto',
      answers: 'Opciones'
    };
    Object.entries(targets).forEach(([key, el]) => {
      const output = panel.querySelector(`[data-quiz-layout-measure="${key}"]`);
      if (!output) return;
      if (!el) {
        output.textContent = `${labels[key]}: 0 px`;
        return;
      }
      const rect = el.getBoundingClientRect();
      output.textContent = `${labels[key]}: ${Math.round(rect.height)} px`;
    });
  }

  function bindQuizLayoutTunePanel() {
    document.querySelectorAll('[data-quiz-layout-tune-open]').forEach((button) => {
      if (button.dataset.boundLayoutTuneOpen === 'true') return;
      button.dataset.boundLayoutTuneOpen = 'true';
      button.addEventListener('click', () => {
        const stage = button.closest('.quiz-stage');
        const panel = stage?.querySelector('[data-quiz-layout-tune-panel]');
        if (!panel) return;
        panel.hidden = false;
        panel.setAttribute('aria-hidden', 'false');
        panel.classList.add('is-open');
      });
    });

    document.querySelectorAll('[data-quiz-layout-tune-panel]').forEach((panel) => {
      if (panel.dataset.boundQuickQuizMenu === 'true') return;
      panel.dataset.boundQuickQuizMenu = 'true';
      const panelStage = panel.closest('.quiz-stage');
      const closePanel = () => {
        const active = document.activeElement;
        if (active && panel.contains(active)) active.blur();
        panel.classList.remove('is-open');
        panel.setAttribute('aria-hidden', 'true');
        panel.hidden = true;
        panelStage?.querySelector('[data-quiz-layout-tune-open]')?.focus?.({ preventScroll: true });
      };

      panel.querySelectorAll('[data-quiz-layout-tune-close]').forEach((button) => {
        button.addEventListener('click', closePanel);
      });
      panel.addEventListener('click', (event) => {
        if (event.target === panel) closePanel();
      });

      const imagePreviewToggle = panel.querySelector('[data-quiz-image-preview-toggle]');
      if (imagePreviewToggle) {
        const imageKey = panel.dataset.quizImagePreviewKey || panel.dataset.quizLayoutType || 'default';
        imagePreviewToggle.checked = getQuizImagePreviewVisible(imageKey);
        imagePreviewToggle.addEventListener('change', () => {
          setQuizImagePreviewVisible(imageKey, imagePreviewToggle.checked);
          applyQuizLayoutTune(panel.dataset.quizLayoutType || 'default', getQuizLayoutTune(panel.dataset.quizLayoutType || 'default'), panelStage);
        });
      }

      const soundToggle = panel.querySelector('[data-quiz-sound-toggle]');
      if (soundToggle) {
        soundToggle.checked = quizSoundsEnabled();
        soundToggle.addEventListener('change', () => {
          state.prefs.quizSounds = Boolean(soundToggle.checked);
          localStorage.setItem('encisomath:prefs', JSON.stringify(state.prefs));
          if (state.prefs.quizSounds === false) stopQuizQuestionMusic(false);
          panel.querySelectorAll('[data-quiz-sound-toggle]').forEach((input) => { input.checked = state.prefs.quizSounds !== false; });
          if (state.prefs.quizSounds !== false) {
            preloadQuizSounds();
            if (state.quizFullscreenActive) startQuizQuestionMusic(getCurrentQuizQuestion());
          }
        });
      }

      const typographyInputs = panel.querySelectorAll('[data-quiz-typography-input]');
      const refreshTypographyPanel = (safe) => {
        panel.querySelectorAll('[data-quiz-typography-value="textSize"]').forEach((node) => { node.textContent = `${safe.textSize}px`; });
        panel.querySelectorAll('[data-quiz-typography-value="optionSize"]').forEach((node) => { node.textContent = `${safe.optionSize}px`; });
        panel.querySelectorAll('[data-quiz-typography-input]').forEach((input) => {
          const key = input.dataset.quizTypographyInput;
          if (!key || !(key in safe)) return;
          input.value = String(safe[key]);
        });
      };
      typographyInputs.forEach((input) => {
        const handleTypographyChange = () => {
          const key = input.dataset.quizTypographyInput;
          if (!key) return;
          const current = getQuizTypographyTune();
          const value = key === 'textSize' || key === 'optionSize' ? Number(input.value) : input.value;
          const safe = saveQuizTypographyTune({ ...current, [key]: value });
          applyQuizTypographyTune(safe);
          refreshTypographyPanel(safe);
          if ((panel.dataset.quizLayoutType || '') === 'order') {
            window.requestAnimationFrame(() => {
              document.querySelectorAll('[data-quiz-order-board]').forEach((orderBoard) => fitQuizOrderCards(orderBoard));
            });
          }
        };
        input.addEventListener('input', handleTypographyChange);
        input.addEventListener('change', handleTypographyChange);
      });
    });
  }


  function applyQuizLayoutTune(type = 'default', tune = getQuizLayoutTune(type), stageRef = null) {
    const stage = stageRef || document.querySelector(`.quiz-stage-fullscreen.quiz-type-${escapeSelector(type)}`) || document.querySelector('.quiz-stage');
    if (!stage) return;
    applyQuizTypographyTune(getQuizTypographyTune());
    const imagePreviewKey = stage.dataset.quizImagePreviewKey || type;
    const hasStageImage = stage.dataset.quizHasImage === 'true';
    const imageVisible = hasStageImage && getQuizImagePreviewVisible(imagePreviewKey);
    stage.classList.toggle('quiz-hide-image-preview', !imageVisible);
    const safe = normalizeQuizLayoutTune(tune, type);
    const unifiedFont = `${safe.text_font}px`;
    stage.style.setProperty('--quiz-text-font', unifiedFont);
    stage.style.setProperty('--quiz-text-a-font', unifiedFont);
    stage.style.setProperty('--quiz-text-b-font', unifiedFont);
    const answerZone = stage.querySelector('[data-quiz-tune-target="answers"]');
    if (answerZone) {
      answerZone.style.setProperty('--quiz-text-font', unifiedFont);
      answerZone.style.setProperty('--quiz-text-a-font', unifiedFont);
      answerZone.style.setProperty('--quiz-text-b-font', unifiedFont);
    }
    const imageFr = Math.max(0, Number(safe.image_h) || 0);
    const textFr = Math.max(1, Number(safe.textA_h) || 1);
    const answerFr = Math.max(1, Number(safe.answers_h) || 1);
    if (imageVisible) {
      stage.style.setProperty('--quiz-fit-image-fr', `${imageFr}fr`);
      stage.style.setProperty('--quiz-fit-text-fr', `${textFr}fr`);
      stage.style.setProperty('--quiz-fit-spacer-fr', '0fr');
      stage.style.setProperty('--quiz-fit-answer-fr', `${answerFr}fr`);
    } else {
      stage.style.setProperty('--quiz-fit-image-fr', '0fr');
      stage.style.setProperty('--quiz-fit-text-fr', '52fr');
      stage.style.setProperty('--quiz-fit-spacer-fr', '3fr');
      stage.style.setProperty('--quiz-fit-answer-fr', '45fr');
    }
    if (type === 'order') {
      window.requestAnimationFrame(() => {
        document.querySelectorAll('[data-quiz-order-board]').forEach((orderBoard) => fitQuizOrderCards(orderBoard));
      });
    }
    const setBox = (name, prefix) => {
      const box = stage.querySelector(`[data-quiz-tune-target="${name}"]`);
      if (!box) return;
      box.style.removeProperty('--quiz-tune-x');
      box.style.removeProperty('--quiz-tune-w');
      box.style.removeProperty('--quiz-tune-h');
      box.style.setProperty('--quiz-tune-y', `${Number(safe[`${prefix}_y`]) || 0}%`);
      if (prefix === 'textA') {
        box.style.setProperty('--quiz-text-font', `${safe.text_font}px`);
        box.style.setProperty('--quiz-text-a-font', `${safe.text_font}px`);
        box.style.setProperty('--quiz-text-b-font', `${safe.text_font}px`);
      }
    };
    setBox('textA', 'textA');
    setBox('image', 'image');
    setBox('answers', 'answers');
    applyQuizTypographyTune(getQuizTypographyTune());
    window.requestAnimationFrame?.(() => updateQuizLayoutMeasurements(stage));
  }

  function quizTypeLabel(type) {
    const labels = {
      multiple_choice: 'Opción múltiple',
      true_false: 'Verdadero / falso',
      open: 'Pregunta abierta',
      order: 'Organizar tarjetas',
      flip: 'Quiz flip'
    };
    return labels[type] || 'Pregunta';
  }

  function quizImageHTML(question) {
    return `
      <button class="quiz-image-card" type="button" data-quiz-image="${escapeAttr(question.image)}" data-quiz-image-alt="${escapeAttr(question.imageAlt || question.prompt || 'Imagen del quiz')}" aria-label="Ampliar imagen de la pregunta">
        <img src="${escapeAttr(question.image)}" alt="${escapeAttr(question.imageAlt || '')}" loading="lazy" />
      </button>
    `;
  }

  function quizQuestionBodyHTML(question) {
    if (question.type === 'order') return quizOrderHTML(question);
    if (question.type === 'flip') return quizFlipHTML(question);
    if (question.type === 'open') return quizOpenHTML(question);
    if (question.type === 'true_false') return quizTrueFalseHTML(question);
    return quizMultipleChoiceHTML(question);
  }

  function quizFlipHTML(question) {
    const colors = ['red', 'blue', 'yellow', 'green', 'orange', 'purple'];
    const options = (Array.isArray(question.options) ? question.options : []).slice(0, 6);
    return `
      <div class="quiz-flip-board" data-quiz-flip-board>
        <div class="quiz-flip-grid" role="list">
          ${options.map((option, index) => {
            const rawColor = String(option.color || colors[index % colors.length] || 'blue').toLowerCase();
            const safeColor = ['red', 'blue', 'yellow', 'green', 'orange', 'purple'].includes(rawColor) ? rawColor : colors[index % colors.length];
            return `
              <button class="quiz-flip-card quiz-flip-${safeColor}" type="button" data-quiz-flip-card data-quiz-answer="${escapeAttr(option.id || String(index))}" data-correct="${String(Boolean(option.correct))}" role="listitem" aria-pressed="false" aria-label="Opción oculta ${index + 1}">
                <span class="quiz-flip-inner" aria-hidden="true">
                  <span class="quiz-flip-face quiz-flip-back"><span>?</span></span>
                  <span class="quiz-flip-face quiz-flip-front"><span>${escapeHTML(option.text || '')}</span></span>
                </span>
              </button>
            `;
          }).join('')}
        </div>
        <button class="primary-btn quiz-flip-submit" type="button" data-flip-validate>Enviar respuesta</button>
      </div>
    `;
  }

  function quizOrderHTML(question) {
    const cards = Array.isArray(question.cards) ? question.cards : (Array.isArray(question.options) ? question.options : []);
    const correctOrder = Array.isArray(question.correctOrder)
      ? question.correctOrder
      : cards.slice().sort((a, b) => Number(a.order || 0) - Number(b.order || 0)).map((card) => card.id);
    return `
      <div class="quiz-order-board" data-quiz-order-board data-correct-order="${escapeAttr(correctOrder.join('|'))}">
        <div class="quiz-order-stack" data-quiz-order-stack>
          ${cards.slice(0, 4).map((card, index) => {
            const orderColors = ['red', 'blue', 'yellow', 'green'];
            const color = String(card.color || orderColors[index % orderColors.length] || 'blue').toLowerCase();
            const safeColor = ['red', 'blue', 'yellow', 'green'].includes(color) ? color : orderColors[index % orderColors.length];
            return `
              <div class="quiz-order-card quiz-order-${safeColor}" draggable="true" data-order-card="${escapeAttr(card.id || String(index))}" data-order-color="${escapeAttr(safeColor)}" role="button" tabindex="0" aria-label="Ordenar: ${escapeAttr(card.text || '')}">
                <span class="quiz-order-grip">☰</span>
                <strong>${escapeHTML(card.text || '')}</strong>
              </div>
            `;
          }).join('')}
        </div>
        <button class="primary-btn quiz-order-submit" type="button" data-order-validate>Enviar respuesta</button>
      </div>
    `;
  }

  function updateQuizOrderNumbers(board) {
    board?.querySelectorAll('[data-order-card]').forEach((card, index) => {
      const number = card.querySelector('.quiz-order-number');
      if (number) number.textContent = String(index + 1);
    });
  }

  function getQuizOrderIds(board) {
    return Array.from(board?.querySelectorAll('[data-order-card]') || []).map((card) => card.dataset.orderCard || '');
  }

  const QUIZ_ORDER_EASE_EXPO = 'cubic-bezier(0.87, 0, 0.13, 1)';
  const QUIZ_ORDER_SHIFT_MS = 420;

  function getQuizOrderGapPx(stack) {
    if (!stack) return 6;
    const styles = window.getComputedStyle(stack);
    const gap = Number.parseFloat(styles.rowGap || styles.gap || '6');
    return Number.isFinite(gap) ? gap : 6;
  }

  function fitQuizOrderCards(board) {
    const stack = board?.querySelector('[data-quiz-order-stack]');
    if (!stack) return;
    const count = Math.max(1, stack.querySelectorAll('[data-order-card]').length || 4);
    const gap = getQuizOrderGapPx(stack);
    const rect = stack.getBoundingClientRect();
    const available = Math.max(0, stack.clientHeight || rect.height || 0);
    const usable = Math.max(0, available - (gap * (count - 1)));
    const cardHeight = Math.max(28, Math.floor(usable / count));
    board.style.setProperty('--quiz-order-card-h', `${cardHeight}px`);
  }

  function getOrderLayoutNodes(stack, draggingCard = null) {
    return Array.from(stack?.children || []).filter((item) => {
      if (item === draggingCard) return false;
      return item.matches?.('[data-order-card], .quiz-order-placeholder');
    });
  }

  function animateOrderLayoutChange(stack, beforeRects, draggingCard = null) {
    getOrderLayoutNodes(stack, draggingCard).forEach((item) => {
      if (item.classList.contains('quiz-order-placeholder')) return;
      const start = beforeRects.get(item);
      if (!start) return;
      const end = item.getBoundingClientRect();
      const dx = start.left - end.left;
      const dy = start.top - end.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
      item.style.transition = 'none';
      item.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      item.getBoundingClientRect();
      window.requestAnimationFrame(() => {
        item.classList.add('order-moving');
        item.style.transition = `transform ${QUIZ_ORDER_SHIFT_MS}ms ${QUIZ_ORDER_EASE_EXPO}`;
        item.style.transform = 'translate3d(0, 0, 0)';
        window.setTimeout(() => {
          item.classList.remove('order-moving');
          item.style.removeProperty('transition');
          item.style.removeProperty('transform');
        }, QUIZ_ORDER_SHIFT_MS + 40);
      });
    });
  }

  function moveOrderPlaceholder(stack, placeholder, clientY, draggingCard) {
    if (!stack || !placeholder?.isConnected) return false;
    const cards = Array.from(stack.querySelectorAll('[data-order-card]')).filter((card) => card !== draggingCard);
    let beforeNode = null;
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) {
        beforeNode = card;
        break;
      }
    }
    const currentNext = placeholder.nextElementSibling;
    const alreadyThere = (beforeNode && currentNext === beforeNode) || (!beforeNode && placeholder === stack.lastElementChild);
    if (alreadyThere) return false;
    const beforeRects = new Map(getOrderLayoutNodes(stack, draggingCard).map((item) => [item, item.getBoundingClientRect()]));
    if (beforeNode) stack.insertBefore(placeholder, beforeNode);
    else stack.appendChild(placeholder);
    animateOrderLayoutChange(stack, beforeRects, draggingCard);
    return true;
  }

  function setQuizFlipCardOpen(card, open = true) {
    if (!card) return;
    const inner = card.querySelector('.quiz-flip-inner');
    const wasOpen = card.classList.contains('is-flipped');
    if (wasOpen === Boolean(open) && !card.classList.contains('is-flip-animating')) return;
    card.classList.remove('is-flipping-open', 'is-flipping-close', 'is-flip-animating');
    if (inner && typeof inner.getAnimations === 'function') inner.getAnimations().forEach((animation) => animation.cancel());
    void card.offsetWidth;
    card.classList.add('is-flip-animating', open ? 'is-flipping-open' : 'is-flipping-close');
    card.classList.toggle('is-flipped', Boolean(open));
    card.setAttribute('aria-pressed', open ? 'true' : 'false');
    window.setTimeout(() => {
      card.classList.remove('is-flipping-open', 'is-flipping-close', 'is-flip-animating');
    }, 430);
  }

  function bindQuizFlipEvents() {
    document.querySelectorAll('[data-quiz-flip-board]').forEach((board) => {
      if (board.dataset.boundFlip === 'true') return;
      board.dataset.boundFlip = 'true';
      const cards = () => Array.from(board.querySelectorAll('[data-quiz-flip-card]'));
      cards().forEach((card) => {
        card.addEventListener('click', () => {
          const session = getQuizSession();
          if (session.locked || board.classList.contains('flip-locked')) return;
          const isOpen = card.classList.contains('is-flipped');
          cards().forEach((other) => {
            if (other !== card && other.classList.contains('is-flipped')) setQuizFlipCardOpen(other, false);
          });
          setQuizFlipCardOpen(card, !isOpen);
          board.dataset.selectedFlipAnswer = !isOpen ? (card.dataset.quizAnswer || '') : '';
        });
      });

      board.querySelector('[data-flip-validate]')?.addEventListener('click', () => {
        const session = getQuizSession();
        const question = getCurrentQuizQuestion();
        const stage = board.closest('.quiz-stage-fullscreen, .quiz-stage');
        if (!question || session.locked || board.classList.contains('flip-locked')) return;
        const selectedId = board.dataset.selectedFlipAnswer || '';
        const selected = cards().find((card) => card.dataset.quizAnswer === selectedId && card.classList.contains('is-flipped')) || null;
        const submit = board.querySelector('[data-flip-validate]');
        if (!selected) {
          if (submit) {
            submit.classList.remove('is-order-submit-jello');
            submit.style.removeProperty('animation');
            void submit.offsetWidth;
            submit.classList.add('is-order-submit-jello');
          }
          return;
        }
        session.locked = true;
        session.selectedAnswerId = selected.dataset.quizAnswer || '';
        const selectedCorrect = selected.dataset.correct === 'true';
        const correctCard = cards().find((card) => card.dataset.correct === 'true') || null;
        board.classList.add('flip-locked', 'flip-pending', selectedCorrect ? 'flip-correct' : 'flip-wrong');
        if (submit) {
          submit.classList.remove('is-order-submit-jello');
          submit.style.removeProperty('animation');
          void submit.offsetWidth;
          submit.classList.add('is-order-submit-jello');
          submit.disabled = true;
        }
        cards().forEach((card) => {
          card.disabled = true;
          card.classList.remove('flip-correct-reveal', 'flip-wrong-reveal', 'flip-unused', 'is-dimmed', 'correct-reveal', 'wrong-reveal');
          if (card !== selected) card.classList.add('flip-unused', 'is-dimmed');
        });
        scheduleQuizTimer(() => {
          if (!board.isConnected) return;
          board.classList.remove('flip-pending');
          board.classList.add('flip-validating');
          const runRevealAnimation = (card, ok) => {
            if (!card) return;
            if (typeof card.getAnimations === 'function') card.getAnimations().forEach((animation) => animation.cancel());
            card.classList.remove('flip-unused', 'is-dimmed', 'flip-correct-reveal', 'flip-wrong-reveal');
            card.style.removeProperty('animation');
            void card.offsetWidth;
            card.classList.add(ok ? 'flip-correct-reveal' : 'flip-wrong-reveal');
          };
          if (selectedCorrect) {
            runRevealAnimation(selected, true);
            playQuizSound('correct');
            recordQuizAnswer(question, true, { selected: session.selectedAnswerId });
            showQuizFeedbackBandAfterDelay(stage, true, question, '', QUIZ_FEEDBACK_AFTER_CHOICE_REVEAL_MS);
          } else {
            runRevealAnimation(selected, false);
            playQuizSound('wrong');
            if (correctCard && correctCard !== selected) {
              setQuizFlipCardOpen(correctCard, true);
              window.setTimeout(() => runRevealAnimation(correctCard, true), 430);
            }
            recordQuizAnswer(question, false, { selected: session.selectedAnswerId, correct: correctCard?.dataset.quizAnswer || '' });
            showQuizFeedbackBandAfterDelay(stage, false, question, '', Math.max(QUIZ_FEEDBACK_AFTER_CHOICE_REVEAL_MS, correctCard && correctCard !== selected ? 980 : 720));
          }
        }, 1000);
      });
    });
  }

  function bindQuizOrderEvents() {
    document.querySelectorAll('[data-quiz-order-board]').forEach((board) => {
      const stack = board.querySelector('[data-quiz-order-stack]');
      if (!stack) return;
      fitQuizOrderCards(board);
      if (board.dataset.boundOrder === 'true') return;
      board.dataset.boundOrder = 'true';

      let resizeTimer = null;
      window.addEventListener('resize', () => {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(() => fitQuizOrderCards(board), 120);
      });
      if (typeof ResizeObserver !== 'undefined' && board.dataset.orderResizeObserver !== 'true') {
        board.dataset.orderResizeObserver = 'true';
        const orderResizeObserver = new ResizeObserver(() => fitQuizOrderCards(board));
        orderResizeObserver.observe(board);
        orderResizeObserver.observe(stack);
      }

      const getCards = () => Array.from(stack.querySelectorAll('[data-order-card]'));

      function getPositions() {
        const positions = new Map();
        Array.from(stack.children).forEach((item) => {
          positions.set(item, item.getBoundingClientRect());
        });
        return positions;
      }

      function animateMove(oldPositions) {
        Array.from(stack.children).forEach((item) => {
          if (!oldPositions.has(item) || item.classList.contains('quiz-order-placeholder')) return;
          const oldRect = oldPositions.get(item);
          const newRect = item.getBoundingClientRect();
          const deltaY = oldRect.top - newRect.top;
          if (Math.abs(deltaY) < 0.5) return;
          item.style.setProperty('transition', 'none', 'important');
          item.style.setProperty('transform', `translateY(${deltaY}px)`, 'important');
          item.getBoundingClientRect();
          window.requestAnimationFrame(() => {
            item.classList.add('order-moving');
            item.style.setProperty('transition', `transform ${QUIZ_ORDER_SHIFT_MS}ms ${QUIZ_ORDER_EASE_EXPO}`, 'important');
            item.style.setProperty('transform', 'translateY(0)', 'important');
            window.setTimeout(() => {
              item.classList.remove('order-moving');
              item.style.removeProperty('transition');
              item.style.removeProperty('transform');
            }, QUIZ_ORDER_SHIFT_MS + 60);
          });
        });
      }

      stack.addEventListener('pointerdown', (event) => {
        const card = event.target.closest('[data-order-card]');
        if (!card || !stack.contains(card)) return;
        if (board.classList.contains('order-locked') || event.button > 0) return;
        event.preventDefault();
        fitQuizOrderCards(board);

        const rect = card.getBoundingClientRect();
        const offsetX = event.clientX - rect.left;
        const offsetY = event.clientY - rect.top;
        const placeholder = document.createElement('div');
        placeholder.className = 'quiz-order-placeholder';
        placeholder.setAttribute('aria-hidden', 'true');
        placeholder.style.height = `${rect.height}px`;
        placeholder.style.flexBasis = `${rect.height}px`;

        let draggingCard = card;
        let lastClientX = event.clientX;
        let lastClientY = event.clientY;
        let finished = false;

        stack.insertBefore(placeholder, card);
        card.classList.add('is-pointer-dragging');
        card.style.position = 'fixed';
        card.style.boxSizing = 'border-box';
        card.style.left = `${rect.left}px`;
        card.style.top = `${rect.top}px`;
        card.style.width = `${rect.width}px`;
        card.style.height = `${rect.height}px`;
        card.style.minHeight = `${rect.height}px`;
        card.style.maxHeight = `${rect.height}px`;
        card.style.flexBasis = `${rect.height}px`;
        card.style.margin = '0';
        card.style.zIndex = '2147483000';
        card.style.pointerEvents = 'none';
        card.style.opacity = '.8';
        card.style.transition = 'none';
        card.style.transform = 'none';

        document.body.appendChild(card);
        stack.classList.add('is-reordering');
        board.classList.add('order-dragging');
        document.body.classList.add('quiz-order-drag-active');

        function moveFloatingCard(clientX, clientY) {
          card.style.left = `${clientX - offsetX}px`;
          card.style.top = `${clientY - offsetY}px`;
        }

        function movePlaceholder(clientY) {
          const oldPositions = getPositions();
          const visibleCards = Array.from(stack.querySelectorAll('[data-order-card]'));
          let placed = false;
          for (const target of visibleCards) {
            const targetRect = target.getBoundingClientRect();
            const middle = targetRect.top + targetRect.height / 2;
            if (clientY < middle) {
              if (placeholder.nextSibling !== target) {
                stack.insertBefore(placeholder, target);
                animateMove(oldPositions);
              }
              placed = true;
              break;
            }
          }
          if (!placed && placeholder !== stack.lastElementChild) {
            stack.appendChild(placeholder);
            animateMove(oldPositions);
          }
        }

        moveFloatingCard(event.clientX, event.clientY);

        const onMove = (moveEvent) => {
          if (!draggingCard || (moveEvent.pointerId !== undefined && event.pointerId !== undefined && moveEvent.pointerId !== event.pointerId)) return;
          moveEvent.preventDefault();
          lastClientX = moveEvent.clientX;
          lastClientY = moveEvent.clientY;
          moveFloatingCard(lastClientX, lastClientY);
          movePlaceholder(lastClientY);
        };

        const finishDrag = () => {
          if (finished || !draggingCard) return;
          finished = true;
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onFinish);
          window.removeEventListener('pointercancel', onCancel);

          movePlaceholder(lastClientY);
          card.classList.remove('is-pointer-dragging');
          ['position', 'box-sizing', 'left', 'top', 'width', 'height', 'min-height', 'max-height', 'flex-basis', 'margin', 'z-index', 'pointer-events', 'opacity', 'transition', 'transform', 'animation'].forEach((prop) => card.style.removeProperty(prop));
          stack.insertBefore(card, placeholder);
          placeholder.remove();
          stack.classList.remove('is-reordering');
          board.classList.remove('order-dragging');
          document.body.classList.remove('quiz-order-drag-active');
          draggingCard = null;
          updateQuizOrderNumbers(board);
          fitQuizOrderCards(board);
        };

        const onFinish = () => finishDrag();
        const onCancel = () => finishDrag();

        window.addEventListener('pointermove', onMove, { passive: false });
        window.addEventListener('pointerup', onFinish, { once: true });
        window.addEventListener('pointercancel', onCancel, { once: true });
      });

      board.querySelector('[data-order-validate]')?.addEventListener('click', () => {
        const session = getQuizSession();
        const question = getCurrentQuizQuestion();
        if (!question || session.locked || board.classList.contains('order-locked') || board.classList.contains('order-dragging')) return;
        const selected = getQuizOrderIds(board);
        const correctOrder = String(board.dataset.correctOrder || '').split('|').filter(Boolean);
        const ok = selected.length === correctOrder.length && selected.every((id, index) => id === correctOrder[index]);
        session.locked = true;
        board.classList.add('order-locked', 'order-pending', ok ? 'order-correct' : 'order-wrong');
        const orderCards = getCards();
        const button = board.querySelector('[data-order-validate]');
        if (button) {
          button.classList.remove('is-order-submit-jello');
          button.style.removeProperty('animation');
          void button.offsetWidth;
          button.classList.add('is-order-submit-jello');
          button.disabled = true;
        }
        const revealGap = 105;
        const revealDuration = 585;
        const pendingDelay = 1000;
        const stage = board.closest('.quiz-stage-fullscreen, .quiz-stage');
        orderCards.forEach((card) => {
          if (typeof card.getAnimations === 'function') {
            card.getAnimations().forEach((animation) => animation.cancel());
          }
          card.classList.remove('order-moving', 'order-reveal-correct', 'order-reveal-wrong', 'matched', 'wrong', 'order-js-revealing');
          card.style.removeProperty('transition');
          card.style.removeProperty('transform');
          card.style.removeProperty('translate');
          card.style.removeProperty('scale');
          card.style.removeProperty('rotate');
          card.style.removeProperty('animation');
          card.classList.add('order-pending-dim');
        });

        const runOrderCardRevealMotion = (card, matched) => {
          const revealClass = matched ? 'order-reveal-correct' : 'order-reveal-wrong';
          card.classList.remove('order-reveal-correct', 'order-reveal-wrong');
          card.style.removeProperty('animation');
          void card.offsetWidth;
          window.requestAnimationFrame(() => {
            card.classList.add(revealClass);
          });
        };

        const revealOneCard = (card, index) => {
          const matched = selected[index] === correctOrder[index];
          if (typeof card.getAnimations === 'function') {
            card.getAnimations().forEach((animation) => animation.cancel());
          }
          card.classList.remove('order-pending-dim', 'order-reveal-correct', 'order-reveal-wrong', 'matched', 'wrong', 'order-js-revealing');
          card.style.removeProperty('transition');
          card.style.removeProperty('transform');
          card.style.removeProperty('translate');
          card.style.removeProperty('scale');
          card.style.removeProperty('rotate');
          card.style.removeProperty('animation');
          void card.offsetWidth;
          card.classList.add('order-js-revealing');
          card.style.setProperty('transition', 'background 420ms cubic-bezier(0.87, 0, 0.13, 1), box-shadow 180ms ease', 'important');
          card.classList.add(matched ? 'matched' : 'wrong');
          runOrderCardRevealMotion(card, matched);
        };

        scheduleQuizTimer(() => {
          if (!board.isConnected) return;
          board.classList.remove('order-pending');
          board.classList.add('order-validating');
          stage?.classList.add('order-reveal-active');
          const revealTotal = orderCards.length ? ((orderCards.length - 1) * revealGap + revealDuration) : 0;
          orderCards.forEach((card, index) => {
            window.setTimeout(() => {
              revealOneCard(card, index);
              if (index === orderCards.length - 1) playQuizSound(ok ? 'correct' : 'wrong');
            }, index * revealGap);
          });
          window.setTimeout(() => {
            board.classList.remove('order-validating');
            stage?.classList.remove('order-reveal-active');
          }, revealTotal + 120);
          recordQuizAnswer(question, ok, { order: selected, correctOrder });
          showQuizFeedbackBandAfterDelay(board.closest('.quiz-stage'), ok, question, '', Math.max(QUIZ_FEEDBACK_AFTER_CHOICE_REVEAL_MS, revealTotal + 360));
        }, pendingDelay);
      });

      updateQuizOrderNumbers(board);
    });
  }

  function quizMultipleChoiceHTML(question) {
    const colors = ['red', 'blue', 'yellow', 'green'];
    const options = Array.isArray(question.options) ? question.options : [];
    const layoutClass = shouldStackMultipleChoiceOptions(options) ? 'kahoot-grid-single' : 'kahoot-grid-2x2';
    return `
      <div class="kahoot-grid ${layoutClass}" role="list">
        ${options.slice(0, 4).map((option, index) => `
          <button class="kahoot-option kahoot-${colors[index]}" data-quiz-answer="${escapeAttr(option.id || String(index))}" data-correct="${String(Boolean(option.correct))}" role="listitem">
            <span class="kahoot-answer-text">${escapeHTML(option.text || '')}</span>
          </button>
        `).join('')}
      </div>
    `;
  }

  function quizTrueFalseHTML(question) {
    const options = Array.isArray(question.options) && question.options.length ? question.options : [
      { id: 'true', text: 'Verdadero', correct: true },
      { id: 'false', text: 'Falso', correct: false }
    ];
    const palette = ['blue', 'red'];
    return `
      <div class="kahoot-grid kahoot-grid-two" role="list">
        ${options.slice(0, 2).map((option, index) => `
          <button class="kahoot-option kahoot-${palette[index]}" data-quiz-answer="${escapeAttr(option.id || String(index))}" data-correct="${String(Boolean(option.correct))}" role="listitem">
            <span class="kahoot-answer-text">${escapeHTML(option.text || '')}</span>
          </button>
        `).join('')}
      </div>
    `;
  }

  function quizOpenHTML(question) {
    return `
      <form class="quiz-open-form quiz-open-card" data-quiz-open-form>
        <textarea class="input quiz-open-input" placeholder="Escribe tu respuesta aquí" rows="3"></textarea>
        <button class="primary-btn quiz-submit-btn" type="submit">Enviar respuesta</button>
        <p class="quiz-open-feedback" data-quiz-open-feedback hidden>Respuesta enviada.</p>
      </form>
    `;
  }




  function getQuizSession() {
    if (!state.quizSession || typeof state.quizSession !== 'object') {
      state.quizSession = { phase: 'idle', answers: [], locked: false, selectedAnswerId: '' };
    }
    if (!Array.isArray(state.quizSession.answers)) state.quizSession.answers = [];
    return state.quizSession;
  }

  function resetQuizSession(phase = 'confirm') {
    clearQuizTimers();
    state.quizSession = {
      phase,
      answers: [],
      locked: false,
      selectedAnswerId: '',
      feedback: null,
      transitionFromIntro: false,
      startedAt: Date.now(),
      securityEvents: [],
      securityWarningOpen: false,
      securityTerminated: false,
      securityPausedFeedback: false
    };
    return state.quizSession;
  }

  function clearQuizTimers() {
    (state.quizTimers || []).forEach((timer) => window.clearTimeout(timer));
    state.quizTimers = [];
  }

  function scheduleQuizTimer(callback, delay) {
    const timer = window.setTimeout(() => {
      state.quizTimers = (state.quizTimers || []).filter((item) => item !== timer);
      callback();
    }, delay);
    state.quizTimers = [...(state.quizTimers || []), timer];
    return timer;
  }

  function normalizeQuizTransitionTune(tune = {}) {
    const safe = { ...QUIZ_TRANSITION_TUNE_DEFAULTS, ...(tune || {}) };
    return {
      radials: safe.radials === true,
      sceneGlow: safe.sceneGlow === true,
      shapeGlow: safe.shapeGlow !== false,
      continuous: safe.continuous === true
    };
  }

  function getQuizTransitionTune() {
    return normalizeQuizTransitionTune(readJSON(QUIZ_TRANSITION_TUNE_KEY) || QUIZ_TRANSITION_TUNE_DEFAULTS);
  }

  function saveQuizTransitionTune(tune) {
    const safe = normalizeQuizTransitionTune(tune);
    localStorage.setItem(QUIZ_TRANSITION_TUNE_KEY, JSON.stringify(safe));
    return safe;
  }

  function quizTransitionClassNames(tune = getQuizTransitionTune()) {
    const safe = normalizeQuizTransitionTune(tune);
    const radialVariant = `quiz-transition-radial-variant-${(Math.max(0, Number(state.quizQuestionIndex) || 0) % 4) + 1}`;
    return [
      safe.radials ? 'quiz-transition-radials-on' : 'quiz-transition-radials-off',
      safe.sceneGlow ? 'quiz-transition-scene-effects-on' : 'quiz-transition-scene-effects-off',
      safe.shapeGlow ? 'quiz-transition-shape-glow-on' : 'quiz-transition-shape-glow-off',
      safe.continuous ? 'quiz-transition-continuous-on' : 'quiz-transition-continuous-off',
      radialVariant
    ].join(' ');
  }

  function applyQuizTransitionTune(tune = getQuizTransitionTune()) {
    const layer = document.getElementById('quizFullscreenLayer');
    if (!layer) return normalizeQuizTransitionTune(tune);
    const safe = normalizeQuizTransitionTune(tune);
    layer.classList.toggle('quiz-transition-radials-on', safe.radials);
    layer.classList.toggle('quiz-transition-radials-off', !safe.radials);
    layer.classList.toggle('quiz-transition-scene-effects-on', safe.sceneGlow);
    layer.classList.toggle('quiz-transition-scene-effects-off', !safe.sceneGlow);
    layer.classList.toggle('quiz-transition-shape-glow-on', safe.shapeGlow);
    layer.classList.toggle('quiz-transition-shape-glow-off', !safe.shapeGlow);
    layer.classList.toggle('quiz-transition-continuous-on', safe.continuous);
    layer.classList.toggle('quiz-transition-continuous-off', !safe.continuous);
    return safe;
  }


  function getQuizTransitionTiming(layer = document.getElementById('quizFullscreenLayer')) {
    const withIntro = Boolean(layer?.classList?.contains('quiz-transition-with-intro'));
    const numberEnterDelay = withIntro ? QUIZ_TRANSITION_FIRST_INFO_MS : 0;
    const exitStart = withIntro ? QUIZ_TRANSITION_FIRST_EXIT_START_MS : QUIZ_TRANSITION_EXIT_START_MS;
    const total = withIntro ? QUIZ_TRANSITION_FIRST_TOTAL_MS : QUIZ_TRANSITION_TOTAL_MS;
    return { withIntro, numberEnterDelay, exitStart, total };
  }

  function playQuizTransitionNumberMotion(layer = document.getElementById('quizFullscreenLayer')) {
    if (!layer || !layer.classList.contains('quiz-phase-transition')) return;
    const count = layer.querySelector('.quiz-transition-count');
    if (!count) return;
    const timing = getQuizTransitionTiming(layer);
    count.classList.remove('quiz-transition-count-entering', 'quiz-transition-count-exiting');
    count.style.animation = 'none';
    void count.offsetWidth;
    count.style.animation = '';
    scheduleQuizTimer(() => {
      if (!count.isConnected) return;
      count.classList.remove('quiz-transition-count-exiting');
      count.style.animation = 'none';
      void count.offsetWidth;
      count.style.animation = '';
      playQuizSound('item');
      count.classList.add('quiz-transition-count-entering');
    }, timing.numberEnterDelay);
    scheduleQuizTimer(() => {
      if (!count.isConnected) return;
      count.classList.remove('quiz-transition-count-entering');
      count.style.animation = 'none';
      void count.offsetWidth;
      count.style.animation = '';
      count.classList.add('quiz-transition-count-exiting');
    }, timing.exitStart);
  }

  function quizTransitionTuneSwitchHTML(key, label, help = '') {
    const tune = getQuizTransitionTune();
    const checked = tune[key] ? 'checked' : '';
    return `
      <label class="quiz-transition-tune-switch">
        <input type="checkbox" data-quiz-transition-tune="${escapeAttr(key)}" ${checked} />
        <span><strong>${escapeHTML(label)}</strong>${help ? `<small>${escapeHTML(help)}</small>` : ''}</span>
      </label>
    `;
  }

  function quizTransitionTunePanelHTML(item = 1, total = 1) {
    return `
      <div class="quiz-transition-tools" data-quiz-transition-tools>
        <button class="quiz-transition-gear" type="button" data-quiz-transition-panel-toggle aria-label="Ajustar transicion">⚙️</button>
        <section class="quiz-transition-tune-panel" data-quiz-transition-tune-panel ${state.quizTransitionPanelOpen ? '' : 'hidden'} aria-label="Ajustes de la transicion entre items">
          <div class="quiz-transition-tune-head">
            <strong>Transición ítem ${Number(item) || 1}/${Number(total) || 1}</strong>
            <button type="button" data-quiz-transition-panel-close aria-label="Cerrar ajustes">×</button>
          </div>
          <div class="quiz-transition-tune-scroll">
            <div class="quiz-transition-tune-grid">
              ${quizTransitionTuneSwitchHTML('radials', 'Radiales', 'Fondo/panel')}
              ${quizTransitionTuneSwitchHTML('sceneGlow', 'Marco/glow', 'Contenedor')}
              ${quizTransitionTuneSwitchHTML('shapeGlow', 'Glow figuras', 'Exterior')}
              <label class="quiz-transition-tune-switch">
                <input type="checkbox" data-quiz-sound-toggle ${booleanPrefChecked('quizSounds')} />
                <span><strong>Sonidos</strong><small>Efectos y música</small></span>
              </label>
              ${quizTransitionTuneSwitchHTML('continuous', 'Continuo', 'Avanza solo')}
            </div>
            <div class="quiz-transition-tune-actions">
              <button type="button" data-quiz-transition-action="restart">Reiniciar</button>
              <button type="button" data-quiz-transition-action="prev">Anterior</button>
              <button type="button" data-quiz-transition-action="next">Siguiente</button>
              <button type="button" data-quiz-transition-action="question">Ver pregunta</button>
            </div>
          </div>
        </section>
      </div>
    `;
  }

  function goToQuizQuestionFromTransition() {
    const quiz = getActiveQuiz();
    if (!quiz) return;
    clearQuizTimers();
    const session = getQuizSession();
    session.phase = 'question';
    session.locked = false;
    session.selectedAnswerId = '';
    session.transitionFromIntro = false;
    renderQuizFullscreen(quiz);
  }

  function scheduleQuizTransitionContinuousAdvance() {
    const tune = getQuizTransitionTune();
    if (!tune.continuous) return;
    const layer = document.getElementById('quizFullscreenLayer');
    const timing = getQuizTransitionTiming(layer);
    const startedAt = Number(state.quizTransitionStartedAt) || Date.now();
    const remaining = Math.max(420, timing.total + 90 - (Date.now() - startedAt));
    scheduleQuizTimer(() => {
      const layer = document.getElementById('quizFullscreenLayer');
      if (!layer || !layer.classList.contains('quiz-phase-transition')) return;
      if (!getQuizTransitionTune().continuous) return;
      goToQuizQuestionFromTransition();
    }, remaining);
  }

  function bindQuizTransitionTunePanel() {
    const layer = document.getElementById('quizFullscreenLayer');
    if (!layer || !layer.classList.contains('quiz-phase-transition')) return;
    applyQuizTransitionTune(getQuizTransitionTune());
    const panel = layer.querySelector('[data-quiz-transition-tune-panel]');
    const syncPanel = () => {
      if (!panel) return;
      panel.hidden = !state.quizTransitionPanelOpen;
      panel.setAttribute('aria-hidden', state.quizTransitionPanelOpen ? 'false' : 'true');
    };
    syncPanel();
    layer.querySelectorAll('[data-quiz-transition-panel-toggle]').forEach((button) => {
      button.addEventListener('click', () => {
        state.quizTransitionPanelOpen = !state.quizTransitionPanelOpen;
        syncPanel();
      });
    });
    layer.querySelectorAll('[data-quiz-transition-panel-close]').forEach((button) => {
      button.addEventListener('click', () => {
        state.quizTransitionPanelOpen = false;
        syncPanel();
      });
    });
    layer.querySelectorAll('[data-quiz-transition-tune]').forEach((input) => {
      input.addEventListener('change', () => {
        const key = input.dataset.quizTransitionTune;
        const tune = getQuizTransitionTune();
        tune[key] = Boolean(input.checked);
        const safeTune = applyQuizTransitionTune(saveQuizTransitionTune(tune));
        if (key === 'continuous' && safeTune.continuous) scheduleQuizTransitionContinuousAdvance();
      });
    });
    layer.querySelectorAll('[data-quiz-sound-toggle]').forEach((input) => {
      input.checked = quizSoundsEnabled();
      input.addEventListener('change', () => {
        state.prefs.quizSounds = Boolean(input.checked);
        localStorage.setItem('encisomath:prefs', JSON.stringify(state.prefs));
        if (state.prefs.quizSounds === false) stopQuizQuestionMusic(false);
        document.querySelectorAll('[data-quiz-sound-toggle]').forEach((toggle) => { toggle.checked = state.prefs.quizSounds !== false; });
        if (state.prefs.quizSounds !== false) {
          preloadQuizSounds();
          if (state.quizFullscreenActive) startQuizQuestionMusic(getCurrentQuizQuestion());
        }
      });
    });

    layer.querySelectorAll('[data-quiz-transition-action]').forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.dataset.quizTransitionAction;
        const quiz = getActiveQuiz();
        const total = Array.isArray(quiz?.questions) ? quiz.questions.length : 0;
        if (!quiz || !total) return;
        if (action === 'restart') {
          showQuizItemTransition(state.quizQuestionIndex);
          return;
        }
        if (action === 'question') {
          goToQuizQuestionFromTransition();
          return;
        }
        if (action === 'prev') {
          showQuizItemTransition(Math.max(0, state.quizQuestionIndex - 1));
          return;
        }
        if (action === 'next') {
          showQuizItemTransition(Math.min(total - 1, state.quizQuestionIndex + 1));
        }
      });
    });
  }



  function quizItemMotionStageFrom(root = document) {
    const stage = root?.matches?.('.quiz-stage-fullscreen') ? root : root?.querySelector?.('.quiz-stage-fullscreen');
    if (!stage || !stage.classList?.contains('quiz-stage-fullscreen')) return null;
    return stage;
  }

  function quizItemMotionLayerFrom(stage) {
    return stage?.closest?.('.quiz-fullscreen-layer') || document.getElementById('quizFullscreenLayer') || document;
  }

  function quizItemMotionParts(stage) {
    const layer = quizItemMotionLayerFrom(stage);
    const top = layer?.querySelector?.('.quiz-fullscreen-top') || null;
    const title = top?.querySelector?.(':scope > div') || null;
    const counter = top?.querySelector?.('.quiz-top-counter') || null;
    const info = stage?.querySelector?.('.quiz-eyebrow') || null;
    const item = stage?.querySelector?.('.quiz-timer-pill') || null;
    const gear = stage?.querySelector?.('.quiz-layout-tune-open') || null;
    const image = stage?.querySelector?.('.quiz-image-tune-box') || null;
    const text = stage?.querySelector?.('.quiz-text-a') || null;
    const options = stage?.querySelector?.('.quiz-answer-zone') || null;
    return { layer, top, title, counter, info, item, gear, image, text, options };
  }

  function uniqueQuizItemMotionNodes(nodes) {
    const seen = new Set();
    return nodes.filter((node) => {
      if (!node || seen.has(node)) return false;
      seen.add(node);
      return true;
    });
  }

  function quizItemMotionPieces(stage) {
    if (!stage) return [];
    const parts = quizItemMotionParts(stage);
    return uniqueQuizItemMotionNodes([
      parts.top,
      parts.title,
      parts.counter,
      parts.info,
      parts.item,
      parts.gear,
      parts.image,
      parts.text,
      parts.options
    ]);
  }

  function quizItemMotionStagePieces(stage) {
    if (!stage) return [];
    const parts = quizItemMotionParts(stage);
    return uniqueQuizItemMotionNodes([
      parts.info,
      parts.item,
      parts.gear,
      parts.image,
      parts.text,
      parts.options
    ]);
  }

  function quizItemMotionTopPieces(stage) {
    if (!stage) return [];
    const parts = quizItemMotionParts(stage);
    return uniqueQuizItemMotionNodes([
      parts.top,
      parts.title,
      parts.counter
    ]);
  }

  function resetQuizItemFlowNode(node) {
    if (!node) return;
    try {
      node.getAnimations?.().forEach((anim) => {
        const id = String(anim.id || '');
        const name = String(anim.animationName || '');
        if (id.startsWith('quiz-item-motion-') || name === 'encisoFlowIn' || name === 'encisoFlowOut') anim.cancel();
      });
    } catch (_) {}
    node.classList?.remove?.('enciso-flow-in', 'enciso-flow-out', 'quiz-item-flow-piece');
    node.style.animationDelay = '';
    node.style.removeProperty('--quiz-item-flow-delay');
  }

  function cancelQuizItemMotion(node) {
    if (!node) return;
    resetQuizItemFlowNode(node);
    try {
      node.getAnimations?.().forEach((anim) => {
        if (String(anim.id || '').startsWith('quiz-item-motion-')) anim.cancel();
      });
    } catch (_) {}
  }

  function applyQuizItemFlow(node, mode, delay = 0) {
    if (!node) return;
    resetQuizItemFlowNode(node);
    node.classList.add('quiz-item-flow-piece');
    node.style.setProperty('--quiz-item-flow-delay', `${Math.max(0, Number(delay) || 0)}ms`);
    node.style.animationDelay = `var(--quiz-item-flow-delay)`;
    void node.offsetWidth;
    node.classList.add(mode === 'out' ? 'enciso-flow-out' : 'enciso-flow-in');
    if (mode !== 'out') {
      const cleanup = () => {
        node.removeEventListener('animationend', cleanup);
        if (node.classList.contains('enciso-flow-in')) {
          node.classList.remove('enciso-flow-in', 'quiz-item-flow-piece');
          node.style.animationDelay = '';
          node.style.removeProperty('--quiz-item-flow-delay');
        }
      };
      node.addEventListener('animationend', cleanup, { once: true });
    }
  }

  function playQuizItemEnterMotion(root = document) {
    const stage = quizItemMotionStageFrom(root);
    if (!stage) return;
    const parts = quizItemMotionParts(stage);
    stage.classList.remove('quiz-item-motion-exiting');
    parts.layer?.classList?.remove?.('quiz-item-motion-exiting');
    stage.dataset.quizItemMotion = 'entering';
    cancelQuizItemMotion(stage);
    quizItemMotionTopPieces(stage).forEach(cancelQuizItemMotion);

    const topDelay = 0;
    const titleDelay = 85;
    const counterDelay = 150;
    const stageDelay = 230;
    const stageDuration = 240;
    const innerStart = stageDelay + 150;
    const innerStagger = 70;

    applyQuizItemFlow(parts.top, 'in', topDelay);
    applyQuizItemFlow(parts.title, 'in', titleDelay);
    applyQuizItemFlow(parts.counter, 'in', counterDelay);
    parts.layer?.classList?.remove?.('quiz-item-motion-ready');

    try {
      const stageAnim = stage.animate([
        { opacity: 0 },
        { opacity: 1 }
      ], { duration: stageDuration, delay: stageDelay, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'both' });
      stageAnim.id = 'quiz-item-motion-stage-enter';
      stageAnim.onfinish = () => {
        stage.classList.remove('quiz-item-enter-ready');
        parts.layer?.classList?.remove?.('quiz-item-motion-ready');
        stage.style.opacity = '';
        delete stage.dataset.quizItemMotion;
      };
    } catch (_) {
      stage.classList.remove('quiz-item-enter-ready');
      parts.layer?.classList?.remove?.('quiz-item-motion-ready');
    }

    quizItemMotionStagePieces(stage).forEach((node, index) => {
      applyQuizItemFlow(node, 'in', innerStart + (index * innerStagger));
    });
  }

  function playQuizItemExitDuringFeedback(stage) {
    stage = quizItemMotionStageFrom(stage);
    if (!stage || stage.dataset.quizItemMotion === 'exiting') return;
    const parts = quizItemMotionParts(stage);
    stage.dataset.quizItemMotion = 'exiting';
    stage.classList.remove('quiz-item-enter-ready');
    stage.classList.add('quiz-item-motion-exiting');
    parts.layer?.classList?.add?.('quiz-item-motion-exiting');
    const stagePieces = quizItemMotionStagePieces(stage).slice().reverse();
    const topPieces = quizItemMotionTopPieces(stage).slice().reverse();
    const pieceDuration = 220;
    const step = 45;
    const startDelay = QUIZ_FEEDBACK_BAND_EXIT_START_MS;
    scheduleQuizTimer(() => {
      stagePieces.forEach((node, index) => {
        applyQuizItemFlow(node, 'out', index * step);
      });
      const stageFadeDelay = Math.max(0, stagePieces.length * step);
      scheduleQuizTimer(() => {
        try {
          const stageAnim = stage.animate([
            { opacity: 1 },
            { opacity: 0 }
          ], { duration: 150, easing: 'ease-out', fill: 'forwards' });
          stageAnim.id = 'quiz-item-motion-stage-exit';
        } catch (_) {
          stage.style.opacity = '0';
        }
      }, stageFadeDelay);
      const topStart = stageFadeDelay + 95;
      topPieces.forEach((node, index) => {
        applyQuizItemFlow(node, 'out', topStart + (index * step));
      });
    }, startDelay);
  }

  function quizFeedbackMiniTuneBoxHTML() {
    const tune = getQuizFeedbackTune();
    const allowed = new Set(['emojiX','emojiY','emojiZoom','titleX','titleY','titleSize','titleWidth','textX','textY','textSize','textWidth','bounceDuration']);
    const fields = QUIZ_FEEDBACK_TUNE_FIELDS.filter((field) => allowed.has(field.key));
    return `
      <div class="quiz-feedback-mini-tune-box">
        <strong>Banda Correcto / Incorrecto</strong>
        <small>Ajusta emoji, título, subtítulo y duración total del bounce.</small>
        ${fields.map((field) => `
          <label class="quiz-layout-tune-row quiz-feedback-mini-row">
            <span>${escapeHTML(field.label)} <b data-quiz-feedback-tune-value="${escapeAttr(field.key)}">${tune[field.key]}${field.unit}</b></span>
            <input type="range" min="${field.min}" max="${field.max}" step="${field.step}" value="${tune[field.key]}" data-quiz-feedback-tune="${escapeAttr(field.key)}" />
          </label>
        `).join('')}
        <button class="btn ghost small" type="button" data-quiz-feedback-tune-reset>Restablecer banda</button>
      </div>
    `;
  }

  function quizFeedbackTuneRangeRowHTML(fieldKey) {
    const tune = getQuizFeedbackTune();
    const field = QUIZ_FEEDBACK_TUNE_FIELDS.find((item) => item.key === fieldKey);
    if (!field) return '';
    const value = tune[field.key];
    return `
      <label class="quiz-feedback-tune-row">
        <span class="quiz-feedback-tune-head"><strong>${escapeHTML(field.label)}</strong><output data-quiz-feedback-tune-value="${escapeAttr(field.key)}">${value}${field.unit}</output></span>
        <input type="range" min="${field.min}" max="${field.max}" step="${field.step}" value="${value}" data-quiz-feedback-tune="${escapeAttr(field.key)}" />
      </label>
    `;
  }

  function quizFeedbackContinueControlHTML(last = false) {
    return `
      <div class="quiz-feedback-continue-control" data-quiz-feedback-simple-continue>
        <button class="primary-btn small" type="button" data-quiz-feedback-continue>${last ? 'Ver resultados' : 'Continuar'}</button>
      </div>`;
  }

  function bindQuizFeedbackContinueControl() {
    document.querySelectorAll('[data-quiz-feedback-continue]').forEach((button) => {
      if (button.dataset.boundContinue === 'true') return;
      button.dataset.boundContinue = 'true';
      button.addEventListener('click', continueQuizAfterFeedback);
    });
  }

  function quizFeedbackTunePanelHTML(options = {}) {
    const tune = getQuizFeedbackTune();
    return `
      <section class="quiz-feedback-tune-panel ${options.live ? 'is-live' : ''}" data-quiz-feedback-tune-live="${options.live ? 'true' : 'false'}" aria-label="Ajuste temporal de la banda de feedback">
        <div class="quiz-feedback-tune-title">Ajuste temporal banda quiz · v0.24.166</div>
        <div class="quiz-feedback-tune-help">El avance está pausado. Ajusta título/subtítulo y pulsa Continuar.</div>
        <div class="quiz-feedback-tune-scroll">
          <div class="quiz-feedback-tune-group">
            <h4>Banda</h4>
            ${quizFeedbackTuneRangeRowHTML('bandZoom')}
            ${quizFeedbackTuneRangeRowHTML('bandRotation')}
          </div>
          <div class="quiz-feedback-tune-group">
            <h4>Título</h4>
            <label class="quiz-feedback-tune-row">
              <span class="quiz-feedback-tune-head"><strong>Fuente título</strong></span>
              <select class="quiz-feedback-font-select" data-quiz-feedback-font="titlePreset">${quizFontPresetOptionsHTML(tune.titlePreset)}</select>
            </label>
            ${quizFeedbackTuneRangeRowHTML('titleSize')}
            ${quizFeedbackTuneRangeRowHTML('titleY')}
          </div>
          <div class="quiz-feedback-tune-group">
            <h4>Subtítulo</h4>
            <label class="quiz-feedback-tune-row">
              <span class="quiz-feedback-tune-head"><strong>Fuente subtítulo</strong></span>
              <select class="quiz-feedback-font-select" data-quiz-feedback-font="textPreset">${quizFontPresetOptionsHTML(tune.textPreset)}</select>
            </label>
            ${quizFeedbackTuneRangeRowHTML('textSize')}
            ${quizFeedbackTuneRangeRowHTML('textY')}
          </div>
        </div>
        <div class="quiz-feedback-tune-actions one-button">
          <button class="primary-btn small" type="button" data-quiz-feedback-continue>${options.last ? 'Ver resultados' : 'Continuar'}</button>
        </div>
      </section>
    `;
  }

  function bindQuizFeedbackTunePanel() {
    applyQuizFeedbackTune(getQuizFeedbackTune());
    document.querySelectorAll('[data-quiz-feedback-tune]').forEach((input) => {
      if (input.dataset.boundTune === 'true') return;
      input.dataset.boundTune = 'true';
      const updateFeedbackTuneFromInput = () => {
        const current = getQuizFeedbackTune();
        const key = input.dataset.quizFeedbackTune;
        current[key] = Number(input.value);
        saveQuizFeedbackTune(current);
        applyQuizFeedbackTune(current);
        updateQuizFeedbackTuneOutput(key, current[key]);
      };
      input.addEventListener('input', updateFeedbackTuneFromInput);
      input.addEventListener('change', updateFeedbackTuneFromInput);
    });
    document.querySelectorAll('[data-quiz-feedback-font]').forEach((select) => {
      if (select.dataset.boundFeedbackFont === 'true') return;
      select.dataset.boundFeedbackFont = 'true';
      select.addEventListener('change', () => {
        const current = getQuizFeedbackTune();
        const key = select.dataset.quizFeedbackFont;
        current[key] = select.value;
        saveQuizFeedbackTune(current);
        applyQuizFeedbackTune(current);
      });
    });
    document.querySelectorAll('[data-quiz-feedback-tune-reset]').forEach((button) => {
      if (button.dataset.boundTuneReset === 'true') return;
      button.dataset.boundTuneReset = 'true';
      button.addEventListener('click', () => {
        const defaults = saveQuizFeedbackTune({ ...QUIZ_FEEDBACK_TUNE_DEFAULTS });
        applyQuizFeedbackTune(defaults);
        document.querySelectorAll('[data-quiz-feedback-tune]').forEach((input) => {
          const key = input.dataset.quizFeedbackTune;
          input.value = defaults[key];
          updateQuizFeedbackTuneOutput(key, defaults[key]);
        });
        document.querySelectorAll('[data-quiz-feedback-font]').forEach((select) => {
          const key = select.dataset.quizFeedbackFont;
          select.value = defaults[key];
        });
      });
    });
    document.querySelectorAll('[data-quiz-feedback-continue]').forEach((button) => {
      if (button.dataset.boundContinue === 'true') return;
      button.dataset.boundContinue = 'true';
      button.addEventListener('click', continueQuizAfterFeedback);
    });
  }

  function getQuizFeedbackTune() {
    return readQuizFeedbackTune();
  }

  function readQuizFeedbackTune() {
    try {
      return normalizeQuizFeedbackTune(JSON.parse(localStorage.getItem(QUIZ_FEEDBACK_TUNE_KEY) || '{}'));
    } catch (_) {
      return { ...QUIZ_FEEDBACK_TUNE_DEFAULTS };
    }
  }

  function normalizeQuizFeedbackTune(tune = {}) {
    const normalized = { ...QUIZ_FEEDBACK_TUNE_DEFAULTS };
    QUIZ_FEEDBACK_TUNE_FIELDS.forEach((field) => {
      const raw = Number(tune[field.key]);
      normalized[field.key] = Number.isFinite(raw) ? Math.max(field.min, Math.min(field.max, raw)) : QUIZ_FEEDBACK_TUNE_DEFAULTS[field.key];
    });
    const presetValues = new Set(QUIZ_FONT_PRESETS.map((item) => item.value));
    normalized.titlePreset = presetValues.has(String(tune.titlePreset || '')) ? String(tune.titlePreset) : QUIZ_FEEDBACK_TUNE_DEFAULTS.titlePreset;
    normalized.textPreset = presetValues.has(String(tune.textPreset || '')) ? String(tune.textPreset) : QUIZ_FEEDBACK_TUNE_DEFAULTS.textPreset;
    return normalized;
  }

  function saveQuizFeedbackTune(tune) {
    const normalized = normalizeQuizFeedbackTune(tune);
    try { localStorage.setItem(QUIZ_FEEDBACK_TUNE_KEY, JSON.stringify(normalized)); } catch (_) {}
    return normalized;
  }

  function updateQuizFeedbackTuneOutput(key, value) {
    const field = QUIZ_FEEDBACK_TUNE_FIELDS.find((item) => item.key === key);
    if (!field) return;
    document.querySelectorAll(`[data-quiz-feedback-tune-value="${escapeSelector(key)}"]`).forEach((output) => {
      output.textContent = `${value}${field.unit}`;
    });
  }

  function applyQuizFeedbackTune(tune = getQuizFeedbackTune()) {
    const root = document.documentElement;
    const safe = normalizeQuizFeedbackTune(tune);
    root.style.setProperty('--quiz-feedback-band-rotation', `${safe.bandRotation}deg`);
    root.style.setProperty('--quiz-feedback-band-x', `${safe.bandX}px`);
    root.style.setProperty('--quiz-feedback-band-y', `${safe.bandY}px`);
    root.style.setProperty('--quiz-feedback-band-width', `${safe.bandWidth}vw`);
    root.style.setProperty('--quiz-feedback-band-height', `${safe.bandHeight}px`);
    root.style.setProperty('--quiz-feedback-band-scale', `${safe.bandZoom / 100}`);
    root.style.setProperty('--quiz-feedback-emoji-x', `${safe.emojiX}px`);
    root.style.setProperty('--quiz-feedback-emoji-y', `${safe.emojiY}px`);
    root.style.setProperty('--quiz-feedback-emoji-scale', `${safe.emojiZoom / 100}`);
    root.style.setProperty('--quiz-feedback-title-x', `${safe.titleX}px`);
    root.style.setProperty('--quiz-feedback-title-y', `${safe.titleY}px`);
    root.style.setProperty('--quiz-feedback-title-size', `${safe.titleSize}px`);
    root.style.setProperty('--quiz-feedback-title-width', `${safe.titleWidth}vw`);
    root.style.setProperty('--quiz-feedback-text-x', `${safe.textX}px`);
    root.style.setProperty('--quiz-feedback-text-y', `${safe.textY}px`);
    root.style.setProperty('--quiz-feedback-text-size', `${safe.textSize}px`);
    root.style.setProperty('--quiz-feedback-text-width', `${safe.textWidth}vw`);
    document.querySelectorAll('[data-quiz-global-feedback-band]').forEach((band) => {
      applyInlineFeedbackBandStyles(band, band.dataset.feedbackKind || 'neutral');
    });
  }

  function bindQuizPlayerEvents() {
    document.querySelectorAll('[data-quiz-start-confirm]').forEach((button) => {
      button.addEventListener('click', beginQuizFromConfirm);
    });
    document.querySelectorAll('[data-quiz-result-target]').forEach((button) => {
      button.addEventListener('click', () => closeQuizFullscreen(button.dataset.quizResultTarget || 'quizzes'));
    });
    document.querySelectorAll('[data-quiz-restart]').forEach((button) => {
      button.addEventListener('click', () => restartQuiz());
    });
    document.querySelectorAll('[data-quiz-security-continue]').forEach((button) => {
      button.addEventListener('click', continueQuizAfterSecurityWarning);
    });
    document.querySelectorAll('[data-quiz-prev]').forEach((button) => {
      button.addEventListener('click', () => moveQuizQuestion(-1));
    });
    document.querySelectorAll('[data-quiz-next]').forEach((button) => {
      button.addEventListener('click', () => moveQuizQuestion(1));
    });
    document.querySelectorAll('[data-quiz-jump]').forEach((button) => {
      button.addEventListener('click', () => jumpQuizQuestion(Number(button.dataset.quizJump)));
    });
    document.querySelectorAll('[data-quiz-answer]').forEach((button) => {
      if (button.matches?.('[data-quiz-flip-card]')) return;
      button.addEventListener('pointerdown', () => pressQuizAnswer(button), { passive: true });
      button.addEventListener('click', () => handleQuizAnswer(button));
    });
    document.querySelectorAll('[data-quiz-image]').forEach((button) => {
      button.addEventListener('click', () => openQuizImageModal(button.dataset.quizImage, button.dataset.quizImageAlt));
    });
    document.querySelectorAll('[data-quiz-open-form]').forEach((form) => {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        handleOpenAnswer(form);
      });
    });
    bindQuizLayoutTunePanel();
    bindQuizTransitionTunePanel();
    bindQuizRankingPodiumTunePanel();
    bindQuizFlipEvents();
    bindQuizOrderEvents();
    applyQuizTypographyTune(getQuizTypographyTune());
  }


  function bindQuizSecurityGuards() {
    if (!QUIZ_SECURITY_ENABLED) return;
    if (state.quizSecurityGuardsBound) return;
    state.quizSecurityGuardsBound = true;

    document.addEventListener('visibilitychange', () => {
      if (!isQuizSecurityActive()) return;
      if (document.visibilityState === 'hidden') {
        state.quizSecurityHiddenPending = true;
        return;
      }
      if (state.quizSecurityHiddenPending) {
        state.quizSecurityHiddenPending = false;
        handleQuizSuspiciousAction('cambio de pantalla, app o pestaña');
      }
    });

    window.addEventListener('blur', () => {
      if (!isQuizSecurityActive()) return;
      state.quizSecurityFocusPending = true;
    });

    window.addEventListener('focus', () => {
      if (!isQuizSecurityActive() || !state.quizSecurityFocusPending) return;
      state.quizSecurityFocusPending = false;
      handleQuizSuspiciousAction('pérdida de foco de la ventana');
    });

    document.addEventListener('contextmenu', (event) => {
      if (!isQuizSecurityActive()) return;
      event.preventDefault();
      handleQuizSuspiciousAction('menú contextual');
    });

    ['copy', 'cut', 'paste'].forEach((type) => {
      document.addEventListener(type, (event) => {
        if (!isQuizSecurityActive()) return;
        event.preventDefault();
        handleQuizSuspiciousAction(type === 'paste' ? 'pegar contenido' : 'copiar contenido');
      });
    });

    document.addEventListener('keydown', (event) => {
      if (!isQuizSecurityActive()) return;
      const key = String(event.key || '').toLowerCase();
      const suspiciousCombo = (event.ctrlKey || event.metaKey) && ['c', 'v', 'x', 's', 'p', 'u', 'a'].includes(key);
      const suspiciousKey = key === 'printscreen' || key === 'f12';
      if (!suspiciousCombo && !suspiciousKey) return;
      event.preventDefault();
      handleQuizSuspiciousAction(suspiciousKey ? 'captura/inspección' : 'atajo del teclado');
    }, true);

    window.addEventListener('beforeunload', (event) => {
      if (!isQuizSecurityActive()) return;
      event.preventDefault();
      event.returnValue = '';
    });
  }

  function isQuizSecurityActive() {
    if (!QUIZ_SECURITY_ENABLED) return false;
    const session = getQuizSession();
    if (!state.quizFullscreenActive) return false;
    if (session.phase === 'results' || session.phase === 'confirm' || session.phase === 'idle') return false;
    if (session.securityTerminated) return false;
    return true;
  }

  function handleQuizSuspiciousAction(reason = 'acción sospechosa') {
    const session = getQuizSession();
    if (!isQuizSecurityActive()) return;
    const now = Date.now();
    if (now < Number(state.quizSecurityGraceUntil || 0)) return;
    if (session.securityWarningOpen) return;
    if (now - Number(state.quizSecurityLastEventAt || 0) < 900) return;
    state.quizSecurityLastEventAt = now;

    const event = { reason, at: now, questionIndex: state.quizQuestionIndex, phase: session.phase || 'question' };
    session.securityEvents = Array.isArray(session.securityEvents) ? session.securityEvents : [];
    session.securityEvents.push(event);
    logQuizSecurityEvent(event);

    if (session.securityEvents.length === 1) {
      session.securityWarningOpen = true;
      showQuizSecurityWarningModal(reason);
      return;
    }

    finishQuizBySecurity(reason);
  }

  function logQuizSecurityEvent(event) {
    try {
      const quiz = getActiveQuiz();
      const key = `encisomath:quizSecurityLog:${quiz?.id || 'quiz'}`;
      const current = readJSON(key) || [];
      current.push({
        ...event,
        quizId: quiz?.id || '',
        assignmentId: state.assignment?.id || '',
        userId: state.user?.id || '',
        userName: state.user?.fullName || state.user?.name || ''
      });
      localStorage.setItem(key, JSON.stringify(current.slice(-80)));
    } catch (_) {}
  }

  function showQuizSecurityWarningModal(reason = '') {
    const existing = document.getElementById('quizSecurityModal');
    if (existing) existing.remove();
    const wrapper = document.createElement('div');
    wrapper.id = 'quizSecurityModal';
    wrapper.className = 'modal-layer quiz-security-layer';
    wrapper.innerHTML = quizSecurityWarningHTML(reason);
    document.body.appendChild(wrapper);
    document.body.classList.add('modal-open', 'quiz-security-warning-open');
    requestAnimationFrame(() => requestAnimationFrame(() => wrapper.classList.add('show')));
    wrapper.querySelector('[data-quiz-security-continue]')?.addEventListener('click', continueQuizAfterSecurityWarning);
    startDeleteWarningMotion();
  }

  function quizSecurityWarningHTML(reason = '') {
    return `
      <div class="modal-card danger-modal quiz-security-modal" role="dialog" aria-modal="true" aria-label="Advertencia de seguridad del quiz">
        <div class="danger-head">
          <span class="danger-red-mesh" aria-hidden="true"></span>
          <div class="warning-tune-stack">
            <div class="warning-icon quiz-security-emoji" aria-hidden="true">😡</div>
          </div>
          <div class="danger-copy">
            <h2>HEY, PILAS CON LO QUE HACES</h2>
            <p>Vuelves a hacerlo y te anulo el quiz.</p>
          </div>
        </div>
        <div class="danger-body">
          <div class="delete-target quiz-security-target">
            <strong>Intento sospechoso detectado</strong>
            <span>${escapeHTML(reason || 'Cambiaste de pantalla, app, pestaña o intentaste salir del quiz.')}</span>
          </div>
          <div class="danger-actions quiz-security-actions">
            <button class="danger-confirm" type="button" data-quiz-security-continue>Continuar quiz</button>
          </div>
        </div>
      </div>
    `;
  }

  function continueQuizAfterSecurityWarning() {
    const layer = document.getElementById('quizSecurityModal');
    const session = getQuizSession();
    session.securityWarningOpen = false;
    document.body.classList.remove('quiz-security-warning-open');
    if (!document.getElementById('modalLayer')) document.body.classList.remove('modal-open');
    if (layer) {
      layer.classList.remove('show');
      window.setTimeout(() => layer.remove(), 160);
    }
    if (state.quizFullscreenActive) {
      try { window.history.pushState({ encisomathQuizLock: true }, '', window.location.href); } catch (_) {}
    }
  }

  function finishQuizBySecurity(reason = '') {
    const layer = document.getElementById('quizSecurityModal');
    if (layer) layer.remove();
    document.body.classList.remove('quiz-security-warning-open');
    if (!document.getElementById('modalLayer')) document.body.classList.remove('modal-open');
    clearQuizTimers();
    const session = getQuizSession();
    session.securityWarningOpen = false;
    session.securityTerminated = true;
    session.securityTerminatedReason = reason || 'Segundo intento sospechoso';
    session.phase = 'results';
    session.locked = false;
    showQuizResults();
  }

  function requestQuizFullscreenMode() {
    if (!QUIZ_SECURITY_ENABLED) return;
    const layer = document.getElementById('quizFullscreenLayer') || document.documentElement;
    try {
      const request = layer.requestFullscreen || layer.webkitRequestFullscreen || layer.msRequestFullscreen;
      if (request && !document.fullscreenElement && !document.webkitFullscreenElement) request.call(layer).catch?.(() => {});
    } catch (_) {}
  }

  function exitQuizFullscreenMode() {
    try {
      const exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
      if (exit && (document.fullscreenElement || document.webkitFullscreenElement)) exit.call(document).catch?.(() => {});
    } catch (_) {}
  }

  function setQuizPeriod(period) {
    if (![1, 2, 3, 4].includes(Number(period))) return;
    if (Number(state.quizPeriod) === Number(period)) return;
    const previous = document.querySelector(`[data-quiz-period="${state.quizPeriod}"]`);
    const next = document.querySelector(`[data-quiz-period="${period}"]`);
    previous?.classList.remove('active');
    next?.classList.add('active');
    pulseElement(previous, 'period-shift');
    pulseElement(next, 'period-shift');
    state.quizPeriod = Number(period);
    state.quizQuestionIndex = 0;
    state.quizActiveId = '';
    localStorage.setItem('encisomath:quizPeriod', String(state.quizPeriod));
    refreshQuizLibrary(true);
  }

  function refreshQuizLibrary(animate = false) {
    const library = document.getElementById('quizLibrary');
    if (!library) return;
    const quizzes = getQuizzesForCurrentAssignment();
    const activeQuiz = getActiveQuiz(quizzes);
    library.innerHTML = quizzes.map((quiz) => quizCardButtonHTML(quiz, activeQuiz?.id === quiz.id)).join('') || `<div class="empty">Aún no hay quizzes para este periodo.</div>`;
    const note = document.getElementById('quizLaunchNote');
    if (note) note.hidden = !activeQuiz;
    bindQuizTabEvents();
    if (animate) pulseElement(library, 'class-grid-update');
  }

  function setActiveQuiz(quizId) {
    state.quizActiveId = quizId;
    state.quizQuestionIndex = 0;
    localStorage.setItem('encisomath:quizActiveId', quizId);
    renderQuizzesTab({ animate: true });
  }

  function jumpQuizQuestion(index) {
    const quiz = getActiveQuiz();
    if (!quiz || !Array.isArray(quiz.questions)) return;
    const max = quiz.questions.length - 1;
    state.quizQuestionIndex = Math.max(0, Math.min(max, Number(index) || 0));
    clearQuizTimers();
    const session = getQuizSession();
    session.phase = 'question';
    session.locked = false;
    session.selectedAnswerId = '';
    session.feedback = null;
    renderQuizFullscreen(quiz);
  }

  function moveQuizQuestion(delta) {
    const quiz = getActiveQuiz();
    if (!quiz || !Array.isArray(quiz.questions)) return;
    const max = quiz.questions.length - 1;
    const nextIndex = Math.max(0, Math.min(max, state.quizQuestionIndex + Number(delta)));
    if (state.quizFullscreenActive) {
      showQuizItemTransition(nextIndex);
      return;
    }
    state.quizQuestionIndex = nextIndex;
    const player = document.getElementById('quizPlayer');
    if (!player) return;
    player.innerHTML = quizPlayerHTML(quiz);
    bindQuizPlayerEvents();
    pulseElement(player, 'class-grid-update');
  }

  function pressQuizAnswer(button) {
    if (!button || getQuizSession().locked) return;
    button.classList.remove('is-pressing');
    void button.offsetWidth;
    button.classList.add('is-pressing');
    window.setTimeout(() => button.classList.remove('is-pressing'), 160);
  }

  function getCurrentQuizQuestion() {
    const quiz = getActiveQuiz();
    if (!quiz || !Array.isArray(quiz.questions)) return null;
    return quiz.questions[state.quizQuestionIndex] || null;
  }

  function handleQuizAnswer(button) {
    const stage = button?.closest('.quiz-stage');
    const question = getCurrentQuizQuestion();
    const session = getQuizSession();
    if (!button || !stage || !question || session.locked) return;

    session.locked = true;
    session.selectedAnswerId = button.dataset.quizAnswer || '';
    stage.classList.add('quiz-choice-pending');
    stage.querySelectorAll('[data-quiz-answer]').forEach((item) => {
      item.disabled = true;
      item.classList.remove('correct', 'wrong', 'correct-reveal', 'wrong-reveal', 'selected', 'is-pressing');
      item.classList.toggle('selected', item === button);
      item.classList.toggle('is-dimmed', item !== button);
    });

    const selectedCorrect = button.dataset.correct === 'true';
    scheduleQuizTimer(() => {
      revealQuizAnswer(stage, button, selectedCorrect);
      playQuizSound(selectedCorrect ? 'correct' : 'wrong');
      recordQuizAnswer(question, selectedCorrect, { selected: session.selectedAnswerId });
      showQuizFeedbackBandAfterDelay(stage, selectedCorrect, question, '', QUIZ_FEEDBACK_AFTER_CHOICE_REVEAL_MS);
    }, 1000);
  }

  function revealQuizAnswer(stage, selectedButton, selectedCorrect) {
    stage.classList.remove('quiz-choice-pending');
    stage.classList.add('quiz-choice-revealed');
    const items = Array.from(stage.querySelectorAll('[data-quiz-answer]'));
    const revealItems = [];
    items.forEach((item) => {
      const isCorrect = item.dataset.correct === 'true';
      const isWrongSelection = item === selectedButton && !selectedCorrect;
      const unused = !isCorrect && !isWrongSelection;
      item.classList.remove('selected', 'correct-reveal', 'wrong-reveal', 'unused-reveal', 'kahoot-reveal-pop', 'kahoot-reveal-wrong', 'kahoot-reveal-correct');
      item.classList.toggle('is-dimmed', unused);
      item.classList.toggle('unused-reveal', unused);
      if (isCorrect || isWrongSelection) revealItems.push({ item, isCorrect });
    });
    revealItems.forEach(({ item, isCorrect }, index) => {
      scheduleQuizTimer(() => {
        item.classList.remove('is-dimmed');
        item.classList.add(isCorrect ? 'correct-reveal' : 'wrong-reveal', 'kahoot-reveal-pop', isCorrect ? 'kahoot-reveal-correct' : 'kahoot-reveal-wrong');
      }, 90 * index);
    });
  }

  function quizAnswerFeedbackHTML(correct, neutralText = '', question = null) {
    const correctPhrases = [
      'Esa neurona vino con turbo.',
      'Respuesta nivel crack. Siga brillando.',
      'Bien jugado. Punto para la mente matemática.',
      'Así se responde, sin despeinarse.',
      'Modo leyenda activado.'
    ];
    const wrongPhrases = [
      'Sacúdete el polvo. La grandeza espera.',
      'Casi, pero la opción correcta se escondió bien.',
      'Error con estilo. Respira y vamos por la siguiente.',
      'La respuesta se fue por la tangente.',
      'Ups, el cálculo pidió revisión.'
    ];
    if (neutralText) {
      const neutralTitle = question?.type === 'open' ? 'Listo' : 'Respuesta enviada';
      return `<div class="quiz-feedback-card is-neutral"><span>✍️</span><strong>${neutralTitle}</strong><p>${escapeHTML(neutralText)}</p></div>`;
    }
    const session = getQuizSession();
    const correctCount = session.answers.filter((answer) => answer.correct === true).length;
    const wrongCount = session.answers.filter((answer) => answer.correct === false).length;
    const correctEmoji = correctCount >= 5 ? '😎' : ['🫡', '😃', '😏', '🤩'][Math.max(0, correctCount - 1)] || '🫡';
    let wrongEmoji = wrongCount >= 5 ? '☠️' : ['😬', '😕', '😨', '🥶'][Math.max(0, wrongCount - 1)] || '😬';
    if (question?.type === 'true_false' && correct === false) wrongEmoji = '😒';
    const phrase = correct
      ? correctPhrases[(correctCount - 1 + correctPhrases.length) % correctPhrases.length]
      : wrongPhrases[(wrongCount - 1 + wrongPhrases.length) % wrongPhrases.length];
    const emoji = correct ? correctEmoji : wrongEmoji;
    return `<div class="quiz-feedback-card ${correct ? 'is-correct' : 'is-wrong'}"><span>${emoji}</span><strong>${correct ? '¡Correcto!' : '¡Incorrecto!'}</strong><p>${escapeHTML(phrase)}</p></div>`;
  }

  function removeQuizGlobalFeedback() {
    if (window.__encisomathQuizFeedbackShowTimer) {
      window.clearTimeout(window.__encisomathQuizFeedbackShowTimer);
      window.__encisomathQuizFeedbackShowTimer = null;
    }
    if (window.__encisomathQuizFeedbackTimer) {
      window.clearTimeout(window.__encisomathQuizFeedbackTimer);
      window.__encisomathQuizFeedbackTimer = null;
    }
    document.querySelectorAll('[data-quiz-global-feedback], .enciso-quiz-feedback-overlay-v95, .enciso-quiz-feedback-overlay-v97, .enciso-quiz-feedback-overlay-v99, .enciso-quiz-feedback-overlay-v102').forEach((node) => node.remove());
    document.querySelectorAll('.quiz-stage.quiz-feedback-visible').forEach((stage) => stage.classList.remove('quiz-feedback-visible'));
  }

  function ensureQuizGlobalFeedbackStyles() {
    // v0.24.106: the feedback overlay uses inline styles and Web Animations.
    // This intentionally bypasses the accumulated old .quiz-feedback-card CSS rules.
  }

  function quizFeedbackParts(correct, neutralText = '', question = null) {
    if (neutralText) {
      return {
        kind: 'neutral',
        emoji: '',
        title: question?.type === 'open' ? 'Listo' : 'Respuesta enviada',
        phrase: 'Tu respuesta quedó guardada.'
      };
    }
    const correctPhrases = [
      'Muy bien, sigue así.',
      'Respuesta correcta.',
      'Excelente trabajo.',
      'Punto para ti.',
      'Lo lograste.'
    ];
    const wrongPhrases = [
      'Revisa y continúa.',
      'No era esa opción.',
      'Inténtalo en la próxima.',
      'Sigue practicando.',
      'Vamos con la siguiente.'
    ];
    const session = getQuizSession();
    const correctCount = session.answers.filter((answer) => answer.correct === true).length;
    const wrongCount = session.answers.filter((answer) => answer.correct === false).length;
    return correct
      ? { kind: 'correct', emoji: '', title: '¡Correcto!', phrase: correctPhrases[(correctCount - 1 + correctPhrases.length) % correctPhrases.length] }
      : { kind: 'wrong', emoji: '', title: '¡Incorrecto!', phrase: wrongPhrases[(wrongCount - 1 + wrongPhrases.length) % wrongPhrases.length] };
  }

  function quizGlobalFeedbackHTML(correct, neutralText = '', question = null) {
    const parts = quizFeedbackParts(correct, neutralText, question);
    return `
      <span class="enciso-quiz-feedback-mesh-v102" aria-hidden="true"></span>
      <strong class="enciso-quiz-feedback-title-v102">${escapeHTML(parts.title)}</strong>
      <p class="enciso-quiz-feedback-phrase-v102">${escapeHTML(parts.phrase)}</p>
    `;
  }

  function applyInlineFeedbackBandStyles(band, kind = 'neutral') {
    if (!band) return;
    const safe = getQuizFeedbackTune();
    const isCorrect = kind === 'correct';
    const isWrong = kind === 'wrong';
    const baseA = isCorrect ? 'rgba(88,204,2,.92)' : isWrong ? 'rgba(226,27,60,.92)' : 'rgba(19,104,206,.90)';
    const baseB = isCorrect ? 'rgba(15,95,24,.96)' : isWrong ? 'rgba(96,9,28,.96)' : 'rgba(8,31,77,.96)';
    const glow = isCorrect ? 'rgba(88,204,2,.30)' : isWrong ? 'rgba(226,27,60,.30)' : 'rgba(19,104,206,.24)';
    const line = isCorrect ? 'rgba(214,255,201,.30)' : isWrong ? 'rgba(255,216,224,.28)' : 'rgba(219,234,254,.28)';
    const shine = isCorrect ? 'rgba(210,255,191,.30)' : isWrong ? 'rgba(255,210,218,.30)' : 'rgba(219,234,254,.22)';
    const rotation = Number.isFinite(Number(safe.bandRotation)) ? Number(safe.bandRotation) : QUIZ_FEEDBACK_TUNE_DEFAULTS.bandRotation;
    const zoom = (Number(safe.bandZoom) || 100) / 100;
    const bandWidth = Math.max(110, Math.min(180, Number(safe.bandWidth) || QUIZ_FEEDBACK_TUNE_DEFAULTS.bandWidth));
    const bandHeight = Math.max(92, Math.min(156, Number(safe.bandHeight) || QUIZ_FEEDBACK_TUNE_DEFAULTS.bandHeight));
    band.dataset.feedbackKind = kind;
    band.dataset.feedbackRotation = String(rotation);
    band.dataset.feedbackZoom = String(zoom);
    band.style.setProperty('--quiz-feedback-band-rotation', `${rotation}deg`);
    band.style.setProperty('--quiz-feedback-band-scale', String(zoom));
    band.style.cssText = [
      'position:fixed',
      `left:calc(50% + ${Number(safe.bandX) || 0}px)`,
      `top:calc(50% + ${Number(safe.bandY) || 0}px)`,
      `width:${bandWidth}vw`,
      'max-width:1320px',
      'min-width:min(96vw,760px)',
      `height:${bandHeight}px`,
      `min-height:${bandHeight}px`,
      'box-sizing:border-box',
      'border-radius:6px',
      'border:1px solid rgba(255,255,255,.12)',
      'padding:clamp(14px,2.4vw,22px) clamp(20px,5vw,54px)',
      'display:grid',
      'grid-template-columns:minmax(0,1fr)',
      'grid-template-rows:auto auto',
      'grid-template-areas:"title" "phrase"',
      'align-content:center',
      'align-items:center',
      'justify-items:center',
      'justify-content:center',
      'row-gap:clamp(6px,1.2vh,10px)',
      'overflow:hidden',
      `background:radial-gradient(circle at 18% 24%, ${shine}, transparent 32%), radial-gradient(circle at 82% 18%, ${glow}, transparent 34%), linear-gradient(135deg, rgba(6,8,16,.98) 0%, ${baseB} 42%, ${baseA} 100%)`,
      'color:#fff',
      `box-shadow:0 0 0 1px rgba(255,255,255,.08) inset, 0 20px 52px ${glow}, 0 12px 34px rgba(0,0,0,.42)`,
      'filter:none',
      'text-shadow:none',
      'opacity:1',
      `transform:translate(-50%,-50%) rotate(${rotation}deg)`,
      'transform-origin:center center',
      'transform-style:flat',
      `zoom:${zoom}`,
      `--quiz-feedback-band-rotation:${rotation}deg`,
      `--quiz-feedback-band-zoom:${zoom}`,
      'will-change:opacity',
      'pointer-events:none',
      'z-index:2147483000',
      "font-family:'Montserrat',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
    ].join(';') + ';';
    const mesh = band.querySelector('.enciso-quiz-feedback-mesh-v102');
    if (mesh) {
      mesh.style.cssText = [
        'position:absolute', 'inset:-20%', 'display:block', 'z-index:0', 'pointer-events:none', 'opacity:.72',
        `background-image:linear-gradient(90deg, ${line} 1px, transparent 1px), linear-gradient(0deg, ${line} 1px, transparent 1px), radial-gradient(circle at 18% 30%, ${glow}, transparent 32%), radial-gradient(circle at 82% 70%, ${glow}, transparent 34%)`,
        'background-size:42px 42px, 42px 42px, 100% 100%, 100% 100%',
        'transform:translate3d(0,0,0)',
        'backface-visibility:hidden',
        'will-change:auto'
      ].join(';') + ';';
      try { mesh.getAnimations?.().forEach((anim) => anim.cancel()); } catch (_) {}
    }
    const titlePreset = quizPresetParts(safe.titlePreset || QUIZ_FEEDBACK_TUNE_DEFAULTS.titlePreset);
    const textPreset = quizPresetParts(safe.textPreset || QUIZ_FEEDBACK_TUNE_DEFAULTS.textPreset);
    const title = band.querySelector('.enciso-quiz-feedback-title-v102');
    if (title) title.style.cssText = [
      'grid-area:title', 'display:block', 'position:relative', 'z-index:1', 'color:#fff',
      `font-size:${Math.max(18, Math.min(54, Number(safe.titleSize) || QUIZ_FEEDBACK_TUNE_DEFAULTS.titleSize))}px`,
      'line-height:1', `font-weight:${titlePreset.weight}`, `font-style:${titlePreset.style}`, 'margin:0', 'white-space:nowrap', 'overflow:hidden', 'text-overflow:ellipsis', 'width:100%', 'max-width:100%', 'text-align:center',
      'text-shadow:0 2px 16px rgba(0,0,0,.32)', 'letter-spacing:-.03em',
      `transform:translate3d(0, ${Number(safe.titleY) || 0}px, 0)`, 'transform-origin:center center'
    ].join(';') + ';';
    const phrase = band.querySelector('.enciso-quiz-feedback-phrase-v102');
    if (phrase) phrase.style.cssText = [
      'grid-area:phrase', 'display:block', 'position:relative', 'z-index:1', 'color:rgba(255,255,255,.94)',
      `font-size:${Math.max(11, Math.min(30, Number(safe.textSize) || QUIZ_FEEDBACK_TUNE_DEFAULTS.textSize))}px`,
      'line-height:1.1', `font-weight:${textPreset.weight}`, `font-style:${textPreset.style}`, 'margin:0', 'width:100%', 'max-width:100%', 'white-space:nowrap', 'overflow:hidden', 'text-overflow:ellipsis', 'text-align:center', 'text-shadow:0 2px 14px rgba(0,0,0,.26)',
      `transform:translate3d(0, ${Number(safe.textY) || 0}px, 0)`, 'transform-origin:center center'
    ].join(';') + ';';
  }

  function startFeedbackMeshDrift(band) {
    const mesh = band?.querySelector?.('.enciso-quiz-feedback-mesh-v102');
    try { mesh?.getAnimations?.().forEach((anim) => anim.cancel()); } catch (_) {}
    if (mesh) {
      mesh.style.transform = 'translate3d(0,0,0)';
      mesh.style.willChange = 'transform';
      try {
        mesh.animate([
          { transform: 'translate3d(0,0,0)' },
          { transform: 'translate3d(-42px,-42px,0)' }
        ], { duration: 9000, iterations: Infinity, easing: 'linear' });
      } catch (_) {
        mesh.style.animation = 'encisoFeedbackMeshDrift140 9s linear infinite';
      }
    }
  }

  function playFeedbackBandAnimation(band) {
    if (!band) return;
    try { band.getAnimations?.().forEach((anim) => anim.cancel()); } catch (_) {}
    band.classList.remove('play-feedback');
    band.style.opacity = '';
    void band.offsetWidth;
    band.classList.add('play-feedback');
    startFeedbackMeshDrift(band);
  }


  function showQuizFeedbackBand(stage, correct, question = null, neutralText = '') {
    removeQuizGlobalFeedback();
    ensureQuizGlobalFeedbackStyles();
    const parts = quizFeedbackParts(correct, neutralText, question);
    const quiz = getActiveQuiz();
    const total = Array.isArray(quiz?.questions) ? quiz.questions.length : 0;
    const last = state.quizQuestionIndex >= total - 1;
    const overlay = document.createElement('div');
    overlay.className = 'enciso-quiz-feedback-overlay-v102 quiz-feedback-stage';
    overlay.dataset.quizGlobalFeedback = 'true';
    overlay.setAttribute('aria-live', 'assertive');
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'width:100vw', 'height:100dvh', 'z-index:2147482500', 'pointer-events:none', 'display:block', 'overflow:visible', 'background:transparent', 'contain:none', 'isolation:isolate', "font-family:'Montserrat',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
    ].join(';') + ';';
    const band = document.createElement('div');
    band.className = 'enciso-quiz-feedback-band-v102 quiz-feedback-band ' + parts.kind;
    band.dataset.quizGlobalFeedbackBand = 'true';
    band.dataset.feedbackKind = parts.kind;
    band.setAttribute('role', 'status');
    band.innerHTML = quizGlobalFeedbackHTML(correct, neutralText, question);
    overlay.appendChild(band);
    document.body.appendChild(overlay);
    applyInlineFeedbackBandStyles(band, parts.kind);
    document.documentElement.dataset.encisoLastFeedback = String(Date.now());
    window.__encisomathLastFeedbackV102 = (window.__encisomathLastFeedbackV102 || 0) + 1;
    playFeedbackBandAnimation(band);
    playQuizItemExitDuringFeedback(stage);
    if (window.__encisomathQuizFeedbackTimer) window.clearTimeout(window.__encisomathQuizFeedbackTimer);
    window.__encisomathQuizFeedbackTimer = window.setTimeout(() => {
      window.__encisomathQuizFeedbackTimer = null;
      continueQuizAfterFeedback();
    }, QUIZ_FEEDBACK_TOTAL_DURATION_MS);
  }

  function showQuizFeedbackBandAfterDelay(stage, correct, question = null, neutralText = '', delayMs = null) {
    const fallbackDelay = neutralText ? QUIZ_FEEDBACK_NEUTRAL_DELAY_MS : QUIZ_FEEDBACK_AFTER_PAINT_DELAY_MS;
    const effectiveDelay = Number.isFinite(Number(delayMs)) ? Math.max(0, Number(delayMs)) : fallbackDelay;
    if (window.__encisomathQuizFeedbackShowTimer) window.clearTimeout(window.__encisomathQuizFeedbackShowTimer);
    window.__encisomathQuizFeedbackShowTimer = window.setTimeout(() => {
      window.__encisomathQuizFeedbackShowTimer = null;
      showQuizFeedbackBand(stage, correct, question, neutralText);
    }, effectiveDelay);
  }

  function recordQuizAnswer(question, correct, extra = {}) {
    const session = getQuizSession();
    const index = Number(state.quizQuestionIndex);
    session.answers = session.answers.filter((answer) => Number(answer.index) !== index);
    session.answers.push({
      index,
      questionId: question?.id || `q${index + 1}`,
      type: question?.type || 'unknown',
      correct,
      ...extra
    });
  }

  function scheduleQuizAdvance() {
    document.querySelectorAll('[data-quiz-feedback-tune-live]').forEach((panel) => panel.remove());
    scheduleQuizTimer(() => continueQuizAfterFeedback(), 4000);
  }

  function showQuizFeedbackTunePanel(stage) {
    if (!stage) return;
    stage.querySelectorAll('[data-quiz-feedback-tune-live]').forEach((panel) => panel.remove());
    const quiz = getActiveQuiz();
    const total = Array.isArray(quiz?.questions) ? quiz.questions.length : 0;
    const last = state.quizQuestionIndex >= total - 1;
    stage.insertAdjacentHTML('beforeend', quizFeedbackTunePanelHTML({ live: true, last }));
  }

  function continueQuizAfterFeedback() {
    removeQuizGlobalFeedback();
    document.querySelectorAll('[data-quiz-feedback-tune-live]').forEach((panel) => panel.remove());
    const quiz = getActiveQuiz();
    if (!quiz || !Array.isArray(quiz.questions)) return;
    if (state.quizQuestionIndex >= quiz.questions.length - 1) {
      showQuizResults();
      return;
    }
    showQuizItemTransition(state.quizQuestionIndex + 1);
  }

  function handleOpenAnswer(form) {
    const session = getQuizSession();
    const question = getCurrentQuizQuestion();
    if (!form || !question || session.locked) return;
    const value = form.querySelector('.quiz-open-input')?.value?.trim() || '';
    session.locked = true;
    const stage = form.closest('.quiz-stage');
    const openTargets = Array.from(form.querySelectorAll('.quiz-open-input, .quiz-submit-btn'));
    form.classList.remove('is-open-submitted');
    openTargets.forEach((item) => {
      if (typeof item.getAnimations === 'function') {
        item.getAnimations().forEach((animation) => animation.cancel());
      }
      item.style.removeProperty('animation');
    });
    void form.offsetWidth;
    form.querySelectorAll('textarea, button').forEach((item) => { item.disabled = true; });
    playQuizSound('type');
    window.requestAnimationFrame(() => {
      form.classList.add('is-open-submitted');
    });
    recordQuizAnswer(question, null, { text: value });
    showQuizFeedbackBandAfterDelay(stage, null, question, value ? 'Tu respuesta quedó registrada en este intento.' : 'Enviada sin texto. La próxima escribe alguito, profe.', 720);
  }

  function startQuiz(quizId) {
    state.quizActiveId = quizId;
    state.quizQuestionIndex = 0;
    state.quizFullscreenActive = false;
    localStorage.setItem('encisomath:quizActiveId', quizId);
    const quiz = getActiveQuiz();
    if (!quiz) return;
    resetQuizSession('confirm');
    openModal(quizStartModalHTML(quiz), () => bindQuizPlayerEvents());
  }

  function beginQuizFromConfirm() {
    const quiz = getActiveQuiz();
    if (!quiz) return;
    closeModal(false);
    preloadQuizSounds();
    startQuizQuestionMusic();
    clearQuizTimers();
    state.quizFullscreenActive = true;
    state.quizSecurityGraceUntil = Date.now() + 2400;
    lockQuizHistory();
    showQuizItemTransition(0, { fromIntro: true });
    requestQuizFullscreenMode();
  }

  function showQuizItemTransition(index = 0, options = {}) {
    const quiz = getActiveQuiz();
    if (!quiz) return;
    clearQuizTimers();
    state.quizQuestionIndex = Math.max(0, Math.min((quiz.questions || []).length - 1, Number(index) || 0));
    const session = getQuizSession();
    session.phase = 'transition';
    session.locked = true;
    session.transitionFromIntro = Boolean(options.fromIntro);
    state.quizTransitionStartedAt = Date.now();
    renderQuizFullscreen(quiz);
    // v0.24.166: por defecto la transicion queda manual. Si se activa "Continuo",
    // avanza a la pregunta al terminar la animacion completa.
  }

  function showQuizResults() {
    stopQuizQuestionMusic(true);
    removeQuizGlobalFeedback();
    const quiz = getActiveQuiz();
    if (!quiz) return;
    clearQuizTimers();
    const session = getQuizSession();
    session.phase = 'results';
    session.locked = false;
    state.quizFullscreenActive = false;
    unlockQuizHistory();
    renderQuizFullscreen(quiz);
  }

  function quizFastNavHTML(total = 0) {
    if (!total) return '';
    const buttons = Array.from({ length: total }, (_, index) => {
      const active = index === state.quizQuestionIndex ? 'active' : '';
      return `<button class="quiz-fast-btn ${active}" type="button" data-quiz-jump="${index}">${index + 1}</button>`;
    }).join('');
    return `<nav class="quiz-fast-nav" aria-label="Navegación rápida de preguntas">${buttons}</nav>`;
  }

  function renderQuizFullscreen(quiz = getActiveQuiz()) {
    removeQuizGlobalFeedback();
    if (!quiz) return;
    let layer = document.getElementById('quizFullscreenLayer');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'quizFullscreenLayer';
      document.body.appendChild(layer);
    }
    document.body.classList.add('quiz-fullscreen-active');
    const session = getQuizSession();
    const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
    const phase = session.phase || 'question';
    const transitionWithIntro = phase === 'transition' && session.transitionFromIntro && state.quizQuestionIndex === 0;
    layer.className = `quiz-fullscreen-layer quiz-phase-${phase}${phase === 'transition' ? ` ${quizTransitionClassNames()}` : ''}${phase === 'transition' && session.transitionFromIntro ? ' quiz-transition-from-intro' : ''}${transitionWithIntro ? ' quiz-transition-with-intro' : ''}${phase === 'question' ? ' quiz-item-motion-ready' : ''}`;
    let content = '';
    if (phase === 'confirm') content = quizStartGateHTML(quiz);
    else if (phase === 'intro') content = quizIntroSplashHTML(quiz);
    else if (phase === 'transition') content = quizItemTransitionHTML(state.quizQuestionIndex + 1, questions.length, quiz, transitionWithIntro);
    else if (phase === 'results') content = quizResultsHTML(quiz);
    else content = quizPlayerHTML(quiz, { fullscreen: true });
    const showTop = phase === 'question';

    layer.innerHTML = `
      <div class="quiz-fullscreen-bg" aria-hidden="true"></div>
      ${phase !== 'confirm' && phase !== 'intro' ? quizSecurityWatermarkHTML() : ''}
      ${showTop ? `<div class="quiz-fullscreen-top ${phase === 'results' ? 'quiz-top-results' : ''}">
        <div>
          <strong>${escapeHTML(quiz.title || 'Quiz')}</strong>
          <small>${phase === 'results' ? 'Quiz finalizado' : (QUIZ_SECURITY_ENABLED ? 'Modo quiz · sin salida hasta finalizar' : 'Modo prueba · protección desactivada')}</small>
        </div>
        <span class="quiz-top-counter">${phase === 'results' ? '<strong>FIN</strong>' : `<small>Ítem</small><strong>${Math.min(state.quizQuestionIndex + 1, questions.length)}/${questions.length}</strong>`}</span>
      </div>` : ''}
      <div class="quiz-fullscreen-content ${phase === 'transition' ? 'quiz-fullscreen-transition-content' : ''}">
        ${content}
      </div>
    `;
    bindQuizPlayerEvents();
    if (phase === 'question') {
      window.requestAnimationFrame(() => {
        playQuizItemEnterMotion(layer);
        startQuizQuestionMusic(getCurrentQuizQuestion());
      });
    } else if (phase === 'transition') {
      startQuizQuestionMusic(getCurrentQuizQuestion());
      playQuizTransitionNumberMotion(layer);
      scheduleQuizTransitionContinuousAdvance();
    } else if (phase === 'results') {
      stopQuizQuestionMusic(true);
    } else if (phase === 'confirm' || phase === 'idle') {
      stopQuizQuestionMusic(false);
    }
  }


  function quizSecurityWatermarkHTML() {
    if (!QUIZ_SECURITY_ENABLED) return '';
    const user = state.user || {};
    const name = user.fullName || user.name || user.username || 'EncisoMath';
    const id = user.id || user.userId || '';
    const assignment = state.assignment || {};
    const course = [assignment.subject, assignment.grade && `${assignment.grade}-${assignment.course}`].filter(Boolean).join(' · ');
    const stamp = new Date().toLocaleString('es-CO', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
    const text = `${name}${id ? ` · ID ${id}` : ''}${course ? ` · ${course}` : ''} · ${stamp}`;
    return `<div class="quiz-security-watermark" aria-hidden="true">${escapeHTML(text)}</div>`;
  }

  function quizStartModalHTML(quiz) {
    const total = Array.isArray(quiz.questions) ? quiz.questions.length : 0;
    return `
      <div class="modal-card quiz-start-modal">
        <button class="modal-close" data-close-modal aria-label="Cerrar">×</button>
        <div class="quiz-start-modal-head">
          <div class="quiz-start-modal-mesh" aria-hidden="true"></div>
          <p class="section-kicker">Antes de empezar</p>
          <h2>¿Iniciarás este quiz?</h2>
          <small>${total} ítems · Periodo ${Number(quiz.period || state.quizPeriod || 1)}</small>
        </div>
        <div class="quiz-start-modal-body">
          <h3>${escapeHTML(quiz.title || 'Quiz')}</h3>
          <p>${escapeHTML(quiz.description || quiz.mode || 'Reto interactivo de práctica.')}</p>
          <div class="quiz-lock-warning">${QUIZ_SECURITY_ENABLED ? '🔒 Cuando empieces, solo podrás salir al finalizar el quiz.' : '🧪 Modo seguro temporalmente desactivado para pruebas.'}</div>
          <button class="primary-btn quiz-start-confirm" type="button" data-quiz-start-confirm>Empezar quiz</button>
        </div>
      </div>
    `;
  }

  function quizStartGateHTML(quiz) {
    const total = Array.isArray(quiz.questions) ? quiz.questions.length : 0;
    return `
      <section class="quiz-start-gate">
        <div class="quiz-kahoot-mark" aria-hidden="true"><span>▲</span><span>◆</span><span>●</span><span>■</span></div>
        <p class="section-kicker">Antes de empezar</p>
        <h2>${escapeHTML(quiz.title || 'Quiz')}</h2>
        <p>${escapeHTML(quiz.description || quiz.mode || 'Reto interactivo de práctica.')}</p>
        <div class="quiz-lock-warning">${QUIZ_SECURITY_ENABLED ? '🔒 Cuando empieces, solo podrás salir al finalizar el quiz.' : '🧪 Modo seguro temporalmente desactivado para pruebas.'}</div>
        <small>${total} ítems · Periodo ${Number(quiz.period || state.quizPeriod || 1)}</small>
        <button class="primary-btn quiz-start-confirm" type="button" data-quiz-start-confirm>Empezar quiz</button>
      </section>
    `;
  }

  function quizIntroSplashHTML(quiz) {
    return `
      <section class="quiz-intro-splash quiz-burst-scene">
        <div class="quiz-burst-shapes" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><span></span></div>
        <p class="section-kicker">Preparando reto</p>
        <h2>${escapeHTML(quiz.title || 'Quiz')}</h2>
        <p>${escapeHTML(quiz.description || quiz.mode || 'Lee con calma, responde rápido y aprende jugando.')}</p>
      </section>
    `;
  }

  function quizItemTransitionHTML(item, total, quiz = getActiveQuiz(), withIntroInfo = false) {
    const current = Math.max(1, Number(item) || 1);
    const count = Math.max(1, Number(total) || 1);
    const infoHTML = withIntroInfo ? `
        <div class="quiz-transition-intro-info" aria-hidden="false">
          <p class="section-kicker">Preparando reto</p>
          <h2>${escapeHTML(quiz?.title || 'Quiz')}</h2>
          <p>${escapeHTML(quiz?.description || quiz?.mode || 'Lee con calma, responde rápido y aprende jugando.')}</p>
        </div>` : '';
    return `
      <section class="quiz-item-transition quiz-burst-scene" aria-live="polite">
        ${quizTransitionTunePanelHTML(current, count)}
        <div class="quiz-burst-shapes" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><span></span></div>
        ${infoHTML}
        <div class="quiz-transition-count"><span class="quiz-transition-number"><strong>${current}</strong><small>/${count}</small></span></div>
        <div class="quiz-transition-progress"><span></span></div>
      </section>
    `;
  }

  function quizResultItemCardsHTML(quiz, answers = []) {
    const questions = Array.isArray(quiz?.questions) ? quiz.questions.slice(0, 10) : [];
    const answerMap = new Map((Array.isArray(answers) ? answers : []).map((answer) => [Number(answer.index), answer]));
    if (!questions.length) return '';
    const cards = questions.map((question, index) => {
      const answer = answerMap.get(index);
      const isOpen = question?.type === 'open';
      const correct = answer?.correct === true;
      const wrong = answer?.correct === false;
      const revisable = answer && !correct && !wrong;
      const openHasText = isOpen && Boolean(String(answer?.text || '').trim());
      const openStateClass = openHasText ? 'is-open is-open-answered' : 'is-open is-open-empty';
      const stateClass = isOpen ? openStateClass : (correct || revisable ? 'is-correct' : 'is-wrong');
      const label = isOpen ? (openHasText ? 'Respuesta abierta enviada' : 'Respuesta abierta sin texto') : (correct ? 'Correcto' : (wrong ? 'Incorrecto' : 'Registrado'));
      const typeLabel = {
        multiple_choice: 'Opción múltiple',
        true_false: 'Verdadero/Falso',
        open: 'Respuesta abierta',
        order: 'Organizar',
        flip: 'Flip'
      }[question?.type] || 'Pregunta';
      return `
        <article class="quiz-ranking-item-card ${stateClass}" style="--item-delay:${index * 90 + 720}ms" aria-label="Ítem ${index + 1}: ${escapeHTML(label)}">
          <span class="quiz-ranking-item-number">Ítem ${index + 1}</span>
          <span class="quiz-ranking-item-type">${escapeHTML(typeLabel)}</span>
        </article>
      `;
    }).join('');
    return `<section class="quiz-ranking-items" aria-label="Resultado por ítem">${cards}</section>`;
  }

  function normalizeQuizRankingPodiumTune(tune = {}) {
    const safe = { ...QUIZ_RANKING_PODIUM_TUNE_DEFAULTS };
    QUIZ_RANKING_PODIUM_TUNE_FIELDS.forEach((field) => {
      const raw = Number(tune[field.key]);
      safe[field.key] = Number.isFinite(raw) ? Math.max(field.min, Math.min(field.max, Math.round(raw))) : QUIZ_RANKING_PODIUM_TUNE_DEFAULTS[field.key];
    });
    return safe;
  }

  function getQuizRankingPodiumTune() {
    try {
      return normalizeQuizRankingPodiumTune(JSON.parse(localStorage.getItem(QUIZ_RANKING_PODIUM_TUNE_KEY) || '{}'));
    } catch (_) {
      return { ...QUIZ_RANKING_PODIUM_TUNE_DEFAULTS };
    }
  }

  function saveQuizRankingPodiumTune(tune) {
    const safe = normalizeQuizRankingPodiumTune(tune);
    try { localStorage.setItem(QUIZ_RANKING_PODIUM_TUNE_KEY, JSON.stringify(safe)); } catch (_) {}
    return safe;
  }

  function applyQuizRankingPodiumTune(tune = getQuizRankingPodiumTune()) {
    const safe = normalizeQuizRankingPodiumTune(tune);
    document.querySelectorAll('[data-quiz-ranking-podium]').forEach((podium) => {
      podium.style.setProperty('--ranking-podium-1-x', `${safe.p1x}px`);
      podium.style.setProperty('--ranking-podium-1-y', `${safe.p1y}px`);
      podium.style.setProperty('--ranking-podium-1-rot', `${safe.p1rot}deg`);
      podium.style.setProperty('--ranking-podium-2-x', `${safe.p2x}px`);
      podium.style.setProperty('--ranking-podium-2-y', `${safe.p2y}px`);
      podium.style.setProperty('--ranking-podium-2-rot', `${safe.p2rot}deg`);
      podium.style.setProperty('--ranking-podium-3-x', `${safe.p3x}px`);
      podium.style.setProperty('--ranking-podium-3-y', `${safe.p3y}px`);
      podium.style.setProperty('--ranking-podium-3-rot', `${safe.p3rot}deg`);
      podium.style.setProperty('--ranking-podium-base-x', `${safe.baseX}px`);
      podium.style.setProperty('--ranking-podium-base-y', `${safe.baseY}px`);
      podium.style.setProperty('--ranking-podium-base-w', `${safe.baseW}%`);
    });
    return safe;
  }

  function updateQuizRankingPodiumTuneOutput(key, value) {
    const field = QUIZ_RANKING_PODIUM_TUNE_FIELDS.find((item) => item.key === key);
    document.querySelectorAll(`[data-quiz-ranking-podium-tune-value="${escapeSelector(key)}"]`).forEach((output) => {
      output.textContent = `${value}${field?.unit || ''}`;
    });
  }

  function quizRankingPodiumTunePanelHTML() {
    const tune = getQuizRankingPodiumTune();
    const groups = ['Puesto 1', 'Puesto 2', 'Puesto 3', 'Base'];
    const groupHTML = groups.map((group) => {
      const rows = QUIZ_RANKING_PODIUM_TUNE_FIELDS.filter((field) => field.group === group).map((field) => {
        const value = tune[field.key];
        return `
          <label class="quiz-ranking-tune-row">
            <span><strong>${escapeHTML(field.label)}</strong><output data-quiz-ranking-podium-tune-value="${escapeAttr(field.key)}">${value}${field.unit}</output></span>
            <input type="range" min="${field.min}" max="${field.max}" step="${field.step}" value="${value}" data-quiz-ranking-podium-tune="${escapeAttr(field.key)}" />
          </label>`;
      }).join('');
      return `<div class="quiz-ranking-tune-group"><h4>${escapeHTML(group)}</h4>${rows}</div>`;
    }).join('');
    return `
      <div class="quiz-ranking-tune-tools" data-quiz-ranking-tune-tools>
        <button class="quiz-ranking-tune-gear" type="button" data-quiz-ranking-tune-toggle aria-label="Ajustar podio">⚙️ Podio</button>
        <section class="quiz-ranking-tune-panel" data-quiz-ranking-tune-panel ${state.quizRankingPodiumPanelOpen ? '' : 'hidden'} aria-hidden="${state.quizRankingPodiumPanelOpen ? 'false' : 'true'}" aria-label="Ajuste temporal del podio">
          <div class="quiz-ranking-tune-head">
            <div><strong>Ajuste temporal podio</strong><small>Pásame estos valores cuando quede bien.</small></div>
            <button type="button" data-quiz-ranking-tune-close aria-label="Cerrar ajuste">×</button>
          </div>
          <div class="quiz-ranking-tune-scroll">${groupHTML}</div>
          <div class="quiz-ranking-tune-actions">
            <button class="mini-btn" type="button" data-quiz-ranking-tune-reset>Restablecer podio</button>
          </div>
        </section>
      </div>`;
  }

  function bindQuizRankingPodiumTunePanel() {
    const layer = document.getElementById('quizFullscreenLayer');
    if (!layer || !layer.classList.contains('quiz-phase-results')) return;
    applyQuizRankingPodiumTune(getQuizRankingPodiumTune());
    const panel = layer.querySelector('[data-quiz-ranking-tune-panel]');
    const syncPanel = () => {
      if (!panel) return;
      panel.hidden = !state.quizRankingPodiumPanelOpen;
      panel.setAttribute('aria-hidden', state.quizRankingPodiumPanelOpen ? 'false' : 'true');
      panel.classList.toggle('is-open', state.quizRankingPodiumPanelOpen);
    };
    syncPanel();
    layer.querySelectorAll('[data-quiz-ranking-tune-toggle]').forEach((button) => {
      if (button.dataset.boundRankingTuneToggle === 'true') return;
      button.dataset.boundRankingTuneToggle = 'true';
      button.addEventListener('click', () => {
        state.quizRankingPodiumPanelOpen = !state.quizRankingPodiumPanelOpen;
        syncPanel();
      });
    });
    layer.querySelectorAll('[data-quiz-ranking-tune-close]').forEach((button) => {
      if (button.dataset.boundRankingTuneClose === 'true') return;
      button.dataset.boundRankingTuneClose = 'true';
      button.addEventListener('click', () => {
        state.quizRankingPodiumPanelOpen = false;
        syncPanel();
      });
    });
    layer.querySelectorAll('[data-quiz-ranking-podium-tune]').forEach((input) => {
      if (input.dataset.boundRankingPodiumTune === 'true') return;
      input.dataset.boundRankingPodiumTune = 'true';
      const update = () => {
        const key = input.dataset.quizRankingPodiumTune;
        const current = getQuizRankingPodiumTune();
        current[key] = Number(input.value);
        const safe = saveQuizRankingPodiumTune(current);
        applyQuizRankingPodiumTune(safe);
        updateQuizRankingPodiumTuneOutput(key, safe[key]);
      };
      input.addEventListener('input', update);
      input.addEventListener('change', update);
    });
    layer.querySelectorAll('[data-quiz-ranking-tune-reset]').forEach((button) => {
      if (button.dataset.boundRankingTuneReset === 'true') return;
      button.dataset.boundRankingTuneReset = 'true';
      button.addEventListener('click', () => {
        const defaults = saveQuizRankingPodiumTune({ ...QUIZ_RANKING_PODIUM_TUNE_DEFAULTS });
        applyQuizRankingPodiumTune(defaults);
        layer.querySelectorAll('[data-quiz-ranking-podium-tune]').forEach((input) => {
          const key = input.dataset.quizRankingPodiumTune;
          input.value = defaults[key];
          updateQuizRankingPodiumTuneOutput(key, defaults[key]);
        });
      });
    });
  }

  function quizRankingPodiumHTML(stats) {
    const scoreBase = Math.max(1, stats.scorable || stats.total || 1);
    const userScore = Math.max(0, stats.correct || 0);
    const podium = [
      { rank: 2, name: 'Sofía', avatar: 'S', score: Math.max(0, Math.min(scoreBase, userScore - 1)), order: 'left' },
      { rank: 1, name: 'Tú', avatar: '★', score: userScore, order: 'center' },
      { rank: 3, name: 'Mateo', avatar: 'M', score: Math.max(0, Math.min(scoreBase, userScore - 2)), order: 'right' }
    ];
    return `
      <section class="quiz-ranking-panel" aria-label="Ranking del quiz">
        <div class="quiz-ranking-podium" data-quiz-ranking-podium aria-hidden="false">
          ${podium.map((slot) => `
            <div class="quiz-podium-slot quiz-podium-${slot.rank} quiz-podium-${slot.order}" data-podium-rank="${slot.rank}" style="--podium-delay:${slot.rank === 3 ? 90 : slot.rank === 2 ? 310 : 540}ms">
              <div class="quiz-podium-adjust">
                <div class="quiz-podium-profile">
                  <span class="quiz-podium-avatar" aria-hidden="true">${escapeHTML(slot.avatar)}</span>
                  <strong>${escapeHTML(slot.name)}</strong>
                </div>
                <div class="quiz-podium-step">
                  <span>${slot.rank}</span>
                </div>
              </div>
            </div>
          `).join('')}
          <div class="quiz-podium-base" aria-hidden="true"></div>
        </div>
      </section>
    `;
  }

  function quizResultsHTML(quiz) {
    const stats = getQuizStats(quiz);
    const session = getQuizSession();
    const securedOut = Boolean(session.securityTerminated);
    const win = !securedOut && (stats.scorable === 0 || stats.correct >= Math.ceil(stats.scorable * 0.6));
    const answers = Array.isArray(session.answers) ? session.answers : [];
    const denominator = Math.max(1, stats.scorable || stats.total || 1);
    const scorePercent = Math.round((Math.max(0, stats.correct || 0) / denominator) * 100);
    const scoreTone = securedOut ? 'blackred' : (scorePercent >= 90 ? 'green' : (scorePercent >= 70 ? 'yellow' : (scorePercent >= 60 ? 'orange' : (scorePercent <= 30 ? 'blackred' : 'red'))));
    return `
      <section class="quiz-results-screen quiz-ranking-screen quiz-ranking-tone-${scoreTone} ${securedOut ? 'is-security-ended' : (win ? 'is-win' : 'is-try')}" style="--quiz-score-percent:${scorePercent}">
        <div class="quiz-results-burst" aria-hidden="true"></div>
        ${securedOut ? `<div class="quiz-security-result-note">Motivo: ${escapeHTML(session.securityTerminatedReason || 'Acción sospechosa repetida')}</div>` : ''}
        ${quizRankingPodiumHTML(stats)}
        ${quizRankingPodiumTunePanelHTML()}
        ${quizResultItemCardsHTML(quiz, answers)}
        <div class="quiz-score-board quiz-ranking-score">
          <strong>${stats.correct}<small>/${stats.scorable || stats.total}</small></strong>
          <span>${securedOut ? 'resultado no válido' : (stats.scorable ? `${scorePercent}% de acierto` : 'respuestas revisables')}</span>
        </div>
        <div class="quiz-results-actions quiz-ranking-actions">
          <button class="primary-btn" type="button" data-quiz-result-target="quizzes">Volver a Quizzes</button>
          <button class="mini-btn" type="button" data-quiz-result-target="classes">Ir a Clases</button>
          <button class="mini-btn" type="button" data-quiz-result-target="rockstars">Ver Rockstars</button>
          <button class="mini-btn" type="button" data-quiz-restart>Repetir quiz</button>
        </div>
      </section>
    `;
  }

  function getQuizStats(quiz) {
    const answers = getQuizSession().answers || [];
    const scorableAnswers = answers.filter((answer) => typeof answer.correct === 'boolean');
    const correct = scorableAnswers.filter((answer) => answer.correct).length;
    const total = Array.isArray(quiz.questions) ? quiz.questions.length : 0;
    return { total, answered: answers.length, scorable: scorableAnswers.length, correct };
  }

  function closeQuizFullscreen(target = 'quizzes') {
    stopQuizQuestionMusic(false);
    removeQuizGlobalFeedback();
    clearQuizTimers();
    unlockQuizHistory();
    state.quizFullscreenActive = false;
    resetQuizSession('idle');
    const layer = document.getElementById('quizFullscreenLayer');
    if (layer) layer.remove();
    document.body.classList.remove('quiz-fullscreen-active');
    exitQuizFullscreenMode();
    if (target === 'classes') setSubjectTab('classes');
    else if (target === 'rockstars') setSubjectTab('rockstars');
    else setSubjectTab('quizzes');
  }

  function restartQuiz() {
    const quiz = getActiveQuiz();
    if (!quiz) return;
    state.quizQuestionIndex = 0;
    state.quizFullscreenActive = true;
    state.quizSecurityGraceUntil = Date.now() + 2200;
    resetQuizSession('transition');
    lockQuizHistory();
    preloadQuizSounds();
    startQuizQuestionMusic();
    showQuizItemTransition(0, { fromIntro: true });
    requestQuizFullscreenMode();
  }

  function lockQuizHistory() {
    if (!QUIZ_SECURITY_ENABLED) return;
    if (state.quizHistoryLocked) return;
    state.quizHistoryLocked = true;
    try { window.history.pushState({ encisomathQuizLock: true }, '', window.location.href); } catch (_) {}
    window.addEventListener('popstate', keepQuizFullscreenLocked);
  }

  function unlockQuizHistory() {
    if (!state.quizHistoryLocked) return;
    state.quizHistoryLocked = false;
    window.removeEventListener('popstate', keepQuizFullscreenLocked);
  }

  function keepQuizFullscreenLocked() {
    if (!QUIZ_SECURITY_ENABLED) return;
    if (!state.quizFullscreenActive) return;
    try { window.history.pushState({ encisomathQuizLock: true }, '', window.location.href); } catch (_) {}
    handleQuizSuspiciousAction('botón atrás o intento de salir');
    if (!state.quizFullscreenActive) return;
    const quiz = getActiveQuiz();
    if (quiz && !getQuizSession().securityWarningOpen) renderQuizFullscreen(quiz);
  }




  function openQuizImageModal(src, alt = '') {
    openModal(`
      <div class="modal-card quiz-image-modal quiz-image-zoom-modal">
        <button class="modal-close" data-close-modal aria-label="Cerrar">×</button>
        <div class="quiz-zoom-controls" aria-label="Controles de zoom">
          <button class="mini-btn" type="button" data-quiz-zoom-out>−</button>
          <button class="mini-btn" type="button" data-quiz-zoom-reset>100%</button>
          <button class="mini-btn" type="button" data-quiz-zoom-in>+</button>
        </div>
        <div class="quiz-zoom-viewport" data-quiz-zoom-viewport>
          <img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" data-quiz-zoom-image />
        </div>
        <p>${escapeHTML(alt || 'Imagen del quiz')} · Pellizca, arrastra o usa los botones para ampliar.</p>
      </div>
    `, bindQuizImageZoomModal);
  }

  function bindQuizImageZoomModal() {
    const viewport = document.querySelector('[data-quiz-zoom-viewport]');
    const image = document.querySelector('[data-quiz-zoom-image]');
    if (!viewport || !image) return;
    let scale = 1;
    let x = 0;
    let y = 0;
    let dragStart = null;
    const pointers = new Map();
    let pinchStartDistance = 0;
    let pinchStartScale = 1;
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const apply = () => {
      if (scale <= 1.01) { x = 0; y = 0; }
      image.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
      viewport.classList.toggle('is-zoomed', scale > 1.01);
    };
    const setScale = (value) => { scale = clamp(value, 1, 4); apply(); };
    document.querySelector('[data-quiz-zoom-in]')?.addEventListener('click', () => setScale(scale + .35));
    document.querySelector('[data-quiz-zoom-out]')?.addEventListener('click', () => setScale(scale - .35));
    document.querySelector('[data-quiz-zoom-reset]')?.addEventListener('click', () => { scale = 1; x = 0; y = 0; apply(); });
    viewport.addEventListener('wheel', (event) => {
      event.preventDefault();
      setScale(scale + (event.deltaY < 0 ? .22 : -.22));
    }, { passive: false });
    viewport.addEventListener('dblclick', () => setScale(scale > 1.05 ? 1 : 2.15));
    viewport.addEventListener('pointerdown', (event) => {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      viewport.setPointerCapture?.(event.pointerId);
      if (pointers.size === 1) dragStart = { x: event.clientX - x, y: event.clientY - y };
      if (pointers.size === 2) {
        const values = Array.from(pointers.values());
        pinchStartDistance = Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
        pinchStartScale = scale;
      }
    });
    viewport.addEventListener('pointermove', (event) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 2 && pinchStartDistance) {
        const values = Array.from(pointers.values());
        const distance = Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
        setScale(pinchStartScale * (distance / pinchStartDistance));
        return;
      }
      if (scale > 1.01 && dragStart && pointers.size === 1) {
        x = event.clientX - dragStart.x;
        y = event.clientY - dragStart.y;
        apply();
      }
    });
    const endPointer = (event) => {
      pointers.delete(event.pointerId);
      if (!pointers.size) dragStart = null;
      if (pointers.size < 2) pinchStartDistance = 0;
    };
    viewport.addEventListener('pointerup', endPointer);
    viewport.addEventListener('pointercancel', endPointer);
    apply();
  }

  function renderClassesTab(options = {}) {
    const $content = document.getElementById('tabContent');
    if (!$content) return;
    setActiveSubjectTabMeta('classes');

    $content.innerHTML = `
      <div class="period-tabs" id="periodTabs">
        ${[1, 2, 3, 4].map((period) => `<button class="period-btn ${Number(state.period) === period ? 'active' : ''}" data-period="${period}">${period}°</button>`).join('')}
      </div>
      <div class="view-row">
        <strong id="periodLabel">Periodo ${state.period}</strong>
        <div>
          <button class="mini-btn ${state.classViewMode === 'grid' ? 'selected' : ''}" id="gridModeBtn">▦ Cuadrícula</button>
          <button class="mini-btn ${state.classViewMode === 'list' ? 'selected' : ''}" id="listModeBtn">☰ Lista</button>
        </div>
      </div>
      <div id="classGrid" class="class-grid ${state.classViewMode}-mode">
        ${renderClassCardsHTML()}
      </div>
    `;

    bindPeriodButtons();
    bindClassViewButtons();
    bindClassCards();
    if (options.animate) pulseElement($content, 'tab-enter');
  }

  function getClassesForCurrentAssignment() {
    const assignment = state.assignment;
    return state.data.classes.filter((item) => item.subject === assignment.subject || item.area === assignment.area);
  }

  function renderClassCardsHTML() {
    const filtered = getClassesForCurrentAssignment().filter((item) => Number(item.period) === Number(state.period));
    return filtered.map(classCardHTML).join('') || `<div class="empty">Aún no hay clases para este periodo.</div>`;
  }

  function bindPeriodButtons() {
    document.querySelectorAll('[data-period]').forEach((button) => {
      button.addEventListener('click', () => setPeriod(Number(button.dataset.period)));
    });
  }

  function setPeriod(period) {
    if (Number(state.period) === Number(period)) return;
    const previous = document.querySelector(`[data-period="${state.period}"]`);
    const next = document.querySelector(`[data-period="${period}"]`);
    previous?.classList.remove('active');
    next?.classList.add('active');
    pulseElement(previous, 'period-shift');
    pulseElement(next, 'period-shift');
    state.period = Number(period);
    const label = document.getElementById('periodLabel');
    if (label) {
      label.textContent = `Periodo ${state.period}`;
      pulseElement(label, 'text-pop');
    }
    updateClassGrid(true);
  }

  function bindClassViewButtons() {
    document.getElementById('gridModeBtn')?.addEventListener('click', () => setClassViewMode('grid'));
    document.getElementById('listModeBtn')?.addEventListener('click', () => setClassViewMode('list'));
  }

  function bindClassCards() {
    document.querySelectorAll('[data-class-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const item = state.data.classes.find((lesson) => lesson.id === button.dataset.classId);
        if (item) renderLesson(item);
      });
    });
  }

  function updateClassGrid(animate = false) {
    const grid = document.getElementById('classGrid');
    if (!grid) return;
    grid.className = `class-grid ${state.classViewMode}-mode`;
    grid.innerHTML = renderClassCardsHTML();
    bindClassCards();
    if (animate) pulseElement(grid, 'class-grid-update');
  }

  function renderLesson(lesson, options = {}) {
    const assignment = state.assignment;
    if (assignment?.id && lesson?.id) commitAppRoute({ screen: 'lesson', assignmentId: assignment.id, lessonId: lesson.id }, options);
    const src = `${lesson.contentUrl}?v=${Date.now()}&assignment=${encodeURIComponent(assignment.id)}`;
    const markup = `
      <main class="screen class-screen">
        <header class="topbar fixed-lock lesson-topbar">
          <button class="icon-btn" id="backBtn" aria-label="Volver">←</button>
          <h1>Clase</h1>
          <span class="spacer"></span>
        </header>
        <section class="lesson-head">
          <div class="class-emoji">${escapeHTML(lesson.emoji || '📘')}</div>
          <div>
            <h2>${escapeHTML(lesson.title)}</h2>
            <p>${escapeHTML(assignment.subject)} · ${escapeHTML(assignment.area)} · Periodo ${lesson.period}</p>
          </div>
        </section>
        <iframe class="lesson-frame" src="${escapeAttr(src)}" title="${escapeAttr(lesson.title)}"></iframe>
      </main>
    `;
    mount(markup, () => {
      document.getElementById('backBtn').addEventListener('click', () => renderSubjectDetail('classes'));
    });
  }

  function renderStudentPlaceholder(options = {}) {
    commitAppRoute({ screen: 'student' }, options);
    mount(`<main class="screen mobile-pad"><h1>Vista estudiante</h1><p>La primera fase está centrada en docentes. La vista estudiante se conecta después con las clases y actividades.</p><button class="primary-btn" id="logoutBtn">Cerrar sesión</button></main>`, () => {
      document.getElementById('logoutBtn').addEventListener('click', logout);
    });
  }

  function assignmentCardHTML(item) {
    const iconSrc = getAssignmentIcon(item);
    const coverStyle = coverBackgroundStyle(item);
    return `
      <article class="assignment-card">
        <button class="assignment-open" data-open-assignment="${escapeAttr(item.id)}">
          <div class="assignment-cover-mini animated-cover ${getAssignmentCover(item) ? 'has-custom-cover' : 'is-default-cover'}" ${coverStyle}>${coverMotionHTML('mini')}</div>
          <div class="assignment-body">
            <img class="subject-icon" src="${escapeAttr(iconSrc)}" alt="" />
            <div class="assignment-text">
              <div class="kicker">${escapeHTML(item.area)}</div>
              <div class="card-title">${escapeHTML(item.subject)}</div>
              <div class="card-sub">${escapeHTML(item.grade)}-${escapeHTML(item.course)} · ${escapeHTML(item.sede)}</div>
            </div>
            <span class="open-mark">↗</span>
          </div>
        </button>
      </article>
    `;
  }

  function rockstarCardHTML(student, points, status) {
    const statusInfo = statusMap[status] || null;
    const locked = isRockstarLocked(status);
    const tier = getRockstarTier(points);
    const visual = locked ? getSleepingTier() : tier;
    const attendanceLabel = statusInfo ? `${statusInfo.emoji} ${statusInfo.label}` : 'Sin marcar hoy';
    const actionHTML = locked
      ? `<div class="rockstar-locked-note" aria-label="Estudiante sin puntos disponibles hoy">😴 Sin puntos hoy</div>`
      : `<div class="rockstar-buttons">
          <button class="rock-btn rock-minus" data-rockstar-student="${escapeAttr(student.id)}" data-rockstar-delta="-1" title="Quitar un punto">−1</button>
          <button class="rock-btn rock-plus" data-rockstar-student="${escapeAttr(student.id)}" data-rockstar-delta="1" title="Dar un punto">+1</button>
        </div>`;
    return `
      <article class="student-card rockstar-card ${visual.className}${locked ? ' rockstar-disabled' : ''}" data-rockstar-card="${escapeAttr(student.id)}">
        <div class="student-main rockstar-main">
          <div class="rockstar-avatar ${visual.className}" data-rockstar-badge>${visual.emoji}</div>
          <div class="student-info rockstar-info">
            <div class="student-name">${escapeHTML(student.fullName)}</div>
            <div class="student-meta">🆔 ${escapeHTML(student.id)} · ${escapeHTML(student.username || '')}</div>
            <div class="student-meta">📅 Asistencia: ${attendanceLabel}</div>
          </div>
        </div>
        <div class="rockstar-score-box" aria-label="Puntos del estudiante">
          <span class="rockstar-score ${visual.className}" data-rockstar-score>${points}</span>
          <span class="rockstar-score-label">pts</span>
        </div>
        ${actionHTML}
      </article>
    `;
  }

  function getRockstarTier(points) {
    const value = Number(points) || 0;
    if (value >= 15) return { emoji: '💎', label: 'Diamante', className: 'tier-diamond' };
    if (value >= 10) return { emoji: '🔥', label: 'Fuego', className: 'tier-fire' };
    if (value >= 5) return { emoji: '😎', label: 'Súper cool', className: 'tier-cool' };
    if (value >= 1) return { emoji: '🚀', label: 'Despegando', className: 'tier-rocket' };
    if (value === 0) return { emoji: '🙂', label: 'Listo para participar', className: 'tier-neutral' };
    if (value >= -5) return { emoji: '😡', label: 'En deuda', className: 'tier-angry' };
    return { emoji: '💀', label: 'Zona crítica', className: 'tier-skull' };
  }

  function studentCardHTML(student, status) {
    const statusInfo = statusMap[status] || null;
    return `
      <article class="student-card ${statusInfo ? statusInfo.className : ''}" data-student-card="${escapeAttr(student.id)}">
        <button class="student-delete" data-delete-student="${escapeAttr(student.id)}" aria-label="Eliminar ${escapeAttr(student.fullName)}">🗑️</button>
        <div class="student-main">
          <img class="student-photo" src="${escapeAttr(student.photo || './assets/default-avatar.svg')}" alt="Foto de ${escapeAttr(student.fullName)}" />
          <div class="student-info">
            <div class="student-name">${escapeHTML(student.fullName)}</div>
            <div class="student-meta">🆔 ${escapeHTML(student.id)} · ${escapeHTML(student.username || '')}</div>
            <div class="student-meta" data-attendance-meta>📅 Asistencia: ${statusInfo ? `${statusInfo.emoji} ${statusInfo.label}` : 'Sin marcar'}</div>
          </div>
        </div>
        <div class="attendance-buttons">
          ${attendanceButtonHTML(student.id, 'present', status)}
          ${attendanceButtonHTML(student.id, 'absent', status)}
          ${attendanceButtonHTML(student.id, 'excused', status)}
        </div>
      </article>
    `;
  }

  function attendanceButtonHTML(studentId, status, current) {
    const info = statusMap[status];
    return `<button class="att-btn att-${status} ${current === status ? 'active' : ''}" data-student-id="${escapeAttr(studentId)}" data-status="${status}" title="${info.label}"><span class="att-emoji">${info.emoji}</span><span class="att-label">${info.label}</span></button>`;
  }

  function classCardHTML(item) {
    return `
      <button class="class-card" data-class-id="${escapeAttr(item.id)}">
        <div class="class-emoji">${escapeHTML(item.emoji || '📘')}</div>
        <div>
          <div class="card-title">${escapeHTML(item.title)}</div>
          <div class="card-sub">${escapeHTML(item.type || 'Clase interactiva')} · ${escapeHTML(item.estimatedTime || '45 min')}</div>
        </div>
      </button>
    `;
  }

  function selectHTML(id, label, options, selected) {
    return `
      <select id="${id}" class="select" aria-label="${label}">
        <option value="all">${label}</option>
        ${options.map((option) => `<option value="${escapeAttr(option)}" ${selected === option ? 'selected' : ''}>${escapeHTML(option)}</option>`).join('')}
      </select>
    `;
  }

  function bottomNav(active) {
    return `
      <nav class="bottom-nav" aria-label="Navegación principal">
        <button class="nav-item ${active === 'profe' ? 'active' : ''}" onclick="window.EncisoMathNav.home()"><span class="nav-icon">🧮</span><span>Profe</span></button>
        <button class="nav-item ${active === 'students' ? 'active' : ''}" onclick="window.EncisoMathNav.students()"><span class="nav-icon">👥</span><span>Estudiantes</span></button>
      </nav>
    `;
  }

  window.EncisoMathNav = {
    home: () => renderTeacherHome(),
    students: () => {
      if (state.assignment) setSubjectTab('students');
      else toast('Elige primero una asignatura para ver estudiantes.');
    }
  };

  function animatedShapes(mode = 'loading') {
    const loginShapes = [
      ['circle', '--w:52px;--h:52px;left:6%;top:9%;--c:#1976D2;--o:.92;--dx:34px;--dy:42px;--r1:120deg;--dur:7.6s;--delay:-1.2s'],
      ['triangle', '--w:58px;--h:54px;left:78%;top:5%;--c:#FBC02D;--o:.90;--dx:-28px;--dy:54px;--r1:-150deg;--dur:8.1s;--delay:-2.1s'],
      ['square outline', '--w:40px;--h:40px;left:87%;top:17%;--c:#C2185B;--o:.86;--dx:-36px;--dy:28px;--r1:210deg;--dur:8.4s;--delay:-3.3s'],
      ['circle', '--w:28px;--h:28px;left:77%;top:21%;--c:#689F38;--o:.82;--dx:22px;--dy:-38px;--r1:-70deg;--dur:7.2s;--delay:-5.7s'],
      ['rect', '--w:74px;--h:22px;left:14%;top:19%;--c:#512DA8;--o:.84;--dx:-48px;--dy:-38px;--r1:38deg;--dur:9.6s;--delay:-6.2s'],
      ['circle outline', '--w:30px;--h:30px;left:7%;top:79%;--c:#0288D1;--o:.86;--dx:50px;--dy:-46px;--r1:120deg;--dur:8.7s;--delay:-4.4s'],
      ['triangle', '--w:42px;--h:40px;left:20%;top:90%;--c:#E64A19;--o:.90;--dx:42px;--dy:-56px;--r1:240deg;--dur:8.8s;--delay:-6s'],
      ['square', '--w:28px;--h:28px;left:83%;top:88%;--c:#D32F2F;--o:.90;--dx:-58px;--dy:-54px;--r1:190deg;--dur:7.3s;--delay:-2.8s'],
      ['rect outline', '--w:78px;--h:26px;left:64%;top:78%;--c:#0288D1;--o:.82;--dx:-38px;--dy:60px;--r1:-130deg;--dur:10.2s;--delay:-6.8s'],
      ['circle', '--w:20px;--h:20px;left:14%;top:70%;--c:#FFA000;--o:.88;--dx:30px;--dy:52px;--r1:90deg;--dur:6.4s;--delay:-1.8s'],
      ['square', '--w:24px;--h:24px;left:88%;top:72%;--c:#F57C00;--o:.86;--dx:-46px;--dy:62px;--r1:190deg;--dur:7.6s;--delay:-3.7s'],
      ['triangle outline', '--w:46px;--h:46px;left:72%;top:95%;--c:#7B1FA2;--o:.82;--dx:-72px;--dy:-68px;--r1:-210deg;--dur:10.8s;--delay:-5.1s']
    ];
    const loadingShapes = [
      ['circle', '--w:54px;--h:54px;left:5%;top:7%;--c:#1976D2;--o:.78;--dx:42px;--dy:98px;--r1:120deg;--dur:7.4s;--delay:-1.2s'],
      ['triangle', '--w:58px;--h:54px;left:78%;top:5%;--c:#FBC02D;--o:.82;--dx:-34px;--dy:110px;--r1:-150deg;--dur:8.2s;--delay:-2.2s'],
      ['square outline', '--w:42px;--h:42px;left:88%;top:24%;--c:#C2185B;--o:.76;--dx:-42px;--dy:80px;--r1:210deg;--dur:8s;--delay:-3.1s'],
      ['rect', '--w:34px;--h:86px;left:4%;top:56%;--c:#388E3C;--o:.72;--dx:44px;--dy:-110px;--r1:80deg;--dur:9.2s;--delay:-4.3s'],
      ['circle outline', '--w:34px;--h:34px;left:86%;top:62%;--c:#0097A7;--o:.78;--dx:-48px;--dy:-90px;--r1:170deg;--dur:7.6s;--delay:-5.3s'],
      ['triangle', '--w:42px;--h:40px;left:7%;top:82%;--c:#E64A19;--o:.80;--dx:52px;--dy:-84px;--r1:240deg;--dur:8.8s;--delay:-6s'],
      ['square', '--w:24px;--h:24px;left:91%;top:82%;--c:#D32F2F;--o:.80;--dx:-72px;--dy:-88px;--r1:190deg;--dur:7.2s;--delay:-2.8s'],
      ['rect outline', '--w:82px;--h:28px;left:74%;top:76%;--c:#0288D1;--o:.70;--dx:-58px;--dy:-92px;--r1:-130deg;--dur:10.2s;--delay:-6.8s'],
      ['circle', '--w:18px;--h:18px;left:12%;top:30%;--c:#FFA000;--o:.88;--dx:34px;--dy:56px;--r1:90deg;--dur:6.4s;--delay:-1.8s'],
      ['square', '--w:22px;--h:22px;left:92%;top:43%;--c:#F57C00;--o:.82;--dx:-48px;--dy:72px;--r1:190deg;--dur:7.6s;--delay:-3.7s'],
      ['circle outline', '--w:28px;--h:28px;left:3%;top:42%;--c:#0288D1;--o:.76;--dx:42px;--dy:62px;--r1:120deg;--dur:8.7s;--delay:-4.4s'],
      ['triangle outline', '--w:46px;--h:46px;left:82%;top:88%;--c:#7B1FA2;--o:.74;--dx:-74px;--dy:-108px;--r1:-210deg;--dur:10.8s;--delay:-5.1s'],
      ['rect', '--w:92px;--h:26px;left:2%;top:18%;--c:#512DA8;--o:.68;--dx:48px;--dy:96px;--r1:38deg;--dur:9.6s;--delay:-7.2s'],
      ['circle', '--w:40px;--h:40px;left:89%;top:8%;--c:#689F38;--o:.70;--dx:-62px;--dy:112px;--r1:-70deg;--dur:8.9s;--delay:-6.1s']
    ];
    const shapes = mode === 'login' ? loginShapes : loadingShapes;
    return `
      <div class="math-bg math-bg-${escapeAttr(mode)}" aria-hidden="true">
        ${shapes.map(([className, style]) => `<span class="shape ${className}" style="${style}"></span>`).join('')}
      </div>
    `;
  }

  function coverMotionHTML(seed = 'home') {
    return `
      <div class="cover-grid" aria-hidden="true"></div>
      <div class="cover-motion" aria-hidden="true">
        <span class="cover-symbol s1">π</span>
        <span class="cover-symbol s2">∑</span>
        <span class="cover-symbol s3">√</span>
        <span class="cover-symbol s4">%</span>
        <span class="cover-geo g1"></span>
        <span class="cover-geo g2"></span>
        <span class="cover-geo g3"></span>
        <span class="cover-geo g4"></span>
      </div>
    `;
  }

  function getTeacherAssignments(teacherId) {
    return state.data.assignments.filter((item) => item.teacherId === teacherId);
  }

  function getStudentsForAssignment(assignment) {
    const removed = new Set(readJSON(`encisomath:removedStudents:${assignment.id}`) || []);
    const base = state.data.students.filter((student) => {
      return student.grade === assignment.grade && student.course === assignment.course && student.sede === assignment.sede && !removed.has(student.id);
    });
    const added = (readJSON(`encisomath:addedStudents:${assignment.id}`) || []).filter((student) => !removed.has(student.id));
    return [...base, ...added].sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));
  }

  function getAttendance(assignmentId, date) {
    return readJSON(`encisomath:attendance:${assignmentId}:${date}`) || {};
  }

  function saveAttendance(assignmentId, date, attendance) {
    localStorage.setItem(`encisomath:attendance:${assignmentId}:${date}`, JSON.stringify(attendance));
  }

  function getBaseRockstarEvents() {
    const source = state.data.rockstars;
    if (Array.isArray(source)) return normalizeRockstarEvents(source);
    if (Array.isArray(source?.events)) return normalizeRockstarEvents(source.events);
    if (source?.students && typeof source.students === 'object') {
      const fromStudents = [];
      Object.entries(source.students).forEach(([studentId, entries]) => {
        if (!Array.isArray(entries)) return;
        entries.forEach((entry) => fromStudents.push({ ...entry, studentId: entry.studentId || studentId }));
      });
      return normalizeRockstarEvents(fromStudents);
    }
    return [];
  }

  function normalizeRockstarEvents(events) {
    return events.map((entry) => ({
      id: entry.id || `base-${entry.assignmentId || 'assignment'}-${entry.studentId || 'student'}-${entry.date || 'date'}-${entry.delta || 0}`,
      assignmentId: entry.assignmentId || entry.assignment || '',
      studentId: entry.studentId || entry.student || entry.idStudent || '',
      period: Number(entry.period || entry.periodo || 1),
      date: entry.date || entry.fecha || todayISO(),
      delta: Number(entry.delta ?? entry.points ?? entry.puntos ?? 0)
    })).filter((entry) => entry.assignmentId && entry.studentId && [1, 2, 3, 4].includes(entry.period) && [-1, 1].includes(entry.delta));
  }

  function getLocalRockstarEvents(assignmentId) {
    return normalizeRockstarEvents(readJSON(`encisomath:rockstars:${assignmentId}`) || []);
  }

  function saveLocalRockstarEvents(assignmentId, events) {
    localStorage.setItem(`encisomath:rockstars:${assignmentId}`, JSON.stringify(normalizeRockstarEvents(events)));
  }

  function getRockstarEvents(assignmentId) {
    return [
      ...getBaseRockstarEvents().filter((entry) => entry.assignmentId === assignmentId),
      ...getLocalRockstarEvents(assignmentId)
    ];
  }

  function getRockstarPointMap(assignmentId, period) {
    const selectedPeriod = Number(period);
    return getRockstarEvents(assignmentId).reduce((scores, entry) => {
      if (Number(entry.period) !== selectedPeriod) return scores;
      scores.set(entry.studentId, (scores.get(entry.studentId) || 0) + Number(entry.delta || 0));
      return scores;
    }, new Map());
  }

  function getRockstarPoints(assignmentId, studentId, period) {
    return getRockstarEvents(assignmentId)
      .filter((entry) => entry.studentId === studentId && Number(entry.period) === Number(period))
      .reduce((total, entry) => total + Number(entry.delta || 0), 0);
  }


  function getAssignmentIcon(assignment) {
    return localStorage.getItem(`encisomath:assignmentIcon:${assignment.id}`) || assignment.icon || './assets/subject-statistics.svg';
  }

  function isSubjectIconVisible(assignment) {
    return localStorage.getItem(`encisomath:assignmentIconVisible:${assignment.id}`) !== 'false';
  }

  function toggleSubjectIconVisibility(visible) {
    if (!state.assignment) return;
    localStorage.setItem(`encisomath:assignmentIconVisible:${state.assignment.id}`, visible ? 'true' : 'false');
    closeModal();
    toast(visible ? 'Icono visible en el banner.' : 'Icono oculto en el banner.');
    renderSubjectDetail('students');
  }

  function getAssignmentCover(assignment) {
    return localStorage.getItem(`encisomath:assignmentCover:${assignment.id}`) || localStorage.getItem(`encisomath:cover:${assignment.id}`) || '';
  }

  function coverBackgroundStyle(assignment) {
    const cover = getAssignmentCover(assignment);
    if (!cover) return '';
    return `style="--cover-image: url('${escapeAttr(cover)}');"`;
  }

  function saveImageOverride(event, type) {
    const file = event.target.files?.[0];
    if (!file || !state.assignment) return;
    if (file.size > 900000) {
      toast('La imagen pesa mucho. Prueba una imagen menor a 900 KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const key = type === 'cover' ? `encisomath:assignmentCover:${state.assignment.id}` : `encisomath:assignmentIcon:${state.assignment.id}`;
        localStorage.setItem(key, reader.result);
        toast(type === 'cover' ? 'Portada guardada en este dispositivo.' : 'Icono guardado en este dispositivo.');
        closeModal();
        renderSubjectDetail('students');
      } catch (error) {
        toast('No se pudo guardar. Usa una imagen más liviana.');
      }
    };
    reader.readAsDataURL(file);
  }

  function resetAssignmentVisual(type) {
    if (!state.assignment) return;
    if (type === 'cover') {
      localStorage.removeItem(`encisomath:assignmentCover:${state.assignment.id}`);
      localStorage.removeItem(`encisomath:cover:${state.assignment.id}`);
      toast('Portada restablecida.');
    } else {
      localStorage.removeItem(`encisomath:assignmentIcon:${state.assignment.id}`);
      toast('Icono restablecido.');
    }
    closeModal();
    renderSubjectDetail('students');
  }

  function setClassViewMode(mode) {
    if (state.classViewMode === mode) return;
    state.classViewMode = mode;
    localStorage.setItem('encisomath:classViewMode', mode);
    document.getElementById('gridModeBtn')?.classList.toggle('selected', mode === 'grid');
    document.getElementById('listModeBtn')?.classList.toggle('selected', mode === 'list');
    updateClassGrid(true);
  }

  function bindFilter(id, key, callback) {
    document.getElementById(id).addEventListener('change', (event) => {
      state.filters[key] = event.target.value;
      callback();
    });
  }

  function findUser(id) {
    const normalized = normalizeID(id);
    return state.data.users.find((user) => normalizeID(user.id) === normalized || normalizeID(user.username) === normalized);
  }

  function logout() {
    localStorage.removeItem('encisomath:session');
    state.user = null;
    state.assignment = null;
    renderLogin();
  }

  async function requestNotificationTest() {
    if (!('Notification' in window)) {
      toast('Este navegador no soporta notificaciones web.');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast('Permiso de notificaciones no concedido.');
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification('EncisoMath', {
        body: 'Notificación local de prueba. Para push real se necesita backend o servicio externo.',
        icon: './assets/icon-192.png',
        badge: './assets/icon-192.png',
        tag: 'encisomath-test'
      });
      toast('Notificación enviada. En Android funciona mejor si la PWA está instalada.');
    } catch (error) {
      console.error(error);
      toast('No se pudo enviar la notificación de prueba.');
    }
  }

  function applyPreferences() {
    const requestedAccent = normalizeHexColor(state.prefs.accent);
    const safeAccent = requestedAccent && isAllowedAccentColor(requestedAccent) ? requestedAccent : DEFAULT_PREFS.accent;
    const safeBackground = BACKGROUND_OPTIONS.some((item) => item.value === state.prefs.background) ? state.prefs.background : DEFAULT_PREFS.background;
    const blackMode = safeBackground === '#000000';
    state.prefs = { ...DEFAULT_PREFS, ...state.prefs, accent: safeAccent, background: safeBackground };

    const root = document.documentElement;
    root.dataset.effectsMotion = prefEnabled('effectsMotion') ? 'on' : 'off';
    root.dataset.effectsMesh = prefEnabled('effectsMesh') ? 'on' : 'off';
    root.dataset.visualOptimized = prefEnabled('visualOptimized') ? 'on' : 'off';
    root.dataset.heroAnimations = prefEnabled('heroAnimations') ? 'on' : 'off';
    root.dataset.tabTransitions = prefEnabled('tabTransitions') ? 'on' : 'off';
    root.dataset.glassEffects = prefEnabled('glassEffects') ? 'on' : 'off';
    root.dataset.quizOptionEffects = prefEnabled('quizOptionEffects') ? 'on' : 'off';
    root.dataset.quizFeedbackEffects = prefEnabled('quizFeedbackEffects') ? 'on' : 'off';
    root.dataset.bgMode = blackMode ? 'black' : 'deep';
    root.style.setProperty('--maincolor', safeAccent);
    root.style.setProperty('--app-bg', safeBackground);
    root.style.setProperty('--app-bg-2', blackMode ? '#000000' : '#071827');
    root.style.setProperty('--body-accent-glow', blackMode ? 'transparent' : 'color-mix(in srgb, var(--maincolor) 22%, transparent)');
    root.style.setProperty('--body-secondary-glow', blackMode ? 'transparent' : 'color-mix(in srgb, var(--maincolor) 10%, transparent)');
    root.style.setProperty('--screen-accent-glow', blackMode ? 'transparent' : 'color-mix(in srgb, var(--maincolor) 14%, transparent)');
    root.style.setProperty('--screen-top-mix', blackMode ? '#000000' : '#0f2334');
    root.style.setProperty('--bar-bg', blackMode ? 'rgba(0, 0, 0, .96)' : 'rgba(4, 16, 28, .92)');
    root.style.setProperty('--bottom-bar-bg', blackMode ? 'rgba(0, 0, 0, .96)' : 'rgba(4, 16, 28, .88)');
    root.style.setProperty('--profile-bg', blackMode ? 'rgba(0, 0, 0, .86)' : 'rgba(4, 16, 28, .78)');
    root.style.setProperty('--panel', blackMode ? 'rgba(7, 7, 7, .94)' : 'rgba(9, 25, 40, .88)');
    root.style.setProperty('--panel-2', blackMode ? 'rgba(11, 11, 11, .78)' : 'rgba(12, 31, 49, .74)');
    root.style.setProperty('--panel-3', blackMode ? 'rgba(255, 255, 255, .05)' : 'rgba(255, 255, 255, .055)');
    root.style.setProperty('--line', blackMode ? 'rgba(255, 255, 255, .13)' : 'rgba(160, 188, 214, .18)');
    root.style.setProperty('--subject-panel-bg', blackMode ? 'rgba(8, 8, 8, .92)' : 'rgba(8, 26, 42, .9)');
    root.style.setProperty('--modal-bg', blackMode ? 'rgba(6, 6, 6, .97)' : 'rgba(6, 18, 31, .96)');
    root.style.setProperty('--green-soft', blackMode ? 'rgba(88, 204, 2, .18)' : 'rgba(88, 204, 2, .14)');
    root.style.setProperty('--red-soft', blackMode ? 'rgba(239, 68, 68, .19)' : 'rgba(239, 68, 68, .15)');
    root.style.setProperty('--yellow-soft', blackMode ? 'rgba(245, 158, 11, .19)' : 'rgba(245, 158, 11, .16)');
    root.style.setProperty('--banner-deep', blackMode ? '#000000' : '#06121e');
    root.style.setProperty('--banner-base', blackMode ? '#000000' : '#04101c');
    root.style.setProperty('--login-warm-glow', blackMode ? 'color-mix(in srgb, var(--maincolor) 22%, transparent)' : 'rgba(255, 214, 10, .20)');
    root.style.setProperty('--login-pink-glow', blackMode ? 'rgba(255, 77, 157, .18)' : 'rgba(255, 77, 157, .22)');
    root.style.setProperty('--login-mid', blackMode ? '#000000' : '#050b14');

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', safeBackground);
  }

  function updatePreference(key, value) {
    let nextValue = value;
    if (key === 'accent') {
      const normalized = normalizeHexColor(value);
      if (!normalized || !isAllowedAccentColor(normalized)) {
        toast('Ese color queda demasiado oscuro o demasiado claro. Elige un tono medio o intenso.');
        return false;
      }
      nextValue = normalized;
    }
    state.prefs[key] = nextValue;
    localStorage.setItem('encisomath:prefs', JSON.stringify(state.prefs));
    applyPreferences();
    toast('Apariencia actualizada.');
    return true;
  }

  function normalizeHexColor(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    const shortMatch = trimmed.match(/^#?([0-9a-fA-F]{3})$/);
    if (shortMatch) {
      return `#${shortMatch[1].split('').map((char) => char + char).join('').toUpperCase()}`;
    }
    const fullMatch = trimmed.match(/^#?([0-9a-fA-F]{6})$/);
    return fullMatch ? `#${fullMatch[1].toUpperCase()}` : null;
  }

  function isAllowedAccentColor(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return false;
    const { lightness, saturation } = rgbToHsl(rgb.r, rgb.g, rgb.b);
    if (lightness < 0.18 || lightness > 0.88) return false;
    if (saturation < 0.12 && (lightness < 0.24 || lightness > 0.76)) return false;
    return true;
  }

  function hexToRgb(hex) {
    const normalized = normalizeHexColor(hex);
    if (!normalized) return null;
    const value = normalized.slice(1);
    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16)
    };
  }

  function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return { hue: h, saturation: s, lightness: l };
  }

  function openModal(markup, afterRender) {
    const existing = document.getElementById('modalLayer');
    if (existing) existing.remove();
    const wrapper = document.createElement('div');
    wrapper.id = 'modalLayer';
    wrapper.className = 'modal-layer';
    wrapper.innerHTML = markup;
    document.body.appendChild(wrapper);
    document.body.classList.add('modal-open');
    wrapper.addEventListener('click', (event) => {
      if (event.target === wrapper || event.target.closest('[data-close-modal]')) closeModal();
    });
    document.addEventListener('keydown', escCloseModal);
    if (typeof afterRender === 'function') afterRender();
    requestAnimationFrame(() => requestAnimationFrame(() => wrapper.classList.add('show')));
  }

  function closeModal(animate = true) {
    const layer = document.getElementById('modalLayer');
    if (!layer) return;
    document.removeEventListener('keydown', escCloseModal);
    const removeLayer = () => {
      layer.remove();
      document.body.classList.remove('modal-open');
    };
    if (!animate) {
      removeLayer();
      return;
    }
    layer.classList.remove('show');
    window.setTimeout(removeLayer, 180);
  }

  function escCloseModal(event) {
    if (event.key === 'Escape') closeModal();
  }

  function pulseElement(element, className) {
    if (!element) return;
    if (!prefEnabled('effectsMotion')) return;
    if (className === 'tab-enter') {
      if (!prefEnabled('tabTransitions')) return;
      element.classList.remove(className);
      requestAnimationFrame(() => element.classList.add(className));
      return;
    }
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
  }

  function escapeSelector(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') return CSS.escape(String(value));
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('./sw.js?v=0.24.181', { updateViaCache: 'none' });
        registration.update();
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (refreshing) return;
          refreshing = true;
          window.location.reload();
        });
      } catch (error) {
        console.warn('Service worker no registrado:', error);
      }
    });
  }

  function toast(message) {
    $toast.textContent = message;
    $toast.classList.add('show');
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => $toast.classList.remove('show'), 3200);
  }

  function readJSON(key) {
    try { return JSON.parse(localStorage.getItem(key)); }
    catch { return null; }
  }

  function unique(values) {
    return [...new Set(values.filter(Boolean))];
  }

  function normalizeID(value) {
    return String(value || '').trim().toLowerCase();
  }

  function randomPhrase() {
    return phrases[Math.floor(Math.random() * phrases.length)];
  }

  function todayISO() {
    const date = new Date();
    const tzOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzOffset).toISOString().slice(0, 10);
  }

  function readableDate(iso) {
    const date = new Date(`${iso}T12:00:00`);
    return new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  }

  function normalizeSearch(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  function makeUsername(name) {
    return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/\s+/).map(part => part.slice(0, 4)).join('').slice(0, 14);
  }

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function escapeAttr(value) {
    return escapeHTML(value);
  }

  function lockViewportZoom() {
    const prevent = (event) => event.preventDefault();
    document.addEventListener('gesturestart', prevent, { passive: false });
    document.addEventListener('gesturechange', prevent, { passive: false });
    document.addEventListener('gestureend', prevent, { passive: false });
    window.addEventListener('wheel', (event) => {
      if (event.ctrlKey) event.preventDefault();
    }, { passive: false });
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (event) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 320) event.preventDefault();
      lastTouchEnd = now;
    }, { passive: false });
  }

  lockViewportZoom();

})();
