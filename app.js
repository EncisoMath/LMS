(() => {
  'use strict';

  const APP_VERSION = '0.24.294';
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

  let lastQuizItemTransitionSoundAt = 0;

  function playQuizItemTransitionSound() {
    const now = Date.now();
    if (now - lastQuizItemTransitionSoundAt < 700) return;
    lastQuizItemTransitionSoundAt = now;
    playQuizSound('item');
  }
  const QUIZ_TIMED_MUSIC_SECONDS = [20, 30, 60, 90, 120];
  const QUIZ_TIMED_MUSIC_DISCOVERY_LIMIT = 3;
  const QUIZ_TIMED_MUSIC_EXTENSIONS = ['.mp3'];
  const QUIZ_TIMED_MUSIC_LIBRARY = {
      "20": [],
      "30": [],
      "60": [],
      "90": [],
      "120": []
  };
  const QUIZ_MUSIC_VOLUME = 0.28;
  const QUIZ_MUSIC_FADE_MS = 160;
  const QUIZ_RESULTS_MUSIC_PATH = './assets/music_quiz/results.mp3';
  const QUIZ_RESULTS_MUSIC_VOLUME = 0.28;
  const QUIZ_RESULTS_MUSIC_FADE_MS = 420;
  const quizTimedMusicDiscoveryCache = new Map();
  let quizQuestionMusicAudio = null;
  let quizQuestionMusicKey = '';
  let quizQuestionMusicFadeTimer = null;
  let quizQuestionMusicRequestId = 0;
  let quizResultsMusicAudio = null;
  let quizResultsMusicFadeTimer = null;

  function quizTimedMusicBucket(seconds) {
    const value = Number.parseInt(seconds, 10);
    return QUIZ_TIMED_MUSIC_SECONDS.includes(value) ? value : 0;
  }
  function quizTimedMusicCandidates(seconds) {
    const bucket = quizTimedMusicBucket(seconds);
    if (!bucket) return [];
    const known = Array.isArray(QUIZ_TIMED_MUSIC_LIBRARY[String(bucket)]) ? QUIZ_TIMED_MUSIC_LIBRARY[String(bucket)] : [];
    const guessed = [];
    for (let index = 1; index <= QUIZ_TIMED_MUSIC_DISCOVERY_LIMIT; index += 1) {
      QUIZ_TIMED_MUSIC_EXTENSIONS.forEach((ext) => guessed.push(`./assets/music_quiz/${bucket}_${index}${ext}`));
    }
    return [...new Set([...known, ...guessed])];
  }

  async function quizTimedMusicUrlExists(src) {
    if (!src || typeof fetch !== 'function') return false;
    try {
      const head = await fetch(src, { method: 'HEAD', cache: 'no-store' });
      if (head.ok) return true;
      if (![405, 501].includes(head.status)) return false;
    } catch (_) {}
    try {
      const partial = await fetch(src, {
        method: 'GET',
        cache: 'no-store',
        headers: { Range: 'bytes=0-0' }
      });
      return partial.ok;
    } catch (_) {
      return false;
    }
  }

  async function discoverQuizTimedMusicTracks(seconds) {
    const bucket = quizTimedMusicBucket(seconds);
    if (!bucket) return [];
    const key = String(bucket);
    if (quizTimedMusicDiscoveryCache.has(key)) return quizTimedMusicDiscoveryCache.get(key);
    const candidates = quizTimedMusicCandidates(bucket);
    const lookup = Promise.all(candidates.map(async (src) => ({ src, ok: await quizTimedMusicUrlExists(src) })))
      .then((results) => results.filter((item) => item.ok).map((item) => item.src))
      .catch(() => []);
    quizTimedMusicDiscoveryCache.set(key, lookup);
    return lookup;
  }
  function currentQuizMusicPath() {
    return '';
  }
  function stopQuizResultsMusic(fade = true) {
    const audio = quizResultsMusicAudio;
    if (quizResultsMusicFadeTimer) {
      window.clearInterval(quizResultsMusicFadeTimer);
      quizResultsMusicFadeTimer = null;
    }
    if (!audio) return;
    const finish = () => {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch (_) {}
      if (quizResultsMusicAudio === audio) quizResultsMusicAudio = null;
    };
    if (!fade) {
      finish();
      return;
    }
    const startVolume = Number.isFinite(audio.volume) ? audio.volume : QUIZ_RESULTS_MUSIC_VOLUME;
    const started = Date.now();
    quizResultsMusicFadeTimer = window.setInterval(() => {
      const progress = Math.min(1, (Date.now() - started) / QUIZ_RESULTS_MUSIC_FADE_MS);
      try { audio.volume = Math.max(0, startVolume * (1 - progress)); } catch (_) {}
      if (progress >= 1) {
        window.clearInterval(quizResultsMusicFadeTimer);
        quizResultsMusicFadeTimer = null;
        finish();
      }
    }, 20);
  }
  function startQuizResultsMusic() {
    if (!quizSoundsEnabled()) return;
    stopQuizQuestionMusic(false);
    if (quizResultsMusicFadeTimer) stopQuizResultsMusic(false);
    if (quizResultsMusicAudio) {
      try {
        quizResultsMusicAudio.loop = true;
        quizResultsMusicAudio.volume = QUIZ_RESULTS_MUSIC_VOLUME;
        if (quizResultsMusicAudio.paused) {
          const playPromise = quizResultsMusicAudio.play();
          if (playPromise && typeof playPromise.catch === 'function') playPromise.catch(() => {});
        }
      } catch (_) {}
      return;
    }
    try {
      const audio = new Audio(QUIZ_RESULTS_MUSIC_PATH);
      audio.preload = 'auto';
      audio.loop = true;
      audio.volume = QUIZ_RESULTS_MUSIC_VOLUME;
      audio.currentTime = 0;
      quizResultsMusicAudio = audio;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') playPromise.catch(() => {});
    } catch (_) {}
  }
  function stopQuizQuestionMusic(fade = true, cancelPending = true) {
    if (cancelPending) quizQuestionMusicRequestId += 1;
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
    }, 20);
  }
  function questionAllowsQuizMusic(question = getCurrentQuizQuestion()) {
    return Boolean(question);
  }

  async function selectQuizTimedMusicPath(question = getCurrentQuizQuestion()) {
    const seconds = getQuizQuestionTimeLimit(question, getActiveQuiz());
    const tracks = await discoverQuizTimedMusicTracks(seconds);
    if (!tracks.length) return '';
    return tracks[Math.floor(Math.random() * tracks.length)];
  }

  async function startQuizQuestionMusic(question = getCurrentQuizQuestion()) {
    stopQuizResultsMusic(false);
    if (!quizSoundsEnabled() || !questionAllowsQuizMusic(question)) {
      stopQuizQuestionMusic(false);
      return;
    }
    const quiz = getActiveQuiz();
    const session = getQuizSession();
    const questionIndex = Number(state.quizQuestionIndex) || 0;
    if (!quiz || session.phase !== 'question' || session.locked) return;
    const seconds = getQuizQuestionTimeLimit(question, quiz);
    if (!quizTimedMusicBucket(seconds)) {
      stopQuizQuestionMusic(false);
      return;
    }
    const questionKeyPrefix = `${quiz?.id || 'quiz'}:${questionIndex}:`;
    if (quizQuestionMusicAudio && quizQuestionMusicKey.startsWith(questionKeyPrefix)) {
      try {
        quizQuestionMusicAudio.loop = false;
        quizQuestionMusicAudio.volume = QUIZ_MUSIC_VOLUME;
        if (quizQuestionMusicAudio.paused) {
          const playPromise = quizQuestionMusicAudio.play();
          if (playPromise && typeof playPromise.catch === 'function') playPromise.catch(() => {});
        }
      } catch (_) {}
      return;
    }
    const requestId = quizQuestionMusicRequestId + 1;
    quizQuestionMusicRequestId = requestId;
    const src = await selectQuizTimedMusicPath(question);
    if (requestId !== quizQuestionMusicRequestId) return;
    const freshSession = getQuizSession();
    if (!src || !quizSoundsEnabled() || freshSession.phase !== 'question' || freshSession.locked || Number(state.quizQuestionIndex) !== questionIndex) return;
    stopQuizQuestionMusic(false, false);
    try {
      const audio = new Audio(src);
      audio.preload = 'auto';
      audio.loop = false;
      audio.volume = QUIZ_MUSIC_VOLUME;
      audio.currentTime = 0;
      quizQuestionMusicAudio = audio;
      quizQuestionMusicKey = `${quiz?.id || 'quiz'}:${questionIndex}:${src}`;
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
  const QUIZ_FEEDBACK_TOTAL_DURATION_MS = 3500;
  const QUIZ_FEEDBACK_BAND_EXIT_START_MS = 3000;
  const QUIZ_TRANSITION_ENTER_MS = 1350;
  const QUIZ_TRANSITION_WAIT_MS = 3000;
  const QUIZ_TRANSITION_EXIT_MS = 1180;
  const QUIZ_TRANSITION_START_BLACK_MS = 350;
  const QUIZ_TRANSITION_EXIT_START_MS = QUIZ_TRANSITION_START_BLACK_MS + QUIZ_TRANSITION_ENTER_MS + QUIZ_TRANSITION_WAIT_MS;
  const QUIZ_TRANSITION_TOTAL_MS = QUIZ_TRANSITION_EXIT_START_MS + QUIZ_TRANSITION_EXIT_MS;
  const QUIZ_TRANSITION_FIRST_INFO_MS = QUIZ_TRANSITION_START_BLACK_MS + QUIZ_TRANSITION_ENTER_MS + QUIZ_TRANSITION_WAIT_MS;
  const QUIZ_TRANSITION_FIRST_EXIT_START_MS = QUIZ_TRANSITION_START_BLACK_MS + (QUIZ_TRANSITION_ENTER_MS * 2) + (QUIZ_TRANSITION_WAIT_MS * 2);
  const QUIZ_TRANSITION_FIRST_TOTAL_MS = QUIZ_TRANSITION_FIRST_EXIT_START_MS + QUIZ_TRANSITION_EXIT_MS;
  const QUIZ_ITEM_TIME_LIMIT_DEFAULT = 20;
  const QUIZ_ITEM_TIME_LIMIT_MIN = 1;
  const QUIZ_ITEM_TIME_LIMIT_MAX = 999;
  const QUIZ_COUNTDOWN_DANGER_SECONDS = 10;
  const QUIZ_TIMEOUT_FEEDBACK_TEXT = '__encisomath_timeout__';
  const QUIZ_SCORE_TOTAL_ITEM_POINTS = 10000;
  const QUIZ_SCORE_TOTAL_TIME_POINTS = 10000;
  const QUIZ_TRANSITION_SCORE_TUNE_KEY = 'encisomath:quizTransitionScoreTune:v0.24.223';
  const QUIZ_TRANSITION_SCORE_TUNE_DEFAULTS = { y: 300, zoom: 55 };
  const QUIZ_TRANSITION_SCORE_TUNE_FIELDS = [
    { key: 'y', label: 'Posición Y contador', min: -300, max: 420, step: 1, unit: 'px' },
    { key: 'zoom', label: 'Zoom contador', min: 55, max: 150, step: 1, unit: '%' }
  ];
  const QUIZ_DEBUG_PAUSE_COUNTDOWN = false;
  const QUIZ_PADDING_DEBUG_KEY = 'encisomath:quizPaddingDebugTune:v0.24.223';
  const QUIZ_PADDING_DEBUG_DEFAULTS = { layerX: 0, contentX: 4, questionX: 0, answerX: 0, optionsX: 0, optionsPullX: 0 };
  const QUIZ_PADDING_DEBUG_FIELDS = [
    { key: 'layerX', label: 'Pantalla completa X', min: 0, max: 18, step: 1, unit: 'px' },
    { key: 'contentX', label: 'Contenido quiz X', min: 0, max: 16, step: 1, unit: 'px' },
    { key: 'questionX', label: 'Pregunta interna X', min: 0, max: 16, step: 1, unit: 'px' },
    { key: 'answerX', label: 'Zona opciones X', min: 0, max: 16, step: 1, unit: 'px' },
    { key: 'optionsX', label: 'Opciones internas X', min: 0, max: 16, step: 1, unit: 'px' },
    { key: 'optionsPullX', label: 'Expandir opciones X', min: -24, max: 24, step: 1, unit: 'px' }
  ];
  const QUIZ_COUNTDOWN_TUNE_KEY = 'encisomath:quizCountdownTune:v0.24.223';
  const QUIZ_COUNTDOWN_TUNE_DEFAULTS = { x: 23 };
  const QUIZ_COUNTDOWN_TUNE_FIELDS = [
    { key: 'x', label: 'Countdown X', min: -36, max: 64, step: 1, unit: 'px' }
  ];
  const QUIZ_TIME_SCORING_MODE_KEY = 'encisomath:quizTimeScoringMode:v0.24.223';
  const QUIZ_TIME_SCORING_MODE_DEFAULT = 'curve';
  const QUIZ_TIME_SCORING_MODES = new Set(['curve', 'speed']);
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
    quizTimeScoringMode: localStorage.getItem(QUIZ_TIME_SCORING_MODE_KEY) || QUIZ_TIME_SCORING_MODE_DEFAULT,
    quizQuestionIndex: 0,
    quizFullscreenActive: false,
    quizSession: { phase: 'idle', answers: [], locked: false, selectedAnswerId: '', securityEvents: [], securityWarningOpen: false, securityTerminated: false },
    quizTimers: [],
    quizCountdown: null,
    attendanceDate: todayISO(),
    filters: { grade: 'all', area: 'all', course: 'all' },
    studentSearch: '',
    prefs: { ...DEFAULT_PREFS, ...(readJSON('encisomath:prefs') || {}) },
    quizTransitionPanelOpen: false,
    quizTransitionScorePanelOpen: false,
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
      emFlatApplyBackgrounds($app);
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

    const markup = `
      <main class="screen home-screen">
        <section class="twitter-profile">
          <div class="profile-cover" data-em-flat-bg data-em-flat-bg-color="#1368ce"></div>
          <div class="profile-info">
            <div class="profile-action-row">
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
          <div id="assignmentsGrid" class="em-sub-home-wrap">
            ${emSubHomeSubjectsHTML(assignments)}
          </div>
        </section>
      </main>
    `;

    mount(markup, () => {
      document.getElementById('logoutBtn').addEventListener('click', logout);
      document.getElementById('notifyBtn').addEventListener('click', requestNotificationTest);
      bindAssignmentCards(assignments);
    });
  }
  function renderTeacherAssignmentGrid() {
    const teacher = state.user;
    const assignments = getTeacherAssignments(teacher.id);
    const grid = document.getElementById('assignmentsGrid');
    if (!grid) return;
    emSubRenderHomeSubjects(assignments, grid);
    grid.classList.remove('grid-local-update');
    void grid.offsetWidth;
    grid.classList.add('grid-local-update');
  }
  function bindAssignmentCards(assignments = getTeacherAssignments(state.user?.id)) {
    document.querySelectorAll('[data-open-assignment], [data-subject-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const assignmentId = button.dataset.openAssignment || button.dataset.subjectId;
        const assignment = assignments.find((item) => String(item.id) === String(assignmentId));
        if (!assignment) return;
        const subjectColor = button.dataset.subjectColor || emGetSubjectColorForAssignment(assignment);
        emSetCurrentSubjectColor(subjectColor);
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
    emSetCurrentSubjectColor(emGetSubjectColorForAssignment(assignment));
    const iconSrc = getAssignmentIcon(assignment);

    const studentCount = getStudentsForAssignment(assignment).length;
    const markup = `
      <main class="screen subject-screen">
        <header class="topbar fixed-lock em-subject-topbar">
          <button class="icon-btn" id="backBtn" aria-label="Volver">←</button>
          <h1>${escapeHTML(assignment.subject)}</h1>
          <span class="spacer"></span>
          <button class="icon-btn" id="homeBtn" aria-label="Inicio">⌂</button>
        </header>
        <section class="subject-banner" data-em-flat-bg data-icon-hidden="${isSubjectIconVisible(assignment) ? 'false' : 'true'}">
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
        <nav class="em-subject-top-tabs" aria-label="Pestañas de asignatura">
          <div class="em-subject-top-tabs-track">
            <button class="em-subject-tab-btn ${tab === 'students' ? 'is-active active' : ''}" id="studentsTab" type="button" data-tab="students">👥 Estudiantes</button>
            <button class="em-subject-tab-btn ${tab === 'classes' ? 'is-active active' : ''}" id="classesTab" type="button" data-tab="classes">📚 Clases</button>
            <button class="em-subject-tab-btn ${tab === 'rockstars' ? 'is-active active' : ''}" id="rockstarsTab" type="button" data-tab="rockstars">🚀 Rockstars</button>
            <button class="em-subject-tab-btn ${tab === 'quizzes' ? 'is-active active' : ''}" id="quizzesTab" type="button" data-tab="quizzes">🎮 Quizzes</button>
          </div>
        </nav>
        <section id="tabContent" class="section tab-section"></section>
      </main>
    `;

    mount(markup, () => {
      document.getElementById('backBtn').addEventListener('click', renderTeacherHome);
      document.getElementById('homeBtn').addEventListener('click', renderTeacherHome);
      document.getElementById('studentsTab').addEventListener('click', () => setSubjectTab('students'));
      document.getElementById('classesTab').addEventListener('click', () => setSubjectTab('classes'));
      document.getElementById('rockstarsTab').addEventListener('click', () => setSubjectTab('rockstars'));
      document.getElementById('quizzesTab').addEventListener('click', () => setSubjectTab('quizzes'));
      emInitSubjectToolbar(document);
      applySubjectInfoTune();
      setActiveSubjectTabMeta(tab);
      if (tab === 'students') renderStudentsTab({ animate: true });
      else if (tab === 'rockstars') renderRockstarsTab({ animate: true });
      else if (tab === 'quizzes') renderQuizzesTab({ animate: true });
      else renderClassesTab({ animate: true });
    });
  }
  function getSubjectInfoTune() {
    return { ...SUBJECT_INFO_TUNE_DEFAULTS };
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
    const updateSubjectTopTab = (id, isActive) => {
      const button = document.getElementById(id);
      if (!button) return;
      button.classList.toggle('active', isActive);
      button.classList.toggle('is-active', isActive);
    };
    updateSubjectTopTab('studentsTab', tab === 'students');
    updateSubjectTopTab('classesTab', tab === 'classes');
    updateSubjectTopTab('rockstarsTab', tab === 'rockstars');
    updateSubjectTopTab('quizzesTab', tab === 'quizzes');
    commitAppRoute({ screen: 'subject', assignmentId: state.assignment?.id || '', tab }, options);
    if (tab === 'students') renderStudentsTab({ animate: true });
    else if (tab === 'rockstars') renderRockstarsTab({ animate: true });
    else if (tab === 'quizzes') renderQuizzesTab({ animate: true });
    else renderClassesTab({ animate: true });
  }
  function renderStudentsTab(options = {}) {
    const assignment = state.assignment;
    const $content = document.getElementById('tabContent');
    if (!$content) return;
    setActiveSubjectTabMeta('students');

    $content.innerHTML = `
      <section class="em-students-attendance-tools">
        <div class="em-attendance-date-card" data-em-attendance-band>
          <span class="em-attendance-shape" aria-hidden="true"></span>
          <span class="em-attendance-shape" aria-hidden="true"></span>

          <div class="em-attendance-title-box">
            <h1 class="em-attendance-title">Asistencia diaria</h1>
            <p class="em-attendance-subtitle" id="attendanceReadableDate">${readableDate(state.attendanceDate)}</p>
          </div>

          <label class="em-date-pill" for="attendanceDate">
            <input id="attendanceDate" type="date" value="${state.attendanceDate}" />
          </label>
        </div>

        <div class="em-attendance-actions-row">
          <label class="em-search-box" for="studentSearch">
            <span class="em-search-tag">Buscar</span>
            <input class="em-search-input" id="studentSearch" type="search" placeholder="Nombre o código" value="${escapeAttr(state.studentSearch || '')}" />
          </label>

          <button class="em-add-button" id="openAddStudentBtn" type="button">Añadir</button>
        </div>
      </section>
      <div class="em-students-count-title">Estudiantes <strong>(${getStudentsForAssignment(assignment).length})</strong></div>
      <div id="studentList" class="student-list em-rs-list">
        ${studentListHTML()}
      </div>
    `;

    bindStudentTabEvents();
    emRandomizeAttendanceBandShapes($content);
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
      const readable = document.getElementById('attendanceReadableDate');
      if (readable) readable.textContent = readableDate(state.attendanceDate);
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
    document.querySelectorAll('.em-rs-att-btn[data-student-id][data-status-option]').forEach((button) => {
      button.addEventListener('click', () => {
        const studentId = button.dataset.studentId;
        const visualStatus = button.dataset.statusOption;
        const storedStatus = emRsVisualStatusToStored(visualStatus);
        const current = getAttendance(assignment.id, state.attendanceDate);

        emRsReplayClass(button, 'tap', 300);

        if (storedStatus) current[studentId] = storedStatus;
        else delete current[studentId];

        saveAttendance(assignment.id, state.attendanceDate, current);
        updateStudentCardAttendance(studentId, storedStatus || 'none');
        syncRockstarListAfterAttendanceChange();
      });
    });

    document.querySelectorAll('.em-rs-trash-btn[data-student-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const studentId = button.dataset.studentId;
        const current = getAttendance(assignment.id, state.attendanceDate);

        emRsReplayClass(button, 'tap', 300);
        delete current[studentId];

        saveAttendance(assignment.id, state.attendanceDate, current);
        updateStudentCardAttendance(studentId, 'none');
        syncRockstarListAfterAttendanceChange();
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
    if (!card) return;

    const visualStatus = emRsStatusToVisual(status);
    const storedStatus = emRsVisualStatusToStored(visualStatus);
    if (card.classList.contains('em-rs-att-card')) {
      card.classList.remove('present', 'absent', 'excuse', 'none');
      card.classList.add(visualStatus);
      card.querySelectorAll('.em-rs-att-btn').forEach((button) => {
        button.classList.toggle('is-active', button.dataset.statusOption === visualStatus);
      });
      emRsSetRandomShape(card);
      emRsReplayCardState(card, 'status-change', 760);
      return;
    }

    const info = statusMap[storedStatus] || null;
    card.classList.remove('present', 'absent', 'excused', 'flash-present', 'flash-absent', 'flash-excused');
    if (info) card.classList.add(info.className, `flash-${info.className}`);
    const meta = card.querySelector('[data-attendance-meta]');
    if (meta) meta.textContent = `📅 Asistencia: ${info ? `${info.emoji} ${info.label}` : 'Sin marcar'}`;
    card.querySelectorAll('.att-btn').forEach((button) => {
      button.classList.toggle('active', button.dataset.status === storedStatus);
    });
    if (info) card.addEventListener('animationend', () => card.classList.remove(`flash-${info.className}`), { once: true });
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
  function getWarningTune() {
    return { ...WARNING_TUNE_DEFAULTS };
  }
  function warningTuneValueLabel(field, value) {
    return `${value}${field.unit}`;
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


  const EM_RS_HERO_CONFIG = {
    rocketRotationDeg: -30,
    starsAngleDeg: 45,
    starDistancePx: 390,
    starsTotal: 64,
    starColors: ['#ffffff', '#edf3ff', '#d7e4ff', '#f6f9ff']
  };

  function emRsEscapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
  function emRsNormalizeGradeCourse(value) {
    return String(value ?? '')
      .replace(/\s+/g, '')
      .toUpperCase();
  }
  function emRsGetAssignmentGradeCourse(assignment = {}) {
    const direct = assignment.gradeCourse || assignment.gradeCourseLabel || assignment.group || assignment.groupLabel;
    if (direct) return emRsNormalizeGradeCourse(direct) || '113PPAL';

    const grade = emRsNormalizeGradeCourse(assignment.grade);
    const course = emRsNormalizeGradeCourse(assignment.course);
    const combined = `${grade}${course}`;

    return combined || '113PPAL';
  }
  function emRsRockstarsHeroHTML(subjectName = 'ESTADÍSTICA', gradeCourse = '113PPAL') {
    const eyebrow = `${emRsEscapeHtml(subjectName)} • ${emRsEscapeHtml(gradeCourse)}`;

    return `
      <div class="em-rs-heroSkin" data-em-rockstars-hero>
        <div class="em-rs-starsLayer" aria-hidden="true"></div>

        <div class="em-rs-rocketWrap" aria-hidden="true">
          <div class="em-rs-rocket">
            <span class="em-rs-window"></span>
            <span class="em-rs-fin em-rs-finLeft"></span>
            <span class="em-rs-fin em-rs-finRight"></span>
            <span class="em-rs-flame"></span>
          </div>
        </div>

        <div class="em-rs-content">
          <span class="em-rs-eyebrow">${eyebrow}</span>
          <h1 class="em-rs-title">ROCKSTARS</h1>
          <p class="em-rs-subtitle">Estudiantes destacados de EncisoMath.</p>
        </div>
      </div>
    `;
  }
  function emRsRandom(min, max) {
    return Math.random() * (max - min) + min;
  }
  function emRsPick(array) {
    return array[Math.floor(Math.random() * array.length)];
  }
  function emRsSetStarVector(heroSkin) {
    const degrees = EM_RS_HERO_CONFIG.starsAngleDeg;
    const radians = degrees * Math.PI / 180;
    const distance = EM_RS_HERO_CONFIG.starDistancePx;

    const x = Math.cos(radians) * distance;
    const y = Math.sin(radians) * distance;

    heroSkin.style.setProperty('--em-rs-star-from-x', `${(-x).toFixed(2)}px`);
    heroSkin.style.setProperty('--em-rs-star-from-y', `${(-y).toFixed(2)}px`);
    heroSkin.style.setProperty('--em-rs-star-to-x', `${x.toFixed(2)}px`);
    heroSkin.style.setProperty('--em-rs-star-to-y', `${y.toFixed(2)}px`);
  }
  function emRsCreateStars(heroSkin) {
    const starsLayer = heroSkin.querySelector('.em-rs-starsLayer');

    if (!starsLayer) return;

    starsLayer.innerHTML = '';

    for (let i = 0; i < EM_RS_HERO_CONFIG.starsTotal; i += 1) {
      const star = document.createElement('span');

      const x = emRsRandom(-8, 108);
      const y = emRsRandom(-10, 110);

      const size = emRsRandom(1.4, 4.8);
      const alpha = emRsRandom(0.36, 0.94);
      const duration = emRsRandom(4.2, 9.4);
      const delay = -emRsRandom(0, duration);
      const color = emRsPick(EM_RS_HERO_CONFIG.starColors);

      star.className = 'em-rs-star';

      star.style.setProperty('--em-rs-star-x', `${x.toFixed(2)}%`);
      star.style.setProperty('--em-rs-star-y', `${y.toFixed(2)}%`);
      star.style.setProperty('--em-rs-star-size', `${size.toFixed(2)}px`);
      star.style.setProperty('--em-rs-star-alpha', alpha.toFixed(2));
      star.style.setProperty('--em-rs-star-duration', `${duration.toFixed(2)}s`);
      star.style.setProperty('--em-rs-star-delay', `${delay.toFixed(2)}s`);
      star.style.setProperty('--em-rs-star-color', color);

      starsLayer.appendChild(star);
    }
  }
  function emRsInitRockstarsHero(root = document) {
    const heroes = root.querySelectorAll
      ? root.querySelectorAll('[data-em-rockstars-hero]')
      : [];

    heroes.forEach((heroSkin) => {
      heroSkin.style.setProperty(
        '--em-rs-rocket-tilt',
        `${EM_RS_HERO_CONFIG.rocketRotationDeg}deg`
      );

      emRsSetStarVector(heroSkin);
      emRsCreateStars(heroSkin);
    });
  }

  const EM_QZ_HERO_CONFIG = {
    shapesTotal: 7,
    shapesSpeed: 0.38,
    shapeTypes: ['square', 'triangle', 'x', 'circle'],
    tileSwapMs: 2100,
    tilePositions: [
      { x: 0, y: 0, r: -2 },
      { x: 47, y: 0, r: 2 },
      { x: 0, y: 47, r: 2 },
      { x: 47, y: 47, r: -2 }
    ]
  };

  let emQzTileOrder = [0, 1, 2, 3];
  let emQzSwapTimer = null;

  function emQzEscapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
  function emQzNormalizeGradeCourse(value) {
    return String(value ?? '')
      .replace(/\s+/g, '')
      .toUpperCase();
  }
  function emQzGetAssignmentGradeCourse(assignment = {}) {
    const direct = assignment.gradeCourse || assignment.gradeCourseLabel || assignment.group || assignment.groupLabel;
    if (direct) return emQzNormalizeGradeCourse(direct) || '113PPAL';

    const grade = emQzNormalizeGradeCourse(assignment.grade);
    const course = emQzNormalizeGradeCourse(assignment.course);
    const combined = `${grade}${course}`;

    return combined || '113PPAL';
  }
  function emQzQuizzesHeroHTML(subjectName = 'ESTADÍSTICA', gradeCourse = '113PPAL') {
    const eyebrow = `${emQzEscapeHtml(subjectName)} • ${emQzEscapeHtml(gradeCourse)}`;

    return `
      <div class="em-qz-shapesLayer" aria-hidden="true"></div>

      <div class="em-qz-quizBoard" aria-hidden="true">
        <div class="em-qz-answerTile em-qz-red" data-em-qz-tile="0" style="--em-qz-tile-delay: 0s;">
          <div class="em-qz-answerTileInner">
            <span class="em-qz-iconTriangle"></span>
          </div>
        </div>

        <div class="em-qz-answerTile em-qz-blue" data-em-qz-tile="1" style="--em-qz-tile-delay: 0.18s;">
          <div class="em-qz-answerTileInner">
            <span class="em-qz-iconX"></span>
          </div>
        </div>

        <div class="em-qz-answerTile em-qz-yellow" data-em-qz-tile="2" style="--em-qz-tile-delay: 0.36s;">
          <div class="em-qz-answerTileInner">
            <span class="em-qz-iconCircle"></span>
          </div>
        </div>

        <div class="em-qz-answerTile em-qz-green" data-em-qz-tile="3" style="--em-qz-tile-delay: 0.54s;">
          <div class="em-qz-answerTileInner">
            <span class="em-qz-iconSquare"></span>
          </div>
        </div>
      </div>

      <div class="em-qz-content">
        <span class="em-qz-eyebrow">${eyebrow}</span>
        <h1 class="em-qz-title">QUIZZES</h1>
        <p class="em-qz-subtitle">Retos rápidos para aprender jugando.</p>
      </div>
    `;
  }
  function emQzRandom(min, max) {
    return Math.random() * (max - min) + min;
  }
  function emQzRandomInt(min, max) {
    return Math.floor(emQzRandom(min, max + 1));
  }
  function emQzShuffle(array) {
    const copy = [...array];

    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy;
  }
  function emQzBuildShapeTypeList(amount) {
    const list = [];

    while (list.length < amount) {
      list.push(...emQzShuffle(EM_QZ_HERO_CONFIG.shapeTypes));
    }

    return list.slice(0, amount);
  }
  function emQzShapePosition(index) {
    const zones = [
      { xMin: 4, xMax: 14, yMin: 10, yMax: 32 },
      { xMin: 18, xMax: 32, yMin: 62, yMax: 92 },
      { xMin: 38, xMax: 52, yMin: 6, yMax: 26 },
      { xMin: 54, xMax: 68, yMin: 60, yMax: 90 },
      { xMin: 70, xMax: 84, yMin: 10, yMax: 34 },
      { xMin: 82, xMax: 96, yMin: 54, yMax: 86 },
      { xMin: 92, xMax: 104, yMin: 10, yMax: 36 }
    ];

    const zone = zones[index % zones.length];

    return {
      x: emQzRandom(zone.xMin, zone.xMax),
      y: emQzRandom(zone.yMin, zone.yMax)
    };
  }
  function emQzCreateShapes(heroSkin) {
    const shapesLayer = heroSkin.querySelector('.em-qz-shapesLayer');

    if (!shapesLayer) return;

    shapesLayer.innerHTML = '';

    const types = emQzBuildShapeTypeList(EM_QZ_HERO_CONFIG.shapesTotal);

    for (let i = 0; i < EM_QZ_HERO_CONFIG.shapesTotal; i += 1) {
      const shape = document.createElement('span');
      const type = types[i];

      shape.className = `em-qz-shape em-qz-shape-${type}`;

      const pos = emQzShapePosition(i);
      const size = emQzRandomInt(58, 138);
      const alpha = emQzRandom(0.18, 0.36);

      const baseDuration = emQzRandom(11, 16);
      const duration = baseDuration / EM_QZ_HERO_CONFIG.shapesSpeed;
      const delay = -(emQzRandom(0, duration));

      const forceX = emQzRandom(14, 44);
      const forceY = emQzRandom(7, 20);

      const x0 = emQzRandom(-5, 5);
      const y0 = emQzRandom(-4, 4);

      const x1 = emQzRandom(-forceX, forceX);
      const y1 = emQzRandom(-forceY, forceY);

      const x2 = emQzRandom(-forceX * 1.12, forceX * 1.12);
      const y2 = emQzRandom(-forceY * 1.12, forceY * 1.12);

      const x3 = emQzRandom(-forceX, forceX);
      const y3 = emQzRandom(-forceY, forceY);

      const r0 = emQzRandomInt(-50, 50);
      const r1 = emQzRandomInt(90, 220);
      const r2 = emQzRandomInt(220, 420);
      const r3 = emQzRandomInt(420, 640);
      const r4 = r0 + 360;

      shape.style.setProperty('--em-qz-shape-x', `${pos.x.toFixed(1)}%`);
      shape.style.setProperty('--em-qz-shape-y', `${pos.y.toFixed(1)}%`);
      shape.style.setProperty('--em-qz-shape-size', `${size}px`);
      shape.style.setProperty('--em-qz-shape-alpha', alpha.toFixed(2));

      shape.style.setProperty('--em-qz-shape-duration', `${duration.toFixed(2)}s`);
      shape.style.setProperty('--em-qz-shape-delay', `${delay.toFixed(2)}s`);

      shape.style.setProperty('--em-qz-x0', `${x0.toFixed(1)}px`);
      shape.style.setProperty('--em-qz-y0', `${y0.toFixed(1)}px`);
      shape.style.setProperty('--em-qz-x1', `${x1.toFixed(1)}px`);
      shape.style.setProperty('--em-qz-y1', `${y1.toFixed(1)}px`);
      shape.style.setProperty('--em-qz-x2', `${x2.toFixed(1)}px`);
      shape.style.setProperty('--em-qz-y2', `${y2.toFixed(1)}px`);
      shape.style.setProperty('--em-qz-x3', `${x3.toFixed(1)}px`);
      shape.style.setProperty('--em-qz-y3', `${y3.toFixed(1)}px`);

      shape.style.setProperty('--em-qz-r0', `${r0}deg`);
      shape.style.setProperty('--em-qz-r1', `${r1}deg`);
      shape.style.setProperty('--em-qz-r2', `${r2}deg`);
      shape.style.setProperty('--em-qz-r3', `${r3}deg`);
      shape.style.setProperty('--em-qz-r4', `${r4}deg`);

      shapesLayer.appendChild(shape);
    }
  }
  function emQzApplyTilePositions(heroSkin) {
    const tiles = heroSkin.querySelectorAll('.em-qz-answerTile');

    tiles.forEach((tile) => {
      const tileIndex = Number(tile.dataset.emQzTile);
      const positionIndex = emQzTileOrder.indexOf(tileIndex);
      const pos = EM_QZ_HERO_CONFIG.tilePositions[positionIndex];

      tile.style.setProperty('--em-qz-tile-x', `${pos.x}px`);
      tile.style.setProperty('--em-qz-tile-y', `${pos.y}px`);
      tile.style.setProperty('--em-qz-tile-rotate', `${pos.r}deg`);

      tile.classList.add('is-moving');

      window.setTimeout(() => {
        tile.classList.remove('is-moving');
      }, 620);
    });
  }
  function emQzSwapTiles(heroSkin) {
    const newOrder = [...emQzTileOrder];

    const a = emQzRandomInt(0, 3);
    let b = emQzRandomInt(0, 3);

    while (b === a) {
      b = emQzRandomInt(0, 3);
    }

    [newOrder[a], newOrder[b]] = [newOrder[b], newOrder[a]];

    emQzTileOrder = newOrder;
    emQzApplyTilePositions(heroSkin);
  }
  function emQzStartTileSwap(heroSkin) {
    if (emQzSwapTimer) {
      clearInterval(emQzSwapTimer);
    }

    emQzSwapTimer = setInterval(() => {
      if (!document.body.contains(heroSkin)) {
        clearInterval(emQzSwapTimer);
        emQzSwapTimer = null;
        return;
      }

      emQzSwapTiles(heroSkin);
    }, EM_QZ_HERO_CONFIG.tileSwapMs);
  }
  function emQzInitQuizzesHero(root = document) {
    const heroes = root.querySelectorAll
      ? root.querySelectorAll('[data-em-quizzes-hero]')
      : [];

    heroes.forEach((heroSkin) => {
      if (heroSkin.dataset.emQzReady === '1') {
        return;
      }

      heroSkin.dataset.emQzReady = '1';

      emQzTileOrder = [0, 1, 2, 3];

      emQzCreateShapes(heroSkin);
      emQzApplyTilePositions(heroSkin);
      emQzStartTileSwap(heroSkin);
    });
  }



  const EM_CL_HERO_CONFIG = {
    shapesTotal: 7,
    shapesSpeed: 0.38,
    shapeTypes: ['square', 'triangle', 'x', 'circle'],
    cardSwapMs: 2300,
    cardPositions: [
      { x: 0, y: 0, r: -5 },
      { x: 17, y: 14, r: 4 },
      { x: 3, y: 29, r: 3 },
      { x: 19, y: 45, r: -4 }
    ]
  };

  const emClHeroStates = new WeakMap();

  function emClEscapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
  function emClClassesHeroHTML(
    eyebrow = 'TEMAS Y CONTENIDOS',
    title = 'CLASES',
    subtitle = 'Aprende por rutas, temas y actividades.'
  ) {
    return `
      <div class="em-cl-shapesLayer" aria-hidden="true"></div>

      <div class="em-cl-lessonsBoard" aria-hidden="true">
        <div class="em-cl-lessonCard em-cl-red" data-em-cl-card="0">
          <span class="em-cl-lessonLabel">TEMA 1</span>
          <span class="em-cl-lessonIcon"><span class="em-cl-iconBook"></span></span>
          <span class="em-cl-lessonLines">
            <span class="em-cl-lessonLine em-cl-one"></span>
            <span class="em-cl-lessonLine em-cl-two"></span>
          </span>
        </div>

        <div class="em-cl-lessonCard em-cl-blue" data-em-cl-card="1">
          <span class="em-cl-lessonLabel">TEMA 2</span>
          <span class="em-cl-lessonIcon">x²</span>
          <span class="em-cl-lessonLines">
            <span class="em-cl-lessonLine em-cl-one"></span>
            <span class="em-cl-lessonLine em-cl-two"></span>
          </span>
        </div>

        <div class="em-cl-lessonCard em-cl-yellow" data-em-cl-card="2">
          <span class="em-cl-lessonLabel">TEMA 3</span>
          <span class="em-cl-lessonIcon"><span class="em-cl-iconChart"><span></span><span></span><span></span></span></span>
          <span class="em-cl-lessonLines">
            <span class="em-cl-lessonLine em-cl-one"></span>
            <span class="em-cl-lessonLine em-cl-two"></span>
          </span>
        </div>

        <div class="em-cl-lessonCard em-cl-green" data-em-cl-card="3">
          <span class="em-cl-lessonLabel">TEMA 4</span>
          <span class="em-cl-lessonIcon"><span class="em-cl-iconList"><span></span><span></span><span></span></span></span>
          <span class="em-cl-lessonLines">
            <span class="em-cl-lessonLine em-cl-one"></span>
            <span class="em-cl-lessonLine em-cl-two"></span>
          </span>
        </div>
      </div>

      <div class="em-cl-content">
        <span class="em-cl-eyebrow">${emClEscapeHtml(eyebrow)}</span>
        <h1 class="em-cl-title">${emClEscapeHtml(title)}</h1>
        <p class="em-cl-subtitle">${emClEscapeHtml(subtitle)}</p>
      </div>
    `;
  }
  function emClRandom(min, max) {
    return Math.random() * (max - min) + min;
  }
  function emClRandomInt(min, max) {
    return Math.floor(emClRandom(min, max + 1));
  }
  function emClShuffle(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
  function emClBuildShapeTypeList(amount) {
    const list = [];
    while (list.length < amount) list.push(...emClShuffle(EM_CL_HERO_CONFIG.shapeTypes));
    return list.slice(0, amount);
  }
  function emClShapePosition(index) {
    const zones = [
      { xMin: 4, xMax: 14, yMin: 10, yMax: 32 },
      { xMin: 18, xMax: 32, yMin: 62, yMax: 92 },
      { xMin: 38, xMax: 52, yMin: 6, yMax: 26 },
      { xMin: 54, xMax: 68, yMin: 60, yMax: 90 },
      { xMin: 70, xMax: 84, yMin: 10, yMax: 34 },
      { xMin: 82, xMax: 96, yMin: 54, yMax: 86 },
      { xMin: 92, xMax: 104, yMin: 10, yMax: 36 }
    ];
    const zone = zones[index % zones.length];
    return { x: emClRandom(zone.xMin, zone.xMax), y: emClRandom(zone.yMin, zone.yMax) };
  }
  function emClGetHeroState(heroSkin) {
    let state = emClHeroStates.get(heroSkin);
    if (!state) {
      state = { cardOrder: [0, 1, 2, 3], timer: null };
      emClHeroStates.set(heroSkin, state);
    }
    return state;
  }
  function emClCreateShapes(heroSkin) {
    const shapesLayer = heroSkin.querySelector('.em-cl-shapesLayer');
    if (!shapesLayer) return;
    shapesLayer.innerHTML = '';
    const types = emClBuildShapeTypeList(EM_CL_HERO_CONFIG.shapesTotal);
    for (let i = 0; i < EM_CL_HERO_CONFIG.shapesTotal; i += 1) {
      const shape = document.createElement('span');
      const type = types[i];
      shape.className = `em-cl-shape em-cl-shape-${type}`;
      const pos = emClShapePosition(i);
      const size = emClRandomInt(58, 138);
      const alpha = emClRandom(0.18, 0.36);
      const baseDuration = emClRandom(11, 16);
      const duration = baseDuration / EM_CL_HERO_CONFIG.shapesSpeed;
      const delay = -emClRandom(0, duration);
      const forceX = emClRandom(14, 44);
      const forceY = emClRandom(7, 20);
      const x0 = emClRandom(-5, 5);
      const y0 = emClRandom(-4, 4);
      const x1 = emClRandom(-forceX, forceX);
      const y1 = emClRandom(-forceY, forceY);
      const x2 = emClRandom(-forceX * 1.12, forceX * 1.12);
      const y2 = emClRandom(-forceY * 1.12, forceY * 1.12);
      const x3 = emClRandom(-forceX, forceX);
      const y3 = emClRandom(-forceY, forceY);
      const r0 = emClRandomInt(-50, 50);
      const r1 = emClRandomInt(90, 220);
      const r2 = emClRandomInt(220, 420);
      const r3 = emClRandomInt(420, 640);
      const r4 = r0 + 360;

      shape.style.setProperty('--em-cl-shape-x', `${pos.x.toFixed(1)}%`);
      shape.style.setProperty('--em-cl-shape-y', `${pos.y.toFixed(1)}%`);
      shape.style.setProperty('--em-cl-shape-size', `${size}px`);
      shape.style.setProperty('--em-cl-shape-alpha', alpha.toFixed(2));
      shape.style.setProperty('--em-cl-shape-duration', `${duration.toFixed(2)}s`);
      shape.style.setProperty('--em-cl-shape-delay', `${delay.toFixed(2)}s`);
      shape.style.setProperty('--em-cl-x0', `${x0.toFixed(1)}px`);
      shape.style.setProperty('--em-cl-y0', `${y0.toFixed(1)}px`);
      shape.style.setProperty('--em-cl-x1', `${x1.toFixed(1)}px`);
      shape.style.setProperty('--em-cl-y1', `${y1.toFixed(1)}px`);
      shape.style.setProperty('--em-cl-x2', `${x2.toFixed(1)}px`);
      shape.style.setProperty('--em-cl-y2', `${y2.toFixed(1)}px`);
      shape.style.setProperty('--em-cl-x3', `${x3.toFixed(1)}px`);
      shape.style.setProperty('--em-cl-y3', `${y3.toFixed(1)}px`);
      shape.style.setProperty('--em-cl-r0', `${r0}deg`);
      shape.style.setProperty('--em-cl-r1', `${r1}deg`);
      shape.style.setProperty('--em-cl-r2', `${r2}deg`);
      shape.style.setProperty('--em-cl-r3', `${r3}deg`);
      shape.style.setProperty('--em-cl-r4', `${r4}deg`);
      shapesLayer.appendChild(shape);
    }
  }
  function emClApplyCardPositions(heroSkin) {
    const state = emClGetHeroState(heroSkin);
    const cards = heroSkin.querySelectorAll('.em-cl-lessonCard');
    cards.forEach((card) => {
      const cardIndex = Number(card.dataset.emClCard);
      const positionIndex = state.cardOrder.indexOf(cardIndex);
      const pos = EM_CL_HERO_CONFIG.cardPositions[positionIndex] || EM_CL_HERO_CONFIG.cardPositions[0];
      card.style.setProperty('--em-cl-card-x', `${pos.x}px`);
      card.style.setProperty('--em-cl-card-y', `${pos.y}px`);
      card.style.setProperty('--em-cl-card-r', `${pos.r}deg`);
      card.classList.add('is-moving');
      window.setTimeout(() => card.classList.remove('is-moving'), 660);
    });
  }
  function emClSwapCards(heroSkin) {
    const state = emClGetHeroState(heroSkin);
    const newOrder = [...state.cardOrder];
    const a = emClRandomInt(0, 3);
    let b = emClRandomInt(0, 3);
    while (b === a) b = emClRandomInt(0, 3);
    [newOrder[a], newOrder[b]] = [newOrder[b], newOrder[a]];
    state.cardOrder = newOrder;
    emClApplyCardPositions(heroSkin);
  }
  function emClStartCardSwap(heroSkin) {
    const state = emClGetHeroState(heroSkin);
    if (state.timer) clearInterval(state.timer);
    state.timer = setInterval(() => {
      if (!document.body.contains(heroSkin)) {
        clearInterval(state.timer);
        state.timer = null;
        return;
      }
      emClSwapCards(heroSkin);
    }, EM_CL_HERO_CONFIG.cardSwapMs);
  }
  function emClInitClassesHero(root = document) {
    const heroes = root.querySelectorAll
      ? root.querySelectorAll('[data-em-classes-hero]')
      : [];

    heroes.forEach((heroSkin) => {
      if (heroSkin.dataset.emClReady === '1') return;
      heroSkin.dataset.emClReady = '1';
      const state = emClGetHeroState(heroSkin);
      state.cardOrder = [0, 1, 2, 3];
      emClCreateShapes(heroSkin);
      emClApplyCardPositions(heroSkin);
      emClStartCardSwap(heroSkin);
    });
  }

  const EM_RS_SHAPE_TYPES = ['circle', 'square', 'triangle', 'x'];
  const emRsAnimationTimers = new WeakMap();

  function emRsGetTimerBucket(element) {
    let bucket = emRsAnimationTimers.get(element);
    if (!bucket) {
      bucket = {};
      emRsAnimationTimers.set(element, bucket);
    }
    return bucket;
  }

  function emRsReplayClass(element, className, duration = 800) {
    if (!element) return;
    const bucket = emRsGetTimerBucket(element);
    if (bucket[className]) {
      clearTimeout(bucket[className]);
      bucket[className] = null;
    }
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
    bucket[className] = window.setTimeout(() => {
      element.classList.remove(className);
      bucket[className] = null;
    }, duration);
  }

  function emRsReplayCardState(card, className, duration = 800) {
    if (!card) return;
    const bucket = emRsGetTimerBucket(card);
    ['score-hit', 'level-change', 'status-change'].forEach((stateClass) => {
      if (bucket[stateClass]) {
        clearTimeout(bucket[stateClass]);
        bucket[stateClass] = null;
      }
      card.classList.remove(stateClass);
    });
    void card.offsetWidth;
    card.classList.add(className);
    bucket[className] = window.setTimeout(() => {
      card.classList.remove(className);
      bucket[className] = null;
    }, duration);
  }

  function emRsRandomShape() {
    return EM_RS_SHAPE_TYPES[Math.floor(Math.random() * EM_RS_SHAPE_TYPES.length)];
  }

  function emRsSetRandomShape(card) {
    const shape = card?.querySelector('.em-rs-card-bg-shape');
    if (!shape) return;
    shape.className = 'em-rs-card-bg-shape';
    shape.classList.add(emRsRandomShape());
  }

  function emRsGetStudentId(student) {
    return student?.id || student?.studentId || student?.codigo || student?.code || '';
  }

  function emRsGetStudentName(student) {
    return student?.fullName || student?.name || student?.nombre || student?.full_name || '';
  }

  function emRsGetStudentCode(student) {
    return student?.codigo || student?.code || student?.id || '';
  }

  function emRsGetStudentUser(student) {
    return student?.username || student?.user || student?.usuario || '';
  }

  function emRsGetStudentSortKey(student) {
    return String(student?.sortKey || emRsGetStudentName(student))
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function emRsSortStudentsByLastName(list) {
    return [...list].sort((a, b) => emRsGetStudentSortKey(a).localeCompare(emRsGetStudentSortKey(b), 'es', { sensitivity: 'base' }));
  }

  function emRsStatusToVisual(status) {
    if (status === 'present') return 'present';
    if (status === 'absent') return 'absent';
    if (status === 'excused' || status === 'excuse') return 'excuse';
    return 'none';
  }

  function emRsVisualStatusToStored(status) {
    if (status === 'present') return 'present';
    if (status === 'absent') return 'absent';
    if (status === 'excuse') return 'excused';
    return '';
  }

  function emRsGetAttendanceLabel(status) {
    const visual = emRsStatusToVisual(status);
    if (visual === 'present') return 'Asistió';
    if (visual === 'absent') return 'No asistió';
    if (visual === 'excuse') return 'Excusa';
    return 'Sin marcar';
  }

  function emRsGetAttendanceEmoji(status) {
    const visual = emRsStatusToVisual(status);
    if (visual === 'present') return '✅';
    if (visual === 'absent') return '🔴';
    if (visual === 'excuse') return '⚠️';
    return '—';
  }

  function emRsIsAttendanceLocked(status) {
    return emRsStatusToVisual(status) !== 'present';
  }

  function emRsGetPointsSortedStudents(students, attendance) {
    const presentStudents = students.filter((student) => emRsStatusToVisual(attendance?.[emRsGetStudentId(student)]) === 'present');
    const lockedStudents = students.filter((student) => emRsStatusToVisual(attendance?.[emRsGetStudentId(student)]) !== 'present');
    return [
      ...emRsSortStudentsByLastName(presentStudents),
      ...emRsSortStudentsByLastName(lockedStudents)
    ];
  }

  function emRsGetTier(score) {
    const value = Number(score) || 0;
    if (value <= -5) return 'm5';
    if (value < 0) return 'm0';
    if (value === 0) return 'zero';
    if (value < 5) return 'p0';
    if (value < 10) return 'p5';
    if (value < 15) return 'p10';
    return 'p15';
  }

  function emRsGetEmoji(score) {
    const value = Number(score) || 0;
    if (value <= -5) return '💀';
    if (value < 0) return '😤';
    if (value === 0) return '😐';
    if (value < 5) return '🙂';
    if (value < 10) return '🚀';
    if (value < 15) return '😎';
    return '🔥';
  }

  function emRsCreateFloatScore(card, delta) {
    const float = document.createElement('span');
    float.className = `em-rs-float-score ${Number(delta) > 0 ? 'plus' : 'minus'}`;
    float.textContent = Number(delta) > 0 ? '+1' : '-1';
    card.appendChild(float);
    window.setTimeout(() => float.remove(), 600);
  }

  function getRockstarAttendanceDate() {
    return state.attendanceDate || todayISO();
  }

  function syncRockstarListAfterAttendanceChange() {
    const list = document.getElementById('rockstarList');
    if (list) refreshRockstarList(true);
  }

  function renderRockstarsTab(options = {}) {
    const assignment = state.assignment;
    const $content = document.getElementById('tabContent');
    if (!assignment || !$content) return;
    setActiveSubjectTabMeta('rockstars');

    $content.innerHTML = `
      <section class="rockstar-hero em-rs-hero-host" aria-label="Rockstars de participación">
        ${emRsRockstarsHeroHTML(assignment.subject || 'ESTADÍSTICA', emRsGetAssignmentGradeCourse(assignment))}
      </section>
      <div class="period-tabs rockstar-period-tabs" id="rockstarPeriodTabs">
        ${[1, 2, 3, 4].map((period) => `<button class="period-btn ${Number(state.rockstarPeriod) === period ? 'active' : ''}" data-rockstar-period="${period}">${period}°</button>`).join('')}
      </div>
      <div id="rockstarList" class="student-list rockstar-list em-rs-list">
        ${rockstarListHTML()}
      </div>
    `;

    bindRockstarTabEvents();
    emRsInitRockstarsHero($content);
    if (options.animate) pulseElement($content, 'tab-enter');
  }
  function rockstarListHTML() {
    const assignment = state.assignment;
    if (!assignment) return '';
    const attendance = getAttendance(assignment.id, getRockstarAttendanceDate());
    const query = '';
    const period = Number(state.rockstarPeriod);
    const pointMap = getRockstarPointMap(assignment.id, period);
    const students = getStudentsForAssignment(assignment).filter((student) => {
      if (!query) return true;
      return normalizeSearch(`${student.fullName} ${student.id} ${student.username || ''}`).includes(query);
    });
    return emRsGetPointsSortedStudents(students, attendance).map((student) => {
      const points = pointMap.get(student.id) || 0;
      return rockstarCardHTML(student, points, attendance[student.id]);
    }).join('') || `<div class="empty">${query ? 'No hay rockstars con ese filtro.' : 'Aún no hay estudiantes en este curso.'}</div>`;
  }
  function bindRockstarTabEvents() {
    document.querySelectorAll('[data-rockstar-period]').forEach((button) => {
      button.addEventListener('click', () => setRockstarPeriod(Number(button.dataset.rockstarPeriod)));
    });


    applyRockstarScoreTune();
    bindRockstarActionButtons();
  }
  function getRockstarScoreTune() {
    return { ...ROCKSTAR_SCORE_TUNE_DEFAULTS };
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
    document.querySelectorAll('.em-rs-score-btn[data-rockstar-delta]').forEach((button) => {
      button.addEventListener('pointerdown', () => {
        emRsReplayClass(button, 'tap', 300);
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
    emRsReplayClass(button, Number(delta) > 0 ? 'tap' : 'tap', duration);
  }
  function addRockstarDelta(studentId, delta) {
    const assignment = state.assignment;
    if (!assignment || !studentId || ![-1, 1].includes(Number(delta))) return false;
    const attendance = getAttendance(assignment.id, getRockstarAttendanceDate());
    if (isRockstarLocked(attendance[studentId])) {
      toast('Estudiante sin puntos hoy por asistencia');
      return false;
    }
    const oldPoints = getRockstarPoints(assignment.id, studentId, state.rockstarPeriod);
    const oldTier = emRsGetTier(oldPoints);
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
    updateRockstarCard(studentId, Number(delta), oldTier);
    return true;
  }
  function updateRockstarCard(studentId, delta = 0, oldTier = null) {
    const assignment = state.assignment;
    const card = document.querySelector(`[data-rockstar-card="${escapeSelector(studentId)}"]`);
    if (!assignment || !card) return;
    const attendance = getAttendance(assignment.id, getRockstarAttendanceDate());
    const status = attendance[studentId];
    const locked = isRockstarLocked(status);
    const points = getRockstarPoints(assignment.id, studentId, state.rockstarPeriod);
    const newTier = emRsGetTier(points);

    if (card.classList.contains('em-rs-card')) {
      card.classList.remove('m5', 'm0', 'zero', 'p0', 'p5', 'p10', 'p15', 'attendance-locked');
      card.classList.add(newTier);
      if (locked) card.classList.add('attendance-locked');
      card.dataset.score = String(points);

      const pointsNumber = card.querySelector('.em-rs-points-num');
      const avatar = card.querySelector('.em-rs-avatar');
      const chip = card.querySelector('.em-rs-score-chip');

      if (pointsNumber) pointsNumber.textContent = String(points);
      if (avatar) avatar.textContent = locked ? '😴' : emRsGetEmoji(points);
      if (chip) chip.textContent = emRsGetAttendanceLabel(status);

      if (locked) return;
      if (delta !== 0) emRsCreateFloatScore(card, delta);

      if (oldTier && oldTier !== newTier) {
        emRsSetRandomShape(card);
        emRsReplayCardState(card, 'level-change', 880);
      } else {
        emRsReplayCardState(card, 'score-hit', 480);
      }
      return;
    }

    const tier = getRockstarTier(points);
    const visual = locked ? getSleepingTier() : tier;
    const badge = card.querySelector('[data-rockstar-badge]');
    const score = card.querySelector('[data-rockstar-score]');
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
    return emRsIsAttendanceLocked(status);
  }
  function getSleepingTier() {
    return { emoji: '😴', label: 'No disponible', className: 'tier-sleep' };
  }
  const EM_CONTENT_SHAPE_PAIRS = [
    ['circle', 'x'],
    ['square', 'triangle'],
    ['triangle', 'circle'],
    ['x', 'square'],
    ['circle', 'triangle'],
    ['square', 'x']
  ];
  function emContentShapePairHTML(baseClass = 'em-content-shape', index = 0) {
    const pair = EM_CONTENT_SHAPE_PAIRS[Math.abs(Number(index) || 0) % EM_CONTENT_SHAPE_PAIRS.length] || EM_CONTENT_SHAPE_PAIRS[0];
    return `
      <span class="${baseClass} ${pair[0]} a" aria-hidden="true"></span>
      <span class="${baseClass} ${pair[1]} b" aria-hidden="true"></span>
    `;
  }
  function getQuizQuestionCount(quiz) {
    return filterSupportedQuizQuestions(quiz?.questions).length;
  }
  function emQuizNumericValue(source, keys = []) {
    for (const key of keys) {
      const value = source?.[key];
      if (value === undefined || value === null || value === '') continue;
      const number = Number(value);
      if (Number.isFinite(number) && number > 0) return Math.floor(number);
    }
    return null;
  }
  function getQuizAttemptLimit(quiz) {
    return emQuizNumericValue(quiz, [
      'attempts',
      'maxAttempts',
      'attemptLimit',
      'availableAttempts',
      'intentos',
      'tries',
      'maxTries'
    ]) || 1;
  }
  function quizHasTimeLimitValue(source) {
    return emQuizNumericValue(source, [
      'timeLimit',
      'timeLimitSeconds',
      'seconds',
      'questionTimeLimit',
      'timePerQuestion',
      'defaultTimeLimit'
    ]) !== null;
  }
  function isQuizTimed(quiz) {
    if (typeof quiz?.timed === 'boolean') return quiz.timed;
    if (typeof quiz?.isTimed === 'boolean') return quiz.isTimed;
    if (typeof quiz?.cronometrado === 'boolean') return quiz.cronometrado;
    if (quizHasTimeLimitValue(quiz)) return true;
    return filterSupportedQuizQuestions(quiz?.questions).some((question) => quizHasTimeLimitValue(question));
  }

  function emQuizFirstValue(source, keys = []) {
    for (const key of keys) {
      const value = source?.[key];
      if (value === undefined || value === null || value === '') continue;
      return value;
    }
    return null;
  }
  function emQuizDateLabel(value, fallback = '') {
    if (value === undefined || value === null || value === '') return fallback;
    const raw = String(value).trim();
    if (!raw) return fallback;
    const parsed = value instanceof Date ? value : new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      const dayMonth = parsed.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }).replace('.', '');
      const time = parsed.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }).replace(' a. m.', ' a.m.').replace(' p. m.', ' p.m.').replace(' a. m.', ' a.m.').replace(' p. m.', ' p.m.');
      return `${dayMonth} · ${time}`;
    }
    return raw;
  }
  function getQuizOpenLabel(quiz) {
    const value = emQuizFirstValue(quiz, ['openAt', 'openedAt', 'startsAt', 'startAt', 'startDate', 'availableFrom', 'availableAt', 'fechaInicio', 'inicio', 'opensAt']);
    return emQuizDateLabel(value, 'Disponible ahora');
  }
  function getQuizCloseLabel(quiz) {
    const value = emQuizFirstValue(quiz, ['closeAt', 'closedAt', 'endsAt', 'endAt', 'endDate', 'dueAt', 'deadline', 'availableUntil', 'fechaFin', 'fin', 'closesAt']);
    return emQuizDateLabel(value, 'Sin cierre');
  }
  function getQuizAttemptsMade(quiz) {
    return emQuizNumericValue(quiz, ['attemptsMade', 'usedAttempts', 'completedAttempts', 'doneAttempts', 'intentosHechos', 'attemptsUsed']) || 0;
  }
  function getQuizAttemptLimitRaw(quiz) {
    return emQuizNumericValue(quiz, ['attempts', 'maxAttempts', 'attemptLimit', 'availableAttempts', 'intentos', 'tries', 'maxTries']);
  }
  function getQuizAttemptDisplay(quiz) {
    const made = getQuizAttemptsMade(quiz);
    const limit = getQuizAttemptLimitRaw(quiz);
    return `${made} / ${limit || '∞'}`;
  }
  function renderQuizzesTab(options = {}) {
    const assignment = state.assignment;
    const $content = document.getElementById('tabContent');
    if (!assignment || !$content) return;
    setActiveSubjectTabMeta('quizzes');
    const quizzes = getQuizzesForCurrentAssignment();
    const activeQuiz = getActiveQuiz(quizzes);
    $content.innerHTML = `
      <section class="quiz-hero em-qz-hero-host" data-em-quizzes-hero aria-label="Quizzes de la asignatura">
        ${emQzQuizzesHeroHTML(assignment.subject || 'ESTADÍSTICA', emQzGetAssignmentGradeCourse(assignment))}
      </section>
      <div class="period-tabs quiz-period-tabs" id="quizPeriodTabs">
        ${[1, 2, 3, 4].map((period) => `<button class="period-btn ${Number(state.quizPeriod) === period ? 'active' : ''}" data-quiz-period="${period}">${period}°</button>`).join('')}
      </div>
      <div class="em-content-list is-grid" id="quizLibrary">
        ${quizzes.map((quiz, index) => quizCardButtonHTML(quiz, activeQuiz?.id === quiz.id, index)).join('') || `<div class="empty">Aún no hay quizzes para este periodo.</div>`}
      </div>
    `;
    bindQuizTabEvents();
    emQzInitQuizzesHero($content);
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
      button.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
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
  function quizCardButtonHTML(quiz, active, index = 0) {
    const total = getQuizQuestionCount(quiz);
    const attempts = getQuizAttemptLimit(quiz);
    const timedLabel = isQuizTimed(quiz) ? 'Cronometrado' : 'No cronometrado';
    const attemptsLabel = attempts === 1 ? 'Intento' : 'Intentos';
    return `
      <article class="em-quiz-card ${active ? 'active' : ''}" data-quiz-id="${escapeAttr(quiz.id)}" role="button" tabindex="0" aria-label="Iniciar ${escapeAttr(quiz.title || 'quiz')}">
        <div class="em-quiz-cover">
          ${emContentShapePairHTML('em-quiz-shape', index)}
          <div class="em-quiz-cover-content">
            <h3 class="em-quiz-title">${escapeHTML(quiz.title || 'Quiz sin título')}</h3>
            <button class="em-quiz-start-btn" type="button" tabindex="-1">Iniciar</button>
          </div>
        </div>
        <div class="em-quiz-body">
          <div class="em-quiz-flat-info">
            <div class="em-quiz-flat-item">
              <strong>${total}</strong>
              <span>Preguntas</span>
            </div>
            <div class="em-quiz-flat-item em-quiz-flat-mode">
              <strong>${timedLabel}</strong>
            </div>
            <div class="em-quiz-flat-item">
              <strong>${attempts}</strong>
              <span>${attemptsLabel}</span>
            </div>
          </div>
        </div>
      </article>
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
    document.querySelectorAll('.quiz-stage, .quiz-fullscreen-layer, .quiz-layout-tune-panel').forEach(setVarTarget);

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

  function normalizeQuizPaddingDebugTune(tune = {}) {
    const safe = { ...QUIZ_PADDING_DEBUG_DEFAULTS };
    QUIZ_PADDING_DEBUG_FIELDS.forEach((field) => {
      const raw = Number(tune[field.key]);
      safe[field.key] = Number.isFinite(raw) ? Math.max(field.min, Math.min(field.max, Math.round(raw))) : QUIZ_PADDING_DEBUG_DEFAULTS[field.key];
    });
    return safe;
  }

  function getQuizPaddingDebugTune() {
    try {
      return normalizeQuizPaddingDebugTune(JSON.parse(localStorage.getItem(QUIZ_PADDING_DEBUG_KEY) || '{}'));
    } catch (_) {
      return { ...QUIZ_PADDING_DEBUG_DEFAULTS };
    }
  }

  function saveQuizPaddingDebugTune(tune) {
    const safe = normalizeQuizPaddingDebugTune(tune);
    try { localStorage.setItem(QUIZ_PADDING_DEBUG_KEY, JSON.stringify(safe)); } catch (_) {}
    return safe;
  }

  function updateQuizPaddingDebugOutput(key, value) {
    const field = QUIZ_PADDING_DEBUG_FIELDS.find((item) => item.key === key);
    if (!field) return;
    document.querySelectorAll(`[data-quiz-padding-debug-value="${escapeSelector(key)}"]`).forEach((node) => {
      node.textContent = `${value}${field.unit}`;
    });
  }

  function applyQuizPaddingDebugTune(tune = getQuizPaddingDebugTune()) {
    const safe = normalizeQuizPaddingDebugTune(tune);
    const root = document.documentElement;
    root.style.setProperty('--quiz-debug-layer-pad-x', `${safe.layerX}px`);
    root.style.setProperty('--quiz-debug-content-pad-x', `${safe.contentX}px`);
    root.style.setProperty('--quiz-debug-question-pad-x', `${safe.questionX}px`);
    root.style.setProperty('--quiz-debug-answer-pad-x', `${safe.answerX}px`);
    root.style.setProperty('--quiz-debug-options-pad-x', `${safe.optionsX}px`);
    root.style.setProperty('--quiz-debug-options-pull-x', `${safe.optionsPullX}px`);

    const setInlinePadding = (selector, value) => {
      document.querySelectorAll(selector).forEach((node) => {
        node.style.setProperty('padding-left', `${value}px`, 'important');
        node.style.setProperty('padding-right', `${value}px`, 'important');
        node.style.setProperty('box-sizing', 'border-box', 'important');
      });
    };
    const setInlineOptions = (selector) => {
      document.querySelectorAll(selector).forEach((node) => {
        node.style.setProperty('padding-left', `${safe.optionsX}px`, 'important');
        node.style.setProperty('padding-right', `${safe.optionsX}px`, 'important');
        node.style.setProperty('margin-left', `${safe.optionsPullX}px`, 'important');
        node.style.setProperty('margin-right', `${safe.optionsPullX}px`, 'important');
        node.style.setProperty('width', safe.optionsPullX ? `calc(100% - ${safe.optionsPullX * 2}px)` : '100%', 'important');
        node.style.setProperty('max-width', safe.optionsPullX ? `calc(100% - ${safe.optionsPullX * 2}px)` : '100%', 'important');
        node.style.setProperty('box-sizing', 'border-box', 'important');
        node.style.setProperty('overflow', 'visible', 'important');
      });
    };

    setInlinePadding('.quiz-fullscreen-layer:not(.quiz-phase-transition)', safe.layerX);
    setInlinePadding('.quiz-fullscreen-layer:not(.quiz-phase-transition):not(.quiz-phase-results) .quiz-fullscreen-content', safe.contentX);
    setInlinePadding('.quiz-fullscreen-layer:not(.quiz-phase-transition) .quiz-stage-fullscreen .quiz-question-content', safe.questionX);
    setInlinePadding('.quiz-fullscreen-layer:not(.quiz-phase-transition) .quiz-stage-fullscreen .quiz-answer-zone', safe.answerX);
    setInlineOptions('.quiz-fullscreen-layer:not(.quiz-phase-transition) .quiz-stage-fullscreen .kahoot-grid, .quiz-fullscreen-layer:not(.quiz-phase-transition) .quiz-stage-fullscreen .quiz-order-board, .quiz-fullscreen-layer:not(.quiz-phase-transition) .quiz-stage-fullscreen .quiz-order-stack, .quiz-fullscreen-layer:not(.quiz-phase-transition) .quiz-stage-fullscreen .quiz-flip-grid, .quiz-fullscreen-layer:not(.quiz-phase-transition) .quiz-stage-fullscreen .quiz-open-form');

    QUIZ_PADDING_DEBUG_FIELDS.forEach((field) => updateQuizPaddingDebugOutput(field.key, safe[field.key]));
    return safe;
  }

  function quizPaddingDebugControlsHTML() {
    return '';
  }
  function normalizeQuizCountdownTune(tune = {}) {
    const safe = { ...QUIZ_COUNTDOWN_TUNE_DEFAULTS };
    QUIZ_COUNTDOWN_TUNE_FIELDS.forEach((field) => {
      const raw = Number(tune[field.key]);
      safe[field.key] = Number.isFinite(raw) ? Math.max(field.min, Math.min(field.max, Math.round(raw))) : QUIZ_COUNTDOWN_TUNE_DEFAULTS[field.key];
    });
    return safe;
  }
  function getQuizCountdownTune() {
    try {
      return normalizeQuizCountdownTune(JSON.parse(localStorage.getItem(QUIZ_COUNTDOWN_TUNE_KEY) || '{}'));
    } catch (_) {
      return { ...QUIZ_COUNTDOWN_TUNE_DEFAULTS };
    }
  }
  function saveQuizCountdownTune(tune) {
    const safe = normalizeQuizCountdownTune(tune);
    try { localStorage.setItem(QUIZ_COUNTDOWN_TUNE_KEY, JSON.stringify(safe)); } catch (_) {}
    return safe;
  }
  function updateQuizCountdownTuneOutput(key, value) {
    const field = QUIZ_COUNTDOWN_TUNE_FIELDS.find((item) => item.key === key);
    if (!field) return;
    document.querySelectorAll(`[data-quiz-countdown-tune-value="${escapeSelector(key)}"]`).forEach((node) => {
      node.textContent = `${value}${field.unit}`;
    });
  }
  function applyQuizCountdownTune(tune = getQuizCountdownTune()) {
    const safe = normalizeQuizCountdownTune(tune);
    const value = `${safe.x}px`;
    document.documentElement.style.setProperty('--quiz-countdown-tune-x', value);
    document.querySelectorAll('.quiz-fullscreen-layer:not(.quiz-phase-transition) > .quiz-fullscreen-top.quiz-fullscreen-top-countdown .quiz-countdown-slot').forEach((node) => {
      node.style.setProperty('transform', `translateX(${value})`, 'important');
    });
    QUIZ_COUNTDOWN_TUNE_FIELDS.forEach((field) => updateQuizCountdownTuneOutput(field.key, safe[field.key]));
    return safe;
  }
  function quizCountdownQuickControlsHTML() {
    const tune = getQuizCountdownTune();
    return `
      <div class="quiz-countdown-tune-box quiz-quick-countdown-box" data-quiz-countdown-tune-box>
        <div class="quiz-layout-tune-nav-head">
          <strong>Countdown</strong>
          <span>Mueve solo la posición horizontal del contador del hero.</span>
        </div>
        <label class="quiz-layout-tune-row quiz-quick-range-row">
          <span>Countdown X <b data-quiz-countdown-tune-value="x">${tune.x}px</b></span>
          <input type="range" min="-36" max="64" step="1" value="${tune.x}" data-quiz-countdown-tune="x" />
        </label>
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
  function quizLayoutTunePanelHTML() {
    return '';
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
            if (state.quizFullscreenActive && getQuizSession().phase === 'question' && !getQuizSession().locked) startQuizQuestionMusic(getCurrentQuizQuestion());
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

      panel.querySelectorAll('[data-quiz-countdown-tune]').forEach((input) => {
        if (input.dataset.boundCountdownTune === 'true') return;
        input.dataset.boundCountdownTune = 'true';
        const handleCountdownTuneChange = () => {
          const key = input.dataset.quizCountdownTune;
          if (!key) return;
          const current = getQuizCountdownTune();
          const safe = saveQuizCountdownTune({ ...current, [key]: Number(input.value) });
          applyQuizCountdownTune(safe);
          panel.querySelectorAll('[data-quiz-countdown-tune]').forEach((slider) => {
            const sliderKey = slider.dataset.quizCountdownTune;
            if (sliderKey && sliderKey in safe) slider.value = String(safe[sliderKey]);
          });
        };
        input.addEventListener('input', handleCountdownTuneChange);
        input.addEventListener('change', handleCountdownTuneChange);
      });

      panel.querySelectorAll('[data-quiz-padding-debug]').forEach((input) => {
        if (input.dataset.boundPaddingDebug === 'true') return;
        input.dataset.boundPaddingDebug = 'true';
        const handlePaddingDebugChange = () => {
          const key = input.dataset.quizPaddingDebug;
          if (!key) return;
          const current = getQuizPaddingDebugTune();
          const safe = saveQuizPaddingDebugTune({ ...current, [key]: Number(input.value) });
          applyQuizPaddingDebugTune(safe);
          panel.querySelectorAll('[data-quiz-padding-debug]').forEach((slider) => {
            const sliderKey = slider.dataset.quizPaddingDebug;
            if (sliderKey && sliderKey in safe) slider.value = String(safe[sliderKey]);
          });
        };
        input.addEventListener('input', handlePaddingDebugChange);
        input.addEventListener('change', handlePaddingDebugChange);
      });
      applyQuizCountdownTune(getQuizCountdownTune());
      applyQuizPaddingDebugTune(getQuizPaddingDebugTune());
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
        const answerTiming = markQuizCountdownResponded();
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
          keepQuizRevealOverflowOpen(1850);
          const runRevealAnimation = (card, ok) => {
            if (!card) return;
            if (typeof card.getAnimations === 'function') card.getAnimations().forEach((animation) => animation.cancel());
            card.classList.remove('flip-unused', 'is-dimmed', 'flip-correct-reveal', 'flip-wrong-reveal');
            card.style.removeProperty('animation');
            void card.offsetWidth;
            card.classList.add(ok ? 'flip-correct-reveal' : 'flip-wrong-reveal');
          };
          if (selectedCorrect) {
            recordQuizAnswer(question, true, { selected: session.selectedAnswerId, timing: answerTiming });
            runRevealAnimation(selected, true);
            playQuizSound('correct');
            showQuizFeedbackBandAfterDelay(stage, true, question, '', QUIZ_FEEDBACK_AFTER_CHOICE_REVEAL_MS);
          } else {
            recordQuizAnswer(question, false, { selected: session.selectedAnswerId, correctAnswer: correctCard?.dataset.quizAnswer || '', timing: answerTiming });
            runRevealAnimation(selected, false);
            playQuizSound('wrong');
            if (correctCard && correctCard !== selected) {
              setQuizFlipCardOpen(correctCard, true);
              window.setTimeout(() => runRevealAnimation(correctCard, true), 430);
            }
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
        const answerTiming = markQuizCountdownResponded();
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
          card.style.setProperty('background', '#6b7280', 'important');
          card.style.setProperty('background-color', '#6b7280', 'important');
          card.style.setProperty('background-image', 'none', 'important');
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
          card.style.removeProperty('background');
          card.style.removeProperty('background-color');
          card.style.removeProperty('background-image');
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
          keepQuizRevealOverflowOpen(revealTotal + 1250);
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
          recordQuizAnswer(question, ok, { order: selected, correctOrder, timing: answerTiming });
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
      securityPausedFeedback: false,
      manualResultPoints: null,
      timeScoringMode: normalizeQuizTimeScoringMode(state.quizTimeScoringMode)
    };
    return state.quizSession;
  }
  function clearQuizTimers() {
    (state.quizTimers || []).forEach((timer) => window.clearTimeout(timer));
    state.quizTimers = [];
    if (window.__encisomathQuizRevealOverflowTimer) {
      window.clearTimeout(window.__encisomathQuizRevealOverflowTimer);
      window.__encisomathQuizRevealOverflowTimer = null;
    }
    document.body.classList.remove('quiz-reveal-overflow-active');
    stopQuizCountdown();
  }
  function scheduleQuizTimer(callback, delay) {
    const timer = window.setTimeout(() => {
      state.quizTimers = (state.quizTimers || []).filter((item) => item !== timer);
      callback();
    }, delay);
    state.quizTimers = [...(state.quizTimers || []), timer];
    return timer;
  }
  function keepQuizRevealOverflowOpen(duration = 1600) {
    const safeDuration = Math.max(480, Number(duration) || 1600);
    document.body.classList.add('quiz-reveal-overflow-active');
    if (window.__encisomathQuizRevealOverflowTimer) {
      window.clearTimeout(window.__encisomathQuizRevealOverflowTimer);
    }
    window.__encisomathQuizRevealOverflowTimer = window.setTimeout(() => {
      window.__encisomathQuizRevealOverflowTimer = null;
      document.body.classList.remove('quiz-reveal-overflow-active');
    }, safeDuration);
  }
  function normalizeQuizItemSeconds(value) {
    const number = Number.parseInt(value, 10);
    if (Number.isNaN(number)) return QUIZ_ITEM_TIME_LIMIT_DEFAULT;
    return Math.min(Math.max(number, QUIZ_ITEM_TIME_LIMIT_MIN), QUIZ_ITEM_TIME_LIMIT_MAX);
  }
  function getQuizQuestionTimeLimit(question = getCurrentQuizQuestion(), quiz = getActiveQuiz()) {
    const candidates = [
      question?.timeLimit,
      question?.timeLimitSeconds,
      question?.seconds,
      quiz?.questionTimeLimit,
      quiz?.timePerQuestion,
      quiz?.defaultTimeLimit
    ];
    const raw = candidates.find((item) => item !== undefined && item !== null && item !== '');
    return normalizeQuizItemSeconds(raw ?? QUIZ_ITEM_TIME_LIMIT_DEFAULT);
  }
  function clampQuizNumber(value, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return min;
    return Math.min(Math.max(number, min), max);
  }
  function getQuizAnswerTimingSnapshot() {
    const active = state.quizCountdown || null;
    const question = getCurrentQuizQuestion();
    const quiz = getActiveQuiz();
    const totalSeconds = normalizeQuizItemSeconds(active?.totalSeconds || getQuizQuestionTimeLimit(question, quiz));
    const storedElapsed = active?.respondedElapsedSeconds;
    let elapsedSeconds = (storedElapsed !== null && storedElapsed !== undefined && Number.isFinite(Number(storedElapsed)))
      ? Number(storedElapsed)
      : Number.NaN;
    if (!Number.isFinite(elapsedSeconds)) {
      if (Number.isFinite(Number(active?.startedAt)) && typeof performance !== 'undefined') {
        elapsedSeconds = (performance.now() - Number(active.startedAt)) / 1000;
      } else {
        const remaining = Number.isFinite(Number(active?.remainingSeconds)) ? Number(active.remainingSeconds) : totalSeconds;
        elapsedSeconds = totalSeconds - remaining;
      }
    }
    elapsedSeconds = clampQuizNumber(elapsedSeconds, 0, totalSeconds);
    const remainingSeconds = clampQuizNumber(totalSeconds - elapsedSeconds, 0, totalSeconds);
    const elapsedRatio = totalSeconds > 0 ? clampQuizNumber(elapsedSeconds / totalSeconds, 0, 1) : 0;
    return {
      totalSeconds,
      elapsedSeconds: Math.round(elapsedSeconds * 1000) / 1000,
      remainingSeconds: Math.round(remainingSeconds * 1000) / 1000,
      elapsedRatio: Math.round(elapsedRatio * 10000) / 10000
    };
  }
  function normalizeQuizTimeScoringMode(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'rapidez' || raw === 'rapido' || raw === 'rápido' || raw === 'speed' || raw === 'fast') return 'speed';
    return QUIZ_TIME_SCORING_MODES.has(raw) ? raw : QUIZ_TIME_SCORING_MODE_DEFAULT;
  }
  function getQuizTimeScoringMode() {
    const session = state.quizSession && typeof state.quizSession === 'object' ? state.quizSession : null;
    return normalizeQuizTimeScoringMode(session?.timeScoringMode || state.quizTimeScoringMode || localStorage.getItem(QUIZ_TIME_SCORING_MODE_KEY));
  }
  function saveQuizTimeScoringMode(value) {
    const mode = normalizeQuizTimeScoringMode(value);
    state.quizTimeScoringMode = mode;
    if (state.quizSession && typeof state.quizSession === 'object') state.quizSession.timeScoringMode = mode;
    try { localStorage.setItem(QUIZ_TIME_SCORING_MODE_KEY, mode); } catch (_) {}
    return mode;
  }
  function quizScorePointsForIndex(totalItems = 1, index = 0, totalPoints = QUIZ_SCORE_TOTAL_ITEM_POINTS) {
    const count = Math.max(1, Number(totalItems) || 1);
    const safeIndex = Math.max(0, Math.min(count - 1, Number(index) || 0));
    const base = Math.floor(totalPoints / count);
    const remainder = totalPoints - (base * count);
    return base + (safeIndex < remainder ? 1 : 0);
  }
  function quizTimeScoreCurve(elapsedRatio = 0) {
    const r = clampQuizNumber(elapsedRatio, 0, 1);
    const noReadLimit = 0.18;
    const sweetSpot = 0.75;
    if (r <= noReadLimit) return 0;
    if (r <= sweetSpot) {
      return Math.pow((r - noReadLimit) / (sweetSpot - noReadLimit), 0.72);
    }
    const lateProgress = (r - sweetSpot) / (1 - sweetSpot);
    return Math.max(0.08, 1 - Math.pow(lateProgress, 1.45) * 0.92);
  }
  function quizTimeScoreSpeed(elapsedRatio = 0) {
    const r = clampQuizNumber(elapsedRatio, 0, 1);
    return clampQuizNumber(1 - r, 0, 1);
  }
  function quizTimeScoreFactor(elapsedRatio = 0, mode = getQuizTimeScoringMode()) {
    return normalizeQuizTimeScoringMode(mode) === 'speed' ? quizTimeScoreSpeed(elapsedRatio) : quizTimeScoreCurve(elapsedRatio);
  }
  function calculateQuizAnswerScore(question, correct, extra = {}, index = state.quizQuestionIndex, quiz = getActiveQuiz()) {
    const questions = Array.isArray(quiz?.questions) ? quiz.questions : [];
    const count = Math.max(1, questions.length || 1);
    const safeIndex = Math.max(0, Math.min(count - 1, Number(index) || 0));
    const itemMax = quizScorePointsForIndex(count, safeIndex, QUIZ_SCORE_TOTAL_ITEM_POINTS);
    const timeMax = quizScorePointsForIndex(count, safeIndex, QUIZ_SCORE_TOTAL_TIME_POINTS);
    const rawTiming = extra?.timing || getQuizAnswerTimingSnapshot();
    const totalSeconds = normalizeQuizItemSeconds(rawTiming?.totalSeconds || getQuizQuestionTimeLimit(question, quiz));
    const elapsedSeconds = clampQuizNumber(Number(rawTiming?.elapsedSeconds), 0, totalSeconds);
    const remainingSeconds = clampQuizNumber(Number.isFinite(Number(rawTiming?.remainingSeconds)) ? Number(rawTiming.remainingSeconds) : totalSeconds - elapsedSeconds, 0, totalSeconds);
    const elapsedRatio = totalSeconds > 0 ? clampQuizNumber(elapsedSeconds / totalSeconds, 0, 1) : 0;
    const timing = {
      totalSeconds,
      elapsedSeconds: Math.round(elapsedSeconds * 1000) / 1000,
      remainingSeconds: Math.round(remainingSeconds * 1000) / 1000,
      elapsedRatio: Math.round(elapsedRatio * 10000) / 10000
    };
    const isCorrect = correct === true;
    const hasTextAnswer = String(extra?.text || '').trim().length > 0;
    const hasSelectedAnswer = String(extra?.selected || extra?.selectedAnswer || extra?.selectedAnswerId || '').trim().length > 0;
    const hasOrderAnswer = Array.isArray(extra?.order) || Array.isArray(extra?.selectedOrder) || Array.isArray(extra?.currentOrder);
    const hasFlipAnswer = String(extra?.selectedCard || extra?.selectedFlip || extra?.selected || '').trim().length > 0;
    const isTimeout = extra?.timeout === true;
    const madeAttempt = !isTimeout && (isCorrect || correct === false || hasTextAnswer || hasSelectedAnswer || hasOrderAnswer || hasFlipAnswer);
    const timeScoringMode = normalizeQuizTimeScoringMode(extra?.timeScoreMode || extra?.timeScoringMode || getQuizTimeScoringMode());
    const curveRaw = isCorrect && madeAttempt ? quizTimeScoreFactor(elapsedRatio, timeScoringMode) : 0;
    const curve = Math.round(curveRaw * 10000) / 10000;
    const item = isCorrect ? itemMax : 0;
    const time = isCorrect && madeAttempt ? Math.round(timeMax * curveRaw) : 0;
    const total = item + time;
    const noReadLimit = 0.18;
    const sweetSpot = 0.75;
    const branch = !madeAttempt ? 'sin intento real / timeout' : !isCorrect ? 'respuesta incorrecta: item y tiempo en 0' : timeScoringMode === 'speed' ? 'rapidez: mas rapido suma mas' : elapsedRatio <= noReadLimit ? 'demasiado rapido' : elapsedRatio <= sweetSpot ? 'subida hacia punto dulce' : 'bajada por respuesta tardia';
    const formula = isCorrect && madeAttempt
      ? (timeScoringMode === 'speed'
        ? `r = tiempoDemorado / tiempoLimite = ${timing.elapsedSeconds}s / ${timing.totalSeconds}s = ${timing.elapsedRatio}; rapidez = 1 - r = ${curve}; puntosTiempo = redondear(${timeMax} * ${curve}) = ${time}`
        : `r = tiempoDemorado / tiempoLimite = ${timing.elapsedSeconds}s / ${timing.totalSeconds}s = ${timing.elapsedRatio}; curva = r <= 0.18 ? 0 : r <= 0.75 ? ((r - 0.18) / (0.75 - 0.18))^0.72 : max(0.08, 1 - ((r - 0.75) / (1 - 0.75))^1.45 * 0.92); puntosTiempo = redondear(${timeMax} * ${curve}) = ${time}`)
      : `respuesta incorrecta, sin intento real o timeout; puntosItem = 0 y puntosTiempo = 0`;
    return {
      item,
      time,
      total,
      maxItem: itemMax,
      maxTime: timeMax,
      curve,
      timeScoringMode,
      timing,
      debug: {
        itemIndex: safeIndex + 1,
        itemCount: count,
        correct: isCorrect,
        madeAttempt,
        timeout: isTimeout,
        timeScoringMode,
        branch,
        formula
      }
    };
  }
  function zeroQuizAnswerScore(answer = null, quiz = getActiveQuiz()) {
    const questions = Array.isArray(quiz?.questions) ? quiz.questions : [];
    const count = Math.max(1, questions.length || 1);
    const rawIndex = Number(answer?.index);
    const safeIndex = Math.max(0, Math.min(count - 1, Number.isFinite(rawIndex) ? rawIndex : 0));
    return {
      item: 0,
      time: 0,
      total: 0,
      maxItem: quizScorePointsForIndex(count, safeIndex, QUIZ_SCORE_TOTAL_ITEM_POINTS),
      maxTime: quizScorePointsForIndex(count, safeIndex, QUIZ_SCORE_TOTAL_TIME_POINTS),
      curve: 0,
      timeScoringMode: normalizeQuizTimeScoringMode(answer?.timeScoreMode || answer?.timeScoringMode || getQuizTimeScoringMode()),
      timing: answer?.timing || null,
      debug: {
        itemIndex: safeIndex + 1,
        itemCount: count,
        correct: false,
        madeAttempt: false,
        timeout: answer?.timeout === true,
        timeScoringMode: normalizeQuizTimeScoringMode(answer?.timeScoreMode || answer?.timeScoringMode || getQuizTimeScoringMode()),
        branch: 'respuesta incorrecta: item y tiempo en 0',
        formula: 'respuesta incorrecta, sin intento real o timeout; puntosItem = 0 y puntosTiempo = 0'
      }
    };
  }
  function getQuizAnswerScore(answer, quiz = getActiveQuiz()) {
    if (!answer) return { item: 0, time: 0, total: 0 };
    if (answer.correct !== true) return zeroQuizAnswerScore(answer, quiz);
    const questions = Array.isArray(quiz?.questions) ? quiz.questions : [];
    const question = questions[Number(answer.index)] || null;
    return calculateQuizAnswerScore(question, true, answer, Number(answer.index), quiz);
  }
  function getQuizCumulativeScoreBeforeTransition(itemNumber = 1, quiz = getActiveQuiz()) {
    const session = getQuizSession();
    const current = Math.max(1, Number(itemNumber) || 1);
    const previousIndex = current - 2;
    const beforePreviousIndex = current - 3;
    const answers = Array.isArray(session.answers) ? session.answers : [];
    const previousAnswer = answers.find((answer) => Number(answer.index) === Number(previousIndex)) || null;
    const previousScore = previousAnswer ? getQuizAnswerScore(previousAnswer, quiz) : null;
    const sumThrough = (maxIndex) => answers.reduce((total, answer) => {
      const index = Number(answer.index);
      if (!Number.isFinite(index) || index > maxIndex) return total;
      return total + (Number(getQuizAnswerScore(answer, quiz).total) || 0);
    }, 0);
    return {
      from: Math.max(0, Math.round(sumThrough(beforePreviousIndex))),
      to: Math.max(0, Math.round(sumThrough(previousIndex))),
      previousIndex,
      previousAnswer,
      previousScore
    };
  }
  function normalizeQuizTransitionScoreTune(tune = {}) {
    const safe = { ...QUIZ_TRANSITION_SCORE_TUNE_DEFAULTS };
    QUIZ_TRANSITION_SCORE_TUNE_FIELDS.forEach((field) => {
      const raw = Number(tune[field.key]);
      safe[field.key] = Number.isFinite(raw) ? Math.max(field.min, Math.min(field.max, Math.round(raw))) : QUIZ_TRANSITION_SCORE_TUNE_DEFAULTS[field.key];
    });
    return safe;
  }
  function getQuizTransitionScoreTune() {
    try {
      return normalizeQuizTransitionScoreTune(JSON.parse(localStorage.getItem(QUIZ_TRANSITION_SCORE_TUNE_KEY) || '{}'));
    } catch (_) {
      return { ...QUIZ_TRANSITION_SCORE_TUNE_DEFAULTS };
    }
  }
  function applyQuizTransitionScoreTune(tune = getQuizTransitionScoreTune()) {
    const safe = normalizeQuizTransitionScoreTune(tune);
    document.querySelectorAll('[data-score-counter-slot]').forEach((slot) => {
      slot.style.setProperty('--score-counter-y', `${safe.y}px`);
      slot.style.setProperty('--score-counter-zoom', `${safe.zoom / 100}`);
    });
    return safe;
  }
  function quizCountdownHTML(seconds = QUIZ_ITEM_TIME_LIMIT_DEFAULT) {
    const safeSeconds = normalizeQuizItemSeconds(seconds);
    return `
      <section class="countdown-poly quiz-countdown-poly" data-quiz-countdown-poly data-quiz-countdown-total="${safeSeconds}" aria-label="Tiempo restante">
        <svg class="countdown-poly__svg" viewBox="0 0 500 300" aria-hidden="true">
          <polygon data-quiz-moving-polygon></polygon>
        </svg>
        <div class="countdown-poly__number" data-quiz-countdown-number>${safeSeconds}</div>
      </section>`;
  }
  function stopQuizCountdown() {
    const active = state.quizCountdown;
    if (!active) return;
    if (active.interval) window.clearInterval(active.interval);
    if (active.beatTimer) window.clearTimeout(active.beatTimer);
    if (active.animationFrame) window.cancelAnimationFrame(active.animationFrame);
    state.quizCountdown = null;
  }
  function setQuizCountdownDisplay(value, className = '') {
    const active = state.quizCountdown;
    const wrap = active?.wrap || document.querySelector('[data-quiz-countdown-poly]');
    const number = active?.number || wrap?.querySelector?.('[data-quiz-countdown-number]');
    if (number) number.textContent = String(value);
    if (wrap) {
      wrap.classList.remove('is-answered', 'is-timeup');
      if (className) wrap.classList.add(className);
    }
  }
  function markQuizCountdownResponded() {
    stopQuizQuestionMusic(true);
    const active = state.quizCountdown;
    if (!active) return getQuizAnswerTimingSnapshot();
    const timing = getQuizAnswerTimingSnapshot();
    active.respondedElapsedSeconds = timing.elapsedSeconds;
    active.respondedRemainingSeconds = timing.remainingSeconds;
    active.remainingSeconds = timing.remainingSeconds;
    if (active.interval) {
      window.clearInterval(active.interval);
      active.interval = null;
    }
    if (active.beatTimer) {
      window.clearTimeout(active.beatTimer);
      active.beatTimer = null;
    }
    active.isRunning = false;
    active.wrap?.classList?.remove('danger', 'beat');
    setQuizCountdownDisplay('!', 'is-answered');
    return timing;
  }
  function lockQuizQuestionForTimeout(stage) {
    if (!stage) return;
    stage.classList.add('quiz-timeout-locked');
    stage.querySelectorAll('[data-quiz-answer], [data-quiz-flip-card], [data-flip-validate], [data-order-validate], textarea, button.quiz-submit-btn').forEach((item) => {
      item.disabled = true;
      item.classList.remove('selected', 'correct-reveal', 'wrong-reveal', 'is-pressing');
      item.classList.add('is-dimmed');
    });
    stage.querySelectorAll('[data-quiz-flip-board]').forEach((board) => board.classList.add('flip-locked', 'quiz-timeout-board'));
    stage.querySelectorAll('[data-quiz-order-board]').forEach((board) => board.classList.add('order-locked', 'quiz-timeout-board'));
  }
  function handleQuizCountdownExpired(questionIndex) {
    const session = getQuizSession();
    const quiz = getActiveQuiz();
    if (!quiz || session.phase !== 'question') return;
    if (session.locked || Number(state.quizQuestionIndex) !== Number(questionIndex)) return;
    const question = getCurrentQuizQuestion();
    if (!question) return;
    session.locked = true;
    stopQuizQuestionMusic(true);
    session.selectedAnswerId = '';
    const stage = document.querySelector(`.quiz-stage[data-quiz-question-index="${Number(questionIndex)}"]`) || document.querySelector('.quiz-stage-fullscreen, .quiz-stage');
    lockQuizQuestionForTimeout(stage);
    setQuizCountdownDisplay('0', 'is-timeup');
    recordQuizAnswer(question, false, { timeout: true, timing: getQuizAnswerTimingSnapshot() });
    playQuizSound('wrong');
    showQuizFeedbackBandAfterDelay(stage, false, question, QUIZ_TIMEOUT_FEEDBACK_TEXT, 620);
  }
  function startQuizCountdownForCurrentQuestion(layer = document.getElementById('quizFullscreenLayer'), quiz = getActiveQuiz()) {
    stopQuizCountdown();
    const session = getQuizSession();
    if (!layer || !quiz || session.phase !== 'question' || session.locked) return;
    const wrap = layer.querySelector('[data-quiz-countdown-poly]');
    const polygon = wrap?.querySelector?.('[data-quiz-moving-polygon]');
    const number = wrap?.querySelector?.('[data-quiz-countdown-number]');
    const progressBar = layer.querySelector('[data-quiz-countdown-progress-bar]');
    if (!wrap || !polygon || !number) return;

    const BASE_POINTS = [
      [62, 72],
      [438, 64],
      [428, 228],
      [72, 236]
    ];
    const SECOND_MOVE_X = 34;
    const SECOND_MOVE_Y = 16;
    const IDLE_MOVE_X = 7;
    const IDLE_MOVE_Y = 4;
    const LIMITS = [
      { minX: 38, maxX: 96, minY: 50, maxY: 90 },
      { minX: 404, maxX: 462, minY: 50, maxY: 90 },
      { minX: 396, maxX: 456, minY: 210, maxY: 250 },
      { minX: 44, maxX: 104, minY: 210, maxY: 250 }
    ];
    const BEAT_EVERY_SECONDS = 10;
    const DANGER_SECONDS = QUIZ_COUNTDOWN_DANGER_SECONDS;
    const questionIndex = Number(state.quizQuestionIndex) || 0;
    const totalSeconds = normalizeQuizItemSeconds(wrap.dataset.quizCountdownTotal || getQuizQuestionTimeLimit(getCurrentQuizQuestion(), quiz));
    let remainingSeconds = totalSeconds;

    function updateProgressBar() {
      if (!progressBar) return;
      const ratio = totalSeconds > 0 ? Math.max(0, Math.min(1, remainingSeconds / totalSeconds)) : 0;
      progressBar.style.width = `${ratio * 100}%`;
    }
    let countdownInterval = null;
    let isRunning = true;
    let currentPoints = createSecondShape();
    let lastSecondShape = clonePoints(currentPoints);
    let startPoints = clonePoints(currentPoints);
    let targetPoints = clonePoints(currentPoints);
    let morphStartTime = performance.now();
    let morphDuration = 900;
    let morphType = 'idle';

    function clonePoints(points) {
      return points.map(([x, y]) => [x, y]);
    }
  function randomBetween(min, max) {
      return min + Math.random() * (max - min);
    }
  function clamp(value, min, max) {
      return Math.min(Math.max(value, min), max);
    }
  function pointsToString(points) {
      return points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
    }
  function createSecondShape() {
      return BASE_POINTS.map(([x, y], index) => {
        const limit = LIMITS[index];
        return [
          clamp(x + randomBetween(-SECOND_MOVE_X, SECOND_MOVE_X), limit.minX, limit.maxX),
          clamp(y + randomBetween(-SECOND_MOVE_Y, SECOND_MOVE_Y), limit.minY, limit.maxY)
        ];
      });
    }
  function createIdleShapeAround(points) {
      return points.map(([x, y], index) => {
        const limit = LIMITS[index];
        return [
          clamp(x + randomBetween(-IDLE_MOVE_X, IDLE_MOVE_X), limit.minX, limit.maxX),
          clamp(y + randomBetween(-IDLE_MOVE_Y, IDLE_MOVE_Y), limit.minY, limit.maxY)
        ];
      });
    }
  function easeInOutCubic(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
  function easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    }
  function startMorph(newTargetPoints, duration, type) {
      startPoints = clonePoints(currentPoints);
      targetPoints = clonePoints(newTargetPoints);
      morphStartTime = performance.now();
      morphDuration = duration;
      morphType = type;
    }
  function moveToNewSecondShape() {
      const newShape = createSecondShape();
      lastSecondShape = clonePoints(newShape);
      startMorph(newShape, 620, 'second');
    }
  function startIdleMovement() {
      const idleShape = createIdleShapeAround(lastSecondShape);
      startMorph(idleShape, randomBetween(900, 1300), 'idle');
    }
  function triggerBeat() {
      wrap.classList.remove('beat');
      void wrap.offsetWidth;
      wrap.classList.add('beat');
      const active = state.quizCountdown;
      if (active?.beatTimer) window.clearTimeout(active.beatTimer);
      if (active) {
        active.beatTimer = window.setTimeout(() => {
          wrap.classList.remove('beat');
          if (state.quizCountdown) state.quizCountdown.beatTimer = null;
        }, 650);
      }
    }
  function updateDangerState() {
      if (remainingSeconds <= DANGER_SECONDS && remainingSeconds > 0 && isRunning) wrap.classList.add('danger');
      else wrap.classList.remove('danger');
    }
  function handleSecondEffects() {
      const elapsedSeconds = totalSeconds - remainingSeconds;
      if (elapsedSeconds > 0 && elapsedSeconds % BEAT_EVERY_SECONDS === 0 && remainingSeconds > 0) triggerBeat();
      updateDangerState();
    }
  function animatePolygon(time) {
      if (!state.quizCountdown || state.quizCountdown.wrap !== wrap || !wrap.isConnected) return;
      const elapsed = time - morphStartTime;
      const progress = Math.min(elapsed / morphDuration, 1);
      const eased = morphType === 'second' ? easeOutCubic(progress) : easeInOutCubic(progress);
      currentPoints = startPoints.map(([x, y], index) => {
        const [targetX, targetY] = targetPoints[index];
        return [x + (targetX - x) * eased, y + (targetY - y) * eased];
      });
      polygon.setAttribute('points', pointsToString(currentPoints));
      if (progress >= 1) startIdleMovement();
      state.quizCountdown.animationFrame = window.requestAnimationFrame(animatePolygon);
    }

    number.textContent = String(totalSeconds);
    updateProgressBar();
    polygon.setAttribute('points', pointsToString(currentPoints));
    wrap.classList.remove('danger', 'beat', 'is-answered', 'is-timeup');
    startIdleMovement();
    state.quizCountdown = { wrap, polygon, number, interval: null, animationFrame: null, beatTimer: null, questionIndex, totalSeconds, remainingSeconds, startedAt: performance.now(), respondedElapsedSeconds: null, respondedRemainingSeconds: null, isRunning: true };
    state.quizCountdown.animationFrame = window.requestAnimationFrame(animatePolygon);
    updateDangerState();
    moveToNewSecondShape();

    if (QUIZ_DEBUG_PAUSE_COUNTDOWN) {
      isRunning = false;
      state.quizCountdown.isRunning = false;
      state.quizCountdown.remainingSeconds = totalSeconds;
      wrap.classList.add('is-debug-paused');
      number.textContent = String(totalSeconds);
      return;
    }

    countdownInterval = window.setInterval(() => {
      const active = state.quizCountdown;
      if (!active || active.wrap !== wrap || !wrap.isConnected) {
        window.clearInterval(countdownInterval);
        return;
      }
      if (getQuizSession().locked || getQuizSession().phase !== 'question' || Number(state.quizQuestionIndex) !== questionIndex) {
        window.clearInterval(countdownInterval);
        active.interval = null;
        return;
      }
      remainingSeconds -= 1;
      active.remainingSeconds = remainingSeconds;
      number.textContent = String(Math.max(0, remainingSeconds));
      updateProgressBar();
      moveToNewSecondShape();
      handleSecondEffects();
      if (remainingSeconds <= 0) {
        window.clearInterval(countdownInterval);
        active.interval = null;
        isRunning = false;
        active.isRunning = false;
        window.setTimeout(() => {
          wrap.classList.remove('danger', 'beat');
        }, 350);
        handleQuizCountdownExpired(questionIndex);
      }
    }, 1000);
    state.quizCountdown.interval = countdownInterval;
  }
  function getQuizTransitionTiming(layer = document.getElementById('quizFullscreenLayer')) {
    const withIntro = Boolean(layer?.classList?.contains('quiz-transition-with-intro'));
    const numberEnterDelay = withIntro ? QUIZ_TRANSITION_FIRST_INFO_MS : 0;
    const exitStart = withIntro ? QUIZ_TRANSITION_FIRST_EXIT_START_MS : QUIZ_TRANSITION_EXIT_START_MS;
    const total = withIntro ? QUIZ_TRANSITION_FIRST_TOTAL_MS : QUIZ_TRANSITION_TOTAL_MS;
    return { withIntro, numberEnterDelay, exitStart, total };
  }

  /* =========================================================
     ENCISOMATH - TRANSICIONES DE BANDA
     No toca countdown.
     No toca polígono/puntaje.
     No toca layout del contenedor.
  ========================================================= */
  (function setupEncisoTransitionBands() {
    const FIGURAS_TOTAL = 10;
    const VELOCIDAD_FIGURAS = 0.4;

    const QUIZ_INFO_HOLD_MS = 3000;
    const ITEM_HOLD_MS = 1900;
    const EXIT_MS = 1180;
    const START_BLACK_MS = 350;

    const COLORES = [
      '#e21b3c',
      '#ff7a00',
      '#EBB513',
      '#24b49a',
      '#54c600'
    ];

    const TIPOS_BASE = ['circulo', 'cuadrado', 'triangulo', 'equis'];

    const DIRECCIONES = [
      { x: -135, y: 0 },
      { x: 135, y: 0 },
      { x: 0, y: -85 },
      { x: 0, y: 85 },
      { x: -135, y: -85 },
      { x: 135, y: -85 },
      { x: -135, y: 85 },
      { x: 135, y: 85 }
    ];

    let timers = [];

    function sleep(ms) {
      return new Promise((resolve) => {
        const timer = setTimeout(resolve, ms);
        timers.push(timer);
      });
    }
  function clearTimers() {
      timers.forEach((timer) => clearTimeout(timer));
      timers = [];
    }
  function random(min, max) {
      return Math.random() * (max - min) + min;
    }
  function randomInt(min, max) {
      return Math.floor(random(min, max + 1));
    }
  function elegir(array) {
      return array[randomInt(0, array.length - 1)];
    }
  function shuffle(array) {
      const copia = [...array];

      for (let i = copia.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copia[i], copia[j]] = [copia[j], copia[i]];
      }

      return copia;
    }
  function construirListaTipos(cantidad) {
      const lista = [];

      while (lista.length < cantidad) {
        lista.push(...shuffle(TIPOS_BASE));
      }

      return lista.slice(0, cantidad);
    }
  function resolveRoot(root) {
      if (root instanceof HTMLElement) return root;
      if (typeof root === 'string') return document.querySelector(root);
      return document.querySelector('.em-transition-host');
    }
  function ensureLayer(root) {
      if (!root) return null;

      root.classList.add('em-transition-host');

      let layer = root.querySelector(':scope > .em-transition-band-layer');

      if (!layer) {
        layer = document.createElement('div');
        layer.className = 'em-transition-band-layer';
        root.insertBefore(layer, root.firstChild);
      }

      return layer;
    }
  function clearLayer(layer) {
      if (!layer) return;
      layer.innerHTML = '';
    }
  function resetAll(root) {
      clearTimers();

      const layer = ensureLayer(root);

      if (layer) clearLayer(layer);
    }
  function createBand({ type, title, subtitle, itemNumber, avoidColor = '' }) {
      const band = document.createElement('section');
      band.className = `em-transition-band ${type || ''}`.trim();

      const figurasLayer = document.createElement('div');
      figurasLayer.className = 'em-transition-figuras-layer';
      figurasLayer.setAttribute('aria-hidden', 'true');

      const copy = document.createElement('div');
      copy.className = 'em-transition-copy';

      const breath = document.createElement('div');
      breath.className = 'em-transition-breath-wrap';

      if (type === 'band-quiz') {
        const kicker = document.createElement('div');
        kicker.className = 'em-transition-quiz-kicker';
        kicker.textContent = 'Nuevo quiz';

        const titleEl = document.createElement('div');
        titleEl.className = 'em-transition-quiz-title';
        titleEl.textContent = title || 'Quiz';

        const subtitleEl = document.createElement('div');
        subtitleEl.className = 'em-transition-quiz-subtitle';
        subtitleEl.textContent = subtitle || '';

        breath.appendChild(kicker);
        breath.appendChild(titleEl);

        if (subtitleEl.textContent.trim()) {
          breath.appendChild(subtitleEl);
        }
      } else {
        const word = document.createElement('div');
        word.className = 'em-transition-item-word';
        word.textContent = 'ITEM';

        const number = document.createElement('div');
        number.className = 'em-transition-item-number';
        number.textContent = String(itemNumber || 1);

        breath.appendChild(word);
        breath.appendChild(number);
      }

      copy.appendChild(breath);
      band.appendChild(figurasLayer);
      band.appendChild(copy);

      const chosenColor = prepareBandVisuals(band, figurasLayer, { avoidColor });

      if (type !== 'band-quiz') {
        setEncisoCurrentItemColor(chosenColor);
      }

      return band;
    }
  function setEncisoCurrentItemColor(color) {
      const safeColor = COLORES.includes(String(color || '').trim()) ? String(color).trim() : '#24b49a';
      window.EncisoCurrentItemColor = safeColor;
      document.documentElement.style.setProperty('--em-current-item-color', safeColor);
      if (window.EncisoQuizHeroLive && typeof window.EncisoQuizHeroLive.setColor === 'function') {
        window.EncisoQuizHeroLive.setColor(safeColor);
      }
    }
  function prepareBandVisuals(band, figurasLayer, { avoidColor = '' } = {}) {
      const availableColors = COLORES.filter((color) => String(color).toLowerCase() !== String(avoidColor).toLowerCase());
      const color = elegir(availableColors.length ? availableColors : COLORES);
      const entrada = elegir(DIRECCIONES);
      const salida = elegir(DIRECCIONES);
      const rotacion = random(-5, 5);

      band.style.setProperty('--band-color', color);
      band.style.setProperty('--band-rot', `${rotacion.toFixed(2)}deg`);

      aplicarDireccionEntrada(band, entrada);
      aplicarDireccionSalida(band, salida);
      crearFiguras(figurasLayer);

      return color;
    }
  function aplicarDireccionEntrada(band, dir) {
      band.style.setProperty('--enter-x', `${dir.x}vw`);
      band.style.setProperty('--enter-y', `${dir.y}vh`);
      band.style.setProperty('--bounce-x1', `${-dir.x * 0.075}vw`);
      band.style.setProperty('--bounce-y1', `${-dir.y * 0.075}vh`);
      band.style.setProperty('--bounce-x2', `${dir.x * 0.042}vw`);
      band.style.setProperty('--bounce-y2', `${dir.y * 0.042}vh`);
      band.style.setProperty('--bounce-x3', `${-dir.x * 0.026}vw`);
      band.style.setProperty('--bounce-y3', `${-dir.y * 0.026}vh`);
      band.style.setProperty('--bounce-x4', `${dir.x * 0.016}vw`);
      band.style.setProperty('--bounce-y4', `${dir.y * 0.016}vh`);
      band.style.setProperty('--bounce-x5', `${-dir.x * 0.009}vw`);
      band.style.setProperty('--bounce-y5', `${-dir.y * 0.009}vh`);
      band.style.setProperty('--bounce-x6', `${dir.x * 0.004}vw`);
      band.style.setProperty('--bounce-y6', `${dir.y * 0.004}vh`);
    }
  function aplicarDireccionSalida(band, dir) {
      band.style.setProperty('--exit-x', `${dir.x}vw`);
      band.style.setProperty('--exit-y', `${dir.y}vh`);
      band.style.setProperty('--exit-pull-x', `${-dir.x * 0.035}vw`);
      band.style.setProperty('--exit-pull-y', `${-dir.y * 0.035}vh`);
      band.style.setProperty('--exit-small-x', `${dir.x * 0.18}vw`);
      band.style.setProperty('--exit-small-y', `${dir.y * 0.18}vh`);
    }
  function posicionExtremo(index) {
      const zona = index % 8;

      if (zona === 0) return { x: random(-5, 105), y: random(-4, 16) };
      if (zona === 1) return { x: random(-5, 105), y: random(84, 104) };
      if (zona === 2) return { x: random(-5, 16), y: random(0, 100) };
      if (zona === 3) return { x: random(84, 105), y: random(0, 100) };
      if (zona === 4) return { x: random(-5, 18), y: random(-5, 18) };
      if (zona === 5) return { x: random(82, 105), y: random(-5, 18) };
      if (zona === 6) return { x: random(-5, 18), y: random(82, 105) };

      return { x: random(82, 105), y: random(82, 105) };
    }
  function posicionInterior() {
      return {
        x: random(18, 82),
        y: random(18, 82)
      };
    }
  function crearFiguras(layer) {
      if (!layer) return;

      layer.innerHTML = '';

      const cantidad = FIGURAS_TOTAL;
      const cantidadExtremos = Math.ceil(cantidad * 0.75);
      const listaTipos = construirListaTipos(cantidad);

      for (let i = 0; i < cantidad; i += 1) {
        const figura = document.createElement('span');
        const tipo = listaTipos[i];

        figura.className = `em-transition-figura ${tipo}`;

        const naceEnExtremo = i < cantidadExtremos;
        const pos = naceEnExtremo ? posicionExtremo(i) : posicionInterior();
        const size = naceEnExtremo ? randomInt(62, 142) : randomInt(48, 112);
        const alpha = random(0.40, 0.64);
        const alphaLow = Math.max(0.24, alpha * 0.68);
        const alphaMid = Math.max(0.30, alpha * 0.86);
        const baseDuration = naceEnExtremo ? random(10, 14) : random(9, 13);
        const duration = baseDuration / VELOCIDAD_FIGURAS;
        const delay = -((i / cantidad) * duration);
        const fuerzaX = naceEnExtremo ? random(50, 145) : random(45, 120);
        const fuerzaY = naceEnExtremo ? random(38, 120) : random(35, 100);
        const x0 = random(-18, 18);
        const y0 = random(-18, 18);
        const x1 = random(-fuerzaX, fuerzaX);
        const y1 = random(-fuerzaY, fuerzaY);
        const x2 = random(-fuerzaX * 1.2, fuerzaX * 1.2);
        const y2 = random(-fuerzaY * 1.2, fuerzaY * 1.2);
        const x3 = random(-fuerzaX * 1.35, fuerzaX * 1.35);
        const y3 = random(-fuerzaY * 1.35, fuerzaY * 1.35);
        const x4 = random(-fuerzaX, fuerzaX);
        const y4 = random(-fuerzaY, fuerzaY);
        const r0 = randomInt(-80, 80);
        const r1 = randomInt(80, 220);
        const r2 = randomInt(220, 420);
        const r3 = randomInt(420, 650);
        const r4 = randomInt(650, 860);
        const r5 = r0 + 360;

        figura.style.setProperty('--x', `${pos.x.toFixed(1)}%`);
        figura.style.setProperty('--y', `${pos.y.toFixed(1)}%`);
        figura.style.setProperty('--size', `${size}px`);
        figura.style.setProperty('--alpha', alpha.toFixed(2));
        figura.style.setProperty('--alpha-low', alphaLow.toFixed(2));
        figura.style.setProperty('--alpha-mid', alphaMid.toFixed(2));
        figura.style.setProperty('--duration', `${duration.toFixed(2)}s`);
        figura.style.setProperty('--delay', `${delay.toFixed(2)}s`);
        figura.style.setProperty('--x0', `${x0.toFixed(1)}px`);
        figura.style.setProperty('--y0', `${y0.toFixed(1)}px`);
        figura.style.setProperty('--x1', `${x1.toFixed(1)}px`);
        figura.style.setProperty('--y1', `${y1.toFixed(1)}px`);
        figura.style.setProperty('--x2', `${x2.toFixed(1)}px`);
        figura.style.setProperty('--y2', `${y2.toFixed(1)}px`);
        figura.style.setProperty('--x3', `${x3.toFixed(1)}px`);
        figura.style.setProperty('--y3', `${y3.toFixed(1)}px`);
        figura.style.setProperty('--x4', `${x4.toFixed(1)}px`);
        figura.style.setProperty('--y4', `${y4.toFixed(1)}px`);
        figura.style.setProperty('--r0', `${r0}deg`);
        figura.style.setProperty('--r1', `${r1}deg`);
        figura.style.setProperty('--r2', `${r2}deg`);
        figura.style.setProperty('--r3', `${r3}deg`);
        figura.style.setProperty('--r4', `${r4}deg`);
        figura.style.setProperty('--r5', `${r5}deg`);

        layer.appendChild(figura);
      }
    }

    async function enterBand(band) {
      band.classList.remove('is-exiting');
      band.classList.add('is-entering');
      await sleep(1350);
    }

    async function exitBand(band) {
      band.classList.remove('is-entering');
      band.classList.add('is-exiting');
      await sleep(EXIT_MS);
    }

    async function playItemOnly(options = {}) {
      const root = resolveRoot(options.root);
      if (!root) return;

      resetAll(root);

      const layer = ensureLayer(root);
      if (!layer) return;

      await sleep(START_BLACK_MS);

      const band = createBand({
        type: 'band-single',
        itemNumber: options.itemNumber || 1
      });

      layer.appendChild(band);

      playQuizItemTransitionSound();
      await enterBand(band);
      await sleep(ITEM_HOLD_MS);
      await exitBand(band);

      band.remove();
    }

    async function playQuizIntroThenItem(options = {}) {
      const root = resolveRoot(options.root);
      if (!root) return;

      resetAll(root);

      const layer = ensureLayer(root);
      if (!layer) return;

      await sleep(START_BLACK_MS);

      const quizBand = createBand({
        type: 'band-quiz',
        title: options.quizTitle || 'Quiz',
        subtitle: options.quizSubtitle || ''
      });

      layer.appendChild(quizBand);

      await enterBand(quizBand);
      await sleep(QUIZ_INFO_HOLD_MS);

      const itemBand = createBand({
        type: 'band-item-over',
        itemNumber: options.itemNumber || 1,
        avoidColor: quizBand.style.getPropertyValue('--band-color')
      });

      layer.appendChild(itemBand);

      playQuizItemTransitionSound();
      await enterBand(itemBand);
      await sleep(ITEM_HOLD_MS);

      await Promise.all([
        exitBand(quizBand),
        exitBand(itemBand)
      ]);

      quizBand.remove();
      itemBand.remove();
    }
  function stop(options = {}) {
      const root = resolveRoot(options.root);
      clearTimers();

      if (root) {
        const layer = ensureLayer(root);
        clearLayer(layer);
      }
    }

    window.EncisoTransitionBands = {
      playItemOnly,
      playQuizIntroThenItem,
      stop
    };
  })();


  /* =========================================================
     ENCISOMATH - HERO DEL QUIZ EN VIVO
     Flat + 5 figuras grandes animadas.
     Usa el mismo color del ITEM de la transicion anterior.
  ========================================================= */
  (function setupEncisoQuizHeroLive() {
    const FIGURAS_TOTAL = 5;
    const VELOCIDAD_FIGURAS = 0.4;
    const COLORES_ITEM = ['#e21b3c', '#ff7a00', '#EBB513', '#24b49a', '#54c600'];
    const TIPOS_BASE = ['circulo', 'cuadrado', 'triangulo', 'equis'];

    function random(min, max) { return Math.random() * (max - min) + min; }
  function randomInt(min, max) { return Math.floor(random(min, max + 1)); }
  function shuffle(array) {
      const copia = [...array];
      for (let i = copia.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copia[i], copia[j]] = [copia[j], copia[i]];
      }
      return copia;
    }
  function construirListaTipos(cantidad) {
      const lista = [];
      while (lista.length < cantidad) lista.push(...shuffle(TIPOS_BASE));
      return lista.slice(0, cantidad);
    }
  function normalizarColor(color) {
      const value = String(color || '').trim();
      return COLORES_ITEM.includes(value) ? value : '#24b49a';
    }
  function oscurecerColor(hex, factor) {
      const clean = String(hex || '').replace('#', '');
      if (clean.length !== 6) return 'rgba(0, 0, 0, 0.28)';
      const r = parseInt(clean.slice(0, 2), 16);
      const g = parseInt(clean.slice(2, 4), 16);
      const b = parseInt(clean.slice(4, 6), 16);
      if (![r, g, b].every(Number.isFinite)) return 'rgba(0, 0, 0, 0.28)';
      const nr = Math.max(0, Math.round(r * factor));
      const ng = Math.max(0, Math.round(g * factor));
      const nb = Math.max(0, Math.round(b * factor));
      return `rgb(${nr}, ${ng}, ${nb})`;
    }
  function resolveHero(root) {
      if (root instanceof HTMLElement) return root;
      if (typeof root === 'string') return document.querySelector(root);
      return document.querySelector('.em-quiz-hero-live');
    }
  function ensureHero(root) {
      const hero = resolveHero(root);
      if (!hero) return null;
      hero.classList.add('em-quiz-hero-live');
      const computed = window.getComputedStyle(hero);
      if (computed.position === 'static') hero.style.position = 'relative';
      return hero;
    }
  function ensureLayer(hero) {
      if (!hero) return null;
      let layer = hero.querySelector(':scope > .em-quiz-hero-shapes-layer');
      if (!layer) {
        layer = document.createElement('div');
        layer.className = 'em-quiz-hero-shapes-layer';
        layer.setAttribute('aria-hidden', 'true');
        hero.insertBefore(layer, hero.firstChild);
      }
      return layer;
    }
  function posicionDistribuida(index) {
      const zonas = [
        { xMin: 6, xMax: 18, yMin: 12, yMax: 34 },
        { xMin: 24, xMax: 40, yMin: 50, yMax: 84 },
        { xMin: 44, xMax: 58, yMin: 8, yMax: 30 },
        { xMin: 64, xMax: 78, yMin: 46, yMax: 82 },
        { xMin: 84, xMax: 96, yMin: 14, yMax: 40 }
      ];
      const zona = zonas[index % zonas.length];
      return { x: random(zona.xMin, zona.xMax), y: random(zona.yMin, zona.yMax) };
    }
  function crearFiguras(hero) {
      const layer = ensureLayer(hero);
      if (!layer) return;
      layer.innerHTML = '';
      const listaTipos = construirListaTipos(FIGURAS_TOTAL);
      for (let i = 0; i < FIGURAS_TOTAL; i += 1) {
        const figura = document.createElement('span');
        const tipo = listaTipos[i];
        figura.className = `em-hero-shape ${tipo}`;
        const pos = posicionDistribuida(i);
        const size = randomInt(68, 128);
        const alpha = random(0.34, 0.54);
        const alphaLow = Math.max(0.22, alpha * 0.72);
        const alphaMid = Math.max(0.28, alpha * 0.88);
        const baseDuration = random(10, 14);
        const duration = baseDuration / VELOCIDAD_FIGURAS;
        const delay = -(random(0, duration));
        const fuerzaX = random(20, 54);
        const fuerzaY = random(8, 20);
        const x0 = random(-8, 8);
        const y0 = random(-5, 5);
        const x1 = random(-fuerzaX, fuerzaX);
        const y1 = random(-fuerzaY, fuerzaY);
        const x2 = random(-fuerzaX * 1.08, fuerzaX * 1.08);
        const y2 = random(-fuerzaY * 1.08, fuerzaY * 1.08);
        const x3 = random(-fuerzaX * 1.20, fuerzaX * 1.20);
        const y3 = random(-fuerzaY * 1.20, fuerzaY * 1.20);
        const x4 = random(-fuerzaX, fuerzaX);
        const y4 = random(-fuerzaY, fuerzaY);
        const r0 = randomInt(-80, 80);
        const r1 = randomInt(80, 220);
        const r2 = randomInt(220, 420);
        const r3 = randomInt(420, 650);
        const r4 = randomInt(650, 860);
        const r5 = r0 + 360;

        figura.style.setProperty('--x', `${pos.x.toFixed(1)}%`);
        figura.style.setProperty('--y', `${pos.y.toFixed(1)}%`);
        figura.style.setProperty('--size', `${size}px`);
        figura.style.setProperty('--alpha', alpha.toFixed(2));
        figura.style.setProperty('--alpha-low', alphaLow.toFixed(2));
        figura.style.setProperty('--alpha-mid', alphaMid.toFixed(2));
        figura.style.setProperty('--duration', `${duration.toFixed(2)}s`);
        figura.style.setProperty('--delay', `${delay.toFixed(2)}s`);
        figura.style.setProperty('--x0', `${x0.toFixed(1)}px`);
        figura.style.setProperty('--y0', `${y0.toFixed(1)}px`);
        figura.style.setProperty('--x1', `${x1.toFixed(1)}px`);
        figura.style.setProperty('--y1', `${y1.toFixed(1)}px`);
        figura.style.setProperty('--x2', `${x2.toFixed(1)}px`);
        figura.style.setProperty('--y2', `${y2.toFixed(1)}px`);
        figura.style.setProperty('--x3', `${x3.toFixed(1)}px`);
        figura.style.setProperty('--y3', `${y3.toFixed(1)}px`);
        figura.style.setProperty('--x4', `${x4.toFixed(1)}px`);
        figura.style.setProperty('--y4', `${y4.toFixed(1)}px`);
        figura.style.setProperty('--r0', `${r0}deg`);
        figura.style.setProperty('--r1', `${r1}deg`);
        figura.style.setProperty('--r2', `${r2}deg`);
        figura.style.setProperty('--r3', `${r3}deg`);
        figura.style.setProperty('--r4', `${r4}deg`);
        figura.style.setProperty('--r5', `${r5}deg`);
        layer.appendChild(figura);
      }
    }
  function setColor(color, root) {
      const finalColor = normalizarColor(color);
      const shapeColor = oscurecerColor(finalColor, 0.55);
      window.EncisoCurrentItemColor = finalColor;
      document.documentElement.style.setProperty('--em-current-item-color', finalColor);
      const hero = ensureHero(root);
      if (!hero) return;
      hero.style.setProperty('--em-hero-bg', finalColor);
      hero.style.setProperty('--em-hero-countdown-color', finalColor);
      hero.style.setProperty('--em-hero-shape-color', shapeColor);
    }
  function init(root) {
      const hero = ensureHero(root);
      if (!hero) return;
      const currentColor = window.EncisoCurrentItemColor || getComputedStyle(document.documentElement).getPropertyValue('--em-current-item-color') || '#24b49a';
      setColor(currentColor, hero);
      crearFiguras(hero);
    }
  function refresh(root) {
      const hero = ensureHero(root);
      if (!hero) return;
      crearFiguras(hero);
    }

    window.EncisoQuizHeroLive = { init, refresh, setColor };

    document.addEventListener('DOMContentLoaded', () => {
      const hero = document.querySelector('.em-quiz-hero-live');
      if (hero) init(hero);
    });
  })();
  function shouldShowQuizTransitionScore(itemNumber = state.quizQuestionIndex + 1) {
    return Math.max(1, Number(itemNumber) || 1) > 1;
  }
  function quizTransitionScoreHTML(itemNumber = 1, quiz = getActiveQuiz()) {
    if (!shouldShowQuizTransitionScore(itemNumber)) return '';
    const score = getQuizCumulativeScoreBeforeTransition(itemNumber, quiz);
    const tune = getQuizTransitionScoreTune();
    return `
      <section class="quiz-transition-score-wrap" data-quiz-transition-score-wrap data-score-from="${Number(score.from) || 0}" data-score-to="${Number(score.to) || 0}" aria-label="Puntaje acumulado">
        <div id="scoreCounterSlot" class="score-counter-slot" data-score-counter-slot style="--score-counter-y:${Number(tune.y) || 0}px;--score-counter-zoom:${(Number(tune.zoom) || 100) / 100};"></div>
      </section>
    `;
  }
  function playScoreCounter({ target, from = 0, score = 0 } = {}) {
    const container = typeof target === 'string' ? document.querySelector(target) : target;
    if (!container) return;
    if (container._scoreCounterCleanup) container._scoreCounterCleanup();
    container.innerHTML = '';

    const stage = document.createElement('div');
    stage.className = 'score-counter-stage';
    stage.innerHTML = `
      <svg class="score-counter-svg" viewBox="0 0 560 270" aria-hidden="true">
        <polygon class="score-counter-polygon"></polygon>
      </svg>
      <div class="score-counter-text"></div>
    `;
    container.appendChild(stage);

    const polygon = stage.querySelector('.score-counter-polygon');
    const scoreText = stage.querySelector('.score-counter-text');
    const CENTER = [280, 135];
    const BASE_POINTS = [[78, 62], [484, 54], [468, 212], [88, 220]];
    const LIMITS = [
      { minX: 48, maxX: 112, minY: 44, maxY: 82 },
      { minX: 448, maxX: 512, minY: 44, maxY: 82 },
      { minX: 430, maxX: 498, minY: 192, maxY: 232 },
      { minX: 58, maxX: 126, minY: 192, maxY: 232 }
    ];
    const ENTER_DURATION = 390;
    const EXIT_DURATION = 330;
    const CHAR_IN_STAGGER = 22;
    const CHAR_OUT_STAGGER = 18;
    const COUNT_DURATION = 1250;
    const HOLD_TIME = 1800;
    const POLYGON_OPEN_DURATION = 300;
    const POLYGON_OPEN_STAGGER = 18;
    const POLYGON_CLOSE_DURATION = 230;
    const POLYGON_CLOSE_STAGGER = 24;

    let timeouts = [];
    let countFrame = null;
    let polygonAnimationFrame = null;
    let currentPoints = [[...CENTER], [...CENTER], [...CENTER], [...CENTER]];

    function clearAllTimeouts() { timeouts.forEach((timeout) => clearTimeout(timeout)); timeouts = []; }
  function later(callback, delay) { const timeout = setTimeout(callback, delay); timeouts.push(timeout); return timeout; }
  function clonePoints(points) { return points.map(([x, y]) => [x, y]); }
  function randomBetween(min, max) { return min + Math.random() * (max - min); }
  function clamp(value, min, max) { return Math.min(Math.max(value, min), max); }
  function pointsToString(points) { return points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' '); }
  function easeOutBackFast(t) { const c1 = 2.15; const c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  function easeInBackFast(t) { const c1 = 1.9; const c3 = c1 + 1; return c3 * t * t * t - c1 * t * t; }
  function easeInOutCubic(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeOutExpo(t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }
  function createRandomOpenShape() {
      return BASE_POINTS.map(([x, y], index) => {
        const limit = LIMITS[index];
        return [clamp(x + randomBetween(-24, 24), limit.minX, limit.maxX), clamp(y + randomBetween(-12, 12), limit.minY, limit.maxY)];
      });
    }
  function createTinyLivingShapeAround(points) {
      return points.map(([x, y], index) => {
        const limit = LIMITS[index];
        return [clamp(x + randomBetween(-8, 8), limit.minX, limit.maxX), clamp(y + randomBetween(-5, 5), limit.minY, limit.maxY)];
      });
    }
  function animatePolygonTo(targetPoints, options = {}) {
      const { duration = 300, stagger = 0, easing = easeOutBackFast, onComplete = null } = options;
      if (polygonAnimationFrame) cancelAnimationFrame(polygonAnimationFrame);
      const fromPoints = clonePoints(currentPoints);
      const startTime = performance.now();
      const totalDuration = duration + stagger * (targetPoints.length - 1);
      function tick(now) {
        const elapsed = now - startTime;
        currentPoints = fromPoints.map(([x, y], index) => {
          const pointDelay = stagger * index;
          const progress = clamp((elapsed - pointDelay) / duration, 0, 1);
          const eased = easing(progress);
          const [targetX, targetY] = targetPoints[index];
          return [x + (targetX - x) * eased, y + (targetY - y) * eased];
        });
        polygon.setAttribute('points', pointsToString(currentPoints));
        if (elapsed < totalDuration) polygonAnimationFrame = requestAnimationFrame(tick);
        else {
          currentPoints = clonePoints(targetPoints);
          polygon.setAttribute('points', pointsToString(currentPoints));
          polygonAnimationFrame = null;
          if (typeof onComplete === 'function') onComplete();
        }
      }
      polygonAnimationFrame = requestAnimationFrame(tick);
    }
  function formatScore(value) { return Math.max(0, Math.round(Number(value) || 0)).toLocaleString('es-CO'); }
  function createScoreText(text) {
      scoreText.innerHTML = '';
      const cleanText = String(text).trim() || '0';
      [...cleanText].forEach((char, index) => {
        const span = document.createElement('span');
        span.className = char === ' ' ? 'score-counter-char score-counter-space' : 'score-counter-char';
        span.style.setProperty('--i', index);
        if (char === ' ') span.innerHTML = '&nbsp;';
        else { span.textContent = char; span.setAttribute('data-char', char); }
        scoreText.appendChild(span);
      });
      return cleanText.length;
    }
  function createReadyScoreText(text) {
      scoreText.innerHTML = '';
      const cleanText = String(text).trim() || '0';
      [...cleanText].forEach((char, index) => {
        const span = document.createElement('span');
        span.className = char === ' ' ? 'score-counter-char ready score-counter-space' : 'score-counter-char ready';
        span.style.setProperty('--i', index);
        if (char === ' ') span.innerHTML = '&nbsp;';
        else { span.textContent = char; span.setAttribute('data-char', char); }
        scoreText.appendChild(span);
      });
    }
  function updateScoreTextWithoutRestart(text) {
      const cleanText = String(text);
      const chars = scoreText.querySelectorAll('.score-counter-char');
      if (chars.length !== cleanText.length) { createReadyScoreText(cleanText); return; }
      chars.forEach((span, index) => {
        const char = cleanText[index];
        span.classList.add('ready');
        span.classList.remove('out');
        span.style.setProperty('--i', index);
        if (char === ' ') { span.innerHTML = '&nbsp;'; span.removeAttribute('data-char'); }
        else { span.textContent = char; span.setAttribute('data-char', char); }
      });
    }
  function exitScoreText() {
      scoreText.querySelectorAll('.score-counter-char').forEach((char, index) => {
        char.classList.remove('ready', 'out');
        char.style.setProperty('--i', index);
        void char.offsetWidth;
        char.classList.add('out');
      });
    }
  function resetPolygonToCenter() {
      currentPoints = [[...CENTER], [...CENTER], [...CENTER], [...CENTER]];
      polygon.setAttribute('points', pointsToString(currentPoints));
    }
  function playStagePop() {
      stage.classList.remove('stage-pop');
      void stage.offsetWidth;
      stage.classList.add('stage-pop');
      later(() => stage.classList.remove('stage-pop'), 300);
    }
  function startCountingTo(startNumber, targetNumber, onComplete) {
      if (countFrame) cancelAnimationFrame(countFrame);
      const fromNumber = Math.max(0, Math.round(Number(startNumber) || 0));
      const toNumber = Math.max(0, Math.round(Number(targetNumber) || 0));
      const diff = toNumber - fromNumber;
      const startTime = performance.now();
      function tick(now) {
        const elapsed = now - startTime;
        const progress = clamp(elapsed / COUNT_DURATION, 0, 1);
        const eased = easeOutExpo(progress);
        const currentValue = Math.round(fromNumber + (diff * eased));
        updateScoreTextWithoutRestart(formatScore(currentValue));
        if (progress < 1) countFrame = requestAnimationFrame(tick);
        else {
          updateScoreTextWithoutRestart(formatScore(toNumber));
          countFrame = null;
          if (typeof onComplete === 'function') onComplete();
        }
      }
      countFrame = requestAnimationFrame(tick);
    }
  function closePolygonDuringTextExit(finalText) {
      const finalLength = String(finalText).length;
      const totalExitTime = EXIT_DURATION + ((finalLength - 1) * CHAR_OUT_STAGGER);
      const totalPolygonCloseTime = POLYGON_CLOSE_DURATION + ((4 - 1) * POLYGON_CLOSE_STAGGER);
      later(() => {
        animatePolygonTo([[...CENTER], [...CENTER], [...CENTER], [...CENTER]], { duration: POLYGON_CLOSE_DURATION, stagger: POLYGON_CLOSE_STAGGER, easing: easeInBackFast });
      }, 90);
      later(() => { container.innerHTML = ''; }, Math.max(totalExitTime, 90 + totalPolygonCloseTime) + 120);
    }
  function cleanup() {
      clearAllTimeouts();
      if (countFrame) { cancelAnimationFrame(countFrame); countFrame = null; }
      if (polygonAnimationFrame) { cancelAnimationFrame(polygonAnimationFrame); polygonAnimationFrame = null; }
    }
    container._scoreCounterCleanup = cleanup;
    resetPolygonToCenter();
    playStagePop();
    const fromNumber = Math.max(0, Math.round(Number(from) || 0));
    const targetNumber = Math.max(0, Math.round(Number(score) || 0));
    const finalText = formatScore(targetNumber);
    const openShape = createRandomOpenShape();
    animatePolygonTo(openShape, {
      duration: POLYGON_OPEN_DURATION,
      stagger: POLYGON_OPEN_STAGGER,
      easing: easeOutBackFast,
      onComplete: () => animatePolygonTo(createTinyLivingShapeAround(openShape), { duration: 260, stagger: 12, easing: easeInOutCubic })
    });
    later(() => {
      const textLength = createScoreText(formatScore(fromNumber));
      const totalEntranceTime = ENTER_DURATION + ((textLength - 1) * CHAR_IN_STAGGER);
      later(() => {
        startCountingTo(fromNumber, targetNumber, () => {
          later(() => {
            exitScoreText();
            closePolygonDuringTextExit(finalText);
          }, HOLD_TIME);
        });
      }, totalEntranceTime);
    }, 120);
  }
  function playQuizTransitionScoreCounter(layer = document.getElementById('quizFullscreenLayer')) {
    const wrap = layer?.querySelector?.('[data-quiz-transition-score-wrap]');
    const slot = wrap?.querySelector?.('[data-score-counter-slot]');
    if (!wrap || !slot) return;
    applyQuizTransitionScoreTune();
    playScoreCounter({ target: slot, from: Number(wrap.dataset.scoreFrom) || 0, score: Number(wrap.dataset.scoreTo) || 0 });
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
    document.getElementById('modalLayer')?.classList.toggle('em-quiz-start-layer', Boolean(document.querySelector('.em-quiz-start-modal')));
    document.querySelectorAll('[data-quiz-start-confirm]').forEach((button) => {
      button.addEventListener('click', beginQuizFromConfirm);
    });
    bindQuizStartSliderEvents();
    document.querySelectorAll('[data-quiz-skip-results]').forEach((button) => {
      button.addEventListener('click', showQuizResultsFromConfirm);
    });
    document.querySelectorAll('[data-quiz-time-scoring-mode]').forEach((select) => {
      select.addEventListener('change', () => saveQuizTimeScoringMode(select.value));
    });
    document.querySelectorAll('[data-quiz-result-target]').forEach((button) => {
      button.addEventListener('click', () => {
        const root = button.closest?.('[data-final-results]');
        stopQuizResultsMusic(true);
        encisoPlayResultButtonJello(button);
        const target = button.dataset.quizResultTarget || 'quizzes';
        if (root) {
          setTimeout(() => {
            encisoPlayFinalResultsFlowOut(root, () => closeQuizFullscreen(target));
          }, 600);
        } else {
          setTimeout(() => closeQuizFullscreen(target), 600);
        }
      });
    });
    document.querySelectorAll('[data-enciso-result-replay]').forEach((button) => {
      button.addEventListener('click', () => {
        const quiz = getActiveQuiz();
        const root = button.closest?.('[data-final-results]');
        stopQuizResultsMusic(true);
        encisoPlayResultButtonJello(button);
        if (root) encisoPlayFinalResultsFlowOut(root, () => { if (quiz) renderQuizFullscreen(quiz); });
        else if (quiz) renderQuizFullscreen(quiz);
      });
    });
    document.querySelectorAll('[data-quiz-restart]').forEach((button) => {
      button.addEventListener('click', () => restartQuiz());
    });
    document.querySelectorAll('[data-quiz-security-continue]').forEach((button) => {
      button.addEventListener('click', continueQuizAfterSecurityWarning);
    });
    document.querySelectorAll('[data-quiz-transition-continue]').forEach((button) => {
      button.addEventListener('click', () => {
        button.disabled = true;
        goToQuizQuestionFromTransition();
      });
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
    bindQuizFlipEvents();
    bindQuizOrderEvents();
    applyQuizTypographyTune(getQuizTypographyTune());
    applyQuizCountdownTune(getQuizCountdownTune());
    applyQuizPaddingDebugTune(getQuizPaddingDebugTune());
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
    emFlatApplyBackgrounds(wrapper);
    document.body.classList.add('modal-open', 'quiz-security-warning-open');
    requestAnimationFrame(() => requestAnimationFrame(() => wrapper.classList.add('show')));
    wrapper.querySelector('[data-quiz-security-continue]')?.addEventListener('click', continueQuizAfterSecurityWarning);
    startDeleteWarningMotion();
  }
  function quizSecurityWarningHTML(reason = '') {
    return `
      <div class="modal-card danger-modal quiz-security-modal" role="dialog" aria-modal="true" aria-label="Advertencia de seguridad del quiz">
        <div class="danger-head quiz-security-flat-head" data-em-flat-bg>
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
    const answerTiming = markQuizCountdownResponded();
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
      recordQuizAnswer(question, selectedCorrect, { selected: session.selectedAnswerId, timing: answerTiming });
      revealQuizAnswer(stage, button, selectedCorrect);
      playQuizSound(selectedCorrect ? 'correct' : 'wrong');
      showQuizFeedbackBandAfterDelay(stage, selectedCorrect, question, '', QUIZ_FEEDBACK_AFTER_CHOICE_REVEAL_MS);
    }, 1000);
  }
  function revealQuizAnswer(stage, selectedButton, selectedCorrect) {
    stage.classList.remove('quiz-choice-pending');
    stage.classList.add('quiz-choice-revealed');
    keepQuizRevealOverflowOpen(1700);
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

  // =========================================================
  // ENCISOMATH - BANDA DE FEEDBACK QUIZ
  // Reemplazo visual para Correcto / Incorrecto / Enviado / Tiempo.
  // =========================================================
  (function setupEncisoFeedbackBand() {
    const FIGURAS_TOTAL = 10;
    const VELOCIDAD_FIGURAS = 0.4;

    const ENTER_MS = 500;
    const HOLD_MS = 2500;
    const EXIT_MS = 500;

    const DEFAULT_POS_Y = 50;
    const DEFAULT_TITLE_SIZE = 58;
    const DEFAULT_SUBTITLE_SIZE = 22;

    const DIRECCIONES = [
      { x: -135, y: 0 },
      { x: 135, y: 0 },
      { x: 0, y: -85 },
      { x: 0, y: 85 },
      { x: -135, y: -85 },
      { x: 135, y: -85 },
      { x: -135, y: 85 },
      { x: 135, y: 85 }
    ];

    const TIPOS_BASE = ['circulo', 'cuadrado', 'triangulo', 'equis'];

    const ESTADOS = {
      correcto: {
        title: 'Correcto!',
        bg: '#58cc02',
        text: '#ffffff',
        subtitles: [
          'Eso era, sin hacer show.',
          'Correcto y sin drama.',
          'Hoy sí prendió la neurona.',
          'La respuesta estaba en modo fino.',
          'Se hizo lo que se tenía que hacer.',
          'Entró como debía entrar.',
          'Ni el profe lo vio venir.'
        ]
      },

      incorrecto: {
        title: 'Incorrecto!',
        bg: '#e21b3c',
        text: '#ffffff',
        subtitles: [
          'Peleaste solo y aun así perdiste.',
          'La intención estaba, la respuesta no.',
          'Casi, pero el casi no califica.',
          'Esa respuesta venía en modo creativo.',
          'Te fuiste por una ruta alterna.',
          'El cálculo dijo: yo no fui.',
          'No era por ahí, pero se respetó el intento.'
        ]
      },

      enviado: {
        title: 'Enviado!',
        bg: '#1368ce',
        text: '#ffffff',
        subtitles: [
          'Listo, eso ya viajó.',
          'Se mandó con toda la fe.',
          'Ya quedó en manos del destino.',
          'Enviado, sin mirar atrás.',
          'Eso ya está en el sistema.',
          'Firmado, sellado y enviado.',
          'Ya no hay botón de arrepentimiento.'
        ]
      },

      tiempo: {
        title: 'Tiempo!',
        bg: '#ffffff',
        text: '#111111',
        subtitles: [
          'Peleaste solo y aun así perdiste.',
          'El reloj hizo speedrun.',
          'Parpadeaste y se fue.',
          'El tiempo no perdona.',
          'Cronómetro: 1, tú: 0.',
          'Se acabó el recreo.',
          'El reloj llegó con pruebas.'
        ]
      }
    };

    let timers = [];

    function clearTimers() {
      timers.forEach((timer) => clearTimeout(timer));
      timers = [];
    }
  function sleep(ms) {
      return new Promise((resolve) => {
        const timer = setTimeout(resolve, ms);
        timers.push(timer);
      });
    }
  function random(min, max) {
      return Math.random() * (max - min) + min;
    }
  function randomInt(min, max) {
      return Math.floor(random(min, max + 1));
    }
  function elegir(array) {
      return array[randomInt(0, array.length - 1)];
    }
  function shuffle(array) {
      const copia = [...array];

      for (let i = copia.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copia[i], copia[j]] = [copia[j], copia[i]];
      }

      return copia;
    }
  function construirListaTipos(cantidad) {
      const lista = [];

      while (lista.length < cantidad) {
        lista.push(...shuffle(TIPOS_BASE));
      }

      return lista.slice(0, cantidad);
    }
  function normalizeState(state) {
      const value = String(state || '').toLowerCase().trim();

      if (value === 'correcto' || value === 'correct' || value === 'right' || value === 'ok' || value === 'success') {
        return 'correcto';
      }

      if (value === 'incorrecto' || value === 'incorrect' || value === 'wrong' || value === 'error' || value === 'fail') {
        return 'incorrecto';
      }

      if (value === 'enviado' || value === 'submitted' || value === 'sent' || value === 'open' || value === 'manual' || value === 'neutral') {
        return 'enviado';
      }

      if (value === 'tiempo' || value === 'tiempo!' || value === 'timeout' || value === 'time' || value === 'timeup') {
        return 'tiempo';
      }

      return 'enviado';
    }
  function resolveRoot(root) {
      if (root instanceof HTMLElement) {
        return root;
      }

      if (typeof root === 'string') {
        return document.querySelector(root);
      }

      return document.querySelector('.em-feedback-host');
    }
  function ensureHost(root) {
      if (!root) return null;

      root.classList.add('em-feedback-host');

      const computed = window.getComputedStyle(root);

      if (computed.position === 'static') {
        root.style.position = 'relative';
      }

      return root;
    }
  function ensureLayer(root) {
      const host = ensureHost(root);

      if (!host) return null;

      let layer = host.querySelector(':scope > .em-feedback-band-layer');

      if (!layer) {
        layer = document.createElement('div');
        layer.className = 'em-feedback-band-layer';
        host.insertBefore(layer, host.firstChild);
      }

      return layer;
    }
  function clearLayer(layer) {
      if (!layer) return;
      layer.innerHTML = '';
    }
  function aplicarDireccionEntrada(band, dir) {
      band.style.setProperty('--enter-x', `${dir.x}vw`);
      band.style.setProperty('--enter-y', `${dir.y}vh`);

      band.style.setProperty('--bounce-x1', `${-dir.x * 0.075}vw`);
      band.style.setProperty('--bounce-y1', `${-dir.y * 0.075}vh`);

      band.style.setProperty('--bounce-x2', `${dir.x * 0.042}vw`);
      band.style.setProperty('--bounce-y2', `${dir.y * 0.042}vh`);

      band.style.setProperty('--bounce-x3', `${-dir.x * 0.026}vw`);
      band.style.setProperty('--bounce-y3', `${-dir.y * 0.026}vh`);

      band.style.setProperty('--bounce-x4', `${dir.x * 0.016}vw`);
      band.style.setProperty('--bounce-y4', `${dir.y * 0.016}vh`);
    }
  function aplicarDireccionSalida(band, dir) {
      band.style.setProperty('--exit-x', `${dir.x}vw`);
      band.style.setProperty('--exit-y', `${dir.y}vh`);

      band.style.setProperty('--exit-pull-x', `${-dir.x * 0.035}vw`);
      band.style.setProperty('--exit-pull-y', `${-dir.y * 0.035}vh`);

      band.style.setProperty('--exit-small-x', `${dir.x * 0.18}vw`);
      band.style.setProperty('--exit-small-y', `${dir.y * 0.18}vh`);
    }
  function posicionExtremo(index) {
      const zona = index % 8;

      if (zona === 0) return { x: random(-5, 105), y: random(-4, 16) };
      if (zona === 1) return { x: random(-5, 105), y: random(84, 104) };
      if (zona === 2) return { x: random(-5, 16), y: random(0, 100) };
      if (zona === 3) return { x: random(84, 105), y: random(0, 100) };
      if (zona === 4) return { x: random(-5, 18), y: random(-5, 18) };
      if (zona === 5) return { x: random(82, 105), y: random(-5, 18) };
      if (zona === 6) return { x: random(-5, 18), y: random(82, 105) };

      return { x: random(82, 105), y: random(82, 105) };
    }
  function posicionInterior() {
      return {
        x: random(18, 82),
        y: random(18, 82)
      };
    }
  function crearFiguras(layer) {
      if (!layer) return;

      layer.innerHTML = '';

      const cantidad = FIGURAS_TOTAL;
      const cantidadExtremos = Math.ceil(cantidad * 0.75);
      const listaTipos = construirListaTipos(cantidad);

      for (let i = 0; i < cantidad; i++) {
        const figura = document.createElement('span');
        const tipo = listaTipos[i];

        figura.className = `em-feedback-figura ${tipo}`;

        const naceEnExtremo = i < cantidadExtremos;
        const pos = naceEnExtremo ? posicionExtremo(i) : posicionInterior();

        const size = naceEnExtremo ? randomInt(52, 118) : randomInt(42, 92);

        const alpha = random(0.36, 0.58);
        const alphaLow = Math.max(0.22, alpha * 0.66);
        const alphaMid = Math.max(0.28, alpha * 0.84);

        const baseDuration = naceEnExtremo ? random(10, 14) : random(9, 13);
        const duration = baseDuration / VELOCIDAD_FIGURAS;
        const delay = -((i / cantidad) * duration);

        const fuerzaX = naceEnExtremo ? random(42, 120) : random(35, 95);
        const fuerzaY = naceEnExtremo ? random(24, 70) : random(20, 58);

        const x0 = random(-16, 16);
        const y0 = random(-12, 12);

        const x1 = random(-fuerzaX, fuerzaX);
        const y1 = random(-fuerzaY, fuerzaY);

        const x2 = random(-fuerzaX * 1.2, fuerzaX * 1.2);
        const y2 = random(-fuerzaY * 1.2, fuerzaY * 1.2);

        const x3 = random(-fuerzaX * 1.35, fuerzaX * 1.35);
        const y3 = random(-fuerzaY * 1.35, fuerzaY * 1.35);

        const x4 = random(-fuerzaX, fuerzaX);
        const y4 = random(-fuerzaY, fuerzaY);

        const r0 = randomInt(-80, 80);
        const r1 = randomInt(80, 220);
        const r2 = randomInt(220, 420);
        const r3 = randomInt(420, 650);
        const r4 = randomInt(650, 860);
        const r5 = r0 + 360;

        figura.style.setProperty('--x', `${pos.x.toFixed(1)}%`);
        figura.style.setProperty('--y', `${pos.y.toFixed(1)}%`);
        figura.style.setProperty('--size', `${size}px`);

        figura.style.setProperty('--alpha', alpha.toFixed(2));
        figura.style.setProperty('--alpha-low', alphaLow.toFixed(2));
        figura.style.setProperty('--alpha-mid', alphaMid.toFixed(2));

        figura.style.setProperty('--duration', `${duration.toFixed(2)}s`);
        figura.style.setProperty('--delay', `${delay.toFixed(2)}s`);

        figura.style.setProperty('--x0', `${x0.toFixed(1)}px`);
        figura.style.setProperty('--y0', `${y0.toFixed(1)}px`);
        figura.style.setProperty('--x1', `${x1.toFixed(1)}px`);
        figura.style.setProperty('--y1', `${y1.toFixed(1)}px`);
        figura.style.setProperty('--x2', `${x2.toFixed(1)}px`);
        figura.style.setProperty('--y2', `${y2.toFixed(1)}px`);
        figura.style.setProperty('--x3', `${x3.toFixed(1)}px`);
        figura.style.setProperty('--y3', `${y3.toFixed(1)}px`);
        figura.style.setProperty('--x4', `${x4.toFixed(1)}px`);
        figura.style.setProperty('--y4', `${y4.toFixed(1)}px`);

        figura.style.setProperty('--r0', `${r0}deg`);
        figura.style.setProperty('--r1', `${r1}deg`);
        figura.style.setProperty('--r2', `${r2}deg`);
        figura.style.setProperty('--r3', `${r3}deg`);
        figura.style.setProperty('--r4', `${r4}deg`);
        figura.style.setProperty('--r5', `${r5}deg`);

        layer.appendChild(figura);
      }
    }
  function createBand(options) {
      const stateKey = normalizeState(options && options.state);
      const estado = ESTADOS[stateKey];

      const band = document.createElement('section');
      band.className = 'em-feedback-band';

      band.style.setProperty('--em-feedback-pos-y', String(options.posY || DEFAULT_POS_Y));
      band.style.setProperty('--em-feedback-title-size', String(options.titleSize || DEFAULT_TITLE_SIZE));
      band.style.setProperty('--em-feedback-subtitle-size', String(options.subtitleSize || DEFAULT_SUBTITLE_SIZE));
      band.style.setProperty('--em-feedback-band-color', estado.bg);
      band.style.setProperty('--em-feedback-text-color', estado.text);

      const entrada = elegir(DIRECCIONES);
      const salida = elegir(DIRECCIONES);
      const rotacion = random(-5, 5);

      band.style.setProperty('--band-rot', `${rotacion.toFixed(2)}deg`);

      aplicarDireccionEntrada(band, entrada);
      aplicarDireccionSalida(band, salida);

      const figurasLayer = document.createElement('div');
      figurasLayer.className = 'em-feedback-figuras-layer';
      figurasLayer.setAttribute('aria-hidden', 'true');

      const copy = document.createElement('div');
      copy.className = 'em-feedback-copy';

      const breath = document.createElement('div');
      breath.className = 'em-feedback-breath-wrap';

      const title = document.createElement('div');
      title.className = 'em-feedback-title';
      title.textContent = estado.title;

      const subtitle = document.createElement('div');
      subtitle.className = 'em-feedback-subtitle';
      subtitle.textContent = options && options.subtitle ? options.subtitle : elegir(estado.subtitles);

      breath.appendChild(title);
      breath.appendChild(subtitle);
      copy.appendChild(breath);

      band.appendChild(figurasLayer);
      band.appendChild(copy);

      crearFiguras(figurasLayer);

      return band;
    }

    async function play(options) {
      const root = resolveRoot(options && options.root);

      if (!root) return;

      clearTimers();

      const layer = ensureLayer(root);

      if (!layer) return;

      clearLayer(layer);

      const band = createBand(options || {});

      layer.appendChild(band);
      band.classList.remove('is-entering', 'is-exiting');

      void band.offsetWidth;

      band.classList.add('is-entering');

      await sleep(ENTER_MS + HOLD_MS);

      band.classList.remove('is-entering');
      band.classList.add('is-exiting');

      await sleep(EXIT_MS);

      band.remove();
    }
  function stop(options) {
      clearTimers();

      const root = resolveRoot(options && options.root);

      if (!root) return;

      const layer = ensureLayer(root);

      if (layer) {
        clearLayer(layer);
      }
    }

    window.EncisoFeedbackBand = {
      play,
      stop
    };
  })();

  function removeQuizGlobalFeedback() {
    try { window.EncisoFeedbackBand?.stop?.(); } catch (_) {}
    if (window.__encisomathQuizFeedbackShowTimer) {
      window.clearTimeout(window.__encisomathQuizFeedbackShowTimer);
      window.__encisomathQuizFeedbackShowTimer = null;
    }
    if (window.__encisomathQuizFeedbackTimer) {
      window.clearTimeout(window.__encisomathQuizFeedbackTimer);
      window.__encisomathQuizFeedbackTimer = null;
    }
    document.querySelectorAll('[data-quiz-global-feedback], .enciso-quiz-feedback-overlay-v102').forEach((node) => node.remove());
    document.querySelectorAll('.quiz-stage.quiz-feedback-visible').forEach((stage) => stage.classList.remove('quiz-feedback-visible'));
  }
  function ensureQuizGlobalFeedbackStyles() {
    // v0.24.106: the feedback overlay uses inline styles and Web Animations.
    // The active feedback band is rendered by EncisoFeedbackBand.
  }
  function quizFeedbackParts(correct, neutralText = '', question = null) {
    if (neutralText === QUIZ_TIMEOUT_FEEDBACK_TEXT) {
      return { kind: 'timeout', emoji: '', title: 'Tiempo!', phrase: '' };
    }
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
  function applyInlineFeedbackBandStyles(band, kind = 'neutral') {
    if (!band) return;
    const safe = getQuizFeedbackTune();
    const isCorrect = kind === 'correct';
    const isWrong = kind === 'wrong';
    const isTimeout = kind === 'timeout';
    const solid = isTimeout ? '#ffffff' : isCorrect ? '#58cc02' : isWrong ? '#e21b3c' : '#1368ce';
    const glow = isTimeout ? 'rgba(255,255,255,.28)' : isCorrect ? 'rgba(88,204,2,.24)' : isWrong ? 'rgba(226,27,60,.24)' : 'rgba(19,104,206,.20)';
    const line = isTimeout ? 'rgba(0,0,0,.12)' : isCorrect ? 'rgba(214,255,201,.34)' : isWrong ? 'rgba(255,216,224,.32)' : 'rgba(219,234,254,.30)';
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
      isTimeout ? 'border:1px solid rgba(0,0,0,.10)' : 'border:1px solid rgba(255,255,255,.12)',
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
      `background:${solid}`,
      isTimeout ? 'color:#000' : 'color:#fff',
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
        'position:absolute', 'inset:-20%', 'display:block', 'z-index:0', 'pointer-events:none', 'opacity:.66',
        `background-image:linear-gradient(90deg, ${line} 1px, transparent 1px), linear-gradient(0deg, ${line} 1px, transparent 1px)`,
        'background-size:42px 42px, 42px 42px',
        'transform:translate3d(0,0,0)',
        'backface-visibility:hidden',
        'will-change:transform',
        'mix-blend-mode:normal'
      ].join(';') + ';';
      try { mesh.getAnimations?.().forEach((anim) => anim.cancel()); } catch (_) {}
    }
    const titlePreset = quizPresetParts(safe.titlePreset || QUIZ_FEEDBACK_TUNE_DEFAULTS.titlePreset);
    const textPreset = quizPresetParts(safe.textPreset || QUIZ_FEEDBACK_TUNE_DEFAULTS.textPreset);
    const title = band.querySelector('.enciso-quiz-feedback-title-v102');
    if (title) title.style.cssText = [
      'grid-area:title', 'display:block', 'position:relative', 'z-index:1', isTimeout ? 'color:#000' : 'color:#fff',
      `font-size:${Math.max(18, Math.min(54, Number(safe.titleSize) || QUIZ_FEEDBACK_TUNE_DEFAULTS.titleSize))}px`,
      'line-height:1', `font-weight:${titlePreset.weight}`, `font-style:${titlePreset.style}`, 'margin:0', 'white-space:nowrap', 'overflow:hidden', 'text-overflow:ellipsis', 'width:100%', 'max-width:100%', 'text-align:center',
      isTimeout ? 'text-shadow:none' : 'text-shadow:0 2px 16px rgba(0,0,0,.32)', 'letter-spacing:-.03em',
      `transform:translate3d(0, ${Number(safe.titleY) || 0}px, 0)`, 'transform-origin:center center'
    ].join(';') + ';';
    const phrase = band.querySelector('.enciso-quiz-feedback-phrase-v102');
    if (phrase) phrase.style.cssText = [
      'grid-area:phrase', 'display:block', 'position:relative', 'z-index:1', isTimeout ? 'color:rgba(0,0,0,.82)' : 'color:rgba(255,255,255,.94)',
      `font-size:${Math.max(11, Math.min(30, Number(safe.textSize) || QUIZ_FEEDBACK_TUNE_DEFAULTS.textSize))}px`,
      'line-height:1.1', `font-weight:${textPreset.weight}`, `font-style:${textPreset.style}`, 'margin:0', 'width:100%', 'max-width:100%', 'white-space:nowrap', 'overflow:hidden', 'text-overflow:ellipsis', 'text-align:center', 'text-shadow:0 2px 14px rgba(0,0,0,.26)',
      `transform:translate3d(0, ${Number(safe.textY) || 0}px, 0)`, 'transform-origin:center center'
    ].join(';') + ';';
  }
  function feedbackStateFromKind(kind = 'neutral') {
    if (kind === 'correct') return 'correcto';
    if (kind === 'wrong') return 'incorrecto';
    if (kind === 'timeout') return 'tiempo';
    return 'enviado';
  }
  function showQuizFeedbackBand(stage, correct, question = null, neutralText = '') {
    removeQuizGlobalFeedback();
    ensureQuizGlobalFeedbackStyles();
    const parts = quizFeedbackParts(correct, neutralText, question);
    const overlay = document.createElement('div');
    overlay.className = 'enciso-quiz-feedback-overlay-v102 quiz-feedback-stage em-feedback-host';
    overlay.dataset.quizGlobalFeedback = 'true';
    overlay.setAttribute('aria-live', 'assertive');
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'width:100vw', 'height:100dvh', 'z-index:2147482500', 'pointer-events:none', 'display:block', 'overflow:visible', 'background:transparent', 'contain:none', 'isolation:isolate', "font-family:'Montserrat',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
    ].join(';') + ';';
    document.body.appendChild(overlay);
    document.documentElement.dataset.encisoLastFeedback = String(Date.now());
    window.__encisomathLastFeedbackV102 = (window.__encisomathLastFeedbackV102 || 0) + 1;
    try {
      window.EncisoFeedbackBand?.play?.({
        root: overlay,
        state: feedbackStateFromKind(parts.kind)
      });
    } catch (_) {}
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
    const safeExtra = { ...(extra || {}) };
    if (Object.prototype.hasOwnProperty.call(safeExtra, 'correct') && typeof safeExtra.correct !== 'boolean') {
      safeExtra.correctAnswer = safeExtra.correct;
      delete safeExtra.correct;
    }
    const timing = safeExtra.timing || getQuizAnswerTimingSnapshot();
    safeExtra.timing = timing;
    safeExtra.timeScoreMode = normalizeQuizTimeScoringMode(safeExtra.timeScoreMode || safeExtra.timeScoringMode || getQuizTimeScoringMode());
    let score = calculateQuizAnswerScore(question, correct, safeExtra, index, getActiveQuiz());
    if (correct !== true) {
      score = zeroQuizAnswerScore({ ...safeExtra, index, correct }, getActiveQuiz());
    }
    const answerRecord = {
      index,
      questionId: question?.id || `q${index + 1}`,
      type: question?.type || 'unknown',
      ...safeExtra,
      score,
      points: score,
      correct
    };
    session.answers = session.answers.filter((answer) => Number(answer.index) !== index);
    session.answers.push(answerRecord);
    return answerRecord;
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
    const answerTiming = markQuizCountdownResponded();
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
    recordQuizAnswer(question, null, { text: value, timing: answerTiming });
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
    const selectedMode = document.querySelector('[data-quiz-time-scoring-mode]')?.value || getQuizTimeScoringMode();
    saveQuizTimeScoringMode(selectedMode);
    const session = getQuizSession();
    session.timeScoringMode = normalizeQuizTimeScoringMode(selectedMode);
    closeModal(false);
    preloadQuizSounds();
    clearQuizTimers();
    state.quizFullscreenActive = true;
    state.quizSecurityGraceUntil = Date.now() + 2400;
    lockQuizHistory();
    showQuizItemTransition(0, { fromIntro: true });
    requestQuizFullscreenMode();
  }
  function showQuizResultsFromConfirm() {
    const quiz = getActiveQuiz();
    if (!quiz) return;
    const selectedMode = document.querySelector('[data-quiz-time-scoring-mode]')?.value || getQuizTimeScoringMode();
    saveQuizTimeScoringMode(selectedMode);
    const session = getQuizSession();
    session.timeScoringMode = normalizeQuizTimeScoringMode(selectedMode);
    session.phase = 'results';
    session.locked = false;
    session.feedback = null;
    session.transitionFromIntro = false;
    session.manualResultPoints = null;
    closeModal(false);
    stopQuizQuestionMusic(false);
    removeQuizGlobalFeedback();
    clearQuizTimers();
    state.quizFullscreenActive = false;
    unlockQuizHistory();
    renderQuizFullscreen(quiz);
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
    const transitionWithIntro = phase === 'transition' && Boolean(session.transitionFromIntro) && (Number(state.quizQuestionIndex) || 0) === 0;
    layer.className = `quiz-fullscreen-layer quiz-phase-${phase}${phase === 'transition' ? `${transitionWithIntro ? ' quiz-transition-with-intro' : ''}` : ''}${phase === 'question' ? ' quiz-item-motion-ready' : ''}`;
    let content = '';
    if (phase === 'confirm') content = quizStartGateHTML(quiz);
    else if (phase === 'intro') content = quizIntroSplashHTML(quiz);
    else if (phase === 'transition') content = quizItemTransitionHTML(state.quizQuestionIndex + 1, questions.length, quiz, transitionWithIntro);
    else if (phase === 'results') content = quizResultsHTML(quiz);
    else content = quizPlayerHTML(quiz, { fullscreen: true });
    const showTop = phase === 'question';
    const currentQuestion = questions[Math.max(0, Math.min(state.quizQuestionIndex, questions.length - 1))] || null;
    const currentSeconds = getQuizQuestionTimeLimit(currentQuestion, quiz);

    layer.innerHTML = `
      <div class="quiz-fullscreen-bg" aria-hidden="true"></div>
      ${phase !== 'confirm' && phase !== 'intro' ? quizSecurityWatermarkHTML() : ''}
      ${showTop ? `<div class="quiz-fullscreen-top quiz-fullscreen-top-countdown em-quiz-hero-live ${phase === 'results' ? 'quiz-top-results' : ''}">
        <div class="em-quiz-hero-shapes-layer" aria-hidden="true"></div>
        <div class="quiz-fullscreen-hero-copy">
          <strong>${escapeHTML(quiz.title || 'Quiz')}</strong>
          <small>${phase === 'results' ? 'Quiz finalizado' : (QUIZ_SECURITY_ENABLED ? 'Modo quiz · sin salida hasta finalizar' : 'Modo prueba · protección desactivada')}</small>
        </div>
        <div class="quiz-countdown-slot">${quizCountdownHTML(currentSeconds)}</div>
      </div>` : ''}
      <div class="quiz-fullscreen-content ${phase === 'transition' ? 'quiz-fullscreen-transition-content' : ''}">
        ${content}
      </div>
    `;
    bindQuizPlayerEvents();
    if (phase === 'question') {
      try { window.EncisoQuizHeroLive?.init?.(layer.querySelector('.quiz-fullscreen-top-countdown')); } catch (_) {}
      window.requestAnimationFrame(() => {
        playQuizItemEnterMotion(layer);
        startQuizQuestionMusic(getCurrentQuizQuestion());
        startQuizCountdownForCurrentQuestion(layer, quiz);
      });
    } else if (phase === 'transition') {
      const transitionRoot = layer.querySelector('.quiz-item-transition');
      let bandPromise = null;
      try {
        if (transitionWithIntro) {
          bandPromise = window.EncisoTransitionBands?.playQuizIntroThenItem?.({
            root: transitionRoot,
            quizTitle: quiz.title || quiz.name || 'Quiz',
            quizSubtitle: quiz.subtitle || quiz.description || '',
            itemNumber: 1
          });
        } else {
          bandPromise = window.EncisoTransitionBands?.playItemOnly?.({
            root: transitionRoot,
            itemNumber: state.quizQuestionIndex + 1
          });
        }
      } catch (_) {}
      Promise.resolve(bandPromise).finally(() => {
        const liveLayer = document.getElementById('quizFullscreenLayer');
        if (!liveLayer || !liveLayer.classList.contains('quiz-phase-transition')) return;
        goToQuizQuestionFromTransition();
      });
      playQuizTransitionScoreCounter(layer);
    } else if (phase === 'results') {
      stopQuizQuestionMusic(true);
      try { startEncisoFinalResultsScreen(layer); } catch (_) {}
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
  function quizTimeScoringSelectorHTML() {
    const mode = getQuizTimeScoringMode();
    return `
      <label class="quiz-time-scoring-picker">
        <span>Tipo de puntos por tiempo</span>
        <select data-quiz-time-scoring-mode>
          <option value="curve" ${mode === 'curve' ? 'selected' : ''}>Curva</option>
          <option value="speed" ${mode === 'speed' ? 'selected' : ''}>Rapidez</option>
        </select>
        <small>Curva premia el punto dulce; rapidez premia responder más rápido.</small>
      </label>
    `;
  }
  function quizStartModalHTML(quiz) {
    const total = getQuizQuestionCount(quiz);
    const timed = isQuizTimed(quiz);
    const openLabel = getQuizOpenLabel(quiz);
    const closeLabel = getQuizCloseLabel(quiz);
    const attemptsLabel = getQuizAttemptDisplay(quiz);
    const quizTitle = quiz.title || quiz.name || 'Quiz';
    return `
      <section class="modal-card quiz-start-modal em-quiz-start-modal" aria-label="Inicio de quiz">
        <div class="em-quiz-start-confetti" data-em-quiz-start-confetti aria-hidden="true"></div>
        <header class="em-quiz-start-head">
          <span class="em-quiz-start-head-shape triangle a" aria-hidden="true"></span>
          <span class="em-quiz-start-head-shape x b" aria-hidden="true"></span>
          <div class="em-quiz-start-head-copy">
            <h2 class="em-quiz-start-title">¿Iniciarás este quiz?</h2>
            <p class="em-quiz-start-name">${escapeHTML(quizTitle)}</p>
          </div>
        </header>
        <section class="em-quiz-start-body">
          <section class="em-quiz-start-info-board" aria-label="Información del quiz">
            <div class="em-quiz-start-info-row two">
              <div class="em-quiz-start-info-cell">
                <span class="em-quiz-start-info-label">Abierto desde</span>
                <strong class="em-quiz-start-info-value">${escapeHTML(openLabel)}</strong>
              </div>
              <div class="em-quiz-start-info-cell">
                <span class="em-quiz-start-info-label">Abierto hasta</span>
                <strong class="em-quiz-start-info-value">${escapeHTML(closeLabel)}</strong>
              </div>
            </div>
            <div class="em-quiz-start-info-row three">
              <div class="em-quiz-start-info-cell">
                <span class="em-quiz-start-info-label">Ítems</span>
                <strong class="em-quiz-start-info-value big">${total}</strong>
              </div>
              <div class="em-quiz-start-info-cell">
                <span class="em-quiz-start-info-label">Tipo</span>
                ${timed ? `<strong class="em-quiz-start-time-pill is-timed">Cronometrado</strong>` : `<strong class="em-quiz-start-time-plain">No cronometrado</strong>`}
              </div>
              <div class="em-quiz-start-info-cell">
                <span class="em-quiz-start-info-label">Intentos</span>
                <strong class="em-quiz-start-info-value big">${escapeHTML(attemptsLabel)}</strong>
              </div>
            </div>
            ${timed ? `<div class="em-quiz-start-bonus-row">
              <div class="em-quiz-start-bonus-copy">
                <span class="em-quiz-start-bonus-label">Puntos por tiempo</span>
                <strong class="em-quiz-start-bonus-text">Premia el mejor momento de respuesta.</strong>
              </div>
              <span class="em-quiz-start-bonus-chip">Ritmo justo</span>
            </div>` : ''}
          </section>
          <div class="em-quiz-start-slider" data-em-quiz-start-slider role="slider" aria-label="Desliza para iniciar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
            <div class="em-quiz-start-slide-fill" data-em-quiz-start-fill></div>
            <span class="em-quiz-start-slide-label" data-em-quiz-start-label><span>DESLIZA PARA INICIAR</span></span>
            <span class="em-quiz-start-slide-goal">GO</span>
            <button class="em-quiz-start-slide-knob" data-em-quiz-start-knob type="button" aria-label="Desliza para iniciar">
              <span class="em-quiz-start-slide-knob-mark">›</span>
            </button>
          </div>
        </section>
      </section>
    `;
  }

  function bindQuizStartSliderEvents() {
    document.querySelectorAll('[data-em-quiz-start-slider]').forEach((slider) => {
      if (slider.dataset.emQuizStartBound === 'true') return;
      slider.dataset.emQuizStartBound = 'true';
      const modal = slider.closest('.em-quiz-start-modal');
      const knob = slider.querySelector('[data-em-quiz-start-knob]');
      const label = slider.querySelector('[data-em-quiz-start-label] span');
      const confettiLayer = modal?.querySelector('[data-em-quiz-start-confetti]');
      if (!modal || !knob || !label) return;
      let isDragging = false;
      let startClientX = 0;
      let currentX = 0;
      let maxX = 0;
      let completed = false;
      let activePointerId = null;
      let startTimer = null;
      const confettiColors = ['#1368ce', '#ff7a00', '#24b49a', '#54c600', '#EBB513', '#e21b3c'];
      const confettiShapes = ['circle', 'square', 'triangle', 'x'];
      const clampValue = (value, min, max) => Math.min(Math.max(value, min), max);
      const calculateMax = () => {
        const sliderRect = slider.getBoundingClientRect();
        const knobRect = knob.getBoundingClientRect();
        maxX = Math.max(0, sliderRect.width - knobRect.width - 14);
      };
      const getProgress = () => maxX > 0 ? currentX / maxX : 0;
      const setSlideText = (progress) => {
        if (completed) {
          label.textContent = '¡VAMOS!';
          return;
        }
        if (progress >= 0.82) {
          label.textContent = 'SUELTA EN GO';
          return;
        }
        if (progress >= 0.48) {
          label.textContent = 'SIGUE DESLIZANDO';
          return;
        }
        label.textContent = 'DESLIZA PARA INICIAR';
      };
      const setSlidePosition = (x) => {
        currentX = clampValue(x, 0, maxX);
        const progress = getProgress();
        slider.style.setProperty('--em-slide-x', `${currentX}px`);
        slider.style.setProperty('--em-slide-progress', progress.toFixed(3));
        slider.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
        const labelShell = slider.querySelector('[data-em-quiz-start-label]');
        if (labelShell) labelShell.style.opacity = String(1 - progress * 0.18);
        setSlideText(progress);
      };
      const resetSlide = () => {
        if (completed) return;
        isDragging = false;
        activePointerId = null;
        slider.classList.remove('is-complete', 'is-dragging');
        modal.classList.remove('is-starting');
        setSlidePosition(0);
      };
      const createConfettiWave = (amount, extraHeight, power) => {
        if (!confettiLayer) return;
        for (let index = 0; index < amount; index += 1) {
          const piece = document.createElement('span');
          const color = confettiColors[Math.floor(Math.random() * confettiColors.length)];
          const shape = confettiShapes[Math.floor(Math.random() * confettiShapes.length)];
          const dx = (Math.random() * 360 - 180) * power;
          const dy = (Math.random() * -270 - 95 - extraHeight) * power;
          const hopX = dx * 0.22;
          const hopY = dy * 0.18;
          const rot = Math.random() * 760 - 380;
          piece.className = `em-quiz-start-confetti-piece ${shape}`;
          piece.style.setProperty('--piece-color', color);
          piece.style.setProperty('--dx', `${dx.toFixed(0)}px`);
          piece.style.setProperty('--dy', `${dy.toFixed(0)}px`);
          piece.style.setProperty('--hop-x', `${hopX.toFixed(0)}px`);
          piece.style.setProperty('--hop-y', `${hopY.toFixed(0)}px`);
          piece.style.setProperty('--rot', `${rot.toFixed(0)}deg`);
          piece.style.animationDelay = `${(Math.random() * 0.12).toFixed(2)}s`;
          piece.style.animationDuration = `${(0.82 + Math.random() * 0.36).toFixed(2)}s`;
          if (shape !== 'triangle' && shape !== 'x') {
            const size = 7 + Math.random() * 8;
            piece.style.width = `${size.toFixed(0)}px`;
            piece.style.height = `${size.toFixed(0)}px`;
          }
          confettiLayer.appendChild(piece);
        }
      };
      const createGeometricConfetti = () => {
        if (!confettiLayer) return;
        confettiLayer.innerHTML = '';
        createConfettiWave(54, 0, 1);
        window.setTimeout(() => createConfettiWave(38, 70, 0.86), 120);
        window.setTimeout(() => { if (confettiLayer) confettiLayer.innerHTML = ''; }, 1650);
      };
      const completeSlide = () => {
        if (completed) return;
        completed = true;
        isDragging = false;
        activePointerId = null;
        clearTimeout(startTimer);
        calculateMax();
        setSlidePosition(maxX);
        setSlideText(1);
        slider.classList.remove('is-dragging', 'is-complete');
        modal.classList.remove('is-starting');
        void slider.offsetWidth;
        slider.classList.add('is-complete');
        modal.classList.add('is-starting');
        createGeometricConfetti();
        startTimer = window.setTimeout(() => {
          modal.classList.remove('is-starting');
          beginQuizFromConfirm();
        }, 920);
      };
      const startDrag = (clientX, pointerId) => {
        if (completed) return;
        calculateMax();
        activePointerId = pointerId;
        isDragging = true;
        startClientX = clientX - currentX;
        slider.classList.add('is-dragging');
      };
      const moveDrag = (clientX) => {
        if (!isDragging || completed) return;
        setSlidePosition(clientX - startClientX);
      };
      const endDrag = () => {
        if (!isDragging || completed) return;
        isDragging = false;
        if (getProgress() >= 0.9) {
          completeSlide();
          return;
        }
        resetSlide();
      };
      knob.addEventListener('pointerdown', (event) => {
        if (completed) return;
        event.preventDefault();
        try { knob.setPointerCapture(event.pointerId); } catch (_) {}
        startDrag(event.clientX, event.pointerId);
      });
      knob.addEventListener('pointermove', (event) => {
        if (activePointerId !== event.pointerId) return;
        moveDrag(event.clientX);
      });
      knob.addEventListener('pointerup', (event) => {
        if (activePointerId !== event.pointerId) return;
        activePointerId = null;
        endDrag();
      });
      knob.addEventListener('pointercancel', (event) => {
        if (activePointerId !== event.pointerId) return;
        resetSlide();
      });
      slider.addEventListener('pointermove', (event) => moveDrag(event.clientX));
      slider.addEventListener('pointerup', () => {
        activePointerId = null;
        endDrag();
      });
      window.addEventListener('resize', () => {
        if (completed || !slider.isConnected) return;
        calculateMax();
        resetSlide();
      }, { passive: true });
      calculateMax();
      setSlidePosition(0);
    });
  }

  function quizStartGateHTML(quiz) {
    const total = Array.isArray(quiz.questions) ? quiz.questions.length : 0;
    return `
      <section class="quiz-start-gate">
        <div class="quiz-kahoot-mark" aria-hidden="true"><span>▲</span><span>◆</span><span>●</span><span>■</span></div>
        <h2>${escapeHTML(quiz.title || 'Quiz')}</h2>
        <p>${escapeHTML(quiz.description || quiz.mode || 'Quiz interactivo de práctica.')}</p>
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
        <p class="section-kicker">Preparando quiz</p>
        <h2>${escapeHTML(quiz.title || 'Quiz')}</h2>
        <p>${escapeHTML(quiz.description || quiz.mode || 'Lee con calma, responde rápido y aprende jugando.')}</p>
      </section>
    `;
  }
  function quizItemTransitionHTML(item, total, quiz = getActiveQuiz(), withIntroInfo = false) {
    const current = Math.max(1, Number(item) || 1);
    const count = Math.max(1, Number(total) || 1);
    return `
      <section class="quiz-item-transition quiz-transition-minimal em-transition-host" aria-live="polite">
        ${quizTransitionScoreHTML(current, quiz)}

      </section>
    `;
  }const ENCISO_RESULT_STATES = {
    red: {
      color: '#e21b3c',
      glow: 'rgba(226,27,60,.55)',
      bandBg: '#e21b3c',
      textColor: '#ffffff',
      noteColor: '#ffffff',
      fakeNoteColor: '#ffffff',
      polygonFill: '#e21b3c',
      titlePool: ['Uy quieto', 'Casi casi', 'Toca remontada', 'Modo recuperación'],
      phrasePool: [
        'El quiz dijo: hoy no, mi ciela.',
        'Toca activar el modo Rocky Balboa.',
        'Eso no fue caída, fue aprendizaje con efectos especiales.',
        'Respira, que hasta los cracks tienen episodio de relleno.',
        'Hoy el algoritmo eligió violencia.'
      ]
    },
    orange: {
      color: '#ff7a00',
      glow: 'rgba(255,122,0,.55)',
      bandBg: '#ff7a00',
      textColor: '#ffffff',
      noteColor: '#ffffff',
      fakeNoteColor: '#ffffff',
      polygonFill: '#ff7a00',
      titlePool: ['Bien ahí', 'Se salvó', 'Aprobado vibes', 'Pasó raspando'],
      phrasePool: [
        'Sobreviviste, que también es talento.',
        'No fue paliza, fue estrategia de suspenso.',
        'El semestre respiró por 2 segundos.',
        'Se ganó, pero el profe sudó contigo.',
        'Modo: no sé cómo, pero salió.'
      ]
    },
    yellow: {
      color: '#EBB513',
      glow: 'rgba(235,181,19,.55)',
      bandBg: '#EBB513',
      textColor: '#ffffff',
      noteColor: '#ffffff',
      fakeNoteColor: '#ffffff',
      polygonFill: '#EBB513',
      titlePool: ['¡Muy bien!', '¡Excelente!', 'Nivel pro', 'Tremendo'],
      phrasePool: [
        'El conocimiento entró con flow.',
        'Eso estuvo más limpio que tablero nuevo.',
        'Hoy sí desayunaste concentración.',
        'La calculadora pidió autógrafo.',
        'Buenardo, como dicen los académicos.'
      ]
    },
    lime: {
      color: '#24b49a',
      glow: 'rgba(36,180,154,.55)',
      bandBg: '#24b49a',
      textColor: '#ffffff',
      noteColor: '#ffffff',
      fakeNoteColor: '#ffffff',
      polygonFill: '#24b49a',
      titlePool: ['¡Muy bien!', '¡Excelente!', 'Nivel pro', 'Tremendo'],
      phrasePool: [
        'El conocimiento entró con flow.',
        'Eso estuvo más limpio que tablero nuevo.',
        'Hoy sí desayunaste concentración.',
        'La calculadora pidió autógrafo.',
        'Buenardo, como dicen los académicos.'
      ]
    },
    green: {
      color: '#54c600',
      glow: 'rgba(84,198,0,.55)',
      bandBg: '#54c600',
      textColor: '#ffffff',
      noteColor: '#ffffff',
      fakeNoteColor: '#ffffff',
      polygonFill: '#54c600',
      titlePool: ['¡Muy bien!', '¡Excelente!', 'Nivel pro', 'Tremendo'],
      phrasePool: [
        'El conocimiento entró con flow.',
        'Eso estuvo más limpio que tablero nuevo.',
        'Hoy sí desayunaste concentración.',
        'La calculadora pidió autógrafo.',
        'Buenardo, como dicen los académicos.'
      ]
    }
  };

  function encisoClamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }
  function encisoRand(min, max) {
    return Math.random() * (max - min) + min;
  }
  function encisoPickRandom(list) {
    const safeList = Array.isArray(list) && list.length ? list : ['Resultado listo'];
    return safeList[Math.floor(Math.random() * safeList.length)];
  }
  function encisoFormatNumber(value) {
    return Math.round(Number(value) || 0).toLocaleString('es-CO');
  }
  function encisoFormatGrade(value) {
    return Number(value || 0).toFixed(1);
  }
  function encisoFloorOneDecimal(value) {
    return Math.floor((Number(value) || 0) * 10) / 10;
  }
  function encisoEaseOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }
  function encisoCalculateFinalScore(correctRaw, timeRaw) {
    const correctPoints = encisoClamp(Number(correctRaw) || 0, 0, 10000);
    const timePoints = Math.max(Number(timeRaw) || 0, 0);
    const globalScore = correctPoints + timePoints;
    const baseGrade = encisoFloorOneDecimal(correctPoints / 1000);
    const timeUnits = Math.floor(timePoints / 2000);
    let finalGrade = baseGrade;
    let bonusGrade = 0;
    let extraPoints = 0;

    if (correctPoints >= 10000) {
      finalGrade = 10.0;
      extraPoints = timeUnits;
    } else {
      const tenthsNeeded = Math.max(0, Math.round((10 - baseGrade) * 10));
      const tenthsUsed = Math.min(timeUnits, tenthsNeeded);
      bonusGrade = tenthsUsed / 10;
      finalGrade = encisoClamp(baseGrade + bonusGrade, 0, 10);
      extraPoints = Math.max(0, timeUnits - tenthsUsed);
    }

    return { correctPoints, timePoints, globalScore, baseGrade, finalGrade, bonusGrade, extraPoints };
  }
  function encisoGetResultStateKeyByGrade(grade) {
    if (grade >= 9) return 'green';
    if (grade >= 8) return 'lime';
    if (grade >= 7) return 'yellow';
    if (grade >= 6) return 'orange';
    return 'red';
  }
  function encisoMakeFakeGrade(realGrade) {
    let fake;
    if (realGrade >= 7) fake = encisoRand(4.8, 6.4);
    else fake = realGrade + encisoRand(.6, 1.3);
    fake = encisoClamp(fake, 1, 9.8);
    if (Math.abs(fake - realGrade) < .4) fake = realGrade >= 7 ? realGrade - 1.1 : realGrade + 1.1;
    return encisoFloorOneDecimal(fake);
  }
  function encisoAnimateValue({ from, to, duration, update, complete }) {
    const start = performance.now();
    function frame(now) {
      const progress = encisoClamp((now - start) / duration, 0, 1);
      const eased = encisoEaseOutCubic(progress);
      const current = from + (to - from) * eased;
      update(current);
      if (progress < 1) requestAnimationFrame(frame);
      else {
        update(to);
        if (complete) complete();
      }
    }
    requestAnimationFrame(frame);
  }
  function encisoGradeRemoveClasses(el, classes) {
    if (!el) return;
    classes.forEach((className) => el.classList.remove(className));
  }
  function encisoGradeRestartClass(el, className) {
    if (!el) return;
    el.classList.remove(className);
    void el.offsetWidth;
    el.classList.add(className);
  }
  function encisoGradeFormat(value, decimals = 1, decimalSeparator = '.') {
    return Number(value || 0).toFixed(decimals).replace('.', decimalSeparator);
  }
  function encisoGradeColorByGrade(value) {
    const n = Number(value) || 0;
    const stateKey = encisoGetResultStateKeyByGrade(n);
    const stateInfo = ENCISO_RESULT_STATES[stateKey] || ENCISO_RESULT_STATES.red;
    return stateInfo.polygonFill || stateInfo.color || '#e21b3c';
  }
  function encisoParseGradePolygonPoints(polygonEl) {
    const raw = polygonEl?.getAttribute?.('points') || '';
    const points = raw.trim().split(/\s+/)
      .map((pair) => pair.split(',').map(Number))
      .filter((pair) => pair.length === 2 && pair.every(Number.isFinite));
    if (points.length >= 4) return points.slice(0, 4);
    return [
      [21, 29],
      [128, 26],
      [124, 101],
      [23, 104]
    ];
  }
  function encisoGradePointsAreCollapsed(points) {
    if (!Array.isArray(points) || points.length < 4) return true;
    const [x0, y0] = points[0];
    return points.every(([x, y]) => Math.abs(x - x0) < .01 && Math.abs(y - y0) < .01);
  }
  function encisoGetCenterFromGradePoints(points) {
    const sum = points.reduce((acc, point) => {
      acc[0] += point[0];
      acc[1] += point[1];
      return acc;
    }, [0, 0]);
    return [sum[0] / points.length, sum[1] / points.length];
  }
  function encisoSetGradePolygonPoints(polygonEl, points) {
    if (!polygonEl) return;
    polygonEl.setAttribute('points', points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '));
  }
  function encisoGradeEaseOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }
  function encisoGradeEaseInOutCubic(t) {
    return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  function encisoGradeEaseOutElastic(t) {
    const c4 = (2 * Math.PI) / 3;
    if (t === 0) return 0;
    if (t === 1) return 1;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * c4) + 1;
  }
  function encisoGradeBounceCartoon(t) {
    if (t < .45) {
      const p = t / .45;
      return 1.28 * encisoGradeEaseOutCubic(p);
    }
    if (t < .68) {
      const p = (t - .45) / .23;
      return 1.28 + (.84 - 1.28) * encisoGradeEaseOutCubic(p);
    }
    if (t < .84) {
      const p = (t - .68) / .16;
      return .84 + (1.08 - .84) * encisoGradeEaseOutCubic(p);
    }
    const p = (t - .84) / .16;
    return 1.08 + (1 - 1.08) * encisoGradeEaseOutCubic(p);
  }
  function encisoGradePointOnBounce(center, target, progress) {
    const scale = encisoGradeBounceCartoon(progress);
    return [
      center[0] + (target[0] - center[0]) * scale,
      center[1] + (target[1] - center[1]) * scale
    ];
  }
  function encisoPickExactFakeGrade(real, fallbackFake) {
    const safeFallback = Number(fallbackFake);
    if (Number.isFinite(safeFallback) && Math.abs(safeFallback - real) >= .2) {
      return encisoClamp(safeFallback, 0, 10);
    }
    const direction = Math.random() > .5 ? 1 : -1;
    let fake = real + direction * encisoRand(1.2, 2.7);
    fake = encisoClamp(fake, 0, 10);
    if (Math.abs(fake - real) < .8) fake = encisoClamp(real + direction * 1.5, 0, 10);
    return fake;
  }
  function playFinalGradeAnimationExact({ grade, fakeGrade, polygonEl, numberEl, decimals = 1, decimalSeparator = '.', maxGrade = 10 }) {
    if (!polygonEl || !numberEl) return null;

    const ownedNumberClasses = [
      'em-grade-number-base',
      'em-grade-number-visible',
      'em-grade-number-show',
      'em-grade-number-counting',
      'em-grade-number-fake-hit',
      'em-grade-number-real-lock'
    ];
    const ownedPolygonClasses = [
      'em-grade-polygon-base',
      'em-grade-polygon-fake-impact',
      'em-grade-polygon-real-impact'
    ];

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const real = encisoClamp(Number(grade) || 0, 0, maxGrade);
    const fake = encisoPickExactFakeGrade(real, fakeGrade);
    let originalPoints = encisoParseGradePolygonPoints(polygonEl);
    if (encisoGradePointsAreCollapsed(originalPoints)) {
      originalPoints = [
        [21, 29],
        [128, 26],
        [124, 101],
        [23, 104]
      ];
    }
    const center = encisoGetCenterFromGradePoints(originalPoints);
    let currentValue = 0;
    let floatingRAF = null;
    let active = true;

    function stopFloating() {
      if (floatingRAF) cancelAnimationFrame(floatingRAF);
      floatingRAF = null;
    }
  function setScore(value) {
      currentValue = value;
      numberEl.textContent = encisoGradeFormat(value, decimals, decimalSeparator);
    }
  function applyFlatGradeColor(value) {
      const fill = encisoGradeColorByGrade(value);
      numberEl.style.color = '#ffffff';
      polygonEl.style.fill = fill;
      polygonEl.setAttribute('fill', fill);
      polygonEl.style.stroke = 'none';
      polygonEl.setAttribute('stroke', 'none');
      polygonEl.style.filter = 'none';
    }
  function countTo(target, duration = 900, elastic = false) {
      const from = currentValue;
      return new Promise((resolve) => {
        const start = performance.now();
        function frame(now) {
          if (!active) return resolve();
          const raw = encisoClamp((now - start) / duration, 0, 1);
          const eased = elastic ? encisoGradeEaseOutElastic(raw) : encisoGradeEaseInOutCubic(raw);
          const value = from + (target - from) * eased;
          setScore(encisoClamp(value, 0, maxGrade));
          if (raw < 1) requestAnimationFrame(frame);
          else {
            setScore(target);
            resolve();
          }
        }
        requestAnimationFrame(frame);
      });
    }
  function animatePolygonCascade(targets, onThirdVertexStart) {
      return new Promise((resolve) => {
        const durationPerVertex = 760;
        const delayPerVertex = 210;
        const totalDuration = durationPerVertex + delayPerVertex * 3;
        const start = performance.now();
        let thirdTriggered = false;
        function frame(now) {
          if (!active) return resolve();
          const elapsed = now - start;
          if (!thirdTriggered && elapsed >= delayPerVertex * 2) {
            thirdTriggered = true;
            if (onThirdVertexStart) onThirdVertexStart();
          }
          const points = targets.map((target, index) => {
            const raw = encisoClamp((elapsed - delayPerVertex * index) / durationPerVertex, 0, 1);
            if (raw <= 0) return center;
            if (raw >= 1) return target;
            return encisoGradePointOnBounce(center, target, raw);
          });
          encisoSetGradePolygonPoints(polygonEl, points);
          if (elapsed < totalDuration) requestAnimationFrame(frame);
          else {
            encisoSetGradePolygonPoints(polygonEl, targets);
            resolve();
          }
        }
        requestAnimationFrame(frame);
      });
    }
  function startFloating(points) {
      stopFloating();
      const floatingBase = points.map((point) => [...point]);
      const floatStartTime = performance.now();
      const phases = [0, .8, 1.6, 2.4];
      const ampX = [5, 6, 5, 6];
      const ampY = [6, 5, 7, 5];
      const speedX = [1.05, 1.18, 1.12, 1.22];
      const speedY = [1, 1.14, 1.2, 1.08];
      function frame(now) {
        if (!active || !polygonEl.isConnected) return;
        const t = (now - floatStartTime) / 1000;
        const ramp = Math.min(1, t / .75);
        const floatingPoints = floatingBase.map(([x, y], index) => {
          const offsetX = ramp * ampX[index] * (Math.sin(t * speedX[index] * 2 + phases[index]) - Math.sin(phases[index]));
          const offsetY = ramp * ampY[index] * (Math.cos(t * speedY[index] * 2 + phases[index]) - Math.cos(phases[index]));
          return [x + offsetX, y + offsetY];
        });
        encisoSetGradePolygonPoints(polygonEl, floatingPoints);
        floatingRAF = requestAnimationFrame(frame);
      }
      floatingRAF = requestAnimationFrame(frame);
    }

    async function run() {
      stopFloating();
      encisoGradeRemoveClasses(numberEl, ownedNumberClasses);
      encisoGradeRemoveClasses(polygonEl, ownedPolygonClasses);
      polygonEl.classList.add('em-grade-polygon-base');
      numberEl.classList.add('em-grade-number-base');
      applyFlatGradeColor(real);
      setScore(0);
      encisoSetGradePolygonPoints(polygonEl, [center, center, center, center]);

      let fakeSequenceStarted = false;
      let fakeSequenceResolve;
      const fakeSequenceDone = new Promise((resolve) => { fakeSequenceResolve = resolve; });

      const startNumberAtThirdVertex = async () => {
        if (fakeSequenceStarted || !active) return;
        fakeSequenceStarted = true;
        numberEl.classList.add('em-grade-number-visible');
        encisoGradeRestartClass(numberEl, 'em-grade-number-show');
        await sleep(210);
        if (!active) return;
        numberEl.classList.remove('em-grade-number-show');
        numberEl.classList.add('em-grade-number-counting');
        await countTo(fake, 820, false);
        if (!active) return;
        numberEl.classList.remove('em-grade-number-counting');
        encisoGradeRestartClass(numberEl, 'em-grade-number-fake-hit');
        encisoGradeRestartClass(polygonEl, 'em-grade-polygon-fake-impact');
        await sleep(740);
        if (!active) return;
        numberEl.classList.remove('em-grade-number-fake-hit');
        polygonEl.classList.remove('em-grade-polygon-fake-impact');
        numberEl.classList.add('em-grade-number-visible');
        fakeSequenceResolve();
      };

      await sleep(120);
      if (!active) return;
      await animatePolygonCascade(originalPoints, startNumberAtThirdVertex);
      if (!active) return;
      startFloating(originalPoints);
      await fakeSequenceDone;
      if (!active) return;
      numberEl.classList.add('em-grade-number-counting');
      await countTo(real, 980, true);
      if (!active) return;
      numberEl.classList.remove('em-grade-number-counting');
      numberEl.classList.remove('em-grade-number-visible');
      encisoGradeRestartClass(numberEl, 'em-grade-number-real-lock');
      encisoGradeRestartClass(polygonEl, 'em-grade-polygon-real-impact');
    }

    run();
    return {
      stop() {
        active = false;
        stopFloating();
      }
    };
  }
  function encisoStartFinalPolygon(root, payload) {
    const stage = root.querySelector('[data-grade-stage]');
    const polygon = root.querySelector('[data-grade-polygon]');
    const note = root.querySelector('[data-grade-note]');
    const caption = root.querySelector('[data-grade-caption]');
    if (!stage || !polygon || !note) return;

    if (root.__encisoFinalGradeAnimation?.stop) root.__encisoFinalGradeAnimation.stop();

    stage.classList.add('active');
    if (caption) caption.textContent = '';

    root.__encisoFinalGradeAnimation = playFinalGradeAnimationExact({
      grade: payload.finalGrade,
      fakeGrade: payload.fakeGrade,
      polygonEl: polygon,
      numberEl: note,
      decimals: 1,
      decimalSeparator: '.',
      maxGrade: 10
    });
  }
  function encisoFinalFlowItems(root) {
    if (!root) return [];
    return [
      root.querySelector('.enciso-result-band'),
      root.querySelector('[data-score-card]'),
      root.querySelector('[data-podium-section]'),
      root.querySelector('[data-review-section]'),
      root.querySelector('[data-actions-section]')
    ].filter(Boolean);
  }
  function encisoResetFinalFlow(root) {
    encisoFinalFlowItems(root).forEach((el) => {
      el.classList.remove('play', 'leaving');
      if (el.matches('[data-actions-section]')) el.classList.remove('show');
      void el.offsetWidth;
    });
  }
  function encisoPlayFinalResultsFlowIn(root) {
    encisoResetFinalFlow(root);
    encisoFinalFlowItems(root).forEach((el, index) => {
      setTimeout(() => {
        if (!root.isConnected) return;
        if (el.matches('[data-actions-section]')) el.classList.add('show');
        el.classList.add('play');
      }, index * 90);
    });
  }
  function encisoPlayFinalResultsFlowOut(root, done) {
    if (!root) {
      if (typeof done === 'function') done();
      return;
    }
    if (root.dataset.encisoFinalLeaving === 'true') return;
    root.dataset.encisoFinalLeaving = 'true';
    const items = encisoFinalFlowItems(root);
    items.forEach((el, index) => {
      setTimeout(() => {
        if (!root.isConnected) return;
        el.classList.remove('play');
        if (el.matches('[data-actions-section]')) el.classList.add('show');
        el.classList.add('leaving');
      }, index * 70);
    });
    setTimeout(() => {
      if (typeof done === 'function') done();
    }, 70 * Math.max(0, items.length - 1) + 560);
  }
  function encisoPlayResultButtonJello(button) {
    if (!button) return;
    button.classList.remove('enciso-result-button-jello');
    void button.offsetWidth;
    button.classList.add('enciso-result-button-jello');
    setTimeout(() => button.classList.remove('enciso-result-button-jello'), 680);
  }
  function encisoResetRankingResultsAnimation(root = document) {
    const ranking = root?.querySelector?.('.ranking-animation-root') || document.querySelector('.ranking-animation-root');
    if (!ranking) return null;
    ranking.classList.remove('ranking-animation-play');
    ranking.classList.add('ranking-animation-ready');
    delete ranking.dataset.rankingAnimationPlayed;
    ranking.querySelectorAll('.enciso-podium-player').forEach((player) => {
      player.classList.remove('show-block', 'show-points', 'show-name', 'show-avatar', 'show-sparkles');
    });
    void ranking.offsetWidth;
    return ranking;
  }
  function encisoPlayRankingResultsAnimation(root = document) {
    const ranking = encisoResetRankingResultsAnimation(root);
    if (!ranking) return;
    ranking.dataset.rankingAnimationPlayed = 'true';
    ranking.classList.add('ranking-animation-play');
  }

  window.playRankingAnimation = encisoPlayRankingResultsAnimation;
  window.restartRankingAnimation = encisoPlayRankingResultsAnimation;

  function playSummaryQuestionEntryAnimation(trackElement) {
    if (!trackElement) return;
    const cards = trackElement.querySelectorAll('.summary-question-entry-card');
    cards.forEach((card, index) => {
      card.style.setProperty('--summary-question-entry-i', index);
    });
    trackElement.classList.remove('summary-question-entry-playing');
    void trackElement.offsetWidth;
    trackElement.classList.add('summary-question-entry-playing');
  }
  function encisoReadFinalPayloadFromRoot(root) {
    return {
      correctPoints: Number(root?.dataset.correctPoints) || 0,
      timePoints: Number(root?.dataset.timePoints) || 0,
      globalScore: Number(root?.dataset.globalScore) || 0,
      finalGrade: Number(root?.dataset.finalGrade) || 0,
      fakeGrade: Number(root?.dataset.fakeGrade) || 0,
      bonusGrade: Number(root?.dataset.bonusGrade) || 0,
      extraPoints: Number(root?.dataset.extraPoints) || 0
    };
  }
  function encisoBuildFinalPayloadFromPoints(correctPoints, timePoints) {
    const result = encisoCalculateFinalScore(Math.round(Number(correctPoints) || 0), Math.round(Number(timePoints) || 0));
    const stateKey = encisoGetResultStateKeyByGrade(result.finalGrade);
    const stateInfo = ENCISO_RESULT_STATES[stateKey] || ENCISO_RESULT_STATES.red;
    return { ...result, fakeGrade: encisoMakeFakeGrade(result.finalGrade), stateKey, stateInfo };
  }
  function encisoApplyFinalPayloadToRoot(root, payload) {
    if (!root || !payload) return;
    const stateKey = payload.stateKey || encisoGetResultStateKeyByGrade(payload.finalGrade);
    const stateInfo = payload.stateInfo || ENCISO_RESULT_STATES[stateKey] || ENCISO_RESULT_STATES.red;
    Object.keys(ENCISO_RESULT_STATES).forEach((key) => root.classList.remove(`enciso-result-state-${key}`));
    root.classList.add(`enciso-result-state-${stateKey}`);
    root.dataset.correctPoints = String(Math.round(Number(payload.correctPoints) || 0));
    root.dataset.timePoints = String(Math.round(Number(payload.timePoints) || 0));
    root.dataset.globalScore = String(Math.round(Number(payload.globalScore) || 0));
    root.dataset.finalGrade = String(Number(payload.finalGrade) || 0);
    root.dataset.fakeGrade = String(Number(payload.fakeGrade) || 0);
    root.dataset.bonusGrade = String(Number(payload.bonusGrade) || 0);
    root.dataset.extraPoints = String(Number(payload.extraPoints) || 0);
    root.style.setProperty('--enciso-state-color', stateInfo.color);
    root.style.setProperty('--enciso-state-glow', stateInfo.glow);
    root.style.setProperty('--enciso-state-band-bg', stateInfo.bandBg);
    root.style.setProperty('--enciso-state-text', stateInfo.textColor);
    root.style.setProperty('--enciso-state-note-text', stateInfo.noteColor);
    root.style.setProperty('--enciso-fake-note-color', stateInfo.fakeNoteColor);
  }
  function encisoResetFinalDynamicTexts(root) {
    if (!root) return;
    const setText = (selector, text) => {
      const el = root.querySelector(selector);
      if (el) el.textContent = text;
    };
    setText('[data-global-score]', '0');
    setText('[data-my-podium-points]', '0 pts');
    setText('[data-correct-points]', '0');
    setText('[data-time-points]', '0');
    setText('[data-bonus-grade]', '+0.0');
    setText('[data-extra-points]', '0');
    setText('[data-grade-note]', '?');
  }
  function encisoRunFinalResultsAnimations(root, payload) {
    if (!root || !payload) return;
    startQuizResultsMusic();
    if (root.__encisoFinalGradeAnimation?.stop) root.__encisoFinalGradeAnimation.stop();
    encisoApplyFinalPayloadToRoot(root, payload);
    encisoResetFinalDynamicTexts(root);
    encisoInitRetoCompletedHero(root);
    encisoPlayFinalResultsFlowIn(root);
    setTimeout(() => encisoPlayRankingResultsAnimation(root), 170);
    const summaryTrack = root.querySelector('.summary-question-entry-track');
    if (summaryTrack) setTimeout(() => playSummaryQuestionEntryAnimation(summaryTrack), 160);
    encisoAnimateValue({
      from: 0,
      to: payload.globalScore,
      duration: 1550,
      update(value) {
        const text = encisoFormatNumber(value);
        const score = root.querySelector('[data-global-score]');
        const podiumPoints = root.querySelector('[data-my-podium-points]');
        if (score) score.textContent = text;
        if (podiumPoints) podiumPoints.textContent = `${text} pts`;
      },
      complete() { encisoStartFinalPolygon(root, payload); }
    });
    encisoAnimateValue({
      from: 0,
      to: payload.correctPoints,
      duration: 1250,
      update(value) {
        const el = root.querySelector('[data-correct-points]');
        if (el) el.textContent = encisoFormatNumber(value);
      }
    });
    encisoAnimateValue({
      from: 0,
      to: payload.timePoints,
      duration: 1350,
      update(value) {
        const el = root.querySelector('[data-time-points]');
        if (el) el.textContent = encisoFormatNumber(value);
      }
    });
    encisoAnimateValue({
      from: 0,
      to: payload.bonusGrade,
      duration: 1400,
      update(value) {
        const el = root.querySelector('[data-bonus-grade]');
        if (el) el.textContent = `+${encisoFormatGrade(value)}`;
      }
    });
    encisoAnimateValue({
      from: 0,
      to: payload.extraPoints,
      duration: 1450,
      update(value) {
        const el = root.querySelector('[data-extra-points]');
        if (el) el.textContent = String(Math.round(value));
      }
    });
  }
  function startEncisoFinalResultsScreen(layer) {
    const root = layer?.querySelector?.('[data-final-results]');
    if (!root || root.dataset.encisoFinalStarted === 'true') return;
    root.dataset.encisoFinalStarted = 'true';
    applyEncisoFinalTune(root, getEncisoFinalTune());
    bindEncisoFinalTunePanel(root);
    encisoRunFinalResultsAnimations(root, encisoReadFinalPayloadFromRoot(root));
  }
  function encisoBuildFinalResultsData(quiz) {
    const session = getQuizSession();
    const answers = Array.isArray(session.answers) ? session.answers : [];
    const questions = Array.isArray(quiz?.questions) ? quiz.questions : [];
    const answerMap = new Map(answers.map((answer) => [Number(answer.index), answer]));
    const manualPoints = session.manualResultPoints && typeof session.manualResultPoints === 'object' ? session.manualResultPoints : null;
    const totals = manualPoints ? {
      correctPoints: Number(manualPoints.correctPoints) || 0,
      timePoints: Number(manualPoints.timePoints) || 0
    } : answers.reduce((acc, answer) => {
      const score = getQuizAnswerScore(answer, quiz);
      acc.correctPoints += Number(score.item) || 0;
      acc.timePoints += Number(score.time) || 0;
      return acc;
    }, { correctPoints: 0, timePoints: 0 });
    const result = encisoCalculateFinalScore(Math.round(totals.correctPoints), Math.round(totals.timePoints));
    const stateKey = encisoGetResultStateKeyByGrade(result.finalGrade);
    const stateInfo = ENCISO_RESULT_STATES[stateKey] || ENCISO_RESULT_STATES.red;
    const user = state.user || {};
    const userName = user.fullName || user.name || user.username || 'Tú';
    const review = questions.slice(0, 10).map((question, index) => {
      const answer = answerMap.get(index) || null;
      const type = question?.type || answer?.type || 'unknown';
      const isOpen = type === 'open';
      const hasOpenText = isOpen && Boolean(String(answer?.text || '').trim());
      const isCorrect = answer?.correct === true;
      const cssClass = isOpen && hasOpenText ? 'open' : (isCorrect ? 'ok' : 'bad');
      const symbol = isOpen && hasOpenText ? '?' : (isCorrect ? '✓' : '×');
      return { index, cssClass, symbol };
    });
    const fakeGrade = encisoMakeFakeGrade(result.finalGrade);
    return {
      ...result,
      fakeGrade,
      stateKey,
      stateInfo,
      userName,
      title: encisoPickRandom(stateInfo.titlePool),
      phrase: encisoPickRandom(stateInfo.phrasePool),
      ranking: [
        { place: 'first', name: userName, points: result.globalScore },
        { place: 'second', name: 'Mateo', points: Math.max(0, result.globalScore - 850) },
        { place: 'third', name: 'Sofía', points: Math.max(0, result.globalScore - 1720) }
      ],
      review
    };
  }
  function encisoReviewItemsHTML(items = []) {
    return items.map((item) => `
      <div class="enciso-review-item summary-question-entry-card ${escapeAttr(item.cssClass)}">
        <small>${Number(item.index) + 1}</small>${escapeHTML(item.symbol)}
      </div>
    `).join('');
  }

  const ENCISO_FINAL_TUNE_STORAGE_KEY = 'encisomath:finalResultsTune:v0.24.248';
  const ENCISO_FINAL_TUNE_DEFAULTS = {
    heroHeight: 23,
    heroX: 0,
    heroY: -12,
    heroZoom: 133,
    heroKickerX: 0,
    heroKickerY: 0,
    heroTitleSize: 68,
    heroTitleY: 38,
    heroMessageSize: 97,
    heroMessageY: 60,
    heroSparklesX: 1,
    heroSparklesY: 24,
    heroSparklesZoom: 138,
    heroSparklesCount: 16,
    scoreHeight: 14,
    scoreX: 0,
    scoreY: -36,
    scoreZoom: 100,
    scoreLabelX: 4,
    scoreLabelY: -153,
    scoreNumberX: 3,
    scoreNumberY: -27,
    gradePolyZoom: 100,
    gradePolyX: 10,
    gradePolyY: -16,
    gradeNoteSize: 90,
    gradeNoteX: 7,
    gradeNoteY: -40,
    podiumHeight: 25,
    podiumX: 0,
    podiumY: -18,
    podiumZoom: 100,
    podiumStarsY: -50,
    reviewHeight: 9,
    reviewX: 0,
    reviewY: -44,
    reviewZoom: 100,
    actionsHeight: 4,
    actionsY: 4,
    replayButtonHeight: 100,
    continueButtonHeight: 100
  };
  const ENCISO_FINAL_TUNE_TABS = [
    {
      key: 'hero',
      label: 'Hero',
      fields: [
        ['heroHeight', 'Altura'],
        ['heroX', 'Posición X'],
        ['heroY', 'Posición Y'],
        ['heroZoom', 'Zoom'],
        ['heroKickerX', 'Posición X quiz'],
        ['heroKickerY', 'Posición Y quiz'],
        ['heroTitleSize', 'Tamaño título'],
        ['heroTitleY', 'Posición Y título'],
        ['heroMessageSize', 'Tamaño subtítulo'],
        ['heroMessageY', 'Posición Y subtítulo'],
        ['heroSparklesX', 'Posición X estrellas'],
        ['heroSparklesY', 'Posición Y estrellas'],
        ['heroSparklesZoom', 'Zoom estrellas'],
        ['heroSparklesCount', 'Cantidad estrellas']
      ]
    },
    {
      key: 'score',
      label: 'Puntaje',
      fields: [
        ['scoreHeight', 'Altura'],
        ['scoreX', 'Posición X'],
        ['scoreY', 'Posición Y'],
        ['scoreZoom', 'Zoom'],
        ['scoreLabelX', 'Posición X texto'],
        ['scoreLabelY', 'Posición Y texto'],
        ['scoreNumberX', 'Posición X número'],
        ['scoreNumberY', 'Posición Y número'],
        ['gradePolyZoom', 'Zoom polígono'],
        ['gradePolyX', 'Posición X polígono'],
        ['gradePolyY', 'Posición Y polígono'],
        ['gradeNoteSize', 'Tamaño número nota'],
        ['gradeNoteX', 'Posición X número nota'],
        ['gradeNoteY', 'Posición Y número nota']
      ]
    },
    { key: 'podium', label: 'Ranking', fields: [['podiumHeight', 'Altura'], ['podiumX', 'Posición X'], ['podiumY', 'Posición Y'], ['podiumZoom', 'Zoom'], ['podiumStarsY', 'Posición Y estrellas']] },
    { key: 'review', label: 'Preguntas', fields: [['reviewHeight', 'Altura'], ['reviewX', 'Posición X'], ['reviewY', 'Posición Y'], ['reviewZoom', 'Zoom']] },
    { key: 'buttons', label: 'Botones', fields: [['actionsHeight', 'Altura contenedor'], ['actionsY', 'Posición Y'], ['replayButtonHeight', 'Altura Repetir'], ['continueButtonHeight', 'Altura Continuar']] },
    { key: 'points', label: 'Puntos', fields: [] }
  ];

  function encisoFinalTuneFieldMeta(key) {
    if (key === 'heroSparklesCount') return { min: 0, max: 24, step: 1, unit: '' };
    if (key === 'actionsHeight') return { min: 1, max: 60, step: 1, unit: '%' };
    if (key === 'replayButtonHeight' || key === 'continueButtonHeight') return { min: 25, max: 260, step: 1, unit: '%' };
    if (key.endsWith('Height')) return { min: 1, max: 120, step: 1, unit: '%' };
    if (key === 'heroZoom') return { min: 20, max: 420, step: 1, unit: '%' };
    if (key === 'gradePolyZoom') return { min: 20, max: 420, step: 1, unit: '%' };
    if (key.endsWith('Zoom')) return { min: 20, max: 360, step: 1, unit: '%' };
    if (key.endsWith('Size')) return { min: 20, max: 360, step: 1, unit: '%' };
    if (key.endsWith('X')) return { min: -220, max: 220, step: 1, unit: '%' };
    if (key.endsWith('Y')) return { min: -220, max: 220, step: 1, unit: '%' };
    return { min: -220, max: 220, step: 1, unit: '%' };
  }
  function normalizeEncisoFinalTune(raw = {}) {
    const out = { ...ENCISO_FINAL_TUNE_DEFAULTS };
    Object.keys(out).forEach((key) => {
      const meta = encisoFinalTuneFieldMeta(key);
      const value = Number(raw?.[key]);
      if (Number.isFinite(value)) out[key] = encisoClamp(value, meta.min, meta.max);
    });
    return out;
  }
  function getEncisoFinalTune() {
    try {
      return normalizeEncisoFinalTune(JSON.parse(localStorage.getItem(ENCISO_FINAL_TUNE_STORAGE_KEY) || '{}'));
    } catch (_) {
      return normalizeEncisoFinalTune();
    }
  }
  function saveEncisoFinalTune(tune) {
    const safe = normalizeEncisoFinalTune(tune);
    try { localStorage.setItem(ENCISO_FINAL_TUNE_STORAGE_KEY, JSON.stringify(safe)); } catch (_) {}
    return safe;
  }
  function applyEncisoFinalTune(root, tune = getEncisoFinalTune()) {
    if (!root) return normalizeEncisoFinalTune(tune);
    const safe = normalizeEncisoFinalTune(tune);
    root.style.setProperty('--enciso-hero-row', `${safe.heroHeight}fr`);
    root.style.setProperty('--enciso-score-row', `${safe.scoreHeight}fr`);
    root.style.setProperty('--enciso-podium-row', `${safe.podiumHeight}fr`);
    root.style.setProperty('--enciso-review-row', `${safe.reviewHeight}fr`);
    root.style.setProperty('--enciso-actions-row', `${safe.actionsHeight}fr`);
    root.style.setProperty('--enciso-hero-x', `${safe.heroX}%`);
    root.style.setProperty('--enciso-score-x', `${safe.scoreX}%`);
    root.style.setProperty('--enciso-score-y', `${safe.scoreY}%`);
    root.style.setProperty('--enciso-podium-x', `${safe.podiumX}%`);
    root.style.setProperty('--enciso-podium-y', `${safe.podiumY}%`);
    root.style.setProperty('--enciso-review-x', `${safe.reviewX}%`);
    root.style.setProperty('--enciso-review-y', `${safe.reviewY}%`);
    root.style.setProperty('--enciso-hero-y', `${safe.heroY}%`);
    root.style.setProperty('--enciso-hero-zoom', `${safe.heroZoom / 100}`);
    root.style.setProperty('--enciso-hero-kicker-x', `${safe.heroKickerX}%`);
    root.style.setProperty('--enciso-hero-kicker-y', `${safe.heroKickerY}%`);
    root.style.setProperty('--enciso-hero-sparkles-x', `${safe.heroSparklesX}%`);
    root.style.setProperty('--enciso-hero-sparkles-y', `${safe.heroSparklesY}%`);
    root.style.setProperty('--enciso-hero-sparkles-zoom', `${safe.heroSparklesZoom / 100}`);
    root.querySelectorAll('.enciso-band-sparkles span').forEach((sparkle, index) => {
      sparkle.hidden = index >= safe.heroSparklesCount;
    });
    root.style.setProperty('--enciso-score-zoom', `${safe.scoreZoom / 100}`);
    root.style.setProperty('--enciso-score-label-x', `${safe.scoreLabelX}%`);
    root.style.setProperty('--enciso-score-label-y', `${safe.scoreLabelY}%`);
    root.style.setProperty('--enciso-score-number-x', `${safe.scoreNumberX}%`);
    root.style.setProperty('--enciso-score-number-y', `${safe.scoreNumberY}%`);
    root.style.setProperty('--enciso-grade-poly-zoom', `${safe.gradePolyZoom / 100}`);
    root.style.setProperty('--enciso-grade-poly-x', `${safe.gradePolyX}%`);
    root.style.setProperty('--enciso-grade-poly-y', `${safe.gradePolyY}%`);
    root.style.setProperty('--enciso-grade-note-size', `${safe.gradeNoteSize / 100}`);
    root.style.setProperty('--enciso-grade-note-x', `${safe.gradeNoteX}%`);
    root.style.setProperty('--enciso-grade-note-y', `${safe.gradeNoteY}%`);
    root.style.setProperty('--enciso-podium-zoom', `${safe.podiumZoom / 100}`);
    root.style.setProperty('--enciso-review-zoom', `${safe.reviewZoom / 100}`);
    root.style.setProperty('--enciso-hero-title-size', `${safe.heroTitleSize / 100}`);
    root.style.setProperty('--enciso-hero-title-y', `${safe.heroTitleY}%`);
    root.style.setProperty('--enciso-hero-message-size', `${safe.heroMessageSize / 100}`);
    root.style.setProperty('--enciso-hero-message-y', `${safe.heroMessageY}%`);
    root.style.setProperty('--enciso-podium-stars-y', `${safe.podiumStarsY}%`);
    root.style.setProperty('--enciso-replay-button-height', `${safe.replayButtonHeight}%`);
    root.style.setProperty('--enciso-continue-button-height', `${safe.continueButtonHeight}%`);
    root.style.setProperty('--enciso-replay-button-scale', `${safe.replayButtonHeight / 100}`);
    root.style.setProperty('--enciso-continue-button-scale', `${safe.continueButtonHeight / 100}`);
    root.style.setProperty('--enciso-replay-button-height-live', `clamp(${(34 * safe.replayButtonHeight / 100).toFixed(2)}px, ${(5.2 * safe.replayButtonHeight / 100).toFixed(2)}dvh, ${(44 * safe.replayButtonHeight / 100).toFixed(2)}px)`);
    root.style.setProperty('--enciso-continue-button-height-live', `clamp(${(34 * safe.continueButtonHeight / 100).toFixed(2)}px, ${(5.2 * safe.continueButtonHeight / 100).toFixed(2)}dvh, ${(44 * safe.continueButtonHeight / 100).toFixed(2)}px)`);
    root.style.setProperty('--enciso-actions-y', `${safe.actionsY}%`);
    return safe;
  }
  function updateEncisoFinalTuneOutputs(root, tune = getEncisoFinalTune()) {
    const safe = normalizeEncisoFinalTune(tune);
    root?.querySelectorAll?.('[data-enciso-final-tune-output]').forEach((output) => {
      const key = output.dataset.encisoFinalTuneOutput;
      const meta = encisoFinalTuneFieldMeta(key);
      output.textContent = `${safe[key]}${meta.unit}`;
    });
    root?.querySelectorAll?.('[data-enciso-final-tune-field]').forEach((input) => {
      const key = input.dataset.encisoFinalTuneField;
      if (Object.prototype.hasOwnProperty.call(safe, key)) input.value = String(safe[key]);
    });
  }
  function encisoFinalTuneSliderHTML(key, label) {
    const meta = encisoFinalTuneFieldMeta(key);
    const value = ENCISO_FINAL_TUNE_DEFAULTS[key];
    return `
      <label class="enciso-final-tune-slider">
        <span>${escapeHTML(label)} <b data-enciso-final-tune-output="${escapeAttr(key)}">${value}${escapeHTML(meta.unit)}</b></span>
        <input type="range" min="${meta.min}" max="${meta.max}" step="${meta.step}" value="${value}" data-enciso-final-tune-field="${escapeAttr(key)}">
      </label>
    `;
  }
  function encisoFinalPointsTuneHTML() {
    return `
      <div class="enciso-final-points-tune">
        <label class="enciso-final-tune-slider">
          <span>Correctas <b data-enciso-final-points-output="correct">0</b></span>
          <input type="number" min="0" max="10000" step="100" value="0" data-enciso-final-points-field="correct">
        </label>
        <label class="enciso-final-tune-slider">
          <span>Tiempo <b data-enciso-final-points-output="time">0</b></span>
          <input type="number" min="0" max="10000" step="100" value="0" data-enciso-final-points-field="time">
        </label>
        <button class="enciso-final-points-replay" type="button" data-enciso-final-points-apply>Reiniciar animación con estos puntos</button>
      </div>
    `;
  }
  function encisoFinalTunePanelHTML() {
    return '';
  }
  function encisoClampFinalPointInput(value) {
    return Math.max(0, Math.min(10000, Math.round(Number(value) || 0)));
  }
  function syncEncisoFinalPointControls(root) {
    if (!root) return;
    const correct = encisoClampFinalPointInput(root.dataset.correctPoints);
    const time = encisoClampFinalPointInput(root.dataset.timePoints);
    root.querySelectorAll('[data-enciso-final-points-field="correct"]').forEach((input) => { input.value = String(correct); });
    root.querySelectorAll('[data-enciso-final-points-field="time"]').forEach((input) => { input.value = String(time); });
    root.querySelectorAll('[data-enciso-final-points-output="correct"]').forEach((output) => { output.textContent = encisoFormatNumber(correct); });
    root.querySelectorAll('[data-enciso-final-points-output="time"]').forEach((output) => { output.textContent = encisoFormatNumber(time); });
  }
  function encisoApplyManualResultPoints(root) {
    if (!root) return;
    const correct = encisoClampFinalPointInput(root.querySelector('[data-enciso-final-points-field="correct"]')?.value);
    const time = encisoClampFinalPointInput(root.querySelector('[data-enciso-final-points-field="time"]')?.value);
    const session = getQuizSession();
    session.manualResultPoints = { correctPoints: correct, timePoints: time };
    const payload = encisoBuildFinalPayloadFromPoints(correct, time);
    encisoApplyFinalPayloadToRoot(root, payload);
    syncEncisoFinalPointControls(root);
    const modal = root.querySelector('[data-enciso-final-tune-modal]');
    if (modal) {
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
      modal.classList.remove('open');
    }
    stopQuizResultsMusic(true);
    window.setTimeout(() => encisoRunFinalResultsAnimations(root, payload), QUIZ_RESULTS_MUSIC_FADE_MS);
  }
  function bindEncisoFinalTunePanel(root) {
    if (!root || root.dataset.encisoFinalTuneBound === 'true') return;
    root.dataset.encisoFinalTuneBound = 'true';
    let tune = applyEncisoFinalTune(root, getEncisoFinalTune());
    updateEncisoFinalTuneOutputs(root, tune);
    syncEncisoFinalPointControls(root);
    const modal = root.querySelector('[data-enciso-final-tune-modal]');
    const openModal = () => {
      if (!modal) return;
      modal.hidden = false;
      modal.setAttribute('aria-hidden', 'false');
      modal.classList.add('open');
    };
    const closeModal = () => {
      if (!modal) return;
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
      modal.classList.remove('open');
    };
    root.querySelectorAll('[data-enciso-final-tune-toggle]').forEach((button) => button.addEventListener('click', openModal));
    root.querySelectorAll('[data-enciso-final-tune-close]').forEach((button) => button.addEventListener('click', closeModal));
    root.querySelectorAll('[data-enciso-final-tune-tab]').forEach((button) => {
      button.addEventListener('click', () => {
        const key = button.dataset.encisoFinalTuneTab;
        root.querySelectorAll('[data-enciso-final-tune-tab]').forEach((item) => item.classList.toggle('active', item === button));
        root.querySelectorAll('[data-enciso-final-tune-pane]').forEach((pane) => pane.classList.toggle('active', pane.dataset.encisoFinalTunePane === key));
      });
    });
    root.querySelectorAll('[data-enciso-final-tune-field]').forEach((input) => {
      input.addEventListener('input', () => {
        const key = input.dataset.encisoFinalTuneField;
        tune = normalizeEncisoFinalTune({ ...tune, [key]: Number(input.value) });
        saveEncisoFinalTune(tune);
        applyEncisoFinalTune(root, tune);
        updateEncisoFinalTuneOutputs(root, tune);
      });
    });
    root.querySelectorAll('[data-enciso-final-points-field]').forEach((input) => {
      input.addEventListener('input', () => {
        const key = input.dataset.encisoFinalPointsField;
        const value = encisoClampFinalPointInput(input.value);
        root.querySelectorAll(`[data-enciso-final-points-output="${escapeSelector(key)}"]`).forEach((output) => {
          output.textContent = encisoFormatNumber(value);
        });
      });
    });
    root.querySelectorAll('[data-enciso-final-points-apply]').forEach((button) => {
      button.addEventListener('click', () => encisoApplyManualResultPoints(root));
    });
    root.querySelectorAll('[data-enciso-final-tune-reset]').forEach((button) => {
      button.addEventListener('click', () => {
        tune = saveEncisoFinalTune(ENCISO_FINAL_TUNE_DEFAULTS);
        applyEncisoFinalTune(root, tune);
        updateEncisoFinalTuneOutputs(root, tune);
        syncEncisoFinalPointControls(root);
      });
    });
    modal?.addEventListener('click', (event) => {
      if (event.target === modal) closeModal();
    });
  }
  const ENCISO_RETO_HERO_FIGURAS_TOTAL = 10;
  const ENCISO_RETO_HERO_VELOCIDAD = 0.4;
  const ENCISO_RETO_HERO_TIPOS = ['circulo', 'cuadrado', 'triangulo', 'equis'];

  function encisoRetoRandom(min, max) {
    return Math.random() * (max - min) + min;
  }
  function encisoRetoRandomInt(min, max) {
    return Math.floor(encisoRetoRandom(min, max + 1));
  }
  function encisoRetoShuffle(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
  function encisoRetoBuildFigureTypes(count) {
    const list = [];
    while (list.length < count) list.push(...encisoRetoShuffle(ENCISO_RETO_HERO_TIPOS));
    return list.slice(0, count);
  }
  function encisoRetoEdgePosition(index) {
    const zone = index % 8;
    if (zone === 0) return { x: encisoRetoRandom(-5, 105), y: encisoRetoRandom(-4, 16) };
    if (zone === 1) return { x: encisoRetoRandom(-5, 105), y: encisoRetoRandom(84, 104) };
    if (zone === 2) return { x: encisoRetoRandom(-5, 16), y: encisoRetoRandom(0, 100) };
    if (zone === 3) return { x: encisoRetoRandom(84, 105), y: encisoRetoRandom(0, 100) };
    if (zone === 4) return { x: encisoRetoRandom(-5, 18), y: encisoRetoRandom(-5, 18) };
    if (zone === 5) return { x: encisoRetoRandom(82, 105), y: encisoRetoRandom(-5, 18) };
    if (zone === 6) return { x: encisoRetoRandom(-5, 18), y: encisoRetoRandom(82, 105) };
    return { x: encisoRetoRandom(82, 105), y: encisoRetoRandom(82, 105) };
  }
  function encisoRetoInnerPosition() {
    return { x: encisoRetoRandom(18, 82), y: encisoRetoRandom(18, 82) };
  }
  function encisoCleanPreviousRetoHeroDecorations(hero) {
    if (!hero) return;
    hero.querySelectorAll('.enciso-band-sparkles, .star, .stars, .dot, .dots, .blind, .blinds, .bubble, .bubbles, .particle, .particles, .sparkle, .sparkles').forEach((el) => {
      if (!el.classList.contains('em-reto-figura') && !el.classList.contains('em-reto-figuras-layer')) el.remove();
    });
  }
  function encisoEnsureRetoHeroLayer(hero) {
    let layer = hero?.querySelector?.('.em-reto-figuras-layer');
    if (!hero) return null;
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'em-reto-figuras-layer';
      layer.setAttribute('aria-hidden', 'true');
      hero.insertBefore(layer, hero.firstChild);
    }
    return layer;
  }
  function encisoCreateRetoHeroFigures(hero) {
    const layer = encisoEnsureRetoHeroLayer(hero);
    if (!layer) return;
    layer.innerHTML = '';
    const count = ENCISO_RETO_HERO_FIGURAS_TOTAL;
    const edgeCount = Math.ceil(count * 0.75);
    const types = encisoRetoBuildFigureTypes(count);
    for (let i = 0; i < count; i++) {
      const figure = document.createElement('span');
      const type = types[i];
      const edge = i < edgeCount;
      const pos = edge ? encisoRetoEdgePosition(i) : encisoRetoInnerPosition();
      const size = edge ? encisoRetoRandomInt(62, 142) : encisoRetoRandomInt(48, 112);
      const alpha = encisoRetoRandom(0.40, 0.64);
      const alphaLow = Math.max(0.24, alpha * 0.68);
      const alphaMid = Math.max(0.30, alpha * 0.86);
      const baseDuration = edge ? encisoRetoRandom(10, 14) : encisoRetoRandom(9, 13);
      const duration = baseDuration / ENCISO_RETO_HERO_VELOCIDAD;
      const delay = -((i / count) * duration);
      const forceX = edge ? encisoRetoRandom(50, 145) : encisoRetoRandom(45, 120);
      const forceY = edge ? encisoRetoRandom(38, 120) : encisoRetoRandom(35, 100);
      const x0 = encisoRetoRandom(-18, 18);
      const y0 = encisoRetoRandom(-18, 18);
      const x1 = encisoRetoRandom(-forceX, forceX);
      const y1 = encisoRetoRandom(-forceY, forceY);
      const x2 = encisoRetoRandom(-forceX * 1.2, forceX * 1.2);
      const y2 = encisoRetoRandom(-forceY * 1.2, forceY * 1.2);
      const x3 = encisoRetoRandom(-forceX * 1.35, forceX * 1.35);
      const y3 = encisoRetoRandom(-forceY * 1.35, forceY * 1.35);
      const x4 = encisoRetoRandom(-forceX, forceX);
      const y4 = encisoRetoRandom(-forceY, forceY);
      const r0 = encisoRetoRandomInt(-80, 80);
      const r1 = encisoRetoRandomInt(80, 220);
      const r2 = encisoRetoRandomInt(220, 420);
      const r3 = encisoRetoRandomInt(420, 650);
      const r4 = encisoRetoRandomInt(650, 860);
      const r5 = r0 + 360;
      figure.className = `em-reto-figura ${type}`;
      figure.style.setProperty('--x', `${pos.x.toFixed(1)}%`);
      figure.style.setProperty('--y', `${pos.y.toFixed(1)}%`);
      figure.style.setProperty('--size', `${size}px`);
      figure.style.setProperty('--alpha', alpha.toFixed(2));
      figure.style.setProperty('--alpha-low', alphaLow.toFixed(2));
      figure.style.setProperty('--alpha-mid', alphaMid.toFixed(2));
      figure.style.setProperty('--duration', `${duration.toFixed(2)}s`);
      figure.style.setProperty('--delay', `${delay.toFixed(2)}s`);
      figure.style.setProperty('--x0', `${x0.toFixed(1)}px`);
      figure.style.setProperty('--y0', `${y0.toFixed(1)}px`);
      figure.style.setProperty('--x1', `${x1.toFixed(1)}px`);
      figure.style.setProperty('--y1', `${y1.toFixed(1)}px`);
      figure.style.setProperty('--x2', `${x2.toFixed(1)}px`);
      figure.style.setProperty('--y2', `${y2.toFixed(1)}px`);
      figure.style.setProperty('--x3', `${x3.toFixed(1)}px`);
      figure.style.setProperty('--y3', `${y3.toFixed(1)}px`);
      figure.style.setProperty('--x4', `${x4.toFixed(1)}px`);
      figure.style.setProperty('--y4', `${y4.toFixed(1)}px`);
      figure.style.setProperty('--r0', `${r0}deg`);
      figure.style.setProperty('--r1', `${r1}deg`);
      figure.style.setProperty('--r2', `${r2}deg`);
      figure.style.setProperty('--r3', `${r3}deg`);
      figure.style.setProperty('--r4', `${r4}deg`);
      figure.style.setProperty('--r5', `${r5}deg`);
      layer.appendChild(figure);
    }
  }
  function encisoRestartRetoHeroAnimation(hero) {
    if (!hero) return;
    hero.classList.remove('is-em-reto-animating');
    void hero.offsetWidth;
    hero.classList.add('is-em-reto-animating');
  }
  function encisoInitRetoCompletedHero(root = document) {
    const hero = root.querySelector?.('.em-reto-hero-animado') || root.querySelector?.('.enciso-result-band');
    if (!hero) return;
    hero.classList.add('em-reto-hero-animado');
    encisoCleanPreviousRetoHeroDecorations(hero);
    encisoCreateRetoHeroFigures(hero);
    encisoRestartRetoHeroAnimation(hero);
  }
  function encisoPodiumSparklesHTML(count = 4) {
    return Array.from({ length: count }, () => '<span class="ranking-sparkle"></span>').join('');
  }
  function quizResultsHTML(quiz) {
    const session = getQuizSession();
    const securedOut = Boolean(session.securityTerminated);
    const data = encisoBuildFinalResultsData(quiz);
    const rootStyle = [
      `--enciso-state-color:${data.stateInfo.color}`,
      `--enciso-state-glow:${data.stateInfo.glow}`,
      `--enciso-state-band-bg:${data.stateInfo.bandBg}`,
      `--enciso-state-text:${data.stateInfo.textColor}`,
      `--enciso-state-note-text:${data.stateInfo.noteColor}`,
      `--enciso-fake-note-color:${data.stateInfo.fakeNoteColor}`
    ].join(';');
    const ranking = new Map(data.ranking.map((entry) => [entry.place, entry]));
    const first = ranking.get('first') || { name: 'Tú', points: data.globalScore };
    const second = ranking.get('second') || { name: 'Mateo', points: 0 };
    const third = ranking.get('third') || { name: 'Sofía', points: 0 };
    return `
      <section class="enciso-final-results results-screen ranking-results-screen enciso-result-state-${escapeAttr(data.stateKey)}" data-final-results data-correct-points="${data.correctPoints}" data-time-points="${data.timePoints}" data-global-score="${data.globalScore}" data-final-grade="${data.finalGrade}" data-fake-grade="${data.fakeGrade}" data-bonus-grade="${data.bonusGrade}" data-extra-points="${data.extraPoints}" style="${escapeAttr(rootStyle)}">
        ${securedOut ? `<div class="enciso-security-result-note">Motivo: ${escapeHTML(session.securityTerminatedReason || 'Acción sospechosa repetida')}</div>` : ''}
        <section class="enciso-result-band em-reto-hero-animado">
          <div class="em-reto-figuras-layer" aria-hidden="true"></div>
          <div class="enciso-result-content">
            <div class="enciso-result-kicker">Quiz completado</div>
            <h2 class="enciso-result-title">${escapeHTML(data.title)}</h2>
            <p class="enciso-result-message">${escapeHTML(data.phrase)}</p>
          </div>
        </section>

        <section class="enciso-score-card" data-score-card>
          <div class="enciso-score-inner">
            <div>
              <div class="enciso-score-label">Puntaje global</div>
              <div class="enciso-score-number" data-global-score>0</div>
            </div>
            <div class="enciso-grade-wrap">
              <div class="enciso-grade-poly-stage" data-grade-stage>
                <svg class="enciso-grade-poly-svg" viewBox="0 0 148 128" aria-hidden="true">
                  <defs>
                    <linearGradient id="silverPolyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stop-color="#697284"></stop><stop offset="11%" stop-color="#b4becd"></stop><stop offset="22%" stop-color="#f7fbff"></stop><stop offset="34%" stop-color="#9aa5b5"></stop><stop offset="47%" stop-color="#e9eef7"></stop><stop offset="55%" stop-color="#ffffff"></stop><stop offset="69%" stop-color="#818b9b"></stop><stop offset="84%" stop-color="#d8e0ec"></stop><stop offset="100%" stop-color="#6f7a89"></stop>
                    </linearGradient>
                    <linearGradient id="goldPolyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stop-color="#8b5a00"></stop><stop offset="10%" stop-color="#c78600"></stop><stop offset="22%" stop-color="#f7c948"></stop><stop offset="36%" stop-color="#fff2a8"></stop><stop offset="48%" stop-color="#ffffff"></stop><stop offset="63%" stop-color="#e0a600"></stop><stop offset="76%" stop-color="#b77900"></stop><stop offset="90%" stop-color="#ffd86b"></stop><stop offset="100%" stop-color="#9c6a00"></stop>
                    </linearGradient>
                  </defs>
                  <polygon data-grade-polygon points="21,29 128,26 124,101 23,104"></polygon>
                </svg>
                <div class="enciso-grade-note" data-grade-note>?</div>
              </div>
              <div class="enciso-grade-caption" data-grade-caption aria-hidden="true"></div>
            </div>
          </div>
          <div class="enciso-stats-grid">
            <div class="enciso-stat"><div class="enciso-stat-value" data-correct-points>0</div><div class="enciso-stat-label">Correctas</div></div>
            <div class="enciso-stat"><div class="enciso-stat-value" data-time-points>0</div><div class="enciso-stat-label">Tiempo</div></div>
            <div class="enciso-stat"><div class="enciso-stat-value" data-bonus-grade>+0.0</div><div class="enciso-stat-label">Bonus nota</div></div>
            <div class="enciso-stat"><div class="enciso-stat-value" data-extra-points>0</div><div class="enciso-stat-label">Puntos</div></div>
          </div>
        </section>

        <section class="enciso-podium-section ranking-animation-root" data-podium-section>
          <div class="enciso-section-title">Ranking del quiz</div>
          <div class="enciso-podium">
            <article class="enciso-podium-player second ranking-place-2" data-place="second">
              <div class="enciso-podium-sparkles" aria-hidden="true">${encisoPodiumSparklesHTML(4)}</div>
              <div class="enciso-avatar ranking-avatar"></div>
              <div class="enciso-podium-name ranking-name">${escapeHTML(second.name)}</div>
              <div class="enciso-podium-points ranking-score">${encisoFormatNumber(second.points)} pts</div>
              <div class="enciso-podium-block ranking-podium-block"><span class="ranking-rank-number">2</span></div>
            </article>
            <article class="enciso-podium-player first ranking-place-1" data-place="first">
              <div class="enciso-podium-sparkles" aria-hidden="true">${encisoPodiumSparklesHTML(8)}</div>
              <div class="enciso-avatar ranking-avatar"></div>
              <div class="enciso-podium-name ranking-name">${escapeHTML(first.name)}</div>
              <div class="enciso-podium-points ranking-score" data-my-podium-points>0 pts</div>
              <div class="enciso-podium-block ranking-podium-block"><span class="ranking-rank-number">1</span></div>
            </article>
            <article class="enciso-podium-player third ranking-place-3" data-place="third">
              <div class="enciso-podium-sparkles" aria-hidden="true">${encisoPodiumSparklesHTML(2)}</div>
              <div class="enciso-avatar ranking-avatar"></div>
              <div class="enciso-podium-name ranking-name">${escapeHTML(third.name)}</div>
              <div class="enciso-podium-points ranking-score">${encisoFormatNumber(third.points)} pts</div>
              <div class="enciso-podium-block ranking-podium-block"><span class="ranking-rank-number">3</span></div>
            </article>
          </div>
        </section>

        <section class="enciso-review-section" data-review-section>
          <div class="enciso-section-title">Resumen por pregunta</div>
          <div class="enciso-review-scroll summary-question-entry-track">${encisoReviewItemsHTML(data.review)}</div>
        </section>

        <section class="enciso-actions-section" data-actions-section>
          <button class="enciso-continue-btn" type="button" data-quiz-result-target="quizzes">Continuar</button>
        </section>
      </section>
    `;
  }
  function closeQuizFullscreen(target = 'quizzes') {
    stopQuizQuestionMusic(false);
    stopQuizResultsMusic(false);
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
      <section class="class-hero em-cl-hero-host" data-em-classes-hero aria-label="Clases de la asignatura">
        ${emClClassesHeroHTML()}
      </section>
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
      <div id="classGrid" class="em-content-list is-${state.classViewMode}">
        ${renderClassCardsHTML()}
      </div>
    `;

    bindPeriodButtons();
    bindClassViewButtons();
    bindClassCards();
    emClInitClassesHero($content);
    if (options.animate) pulseElement($content, 'tab-enter');
  }
  function getClassesForCurrentAssignment() {
    const assignment = state.assignment;
    return state.data.classes.filter((item) => item.subject === assignment.subject || item.area === assignment.area);
  }
  function renderClassCardsHTML() {
    const filtered = getClassesForCurrentAssignment().filter((item) => Number(item.period) === Number(state.period));
    return filtered.map((item, index) => classCardHTML(item, index)).join('') || `<div class="empty">Aún no hay clases para este periodo.</div>`;
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
      button.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        const item = state.data.classes.find((lesson) => lesson.id === button.dataset.classId);
        if (item) renderLesson(item);
      });
    });
  }
  function updateClassGrid(animate = false) {
    const grid = document.getElementById('classGrid');
    if (!grid) return;
    grid.className = `em-content-list is-${state.classViewMode}`;
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
        <section class="lesson-head" data-em-flat-bg>
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
  const EM_FLAT_BACKGROUND_SHAPES = [
    'circle',
    'x',
    'triangle',
    'square',
    'circle',
    'triangle',
    'square',
    'x'
  ];

  const EM_SUBJECT_COLORS = [
    '#1368ce',
    '#ff7a00',
    '#24b49a',
    '#54c600',
    '#EBB513',
    '#e21b3c'
  ];

  const EM_SUBJECT_THEME_MAP = {
    '#1368ce': {
      main: '#1368ce',
      support: '#24b49a',
      mainInk: '#ffffff',
      supportInk: '#001814',
      shape: 'rgba(19, 104, 206, .28)'
    },
    '#ff7a00': {
      main: '#ff7a00',
      support: '#EBB513',
      mainInk: '#ffffff',
      supportInk: '#181100',
      shape: 'rgba(255, 122, 0, .28)'
    },
    '#24b49a': {
      main: '#24b49a',
      support: '#1368ce',
      mainInk: '#001814',
      supportInk: '#ffffff',
      shape: 'rgba(36, 180, 154, .28)'
    },
    '#54c600': {
      main: '#54c600',
      support: '#EBB513',
      mainInk: '#092300',
      supportInk: '#181100',
      shape: 'rgba(84, 198, 0, .28)'
    },
    '#ebb513': {
      main: '#EBB513',
      support: '#ff7a00',
      mainInk: '#181100',
      supportInk: '#ffffff',
      shape: 'rgba(235, 181, 19, .28)'
    },
    '#e21b3c': {
      main: '#e21b3c',
      support: '#ff7a00',
      mainInk: '#ffffff',
      supportInk: '#ffffff',
      shape: 'rgba(226, 27, 60, .28)'
    }
  };

  const EM_ATTENDANCE_SHAPE_TYPES = ['circle', 'square', 'triangle', 'x'];

  const EM_ATTENDANCE_MOVEMENT_PAIRS = [
    ['move-a1', 'move-b1'],
    ['move-a2', 'move-b2'],
    ['move-a3', 'move-b3'],
    ['move-a4', 'move-b4']
  ];

  function emNormalizeHexColor(color) {
    return String(color || '#1368ce').trim().toLowerCase();
  }

  function emGetSubjectTheme(color) {
    const normalized = emNormalizeHexColor(color);
    return EM_SUBJECT_THEME_MAP[normalized] || EM_SUBJECT_THEME_MAP['#1368ce'];
  }

  function emApplySubjectTheme(color, root = document.documentElement) {
    const theme = emGetSubjectTheme(color);

    root.style.setProperty('--em-current-subject-color', theme.main);
    root.style.setProperty('--em-current-support-color', theme.support);
    root.style.setProperty('--em-current-subject-ink', theme.mainInk);
    root.style.setProperty('--em-current-support-ink', theme.supportInk);
    root.style.setProperty('--em-current-shape-color', theme.shape);
  }

  function emRandomFrom(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function emRandomizeAttendanceBandShapes(root = document) {
    const cards = root.querySelectorAll?.('[data-em-attendance-band]') || [];

    cards.forEach((card) => {
      const shapes = card.querySelectorAll('.em-attendance-shape');
      const pair = emRandomFrom(EM_ATTENDANCE_MOVEMENT_PAIRS);

      shapes.forEach((shape, index) => {
        const randomShape = emRandomFrom(EM_ATTENDANCE_SHAPE_TYPES);
        const movement = pair[index] || pair[0];

        shape.className = 'em-attendance-shape';
        shape.classList.add(randomShape, movement);
        shape.setAttribute('aria-hidden', 'true');
      });
    });
  }

  function emInitSubjectToolbar(root = document) {
    root.querySelectorAll?.('.em-subject-tab-btn').forEach((button) => {
      if (button.dataset.emToolbarBound === 'true') return;
      button.dataset.emToolbarBound = 'true';
      button.addEventListener('click', () => {
        const group = button.closest('.em-subject-top-tabs');
        if (!group) return;

        group.querySelectorAll('.em-subject-tab-btn').forEach((item) => {
          item.classList.remove('is-active', 'active');
        });

        button.classList.add('is-active', 'active');
      });
    });
  }

  function emGetSubjectColorByIndex(index) {
    const safeIndex = Number.isFinite(Number(index)) ? Number(index) : 0;
    return EM_SUBJECT_COLORS[((safeIndex % EM_SUBJECT_COLORS.length) + EM_SUBJECT_COLORS.length) % EM_SUBJECT_COLORS.length];
  }

  function emSetCurrentSubjectColor(color) {
    const safeColor = color || '#1368ce';
    emApplySubjectTheme(safeColor);
  }

  function emFlatEnsureBackground(element, color) {
    if (!element) return;
    element.classList.add('em-flat-background');

    if (color) {
      element.style.setProperty('--em-flat-bg-color', color);
    }

    let layer = element.querySelector(':scope > .em-flat-background-layer');

    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'em-flat-background-layer';
      layer.setAttribute('aria-hidden', 'true');

      EM_FLAT_BACKGROUND_SHAPES.forEach((shapeType) => {
        const shape = document.createElement('span');
        shape.className = `em-bg-shape ${shapeType}`;
        layer.appendChild(shape);
      });

      element.prepend(layer);
    }
  }

  function emFlatApplyBackgrounds(root = document) {
    root.querySelectorAll?.('[data-em-flat-bg]').forEach((element) => {
      const color = element.getAttribute('data-em-flat-bg-color');
      emFlatEnsureBackground(element, color);
    });
  }

  function emGetSubjectColorForAssignment(subject) {
    if (!subject) return '#1368ce';
    if (subject.__emColor) return subject.__emColor;

    const teacherAssignments = getTeacherAssignments(state.user?.id);
    const sortedSubjects = emSubSortSubjects(teacherAssignments);
    const index = sortedSubjects.findIndex((item) => String(emSubGetSubjectId(item)) === String(emSubGetSubjectId(subject)));
    const color = emGetSubjectColorByIndex(index >= 0 ? index : 0);
    subject.__emColor = color;
    return color;
  }

  const EM_SUB_SHAPE_PAIRS = [
    ['circle', 'x'],
    ['triangle', 'circle'],
    ['square', 'triangle'],
    ['x', 'square'],
    ['circle', 'triangle'],
    ['square', 'x']
  ];

  const EM_SUB_MOVE_PAIRS = [
    ['em-sub-move-1a', 'em-sub-move-1b'],
    ['em-sub-move-2a', 'em-sub-move-2b'],
    ['em-sub-move-3a', 'em-sub-move-3b'],
    ['em-sub-move-4a', 'em-sub-move-4b'],
    ['em-sub-move-5a', 'em-sub-move-5b'],
    ['em-sub-move-6a', 'em-sub-move-6b']
  ];

  function emSubGetSubjectId(subject) {
    return subject.id || subject.subjectId || subject.key || subject.slug || '';
  }
  function emSubGetSubjectArea(subject) {
    return subject.area || subject.asignatura || subject.subject || subject.materia || 'Asignatura';
  }
  function emSubGetSubjectName(subject) {
    return subject.name || subject.nombre || subject.title || subject.titulo || subject.subject || 'Sin nombre';
  }
  function emSubGetSubjectGrade(subject) {
    return subject.grade || subject.grado || subject.level || '';
  }
  function emSubGetSubjectCourse(subject) {
    return subject.course || subject.curso || subject.group || subject.grupo || '';
  }
  function emSubGetSubjectGradeCourse(subject) {
    const grade = emSubGetSubjectGrade(subject);
    const course = emSubGetSubjectCourse(subject);
    if (grade && course) return `${grade}-${course}`;
    if (course) return String(course);
    if (grade) return String(grade);
    return '';
  }
  function emSubGetSubjectSortGrade(subject) {
    const gradeCourse = emSubGetSubjectGradeCourse(subject);
    const grade = emSubGetSubjectGrade(subject);
    const raw = String(grade || gradeCourse || '').match(/\d+/);
    return raw ? Number(raw[0]) : 0;
  }
  function emSubNaturalPart(value) {
    const raw = String(value || '').match(/\d+/);
    return raw ? Number(raw[0]) : Number.POSITIVE_INFINITY;
  }
  function emSubGetSubjectSortKey(subject) {
    return [
      String(emSubNaturalPart(emSubGetSubjectCourse(subject))).padStart(4, '0'),
      emSubGetSubjectArea(subject),
      emSubGetSubjectName(subject),
      emSubGetSubjectGradeCourse(subject)
    ]
      .join(' ')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }
  function emSubSortSubjects(subjects) {
    return [...subjects].sort((a, b) => {
      const gradeA = emSubGetSubjectSortGrade(a);
      const gradeB = emSubGetSubjectSortGrade(b);
      if (gradeA !== gradeB) return gradeB - gradeA;
      return emSubGetSubjectSortKey(a).localeCompare(emSubGetSubjectSortKey(b), 'es', { sensitivity: 'base' });
    });
  }
  function emSubGroupSubjectsByGrade(subjects) {
    const sorted = emSubSortSubjects(subjects);
    const groups = new Map();
    sorted.forEach((subject) => {
      const grade = emSubGetSubjectSortGrade(subject);
      const label = grade ? `GRADO ${grade}` : 'SIN GRADO';
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(subject);
    });
    return [...groups.entries()].map(([label, items]) => ({ label, items }));
  }
  function emSubSubjectCardHTML(subject, index) {
    const id = emSubGetSubjectId(subject);
    const area = emSubGetSubjectArea(subject);
    const name = emSubGetSubjectName(subject);
    const gradeCourse = emSubGetSubjectGradeCourse(subject);
    const pairIndex = index % EM_SUB_SHAPE_PAIRS.length;
    const shapes = EM_SUB_SHAPE_PAIRS[pairIndex];
    const moves = EM_SUB_MOVE_PAIRS[pairIndex];
    const subjectColor = emGetSubjectColorByIndex(index);
    subject.__emColor = subjectColor;
    return `
      <article class="em-sub-card" data-subject-id="${escapeAttr(id)}" data-subject-color="${escapeAttr(subjectColor)}" style="--main: ${escapeAttr(subjectColor)};" role="button" tabindex="0">
        <div class="em-sub-cover">
          <span class="em-sub-shape ${escapeAttr(shapes[0])} ${escapeAttr(moves[0])}"></span>
          <span class="em-sub-shape ${escapeAttr(shapes[1])} ${escapeAttr(moves[1])}"></span>
        </div>
        <div class="em-sub-content">
          <p class="em-sub-area">${escapeHTML(area)}</p>
          <h2 class="em-sub-name">${escapeHTML(name)}</h2>
          <p class="em-sub-course">${escapeHTML(gradeCourse)}</p>
        </div>
      </article>
    `;
  }
  function emSubGradeGroupHTML(group, startIndex) {
    return `
      <section class="em-sub-grade-group">
        <h2 class="em-sub-grade-title">${escapeHTML(group.label)}</h2>
        <div class="em-sub-grid">
          ${group.items.map((subject, index) => emSubSubjectCardHTML(subject, startIndex + index)).join('')}
        </div>
      </section>
    `;
  }
  function emSubHomeSubjectsHTML(subjects) {
    const groups = emSubGroupSubjectsByGrade(subjects);
    let runningIndex = 0;
    const html = groups.map((group) => {
      const groupHTML = emSubGradeGroupHTML(group, runningIndex);
      runningIndex += group.items.length;
      return groupHTML;
    }).join('');
    return html || '<div class="empty">No hay asignaturas asignadas.</div>';
  }
  function emSubRenderHomeSubjects(subjects, homeSubjectsContainer) {
    if (!homeSubjectsContainer) return;
    homeSubjectsContainer.classList.add('em-sub-home-wrap');
    homeSubjectsContainer.innerHTML = emSubHomeSubjectsHTML(subjects);
    bindAssignmentCards(subjects);
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
    const visualStatus = emRsStatusToVisual(status);
    const tier = emRsGetTier(points);
    const locked = emRsIsAttendanceLocked(status);
    const lockedClass = locked ? 'attendance-locked' : '';
    const emoji = locked ? '😴' : emRsGetEmoji(points);
    const id = emRsGetStudentId(student);
    return `
      <article class="em-rs-card ${tier} ${lockedClass}" data-rockstar-card="${escapeAttr(id)}" data-student-id="${escapeAttr(id)}" data-score="${Number(points) || 0}">
        <div class="em-rs-card-bg-shape ${emRsRandomShape()}"></div>

        <div class="em-rs-student-top">
          <div class="em-rs-avatar">${emoji}</div>

          <div class="em-rs-info">
            <h2 class="em-rs-name">${escapeHTML(emRsGetStudentName(student))}</h2>
            <p class="em-rs-meta"><span class="em-rs-id-badge">ID</span>${escapeHTML(emRsGetStudentCode(student))} • ${escapeHTML(emRsGetStudentUser(student))}</p>
            <p class="em-rs-score-chip">${escapeHTML(emRsGetAttendanceLabel(visualStatus))}</p>
          </div>

          <div class="em-rs-points">
            <span class="em-rs-points-num">${Number(points) || 0}</span>
            <span class="em-rs-points-label">PTS</span>
            <div class="em-rs-burst"><span></span><span></span><span></span><span></span><span></span><span></span></div>
          </div>
        </div>

        <div class="em-rs-score-actions">
          <button class="em-rs-score-btn minus" type="button" data-rockstar-student="${escapeAttr(id)}" data-rockstar-delta="-1">-1</button>
          <button class="em-rs-score-btn plus" type="button" data-rockstar-student="${escapeAttr(id)}" data-rockstar-delta="1">+1</button>
        </div>
      </article>
    `;
  }
  function getRockstarTier(points) {
    const value = Number(points) || 0;
    if (value <= -5) return { emoji: '💀', label: 'Zona crítica', className: 'm5' };
    if (value < 0) return { emoji: '😤', label: 'Remontando', className: 'm0' };
    if (value === 0) return { emoji: '😐', label: 'Neutro', className: 'zero' };
    if (value < 5) return { emoji: '🙂', label: 'Participando', className: 'p0' };
    if (value < 10) return { emoji: '🚀', label: 'Despegando', className: 'p5' };
    if (value < 15) return { emoji: '😎', label: 'Sólido', className: 'p10' };
    return { emoji: '🔥', label: 'On fire', className: 'p15' };
  }
  function studentCardHTML(student, status) {
    const visualStatus = emRsStatusToVisual(status);
    const id = emRsGetStudentId(student);
    return `
      <article class="em-rs-att-card ${visualStatus}" data-student-card="${escapeAttr(id)}" data-student-id="${escapeAttr(id)}">
        <div class="em-rs-card-bg-shape ${emRsRandomShape()}"></div>

        <div class="em-rs-student-top">
          <div class="em-rs-avatar em-rs-avatar-person"></div>

          <div class="em-rs-info">
            <h2 class="em-rs-name">${escapeHTML(emRsGetStudentName(student))}</h2>
            <p class="em-rs-meta" data-attendance-meta><span class="em-rs-id-badge">ID</span>${escapeHTML(emRsGetStudentCode(student))} • ${escapeHTML(emRsGetStudentUser(student))}</p>
          </div>
        </div>

        <button class="em-rs-trash-btn" type="button" data-student-id="${escapeAttr(id)}" aria-label="Limpiar asistencia">🗑️</button>

        <div class="em-rs-att-actions">
          <button class="em-rs-att-btn present ${visualStatus === 'present' ? 'is-active' : ''}" type="button" data-student-id="${escapeAttr(id)}" data-status-option="present">✅ Asistió</button>
          <button class="em-rs-att-btn absent ${visualStatus === 'absent' ? 'is-active' : ''}" type="button" data-student-id="${escapeAttr(id)}" data-status-option="absent">🔴 No asistió</button>
          <button class="em-rs-att-btn excuse ${visualStatus === 'excuse' ? 'is-active' : ''}" type="button" data-student-id="${escapeAttr(id)}" data-status-option="excuse">⚠️ Excusa</button>
        </div>
      </article>
    `;
  }
  function attendanceButtonHTML(studentId, status, current) {
    const info = statusMap[status];
    return `<button class="att-btn att-${status} ${current === status ? 'active' : ''}" data-student-id="${escapeAttr(studentId)}" data-status="${status}" title="${info.label}"><span class="att-emoji">${info.emoji}</span><span class="att-label">${info.label}</span></button>`;
  }
  function classCardHTML(item, index = 0) {
    return `
      <article class="em-class-card" data-class-id="${escapeAttr(item.id)}" role="button" tabindex="0" aria-label="Abrir ${escapeAttr(item.title || 'clase')}">
        <div class="em-class-cover">
          ${emContentShapePairHTML('em-content-shape', index)}
        </div>
        <div class="em-class-body">
          <h3 class="em-class-title">${escapeHTML(item.title || 'Clase sin título')}</h3>
        </div>
      </article>
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
    return '';
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
    emFlatApplyBackgrounds(wrapper);
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
        const registration = await navigator.serviceWorker.register('./sw.js?v=0.24.294', { updateViaCache: 'none' });
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
