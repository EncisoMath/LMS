(() => {
  'use strict';

  const APP_VERSION = '0.25.005';
  const PDFJS_VERSION = '6.1.200';
  const MAX_CLASS_PDF_BYTES = 20 * 1024 * 1024;
  const MAX_CLASS_THUMB_BYTES = 5 * 1024 * 1024;
  let pdfJsModulePromise = null;
  let activePdfViewerCleanup = null;
  let excelJsLoaderPromise = null;
  const QUIZ_SECURITY_ENABLED = false; // v0.24.166: modo seguro de Quizzes desactivado temporalmente
  const DATA_FILES = {
    users: './data/users.json',
    assignments: './data/assignments.json',
    students: './data/students.json',
    classes: './data/classes.json',
    rockstars: './data/rockstars.json',
    quizzes: './data/quizzes.json'
  };

  const LEGACY_DEMO_LESSON_IDS = new Set([
    'bar-charts',
    'frequency-tables',
    'central-tendency',
    'probability-intro',
    'final-project',
    'boxplot',
    'dispersion-measures'
  ]);
  const LEGACY_DEMO_QUIZ_IDS = new Set(['quiz-demo-estadistica-p1']);

  function removeLegacyDemoContent(data = {}) {
    const safe = { ...data };
    const classes = Array.isArray(safe.classes) ? safe.classes : [];
    const quizzesSource = Array.isArray(safe.quizzes)
      ? safe.quizzes
      : (Array.isArray(safe.quizzes?.quizzes) ? safe.quizzes.quizzes : []);
    safe.classes = classes.filter((item) => !LEGACY_DEMO_LESSON_IDS.has(String(item?.id || '')));
    safe.quizzes = quizzesSource.filter((item) => !LEGACY_DEMO_QUIZ_IDS.has(String(item?.id || '')));
    return safe;
  }

  function clearLegacyDemoBrowserState() {
    try {
      const stored = JSON.parse(localStorage.getItem('encisomath:localQuizzes') || '[]');
      if (Array.isArray(stored)) {
        const cleaned = stored.filter((quiz) => !LEGACY_DEMO_QUIZ_IDS.has(String(quiz?.id || '')));
        if (cleaned.length !== stored.length) {
          localStorage.setItem('encisomath:localQuizzes', JSON.stringify(cleaned));
        }
      }
      const activeQuizId = String(localStorage.getItem('encisomath:quizActiveId') || '');
      if (LEGACY_DEMO_QUIZ_IDS.has(activeQuizId)) localStorage.removeItem('encisomath:quizActiveId');
    } catch (_) {}
  }

  const DEFAULT_PREFS = {
    accent: '#1976D2',
    background: '#000000',
    effectsMotion: true,
    effectsMesh: true,
    visualOptimized: true,
    heroAnimations: true,
    tabTransitions: false,
    glassEffects: false,
    quizOptionEffects: true,
    quizFeedbackEffects: true,
    quizSounds: true,
    academicPeriodStarts: { 1: '', 2: '', 3: '', 4: '' },
    gradebookConfigs: {}
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
    data: { users: [], assignments: [], students: [], classes: [], activities: [], activityGrades: [], quizGrades: [], rockstars: [], quizzes: [] },
    user: null,
    assignment: null,
    activePeriod: 1,
    period: 1,
    classViewMode: localStorage.getItem('encisomath:classViewMode') === 'list' ? 'list' : 'grid',
    activityViewMode: localStorage.getItem('encisomath:activityViewMode') === 'list' ? 'list' : 'grid',
    quizViewMode: localStorage.getItem('encisomath:quizViewMode') === 'list' ? 'list' : 'grid',
    rockstarPeriod: 1,
    activitiesPeriod: 1,
    quizPeriod: 1,
    quizActiveId: localStorage.getItem('encisomath:quizActiveId') || '',
    activeActivityId: '',
    activityGradebook: [],
    activityGradeSort: { key: 'lastName', direction: 'asc' },
    notesStudentSort: { key: 'name', direction: 'asc' },
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
    quizStudioContext: null,
    quizStudioDraft: null,
    quizStudioQuestionIndex: 0,
    quizStudioTab: 'data',
    appHistoryReady: false,
    applyingHistoryRoute: false,
    cloud: {
      enabled: false,
      loading: false,
      attendance: {},
      sessionMode: localStorage.getItem('encisomath:cloudSessionMode') || 'persistent',
      lastSyncError: ''
    }
  };

  const PERF_DEFAULTS_111_KEY = 'encisomath:perfDefaults:v0.24.124';
  // v0.24.124: la transición entre pestañas queda desactivada de forma fija;
  // los demás efectos respetan la configuración normal del usuario.
  state.prefs.tabTransitions = false;

  // v0.24.304: restaura de forma explícita las animaciones de los heroes
  // CLASES, ROCKSTARS y QUIZZES. La primera carga de preferencias de Supabase
  // no debe volver a congelarlas con un valor heredado o ausente.
  const HERO_ANIMATIONS_RESTORE_KEY = 'encisomath:heroAnimationsRestored:v0.24.304';
  state.prefs.heroAnimations = true;
  if (!localStorage.getItem(HERO_ANIMATIONS_RESTORE_KEY)) {
    localStorage.setItem('encisomath:prefs', JSON.stringify(state.prefs));
    localStorage.setItem(HERO_ANIMATIONS_RESTORE_KEY, '1');
  }

  // v0.24.306: el proyecto parte sin contenido de demostracion.
  // Se limpian solamente quizzes locales heredados; estudiantes, asistencia
  // y puntos Rockstar permanecen intactos.
  const DEMO_CONTENT_CLEANUP_KEY = 'encisomath:demoContentCleaned:v0.24.306';
  if (!localStorage.getItem(DEMO_CONTENT_CLEANUP_KEY)) {
    localStorage.removeItem('encisomath:localQuizzes');
    localStorage.removeItem('encisomath:quizActiveId');
    state.quizActiveId = '';
    localStorage.setItem(DEMO_CONTENT_CLEANUP_KEY, '1');
  }

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

  const CLOUD_SESSION_MODE_KEY = 'encisomath:cloudSessionMode';
  const CLOUD_SESSION_TAB_KEY = 'encisomath:cloudSessionTab';

  document.addEventListener('DOMContentLoaded', boot);

  function cloudAPI() {
    return window.EncisoSupabase || null;
  }
  function isCloudReady() {
    return Boolean(state.cloud?.enabled && cloudAPI());
  }
  function cloudAttendanceKey(assignmentId, date) {
    return `${assignmentId}|${date}`;
  }
  function reportCloudError(context, error, options = {}) {
    const message = error?.message || String(error || 'Error desconocido');
    state.cloud.lastSyncError = message;
    console.error(`[Supabase] ${context}`, error);
    if (!options.silent) toast(`${context}. Se conservará el cambio visual y podrás reintentar con conexión.`);
  }
  function savePreferencesToCloud() {
    if (!isCloudReady()) return;
    cloudAPI().savePreferences(state.prefs).catch((error) => reportCloudError('No se sincronizaron las preferencias', error, { silent: true }));
  }

  function applyCloudSnapshotToState(cloudData, options = {}) {
    if (!cloudData?.user || !cloudData?.data) return false;
    const cleanCloudData = removeLegacyDemoContent(cloudData.data || {});
    clearLegacyDemoBrowserState();
    state.cloud.enabled = true;
    state.cloud.loading = false;
    state.cloud.attendance = cloudData.attendance || {};
    state.user = cloudData.user;
    state.data = {
      ...state.data,
      ...cleanCloudData,
      users: cleanCloudData.users || [cloudData.user]
    };
    if (cloudData.preferences && typeof cloudData.preferences === 'object') {
      state.prefs = { ...state.prefs, ...cloudData.preferences, heroAnimations: true, tabTransitions: false };
      state.prefs.academicPeriodStarts = normalizeAcademicPeriodStarts(state.prefs.academicPeriodStarts);
      localStorage.setItem('encisomath:prefs', JSON.stringify(state.prefs));
      applyPreferences();
    }
    if (options.initializePeriod !== false) initializeAcademicPeriodState();
    return true;
  }

  function bindOfflineSyncEvents() {
    if (bindOfflineSyncEvents.bound) return;
    bindOfflineSyncEvents.bound = true;
    window.addEventListener('encisomath:sync-complete', (event) => {
      const snapshot = event.detail?.snapshot;
      const summary = event.detail?.summary || {};
      if (!applyCloudSnapshotToState(snapshot, { initializePeriod: false })) return;
      if (state.appRoute?.screen === 'activity') {
        const activity = (state.data.activities || []).find((item) => String(item.id) === String(state.activeActivityId || state.appRoute.activityId || ''));
        if (activity) loadActivityGradebook(activity).catch?.(() => {});
      } else if (state.appRoute?.screen === 'subject') {
        refreshActivePeriodContent(false);
      }
      if (summary.conflicts) toast(`${summary.conflicts} cambio(s) no se aplicaron porque Supabase tenía una versión más reciente.`);
      else if (summary.applied) toast(`${summary.applied} cambio(s) sincronizado(s).`);
    });
    window.addEventListener('offline', () => toast('Sin conexión. Puedes seguir trabajando; los cambios quedarán pendientes.'));
    window.addEventListener('online', () => toast('Conexión recuperada. Sincronizando cambios…'));
    window.addEventListener('encisomath:auth-required', (event) => {
      const now = Date.now();
      if (now - Number(bindOfflineSyncEvents.lastAuthNotice || 0) < 5000) return;
      bindOfflineSyncEvents.lastAuthNotice = now;
      toast(event.detail?.message || 'La sesión venció. El cambio quedó guardado localmente; inicia sesión nuevamente para sincronizar.');
    });
    window.addEventListener('encisomath:request-login', () => {
      renderLogin();
    });
    navigator.serviceWorker?.addEventListener?.('message', (event) => {
      if (event.data?.type === 'ENCISOMATH_SYNC_REQUEST') cloudAPI()?.syncNow?.({ automatic: true }).catch(() => {});
    });
  }
  function normalizeAcademicPeriodStarts(value) {
    const source = value && typeof value === 'object' ? value : {};
    return {
      1: /^\d{4}-\d{2}-\d{2}$/.test(String(source[1] || source.p1 || '')) ? String(source[1] || source.p1) : '',
      2: /^\d{4}-\d{2}-\d{2}$/.test(String(source[2] || source.p2 || '')) ? String(source[2] || source.p2) : '',
      3: /^\d{4}-\d{2}-\d{2}$/.test(String(source[3] || source.p3 || '')) ? String(source[3] || source.p3) : '',
      4: /^\d{4}-\d{2}-\d{2}$/.test(String(source[4] || source.p4 || '')) ? String(source[4] || source.p4) : ''
    };
  }
  function getAcademicPeriodStarts() {
    return normalizeAcademicPeriodStarts(state.prefs.academicPeriodStarts);
  }
  function getAutomaticAcademicPeriod(dateValue = todayISO(), startsValue = getAcademicPeriodStarts()) {
    const starts = normalizeAcademicPeriodStarts(startsValue);
    const today = /^\d{4}-\d{2}-\d{2}$/.test(String(dateValue || '')) ? String(dateValue) : todayISO();
    let current = 1;
    [1, 2, 3, 4].forEach((period) => {
      if (starts[period] && today >= starts[period]) current = period;
    });
    return current;
  }
  function syncAcademicPeriodState(period) {
    const safe = [1, 2, 3, 4].includes(Number(period)) ? Number(period) : 1;
    state.activePeriod = safe;
    state.period = safe;
    state.rockstarPeriod = safe;
    state.activitiesPeriod = safe;
    state.quizPeriod = safe;
    const selector = document.getElementById('globalPeriodSelect');
    if (selector) selector.value = String(safe);
    return safe;
  }
  function initializeAcademicPeriodState() {
    return syncAcademicPeriodState(getAutomaticAcademicPeriod());
  }
  function refreshActivePeriodContent(animate = true) {
    const tab = state.activeSubjectTab;
    if (tab === 'classes') updateClassGrid(animate);
    else if (tab === 'activities') {
      const content = document.getElementById('activitiesPeriodContent');
      if (content) {
        content.innerHTML = activitiesPeriodHTML();
        bindActivityCards();
        if (animate) pulseElement(content, 'class-grid-update');
      }
    } else if (tab === 'notes') renderNotesTab({ animate });
    else if (tab === 'rockstars') refreshRockstarList(animate);
    else if (tab === 'quizzes') {
      state.quizQuestionIndex = 0;
      state.quizActiveId = '';
      refreshQuizLibrary(animate);
    }
  }
  function setGlobalAcademicPeriod(period, options = {}) {
    const safe = [1, 2, 3, 4].includes(Number(period)) ? Number(period) : 1;
    const changed = Number(state.activePeriod) !== safe;
    syncAcademicPeriodState(safe);
    if (changed && options.refresh !== false) refreshActivePeriodContent(options.animate !== false);
  }
  function academicPeriodSelectorHTML() {
    return `
      <label class="em-topbar-period-select" for="globalPeriodSelect" title="Seleccionar periodo">
        <span aria-hidden="true">▾</span>
        <select id="globalPeriodSelect" aria-label="Seleccionar periodo académico">
          ${[1, 2, 3, 4].map((period) => `<option value="${period}" ${Number(state.activePeriod) === period ? 'selected' : ''}>Periodo ${period}</option>`).join('')}
        </select>
      </label>
    `;
  }
  function formatAcademicDate(value) {
    if (!value) return 'Sin configurar';
    const [year, month, day] = String(value).split('-').map(Number);
    const date = new Date(year, (month || 1) - 1, day || 1);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  function validateAcademicPeriodStarts(starts) {
    const values = [1, 2, 3, 4].map((period) => starts[period]);
    if (values.some((value) => !value)) return 'Debes establecer la fecha de inicio de los cuatro periodos.';
    for (let index = 1; index < values.length; index += 1) {
      if (values[index] <= values[index - 1]) return `El periodo ${index + 1} debe comenzar después del periodo ${index}.`;
    }
    return '';
  }
  function openAcademicPeriodsModal() {
    const starts = getAcademicPeriodStarts();
    const autoPeriod = getAutomaticAcademicPeriod(todayISO(), starts);
    openModal(`
      <section class="modal-card em-period-settings-modal" role="dialog" aria-modal="true" aria-labelledby="periodSettingsTitle">
        <button class="modal-close" data-close-modal aria-label="Cerrar">×</button>
        <div class="em-period-settings-heading">
          <span class="em-period-settings-gear" aria-hidden="true">⚙</span>
          <div>
            <p class="section-kicker">Calendario académico</p>
            <h2 id="periodSettingsTitle">Inicio de periodos</h2>
            <p>EncisoMath seleccionará automáticamente el periodo vigente según la fecha del dispositivo.</p>
          </div>
        </div>
        <div class="em-period-settings-grid">
          ${[1, 2, 3, 4].map((period) => `
            <label class="em-period-date-field">
              <span><strong>Periodo ${period}</strong><small>Fecha de inicio</small></span>
              <input type="date" data-academic-period-start="${period}" value="${escapeAttr(starts[period])}" />
            </label>
          `).join('')}
        </div>
        <div class="em-period-auto-preview" id="academicPeriodPreview">
          <strong>Periodo automático actual: ${autoPeriod}</strong>
          <span>${starts[autoPeriod] ? `Comenzó el ${escapeHTML(formatAcademicDate(starts[autoPeriod]))}.` : 'Configura las cuatro fechas para activar el calendario automático.'}</span>
        </div>
        <p class="em-period-settings-error" id="academicPeriodError" role="alert"></p>
        <div class="em-period-settings-actions">
          <button class="ghost-btn" type="button" data-close-modal>Cancelar</button>
          <button class="primary-btn" type="button" id="saveAcademicPeriodsBtn">Guardar fechas</button>
        </div>
      </section>
    `, () => {
      const inputs = [...document.querySelectorAll('[data-academic-period-start]')];
      const readStarts = () => normalizeAcademicPeriodStarts(Object.fromEntries(inputs.map((input) => [input.dataset.academicPeriodStart, input.value])));
      const updatePreview = () => {
        const draft = readStarts();
        const period = getAutomaticAcademicPeriod(todayISO(), draft);
        const preview = document.getElementById('academicPeriodPreview');
        if (!preview) return;
        const complete = [1, 2, 3, 4].every((item) => Boolean(draft[item]));
        preview.innerHTML = `<strong>Periodo automático actual: ${period}</strong><span>${complete ? `Según la fecha de hoy (${escapeHTML(formatAcademicDate(todayISO()))}).` : 'Completa las cuatro fechas para activar el calendario automático.'}</span>`;
      };
      inputs.forEach((input) => input.addEventListener('change', updatePreview));
      document.getElementById('saveAcademicPeriodsBtn')?.addEventListener('click', () => {
        const draft = readStarts();
        const error = validateAcademicPeriodStarts(draft);
        const errorBox = document.getElementById('academicPeriodError');
        if (error) {
          if (errorBox) errorBox.textContent = error;
          return;
        }
        state.prefs.academicPeriodStarts = draft;
        localStorage.setItem('encisomath:prefs', JSON.stringify(state.prefs));
        savePreferencesToCloud();
        setGlobalAcademicPeriod(getAutomaticAcademicPeriod(todayISO(), draft), { refresh: true, animate: true });
        closeModal();
        toast(`Calendario guardado. Periodo actual: ${state.activePeriod}.`);
      });
    });
  }
  function authErrorMessage(error) {
    const raw = String(error?.message || '').toLowerCase();
    if (raw.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.';
    if (raw.includes('email not confirmed')) return 'El correo todavía no está confirmado en Supabase.';
    if (raw.includes('failed to fetch') || raw.includes('network')) return 'No hay conexión con Supabase. Revisa internet e inténtalo otra vez.';
    return error?.message || 'No se pudo iniciar sesión.';
  }
  async function enterCloudSession(activeSession) {
    if (!activeSession?.user?.id) return false;
    state.cloud.loading = true;
    mount(renderLoadingHTML('Sincronizando EncisoMath con Supabase...'), null, { instant: true });
    try {
      const cloudData = await cloudAPI().loadApplicationData();
      applyCloudSnapshotToState(cloudData, { initializePeriod: true });
      localStorage.setItem('encisomath:lastUser', JSON.stringify({
        id: cloudData.user.email || cloudData.user.id,
        email: cloudData.user.email || '',
        name: cloudData.user.fullName
      }));
      if (cloudData.user.role === 'teacher' || cloudData.user.role === 'admin') renderTeacherHome();
      else renderStudentPlaceholder();
      return true;
    } catch (error) {
      state.cloud.loading = false;
      state.cloud.enabled = false;
      console.error(error);
      mount(`<main class="screen mobile-pad"><h1>No se pudo sincronizar EncisoMath</h1><p class="card-sub">${escapeHTML(error?.message || 'Supabase rechazó la consulta.')}</p><button class="primary-btn" id="retryCloudBtn">Reintentar</button><button class="ghost-btn" id="logoutCloudBtn">Cerrar sesión</button></main>`, () => {
        document.getElementById('retryCloudBtn')?.addEventListener('click', () => enterCloudSession(activeSession));
        document.getElementById('logoutCloudBtn')?.addEventListener('click', logout);
      }, { instant: true });
      return false;
    }
  }

  async function boot() {
    applyPreferences();
    applyQuizFeedbackTune();
    registerServiceWorker();
    bindQuizSecurityGuards();
    bindAppBackNavigation();
    bindOfflineSyncEvents();
    mount(renderLoadingHTML('Preparando EncisoMath...'), null, { instant: true });
    try {
      state.data = await loadAllData();
      if (!cloudAPI()?.isConfigured?.()) throw new Error('Supabase no está configurado.');
      cloudAPI().init();

      let activeSession = await cloudAPI().getSession();
      const sessionMode = localStorage.getItem(CLOUD_SESSION_MODE_KEY) || 'persistent';
      const tabSessionAlive = sessionStorage.getItem(CLOUD_SESSION_TAB_KEY) === '1';
      if (activeSession && sessionMode === 'session' && !tabSessionAlive && navigator.onLine !== false) {
        await cloudAPI().signOut();
        activeSession = null;
      }
      if (activeSession) {
        sessionStorage.setItem(CLOUD_SESSION_TAB_KEY, '1');
        await enterCloudSession(activeSession);
        return;
      }
      renderLogin();
    } catch (error) {
      console.error(error);
      mount(`<main class="screen mobile-pad"><h1>No se pudo cargar EncisoMath</h1><p class="card-sub">${escapeHTML(error?.message || 'Revisa la configuración de Supabase y los archivos del proyecto.')}</p><button class="primary-btn" onclick="location.reload()">Reintentar</button></main>`);
    }
  }

  async function loadAllData() {
    const entries = await Promise.all(Object.entries(DATA_FILES).map(async ([key, url]) => {
      const response = await fetch(url, { cache: navigator.onLine === false ? 'force-cache' : 'default' });
      if (!response.ok) throw new Error(`No se pudo cargar ${url}`);
      return [key, await response.json()];
    }));
    return Object.fromEntries(entries);
  }
  function mount(markup, afterRender = null, options = {}) {
    const optimizedRoute = prefEnabled('visualOptimized') || !prefEnabled('effectsMotion') || !prefEnabled('tabTransitions');
    const paint = () => {
      $app.innerHTML = markup;
      initEncisoAnimatedLogos($app);
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
    if (screen === 'activity') {
      return {
        screen: 'activity',
        assignmentId: String(route.assignmentId || state.assignment?.id || ''),
        activityId: String(route.activityId || '')
      };
    }
    if (['login', 'home', 'student'].includes(screen)) return { screen };
    return null;
  }
  function normalizeSubjectTab(tab) {
    const value = String(tab || 'students');
    return ['students', 'classes', 'activities', 'notes', 'rockstars', 'quizzes'].includes(value) ? value : 'students';
  }
  function subjectTabDisplayLabel(tab) {
    return {
      students: '👥 Estudiantes',
      classes: '📚 Clases',
      activities: '📝 Actividades',
      notes: '📊 Notas',
      rockstars: '🚀 Rockstars',
      quizzes: '🎮 Quizzes'
    }[normalizeSubjectTab(tab)] || '👥 Estudiantes';
  }
  function appRouteKey(route) {
    const normalized = normalizeAppRoute(route);
    if (!normalized) return '';
    if (normalized.screen === 'subject') return `subject:${normalized.assignmentId}:${normalized.tab}`;
    if (normalized.screen === 'lesson') return `lesson:${normalized.assignmentId}:${normalized.lessonId}`;
    if (normalized.screen === 'activity') return `activity:${normalized.assignmentId}:${normalized.activityId}`;
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


    if (normalized.screen === 'activity') {
      const assignment = state.data.assignments.find((item) => item.id === normalized.assignmentId);
      const activity = state.data.activities.find((item) => item.id === normalized.activityId);
      if (!assignment || !activity) {
        renderTeacherHome({ noHistory: true });
        return;
      }
      state.assignment = assignment;
      renderActivityDetail(activity, { noHistory: true });
    }
  }
  function encisoAnimatedLogoHTML(variant = 'default') {
    const safeVariant = String(variant || 'default').replace(/[^a-z0-9_-]/gi, '').toLowerCase() || 'default';
    return `
      <div class="em-enciso-logo-scene em-enciso-logo-scene-${escapeAttr(safeVariant)}" data-em-animated-logo aria-label="Logo animado de EncisoMaths">
        <div class="em-enciso-logo-hex-cluster" aria-hidden="true">
          <span class="em-enciso-logo-hex is-red"></span>
          <span class="em-enciso-logo-hex is-blue"></span>
          <span class="em-enciso-logo-hex is-green"></span>
          <span class="em-enciso-logo-hex is-yellow"></span>
        </div>
        <div class="em-enciso-logo-brand">
          <div class="em-enciso-logo-brand-name">EncisoMaths</div>
          <div class="em-enciso-logo-tagline">Matematicas para dummies</div>
        </div>
      </div>
    `;
  }

  function initEncisoAnimatedLogos(root = document) {
    root.querySelectorAll?.('[data-em-animated-logo]:not([data-em-logo-ready])').forEach((logoScene) => {
      logoScene.dataset.emLogoReady = 'true';
      const hexagons = [...logoScene.querySelectorAll('.em-enciso-logo-hex')];
      const brandName = logoScene.querySelector('.em-enciso-logo-brand-name');
      if (hexagons.length !== 4 || !brandName) return;

      const slots = [
        { left: 'var(--em-logo-dx)', top: '0px' },
        { left: '0px', top: 'var(--em-logo-dy)' },
        { left: 'var(--em-logo-dx)', top: 'var(--em-logo-stack)' },
        { left: '0px', top: 'calc(var(--em-logo-dy) + var(--em-logo-stack))' }
      ];
      const currentSlots = [0, 1, 2, 3];
      const timers = [];

      const setHexToSlot = (hexagon, slotIndex) => {
        hexagon.style.setProperty('--em-logo-left', slots[slotIndex].left);
        hexagon.style.setProperty('--em-logo-top', slots[slotIndex].top);
      };
      const positionAll = () => hexagons.forEach((hexagon, index) => setHexToSlot(hexagon, currentSlots[index]));
      const isDetached = () => !logoScene.isConnected;
      const pickTwoDifferentHexagons = () => {
        const first = Math.floor(Math.random() * hexagons.length);
        let second = first;
        while (second === first) second = Math.floor(Math.random() * hexagons.length);
        return [first, second];
      };
      const swapOnlyTwoHexagons = () => {
        if (isDetached()) return;
        const [first, second] = pickTwoDifferentHexagons();
        [currentSlots[first], currentSlots[second]] = [currentSlots[second], currentSlots[first]];
        setHexToSlot(hexagons[first], currentSlots[first]);
        setHexToSlot(hexagons[second], currentSlots[second]);
        [first, second].forEach((index) => {
          const hexagon = hexagons[index];
          hexagon.classList.remove('is-swapping');
          void hexagon.offsetWidth;
          hexagon.classList.add('is-swapping');
        });
      };
      const playJellyFromE = () => {
        if (isDetached()) return;
        brandName.classList.remove('is-jelly');
        void brandName.offsetWidth;
        brandName.classList.add('is-jelly');
      };
      const addGuardedInterval = (callback, delay) => {
        const timer = window.setInterval(() => {
          if (isDetached()) {
            window.clearInterval(timer);
            return;
          }
          callback();
        }, delay);
        timers.push(timer);
      };

      brandName.addEventListener('animationend', () => brandName.classList.remove('is-jelly'));
      hexagons.forEach((hexagon) => hexagon.addEventListener('animationend', () => hexagon.classList.remove('is-swapping')));
      logoScene.addEventListener('click', () => {
        swapOnlyTwoHexagons();
        playJellyFromE();
      });

      positionAll();
      timers.push(window.setTimeout(() => { if (!isDetached()) swapOnlyTwoHexagons(); }, 900));
      timers.push(window.setTimeout(() => { if (!isDetached()) playJellyFromE(); }, 550));
      addGuardedInterval(swapOnlyTwoHexagons, 2800);
      addGuardedInterval(playJellyFromE, 5000);
    });
  }

  function renderLogin(options = {}) {
    commitAppRoute({ screen: 'login' }, options);
    const last = readJSON('encisomath:lastUser');
    const markup = `
      <main class="login-screen">
        ${animatedShapes('login')}
        <section class="login-card">
          <div class="logo-wrap em-login-logo-wrap" aria-label="EncisoMaths">
            ${encisoAnimatedLogoHTML('login')}
          </div>

          <form id="loginForm" class="login-form">
            <label class="field-label" for="userEmail">Correo electrónico</label>
            <input class="input" id="userEmail" name="email" type="email" inputmode="email" autocomplete="username" value="${escapeAttr(last?.email || last?.id || '')}" placeholder="enciso.math@gmail.com" required />
            <label class="field-label" for="userPassword">Contraseña</label>
            <input class="input" id="userPassword" name="password" type="password" autocomplete="current-password" placeholder="Tu contraseña de Supabase" required />
            <div class="remember-row">
              <label><input type="checkbox" id="remember" checked /> Mantener sesión iniciada</label>
            </div>
            <button class="primary-btn full" id="loginSubmitBtn" type="submit">Iniciar sesión</button>
            <div class="last-user">
              <span>Último usuario</span>
              <button type="button" class="mini-btn" id="lastUserBtn">${last ? `${escapeHTML(last.name || '')} · ${escapeHTML(last.email || last.id || '')}` : 'Sin registro'}</button>
            </div>
            <p class="login-hint">Acceso protegido con Supabase Auth. Los registros se guardan en la nube según el rol del usuario.</p>
          </form>
        </section>
      </main>
    `;

    mount(markup, () => {
      const emailInput = document.getElementById('userEmail');
      const passwordInput = document.getElementById('userPassword');
      const submitButton = document.getElementById('loginSubmitBtn');
      document.getElementById('lastUserBtn').addEventListener('click', () => {
        if (last?.email || last?.id) emailInput.value = last.email || last.id;
        passwordInput.focus();
      });

      document.getElementById('loginForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = emailInput.value.trim().toLowerCase();
        const password = passwordInput.value;
        const remember = document.getElementById('remember').checked;
        if (!email || !password) return;
        submitButton.disabled = true;
        submitButton.textContent = 'Conectando...';
        try {
          const activeSession = await cloudAPI().signIn(email, password);
          localStorage.setItem(CLOUD_SESSION_MODE_KEY, remember ? 'persistent' : 'session');
          sessionStorage.setItem(CLOUD_SESSION_TAB_KEY, '1');
          await enterCloudSession(activeSession);
        } catch (error) {
          toast(authErrorMessage(error));
          passwordInput.select();
        } finally {
          submitButton.disabled = false;
          submitButton.textContent = 'Iniciar sesión';
        }
      });
    });
  }
  function renderLoadingHTML(text = randomPhrase()) {
    return `
      <main class="loading-screen em-brand-loading-screen">
        <section class="loader-card em-brand-loading-card">
          ${encisoAnimatedLogoHTML('loading')}
          <div class="em-app-loader-progress em-pdf-loader-track" aria-hidden="true">
            <span class="em-pdf-loader-bar"></span>
          </div>
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
              <button class="round-action em-period-settings-button" id="periodSettingsBtn" type="button" aria-label="Configurar fechas de periodos" title="Configurar periodos">⚙</button>
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
      document.getElementById('periodSettingsBtn')?.addEventListener('click', openAcademicPeriodsModal);
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
    cleanupActivePdfViewer();
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
          ${academicPeriodSelectorHTML()}
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
        <div class="em-subject-workspace">
          <nav class="em-subject-section-picker" aria-label="Sección de la asignatura">
            <label class="em-subject-section-select-wrap" for="subjectSectionSelect">
              <span class="em-subject-section-label">Sección</span>
              <span class="em-subject-section-current" id="subjectSectionCurrent">${escapeHTML(subjectTabDisplayLabel(tab))}</span>
              <select class="em-subject-section-select" id="subjectSectionSelect" aria-label="Seleccionar sección">
                <option value="students" ${tab === 'students' ? 'selected' : ''}>👥 Estudiantes</option>
                <option value="classes" ${tab === 'classes' ? 'selected' : ''}>📚 Clases</option>
                <option value="activities" ${tab === 'activities' ? 'selected' : ''}>📝 Actividades</option>
                <option value="notes" ${tab === 'notes' ? 'selected' : ''}>📊 Notas</option>
                <option value="rockstars" ${tab === 'rockstars' ? 'selected' : ''}>🚀 Rockstars</option>
                <option value="quizzes" ${tab === 'quizzes' ? 'selected' : ''}>🎮 Quizzes</option>
              </select>
              <span class="em-subject-section-chevron" aria-hidden="true">⌄</span>
            </label>
          </nav>
          <section id="tabContent" class="section tab-section"></section>
        </div>
      </main>
    `;

    mount(markup, () => {
      document.getElementById('backBtn').addEventListener('click', renderTeacherHome);
      document.getElementById('globalPeriodSelect')?.addEventListener('change', (event) => setGlobalAcademicPeriod(Number(event.target.value), { refresh: true, animate: true }));
      const subjectSectionSelect = document.getElementById('subjectSectionSelect');
      subjectSectionSelect?.addEventListener('change', (event) => {
        const nextTab = normalizeSubjectTab(event.target.value);
        const currentLabel = document.getElementById('subjectSectionCurrent');
        if (currentLabel) currentLabel.textContent = subjectTabDisplayLabel(nextTab);
        setSubjectTab(nextTab);
      });
      emInitSubjectToolbar(document);
      applySubjectInfoTune();
      setActiveSubjectTabMeta(tab);
      if (tab === 'students') renderStudentsTab({ animate: true });
      else if (tab === 'activities') renderActivitiesTab({ animate: true });
      else if (tab === 'notes') renderNotesTab({ animate: true });
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
    const sectionSelect = document.getElementById('subjectSectionSelect');
    if (sectionSelect && sectionSelect.value !== tab) sectionSelect.value = tab;
    const sectionCurrent = document.getElementById('subjectSectionCurrent');
    if (sectionCurrent) sectionCurrent.textContent = subjectTabDisplayLabel(tab);
    commitAppRoute({ screen: 'subject', assignmentId: state.assignment?.id || '', tab }, options);
    if (tab === 'students') renderStudentsTab({ animate: true });
    else if (tab === 'activities') renderActivitiesTab({ animate: true });
    else if (tab === 'notes') renderNotesTab({ animate: true });
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
        <p class="card-sub">Se matriculará en Supabase dentro del grupo ${escapeHTML(assignment.grade)}-${escapeHTML(assignment.course)}, sede ${escapeHTML(assignment.sede)}.</p>
        <form id="newStudentModalForm" class="add-student-form">
          <label class="field-label" for="studentCode">Código / matrícula</label>
          <input class="input" id="studentCode" inputmode="numeric" autocomplete="off" placeholder="Ejemplo: 9868" required />
          <label class="field-label" for="studentFirstName">Nombre</label>
          <input class="input" id="studentFirstName" autocomplete="off" placeholder="Ejemplo: Carlos Junior" required />
          <label class="field-label" for="studentLastName">Apellido</label>
          <input class="input" id="studentLastName" autocomplete="off" placeholder="Ejemplo: Acosta López" required />
          <button class="primary-btn full" id="addStudentSubmitBtn" type="submit">Añadir estudiante</button>
        </form>
      </div>
    `, () => {
      const code = document.getElementById('studentCode');
      code.focus();
      document.getElementById('newStudentModalForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        const studentCode = code.value.trim();
        const firstName = document.getElementById('studentFirstName').value.trim();
        const lastName = document.getElementById('studentLastName').value.trim();
        const submit = document.getElementById('addStudentSubmitBtn');
        if (!studentCode || !firstName || !lastName) return;
        submit.disabled = true;
        submit.textContent = 'Guardando...';
        try {
          await addNewStudent(studentCode, firstName, lastName);
        } finally {
          if (document.body.contains(submit)) {
            submit.disabled = false;
            submit.textContent = 'Añadir estudiante';
          }
        }
      });
    });
  }
  async function addNewStudent(studentCode, firstName, lastName) {
    const assignment = state.assignment;
    const fullName = `${lastName}, ${firstName}`.replace(/\s+/g, ' ').trim();
    if (!isCloudReady()) {
      toast('Necesitas una sesión de Supabase para añadir estudiantes.');
      return;
    }
    if (state.data.students.some((student) => student.id === studentCode && student.groupId === assignment.groupId)) {
      toast(`El código ${studentCode} ya está matriculado en este curso.`);
      return;
    }
    try {
      const student = await cloudAPI().createStudentAndEnroll({
        studentCode,
        firstName,
        lastName,
        groupId: assignment.groupId
      });
      state.data.students.push(student);
      closeModal();
      toast(`Añadiste a ${fullName}. Registro guardado en Supabase.`);
      state.studentSearch = '';
      renderStudentsTab({ animate: false });
    } catch (error) {
      reportCloudError('No se pudo añadir el estudiante', error);
    }
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
            <h2>PASARÁS ESTE ESTUDIANTE A INACTIVO</h2>
            <p>Dejará de aparecer en el curso, pero conservará intacto su historial académico.</p>
          </div>
          <button class="modal-close danger-close" data-close-modal aria-label="Cerrar">×</button>
        </div>
        <div class="danger-body">
          <div class="delete-target">
            <strong>${escapeHTML(student.fullName)}</strong>
            <span>ID ${escapeHTML(student.id)} · ${escapeHTML(assignment.sede)} · ${escapeHTML(assignment.grade)}° ${escapeHTML(assignment.course)}</span>
          </div>
          <div class="danger-actions">
            <button class="danger-confirm" id="confirmDeleteStudent">Sí, pasar a inactivo</button>
            <button class="ghost-btn" data-close-modal>Cancelar</button>
          </div>
        </div>
      </div>
    `, () => {
      const confirmButton = document.getElementById('confirmDeleteStudent');
      confirmButton.addEventListener('click', async () => {
        if (confirmButton.disabled) return;
        confirmButton.disabled = true;
        confirmButton.textContent = 'Guardando...';
        await deleteStudent(student);
        if (document.body.contains(confirmButton)) {
          confirmButton.disabled = false;
          confirmButton.textContent = 'Sí, pasar a inactivo';
        }
      });
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
  async function deleteStudent(student) {
    const assignment = state.assignment;
    if (!isCloudReady()) {
      toast('Necesitas una sesión de Supabase para retirar estudiantes.');
      return;
    }
    try {
      await cloudAPI().withdrawStudent({ groupId: assignment.groupId, studentCode: student.id });
      state.data.students = state.data.students.filter((item) => !(item.id === student.id && item.groupId === assignment.groupId));
      const key = cloudAttendanceKey(assignment.id, state.attendanceDate);
      if (state.cloud.attendance[key]) delete state.cloud.attendance[key][student.id];
      closeModal();
      toast(`${student.fullName} quedó inactivo en este curso.`);
      renderStudentsTab({ animate: false });
    } catch (error) {
      reportCloudError('No se pudo retirar el estudiante', error);
    }
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
      <div id="rockstarList" class="student-list rockstar-list em-rs-list">
        ${rockstarListHTML()}
      </div>
    `;

    bindRockstarTabEvents();
    emRsInitRockstarsHero($content);
    emPlayTabEntrance($content, 'rockstars');
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
  function refreshRockstarList(animate = false) {
    const list = document.getElementById('rockstarList');
    if (!list) return;
    list.innerHTML = rockstarListHTML();
    applyRockstarScoreTune();
    bindRockstarActionButtons();
    if (animate) {
      pulseElement(list, 'class-grid-update');
      emPlayTabEntrance(document.getElementById('tabContent') || list, 'rockstars');
    }
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
    const event = {
      id: `rs-pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      assignmentId: assignment.id,
      studentId,
      period: Number(state.rockstarPeriod),
      date: todayISO(),
      occurredAt: new Date().toISOString(),
      delta: Number(delta)
    };

    if (isCloudReady()) {
      if (!Array.isArray(state.data.rockstars)) state.data.rockstars = [];
      state.data.rockstars.push(event);
      updateRockstarCard(studentId, Number(delta), oldTier);
      cloudAPI().addRockstarEvent(event).then((saved) => {
        event.id = saved?.id || event.id;
        event.occurredAt = saved?.occurred_at || event.occurredAt;
        if (String(saved?.id || '').startsWith('offline-')) {
          toast('Punto Rockstar guardado localmente. Se sincronizará automáticamente.');
        }
      }).catch((error) => {
        // El motor offline intenta encolar antes de llegar aqui. Si aun asi se
        // produce un fallo no recuperable, se conserva el cambio visual para
        // que el docente no pierda el punto mientras revisa el centro de sync.
        reportCloudError('No se sincronizó el punto Rockstar', error);
      });
      return true;
    }

    const events = getLocalRockstarEvents(assignment.id);
    events.push(event);
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
  const EM_QUIZ_CARD_CLEAN_COLORS = ['#1368ce', '#ff7a00', '#24b49a', '#54c600', '#EBB513', '#e21b3c'];
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
  const NOTES_COLUMN_COLORS = [
    '#e21b3c', '#1368ce', '#24b49a', '#EBB513', '#ff7a00',
    '#a855f7', '#06b6d4', '#ec4899', '#54c600', '#6366f1'
  ];

  function notesConfigKey(assignmentId = state.assignment?.id || '', period = state.activePeriod) {
    return `${String(assignmentId || '')}|period-${Number(period || 1)}`;
  }

  function getNotesConfigStore() {
    if (!state.prefs.gradebookConfigs || typeof state.prefs.gradebookConfigs !== 'object' || Array.isArray(state.prefs.gradebookConfigs)) {
      state.prefs.gradebookConfigs = {};
    }
    return state.prefs.gradebookConfigs;
  }

  function notesDefaultWeights(count) {
    const total = Math.max(1, Number(count || 0));
    const base = Math.floor(100 / total);
    const remainder = 100 - base * total;
    return Array.from({ length: total }, (_, index) => base + (index < remainder ? 1 : 0));
  }

  function getNotesActivities() {
    return getActivitiesForCurrentAssignment()
      .filter((activity) => Number(activity.period || 1) === Number(state.activePeriod || 1))
      .sort((a, b) => {
        const aOrder = Number(a.sortOrder || 0);
        const bOrder = Number(b.sortOrder || 0);
        if (aOrder !== bOrder) return aOrder - bOrder;
        const aDate = String(a.startsAt || a.createdAt || '');
        const bDate = String(b.startsAt || b.createdAt || '');
        if (aDate !== bDate) return aDate.localeCompare(bDate);
        return String(a.title || '').localeCompare(String(b.title || ''), 'es');
      });
  }

  function getNotesQuizzes() {
    const assignment = state.assignment;
    if (!assignment) return [];
    return getBaseQuizzes()
      .filter((quiz) => {
        if (Number(quiz.period || 1) !== Number(state.activePeriod || 1)) return false;
        const ids = Array.isArray(quiz.assignmentIds) ? quiz.assignmentIds : [];
        if (ids.length) return ids.includes('*') || ids.includes(assignment.id);
        if (quiz.subject && quiz.subject === assignment.subject) return true;
        if (quiz.area && quiz.area === assignment.area) return true;
        return !ids.length && !quiz.subject && !quiz.area;
      })
      .sort((a, b) => {
        const aDate = String(a.availableFrom || a.createdAt || a.openAt || '');
        const bDate = String(b.availableFrom || b.createdAt || b.openAt || '');
        if (aDate !== bDate) return aDate.localeCompare(bDate);
        return String(a.title || '').localeCompare(String(b.title || ''), 'es');
      });
  }

  function notesColumnDefinitions() {
    const assignmentId = String(state.assignment?.id || '');
    const period = Number(state.activePeriod || 1);
    const activities = getNotesActivities();
    const quizzes = getNotesQuizzes();
    const baseColumns = [
      ...activities.map((activity, index) => ({
        key: `activity:${activity.id}`,
        type: 'activity',
        activityId: activity.id,
        title: activity.title || `Actividad ${index + 1}`,
        defaultCode: `A${index + 1}`,
        defaultColor: NOTES_COLUMN_COLORS[index % NOTES_COLUMN_COLORS.length]
      })),
      ...quizzes.map((quiz, index) => ({
        key: `quiz:${quiz.id}`,
        type: 'quiz',
        quizId: quiz.id,
        title: quiz.title || `Quiz ${index + 1}`,
        defaultCode: `Q${index + 1}`,
        defaultColor: NOTES_COLUMN_COLORS[(activities.length + index) % NOTES_COLUMN_COLORS.length]
      })),
      {
        key: 'attendance',
        type: 'attendance',
        title: 'Asistencia',
        defaultCode: 'ASI',
        defaultColor: '#24b49a'
      },
      {
        key: 'rockstars',
        type: 'rockstars',
        title: 'Rockstars',
        defaultCode: 'RKS',
        defaultColor: '#EBB513'
      }
    ];
    const defaults = notesDefaultWeights(baseColumns.length);
    const root = getNotesConfigStore()[notesConfigKey(assignmentId, period)] || {};
    const savedColumns = root.columns && typeof root.columns === 'object' ? root.columns : {};
    const hasSavedColumns = Object.keys(savedColumns).length > 0;
    return baseColumns.map((column, index) => {
      const saved = savedColumns[column.key] && typeof savedColumns[column.key] === 'object' ? savedColumns[column.key] : {};
      const hasSavedWeight = Object.prototype.hasOwnProperty.call(saved, 'weight');
      const savedWeight = Number(saved.weight);
      return {
        ...column,
        code: String(saved.code || column.defaultCode).trim().toUpperCase().slice(0, 8),
        color: /^#[0-9a-f]{6}$/i.test(String(saved.color || '')) ? saved.color : column.defaultColor,
        weight: hasSavedWeight && Number.isFinite(savedWeight) ? Math.max(0, Math.min(100, savedWeight)) : (hasSavedColumns ? 0 : defaults[index]),
        target: column.type === 'rockstars' ? Math.max(1, Number(saved.target || 15)) : null
      };
    });
  }

  function saveNotesColumnConfig(columnKey, values) {
    const assignmentId = String(state.assignment?.id || '');
    const period = Number(state.activePeriod || 1);
    const key = notesConfigKey(assignmentId, period);
    const store = getNotesConfigStore();
    const current = store[key] && typeof store[key] === 'object' ? store[key] : {};
    const definitions = notesColumnDefinitions();
    const columns = Object.fromEntries(definitions.map((column) => [column.key, {
      code: column.code,
      color: column.color,
      weight: Number(column.weight || 0),
      ...(column.type === 'rockstars' ? { target: Number(column.target || 15) } : {})
    }]));
    columns[columnKey] = { ...(columns[columnKey] || {}), ...values };
    store[key] = { ...current, columns, updatedAt: new Date().toISOString() };
    localStorage.setItem('encisomath:prefs', JSON.stringify(state.prefs));
    savePreferencesToCloud();
  }

  function notesStudentNameParts(student) {
    const code = String(student?.id || student?.studentCode || '').trim();
    let lastName = String(student?.lastName || '').trim();
    let firstName = String(student?.firstName || '').trim();
    const fullName = String(student?.fullName || '').trim();
    if ((!lastName || !firstName) && fullName) {
      if (fullName.includes(',')) {
        const [last, ...first] = fullName.split(',');
        lastName = lastName || String(last || '').trim();
        firstName = firstName || first.join(',').trim();
      } else {
        const parts = fullName.split(/\s+/).filter(Boolean);
        if (!firstName && parts.length) firstName = parts.slice(0, Math.max(1, Math.ceil(parts.length / 2))).join(' ');
        if (!lastName && parts.length > 1) lastName = parts.slice(Math.max(1, Math.ceil(parts.length / 2))).join(' ');
      }
    }
    return {
      code,
      lastName: lastName || fullName || code,
      firstName: firstName || ''
    };
  }

  function notesStudentColumnWidth(students = []) {
    let measured = 0;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    (students || []).forEach((student) => {
      const name = notesStudentNameParts(student);
      if (context) {
        context.font = '700 12px Montserrat, Arial, sans-serif';
        measured = Math.max(measured, context.measureText(name.lastName || '').width);
        context.font = '500 10px Montserrat, Arial, sans-serif';
        measured = Math.max(measured, context.measureText(name.firstName || '').width);
        context.font = '600 8px Montserrat, Arial, sans-serif';
        measured = Math.max(measured, context.measureText(name.code || '').width);
      } else {
        measured = Math.max(measured, String(name.lastName || '').length * 7, String(name.firstName || '').length * 5.8);
      }
    });
    return Math.round(Math.max(118, Math.min(184, measured + 28)));
  }

  function notesAttendanceSessions(assignmentId, period) {
    const sessions = [];
    const safeAssignmentId = String(assignmentId || '');
    const safePeriod = Number(period || 1);
    if (isCloudReady()) {
      Object.entries(state.cloud.attendance || {}).forEach(([key, attendance]) => {
        const separator = key.indexOf('|');
        if (separator < 0 || key.slice(0, separator) !== safeAssignmentId) return;
        const date = key.slice(separator + 1);
        if (getAutomaticAcademicPeriod(date) !== safePeriod) return;
        const values = attendance && typeof attendance === 'object' ? Object.values(attendance) : [];
        if (!values.some(Boolean)) return;
        sessions.push({ date, attendance: { ...(attendance || {}) } });
      });
    } else {
      const prefix = `encisomath:attendance:${safeAssignmentId}:`;
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index) || '';
        if (!key.startsWith(prefix)) continue;
        const date = key.slice(prefix.length);
        if (getAutomaticAcademicPeriod(date) !== safePeriod) continue;
        const attendance = readJSON(key) || {};
        if (!Object.values(attendance).some(Boolean)) continue;
        sessions.push({ date, attendance });
      }
    }
    return sessions.sort((a, b) => a.date.localeCompare(b.date));
  }

  function notesAttendanceSummary(studentCode, sessions = []) {
    const summary = { total: sessions.length, present: 0, absent: 0, excused: 0, score: null };
    sessions.forEach((session) => {
      const status = String(session.attendance?.[studentCode] || 'absent');
      if (status === 'present') summary.present += 1;
      else if (status === 'excused') summary.excused += 1;
      else summary.absent += 1;
    });
    if (!summary.total) return summary;
    let score = 0;
    if (summary.absent === 0 && summary.excused > 0 && summary.present < summary.total) {
      score = Math.max(60, Math.round((summary.present / summary.total) * 100));
    } else {
      const accountable = summary.present + summary.absent;
      score = accountable ? Math.round((summary.present / accountable) * 100) : 60;
    }
    summary.score = Math.max(0, Math.min(100, score));
    return summary;
  }

  function notesActivityGradeMap(assignmentId) {
    const map = new Map();
    (state.data.activityGrades || []).forEach((row) => {
      if (String(row.assignmentId || '') !== String(assignmentId || '')) return;
      map.set(`${String(row.activityId || '')}|${String(row.studentCode || '')}`, row);
    });
    return map;
  }


  function notesQuizGradeMap(assignmentId) {
    const map = new Map();
    (state.data.quizGrades || []).forEach((row) => {
      if (String(row.assignmentId || '') !== String(assignmentId || '')) return;
      map.set(`${String(row.quizId || '')}|${String(row.studentCode || '')}`, row);
    });
    return map;
  }

  function syncActivityGradesFromGradebook(activityId, assignmentId, rows = []) {
    if (!Array.isArray(state.data.activityGrades)) state.data.activityGrades = [];
    state.data.activityGrades = state.data.activityGrades.filter((row) => !(
      String(row.activityId || '') === String(activityId || '') &&
      String(row.assignmentId || '') === String(assignmentId || '')
    ));
    rows.forEach((row) => {
      state.data.activityGrades.push({
        activityId: String(activityId || row.activityId || ''),
        assignmentId: String(assignmentId || row.assignmentId || ''),
        studentCode: String(row.studentCode || ''),
        score: Number(row.score ?? 40),
        gradedAt: row.gradedAt || '',
        gradingGroupId: row.gradingGroupId || ''
      });
    });
  }

  function notesRockstarGrade(studentCode, column, attendanceSummary) {
    const target = Math.max(1, Number(column.target || 15));
    const points = getRockstarPoints(state.assignment?.id || '', studentCode, state.activePeriod);
    const proportional = Math.max(0, Math.min(100, Math.round((points / target) * 100)));
    const score = attendanceSummary.present > 0 ? Math.max(60, proportional) : proportional;
    return { score, points, target };
  }

  function notesCellScore(column, student, context) {
    if (column.type === 'activity') {
      const record = context.activityGrades.get(`${column.activityId}|${student.id}`);
      return {
        score: Number(record?.score ?? 40),
        pending: !record?.gradedAt,
        title: record?.gradedAt ? 'Calificación registrada' : 'Pendiente de calificar'
      };
    }
    if (column.type === 'quiz') {
      const record = context.quizGrades.get(`${column.quizId}|${student.id}`);
      return {
        score: record ? Number(record.score ?? 0) : null,
        pending: !record,
        title: record ? `Mejor intento: ${Number(record.score ?? 0).toFixed(1)}/100` : 'Quiz pendiente o sin intento enviado'
      };
    }
    if (column.type === 'attendance') {
      const attendance = context.attendanceByStudent.get(student.id);
      return {
        score: attendance.score,
        pending: attendance.score === null,
        title: `${attendance.present} asistencias · ${attendance.excused} excusas · ${attendance.absent} inasistencias`
      };
    }
    const rockstar = notesRockstarGrade(student.id, column, context.attendanceByStudent.get(student.id));
    return {
      score: rockstar.score,
      pending: false,
      title: `${rockstar.points}/${rockstar.target} puntos Rockstar`
    };
  }

  function notesScoreClass(score) {
    const value = Number(score || 0);
    if (value >= 90) return 'is-superior';
    if (value >= 80) return 'is-high';
    if (value >= 70) return 'is-basic-yellow';
    if (value >= 60) return 'is-basic-orange';
    return 'is-low';
  }

  function loadExcelJsScript(source) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = source;
      script.async = true;
      script.dataset.encisoExcelJs = source;
      script.addEventListener('load', () => resolve(window.ExcelJS), { once: true });
      script.addEventListener('error', () => {
        script.remove();
        reject(new Error('No se pudo cargar el generador de Excel.'));
      }, { once: true });
      document.head.appendChild(script);
    });
  }

  async function ensureExcelJs() {
    if (window.ExcelJS?.Workbook) return window.ExcelJS;
    if (!excelJsLoaderPromise) {
      excelJsLoaderPromise = (async () => {
        const sources = [
          'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js',
          'https://unpkg.com/exceljs@4.4.0/dist/exceljs.min.js'
        ];
        let lastError = null;
        for (const source of sources) {
          try {
            await loadExcelJsScript(source);
            if (window.ExcelJS?.Workbook) return window.ExcelJS;
          } catch (error) {
            lastError = error;
          }
        }
        throw lastError || new Error('No se pudo iniciar el generador de Excel.');
      })().catch((error) => {
        excelJsLoaderPromise = null;
        throw error;
      });
    }
    return excelJsLoaderPromise;
  }

  function notesEducaCitySafeFilenamePart(value, fallback = 'DATO') {
    const cleaned = String(value || fallback)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .replace(/[^A-Za-z0-9_-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-_]+|[-_]+$/g, '');
    return (cleaned || fallback).toUpperCase();
  }

  function notesEducaCityFilename(assignment, period) {
    const grade = notesEducaCitySafeFilenamePart(assignment?.grade || '', 'GRADO');
    const course = notesEducaCitySafeFilenamePart(assignment?.course || '', 'CURSO');
    const subject = notesEducaCitySafeFilenamePart(assignment?.subject || assignment?.area || '', 'ASIGNATURA');
    return `${grade}-${course}_${subject}_PERIODO-${Number(period || 1)}.xlsx`;
  }

  function notesEducaCityNumericCode(value) {
    const text = String(value ?? '').trim();
    if (/^\d+$/.test(text)) {
      const numeric = Number(text);
      if (Number.isSafeInteger(numeric)) return numeric;
    }
    return text;
  }

  function cloneExcelStyle(style) {
    try {
      return JSON.parse(JSON.stringify(style || {}));
    } catch (_) {
      return { ...(style || {}) };
    }
  }

  function createEducaCityFallbackSheet(workbook) {
    const sheet = workbook.addWorksheet('Calificaciones', {
      views: [{ state: 'frozen', xSplit: 4, ySplit: 2 }]
    });
    sheet.columns = [
      { width: 15 },
      { width: 24 },
      { width: 24 },
      { width: 14 },
      { width: 14 }
    ];
    sheet.getRow(1).height = 48;
    sheet.getRow(2).height = 24;
    sheet.getRow(3).height = 24;

    const thinBorder = {
      top: { style: 'thin', color: { argb: 'FFD7DDE3' } },
      left: { style: 'thin', color: { argb: 'FFD7DDE3' } },
      bottom: { style: 'thin', color: { argb: 'FFD7DDE3' } },
      right: { style: 'thin', color: { argb: 'FFD7DDE3' } }
    };
    const fixedTitles = ['Grado - Grupo', 'Apellidos', 'Nombres', 'Matrícula Id'];
    fixedTitles.forEach((title, index) => {
      const cell = sheet.getCell(1, index + 1);
      cell.value = title;
      cell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF000000' } };
      cell.alignment = { vertical: 'bottom', horizontal: 'left', wrapText: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
      cell.border = thinBorder;
    });
    const itemTitle = sheet.getCell(1, 5);
    itemTitle.value = 'Actividad 1';
    itemTitle.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF000000' } };
    itemTitle.alignment = { vertical: 'bottom', horizontal: 'left', wrapText: true };
    itemTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF35B8AE' } };
    itemTitle.border = thinBorder;

    for (let column = 1; column <= 5; column += 1) {
      const codeCell = sheet.getCell(2, column);
      codeCell.value = column === 5 ? 1 : null;
      codeCell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
      codeCell.alignment = { vertical: 'middle', horizontal: column >= 4 ? 'right' : 'left' };
      codeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B7D94' } };
      codeCell.border = thinBorder;
    }

    for (let column = 1; column <= 5; column += 1) {
      const dataCell = sheet.getCell(3, column);
      dataCell.value = null;
      dataCell.font = {
        name: 'Arial',
        size: 11,
        bold: column <= 4,
        color: { argb: column <= 4 ? 'FFFFFFFF' : 'FFD9D9D9' }
      };
      dataCell.alignment = { vertical: 'middle', horizontal: column >= 4 ? 'right' : 'left' };
      dataCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: column <= 4 ? 'FF0B7D94' : 'FF8D8D8D' }
      };
      dataCell.border = thinBorder;
      if (column === 5) dataCell.numFmt = '0.0';
    }
    return sheet;
  }

  async function createEducaCityWorkbook(columns, students, context) {
    const ExcelJS = await ensureExcelJs();
    let workbook = new ExcelJS.Workbook();
    let sheet = null;
    try {
      const templateUrl = new URL('./assets/templates/educacity-planilla-base.xlsx?v=0.25.005', document.baseURI).href;
      const templateResponse = await fetch(templateUrl, { cache: 'no-store' });
      if (!templateResponse.ok) throw new Error(`Plantilla HTTP ${templateResponse.status}`);
      await workbook.xlsx.load(await templateResponse.arrayBuffer());
      sheet = workbook.getWorksheet('Calificaciones') || workbook.worksheets[0] || null;
      if (!sheet) throw new Error('La plantilla no contiene una hoja utilizable.');
    } catch (error) {
      console.warn('Se usará la plantilla interna de respaldo para EducaCity:', error);
      workbook = new ExcelJS.Workbook();
      sheet = createEducaCityFallbackSheet(workbook);
    }

    const fixedHeaderStyles = [1, 2, 3, 4].map((column) => cloneExcelStyle(sheet.getCell(1, column).style));
    const blankCodeStyles = [1, 2, 3, 4].map((column) => cloneExcelStyle(sheet.getCell(2, column).style));
    const itemHeaderStyle = cloneExcelStyle(sheet.getCell(1, 5).style);
    const itemCodeStyle = cloneExcelStyle(sheet.getCell(2, 5).style);
    const fixedDataStyles = [1, 2, 3, 4].map((column) => cloneExcelStyle(sheet.getCell(3, column).style));
    const scoreStyle = cloneExcelStyle(sheet.getCell(3, 5).style);
    const fixedWidths = [1, 2, 3, 4].map((column) => sheet.getColumn(column).width);
    const itemWidth = sheet.getColumn(5).width || 14;
    const titleHeight = sheet.getRow(1).height;
    const codeHeight = sheet.getRow(2).height;
    const studentHeight = sheet.getRow(3).height;
    const templateViews = Array.isArray(sheet.views) ? sheet.views.map((view) => ({ ...view })) : [];

    if (sheet.rowCount > 2) sheet.spliceRows(3, sheet.rowCount - 2);
    const desiredColumnCount = 4 + columns.length;
    if (sheet.columnCount > desiredColumnCount) {
      sheet.spliceColumns(desiredColumnCount + 1, sheet.columnCount - desiredColumnCount);
    }

    const fixedTitles = ['Grado - Grupo', 'Apellidos', 'Nombres', 'Matrícula Id'];
    fixedTitles.forEach((title, index) => {
      const column = index + 1;
      const headerCell = sheet.getCell(1, column);
      const codeCell = sheet.getCell(2, column);
      headerCell.value = title;
      headerCell.style = cloneExcelStyle(fixedHeaderStyles[index]);
      codeCell.value = null;
      codeCell.style = cloneExcelStyle(blankCodeStyles[index]);
      sheet.getColumn(column).width = fixedWidths[index];
    });

    columns.forEach((column, index) => {
      const columnNumber = index + 5;
      const titleCell = sheet.getCell(1, columnNumber);
      const codeCell = sheet.getCell(2, columnNumber);
      titleCell.value = column.title;
      titleCell.style = cloneExcelStyle(itemHeaderStyle);
      codeCell.value = notesEducaCityNumericCode(column.code);
      codeCell.style = cloneExcelStyle(itemCodeStyle);
      sheet.getColumn(columnNumber).width = itemWidth;
    });

    if (titleHeight) sheet.getRow(1).height = titleHeight;
    if (codeHeight) sheet.getRow(2).height = codeHeight;
    sheet.views = templateViews;

    const gradeCourse = emRsGetAssignmentGradeCourse(state.assignment);
    students.forEach((student) => {
      const name = notesStudentNameParts(student);
      const scores = columns.map((column) => {
        const cell = notesCellScore(column, student, context);
        if (cell.score === null || cell.score === undefined || !Number.isFinite(Number(cell.score))) return null;
        return Math.round(Math.max(0, Math.min(100, Number(cell.score))) * 10) / 10;
      });
      const row = sheet.addRow([
        gradeCourse,
        name.lastName,
        name.firstName,
        notesEducaCityNumericCode(name.code),
        ...scores
      ]);
      if (studentHeight) row.height = studentHeight;
      [1, 2, 3, 4].forEach((columnNumber, index) => {
        row.getCell(columnNumber).style = cloneExcelStyle(fixedDataStyles[index]);
      });
      columns.forEach((_, index) => {
        const cell = row.getCell(index + 5);
        cell.style = cloneExcelStyle(scoreStyle);
        cell.numFmt = '0.0';
      });
    });

    workbook.creator = 'EncisoMath';
    workbook.lastModifiedBy = state.user?.fullName || state.user?.name || 'EncisoMath';
    workbook.created = new Date();
    workbook.modified = new Date();
    return workbook;
  }

  async function downloadNotesForEducaCity(button) {
    const assignment = state.assignment;
    if (!assignment) return;
    const columns = notesColumnDefinitions();
    const students = getStudentsForAssignment(assignment);
    const sessions = notesAttendanceSessions(assignment.id, state.activePeriod);
    const attendanceByStudent = new Map(students.map((student) => [student.id, notesAttendanceSummary(student.id, sessions)]));
    const context = {
      activityGrades: notesActivityGradeMap(assignment.id),
      quizGrades: notesQuizGradeMap(assignment.id),
      attendanceByStudent
    };
    const originalText = button?.textContent || 'Descargar Excel listo para EducaCity';
    if (button) {
      button.disabled = true;
      button.textContent = 'Preparando Excel…';
    }
    try {
      const workbook = await createEducaCityWorkbook(columns, students, context);
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = notesEducaCityFilename(assignment, state.activePeriod);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      toast(`Excel de ${students.length} estudiantes listo para EducaCity.`);
    } catch (error) {
      console.error('No se pudo exportar la planilla EducaCity:', error);
      toast(error?.message || 'No se pudo generar el Excel para EducaCity.');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  }

  function notesHeroHTML(assignment) {
    return `
      <section class="activity-hero em-act-hero-host em-notes-hero-host" data-em-notes-hero aria-label="Notas del periodo">
        <div class="em-act-shapes" aria-hidden="true">
          <span class="em-act-shape em-act-shape-circle"></span>
          <span class="em-act-shape em-act-shape-square"></span>
          <span class="em-act-shape em-act-shape-triangle"></span>
          <span class="em-act-shape em-act-shape-x"></span>
        </div>
        <div class="em-notes-grade-stack" aria-hidden="true">
          <span class="em-notes-grade-card em-notes-grade-card-100">100</span>
          <span class="em-notes-grade-card em-notes-grade-card-80">80</span>
          <span class="em-notes-grade-card em-notes-grade-card-50">50</span>
          <span class="em-notes-grade-card em-notes-grade-card-40">40</span>
        </div>
        <div class="em-act-content em-notes-hero-content">
          <span class="em-act-eyebrow">${escapeHTML(assignment.subject || 'Asignatura')} • ${escapeHTML(emRsGetAssignmentGradeCourse(assignment))}</span>
          <h1 class="em-act-title">NOTAS</h1>
          <p class="em-act-subtitle">Actividades, quizzes, asistencia y Rockstars.</p>
        </div>
      </section>
    `;
  }

  function emNotesInitHero(root = document) {
    const hero = root.querySelector?.('[data-em-notes-hero]');
    if (!hero) return;
    hero.classList.remove('is-live');
    void hero.offsetWidth;
    hero.classList.add('is-live');
    hero.querySelectorAll('.em-act-shape').forEach((shape, index) => {
      shape.style.setProperty('--em-act-shape-delay', `${-1.25 * (index + 1)}s`);
      shape.style.setProperty('--em-act-shape-duration', `${7.4 + index * 1.05}s`);
    });
  }

  function notesColumnHeaderHTML(column) {
    return `
      <th class="em-notes-grade-header" style="--em-notes-column-color:${escapeAttr(column.color)}">
        <button type="button" data-notes-column-key="${escapeAttr(column.key)}" title="Configurar ${escapeAttr(column.title)}">
          <span class="em-notes-column-code">${escapeHTML(column.code)}</span>
          <span class="em-notes-column-title">${escapeHTML(column.title)}</span>
          <span class="em-notes-column-weight">${Number(column.weight)}%</span>
        </button>
      </th>
    `;
  }

  function notesStudentRowHTML(student, columns, context) {
    let weighted = 0;
    const cells = columns.map((column) => {
      const cell = notesCellScore(column, student, context);
      const score = cell.score === null ? null : Math.max(0, Math.min(100, Number(cell.score || 0)));
      if (score !== null) weighted += score * (Number(column.weight || 0) / 100);
      return `<td class="em-notes-score-cell ${score === null ? 'is-empty' : notesScoreClass(score)} ${cell.pending ? 'is-pending' : ''}" title="${escapeAttr(cell.title || '')}">${score === null ? '—' : Math.round(score)}</td>`;
    }).join('');
    const finalScore = Math.max(0, Math.min(100, Math.floor(weighted + 1e-9)));
    const name = notesStudentNameParts(student);
    return `
      <tr>
        <th class="em-notes-student-cell" scope="row" title="${escapeAttr(student.fullName || '')}">
          <small class="em-notes-student-code">${escapeHTML(name.code)}</small>
          <strong class="em-notes-student-lastname">${escapeHTML(name.lastName)}</strong>
          <span class="em-notes-student-firstname">${escapeHTML(name.firstName)}</span>
        </th>
        ${cells}
        <td class="em-notes-final-cell ${notesScoreClass(finalScore)}"><strong>${finalScore}</strong></td>
      </tr>
    `;
  }

  function renderNotesTab(options = {}) {
    const assignment = state.assignment;
    const content = document.getElementById('tabContent');
    if (!assignment || !content) return;
    setActiveSubjectTabMeta('notes');
    const columns = notesColumnDefinitions();
    const students = getStudentsForAssignment(assignment);
    const sessions = notesAttendanceSessions(assignment.id, state.activePeriod);
    const attendanceByStudent = new Map(students.map((student) => [student.id, notesAttendanceSummary(student.id, sessions)]));
    const context = {
      activityGrades: notesActivityGradeMap(assignment.id),
      quizGrades: notesQuizGradeMap(assignment.id),
      attendanceByStudent
    };
    const totalWeight = columns.reduce((sum, column) => sum + Number(column.weight || 0), 0);
    const weightStatus = Math.abs(totalWeight - 100) < .001 ? 'is-complete' : 'is-incomplete';
    const studentColumnWidth = notesStudentColumnWidth(students);
    content.innerHTML = `
      ${notesHeroHTML(assignment)}
      <section class="em-notes-toolbar">
        <div>
          <p class="section-kicker">Periodo ${Number(state.activePeriod || 1)}</p>
          <h2>Hoja de calificaciones</h2>
          <span>${students.length} estudiantes · ${columns.length} componentes · ${sessions.length} registros de clase</span>
        </div>
        <div class="em-notes-toolbar-actions">
          <button class="em-notes-excel-btn" id="downloadEducaCityExcelBtn" type="button">Descargar Excel listo para EducaCity</button>
          <div class="em-notes-weight-summary ${weightStatus}">
            <span>Peso configurado</span>
            <strong>${Math.round(totalWeight * 10) / 10}%</strong>
            <i><b style="width:${Math.max(0, Math.min(100, totalWeight))}%"></b></i>
            <small>${weightStatus === 'is-complete' ? 'La ponderación suma 100%.' : 'Toca los encabezados para ajustar la ponderación a 100%.'}</small>
          </div>
        </div>
      </section>
      <section class="em-notes-sheet-shell" style="--em-notes-student-width:${studentColumnWidth}px">
        <div class="em-notes-sheet-scroll">
          <table class="em-notes-sheet">
            <thead>
              <tr>
                <th class="em-notes-student-header" scope="col"><span>Estudiante</span></th>
                ${columns.map(notesColumnHeaderHTML).join('')}
                <th class="em-notes-final-header" scope="col"><div class="em-notes-final-header-copy"><span>Definitiva</span><small>Periodo</small></div></th>
              </tr>
            </thead>
            <tbody>
              ${students.length ? students.map((student) => notesStudentRowHTML(student, columns, context)).join('') : '<tr><td class="em-notes-empty" colspan="99">Aún no hay estudiantes en este curso.</td></tr>'}
            </tbody>
          </table>
        </div>
        <p class="em-notes-sheet-help">Toca el encabezado de una actividad, quiz, Asistencia o Rockstars para configurar su código, color y peso.</p>
      </section>
    `;
    content.querySelectorAll('[data-notes-column-key]').forEach((button) => {
      button.addEventListener('click', () => openNotesColumnModal(button.dataset.notesColumnKey || ''));
    });
    document.getElementById('downloadEducaCityExcelBtn')?.addEventListener('click', (event) => {
      downloadNotesForEducaCity(event.currentTarget);
    });
    emNotesInitHero(content);
    emPlayTabEntrance(content, 'notes');
    if (options.animate) pulseElement(content, 'tab-enter');
  }

  function openNotesColumnModal(columnKey) {
    const columns = notesColumnDefinitions();
    const column = columns.find((item) => item.key === columnKey);
    if (!column) return;
    const currentTotal = columns.reduce((sum, item) => sum + Number(item.weight || 0), 0);
    openModal(`
      <section class="modal-card em-activity-create-modal em-notes-column-modal" role="dialog" aria-modal="true" aria-labelledby="notesColumnModalTitle">
        <button class="modal-close" data-close-modal aria-label="Cerrar">×</button>
        <p class="section-kicker">Configurar nota</p>
        <h2 id="notesColumnModalTitle">${escapeHTML(column.title)}</h2>
        <div class="em-activity-modal-tabs em-notes-modal-tabs" aria-hidden="true"><button class="is-active" type="button">Columna de calificación</button></div>
        <form id="notesColumnForm" class="em-activity-create-form">
          <section class="em-activity-form-block">
            <div class="em-activity-block-head"><span class="em-activity-step-badge">1</span><div><h3>Identificación</h3><p>El código y el color permiten reconocer rápidamente este componente en la hoja.</p></div></div>
            <div class="em-notes-column-preview" id="notesColumnPreview" style="--em-notes-column-color:${escapeAttr(column.color)}"><span>${escapeHTML(column.code)}</span><strong>${escapeHTML(column.title)}</strong><small>${Number(column.weight)}%</small></div>
            <div class="em-notes-config-grid">
              <label><span>Código</span><input class="input" id="notesColumnCode" maxlength="8" value="${escapeAttr(column.code)}" required /></label>
              <label><span>Peso sobre 100%</span><input class="input" id="notesColumnWeight" type="number" min="0" max="100" step="0.5" value="${Number(column.weight)}" required /></label>
            </div>
          </section>
          <section class="em-activity-form-block">
            <div class="em-activity-block-head"><span class="em-activity-step-badge">2</span><div><h3>Color</h3><p>Escoge un color para la cabecera y la identificación visual de la columna.</p></div></div>
            <div class="em-notes-color-grid">
              ${NOTES_COLUMN_COLORS.map((color) => `<button type="button" data-notes-color="${color}" style="--em-notes-preset-color:${color}" aria-label="Usar color ${color}" class="${color.toLowerCase() === String(column.color).toLowerCase() ? 'is-selected' : ''}"></button>`).join('')}
            </div>
            <label class="em-notes-custom-color"><span>Color personalizado</span><input id="notesColumnColor" type="color" value="${escapeAttr(column.color)}" /></label>
          </section>
          ${column.type === 'rockstars' ? `
            <section class="em-activity-form-block">
              <div class="em-activity-block-head"><span class="em-activity-step-badge">3</span><div><h3>Meta Rockstar</h3><p>La nota compara los puntos obtenidos por el estudiante con esta meta del periodo.</p></div></div>
              <label><span>Meta de puntos Rockstar</span><input class="input" id="notesRockstarTarget" type="number" min="1" max="999" step="1" value="${Number(column.target || 15)}" required /></label>
            </section>
          ` : ''}
          <div class="em-notes-weight-preview ${Math.abs(currentTotal - 100) < .001 ? 'is-complete' : ''}" id="notesWeightPreview"><span>Total de la ponderación</span><strong>${Math.round(currentTotal * 10) / 10}%</strong><small>El total ideal es 100%.</small></div>
          <p class="em-class-create-error" id="notesColumnError" role="alert"></p>
          <div class="em-activity-modal-actions"><button class="ghost-btn" type="button" data-close-modal>Cancelar</button><button class="primary-btn" type="submit">Guardar configuración</button></div>
        </form>
      </section>
    `, () => initNotesColumnModal(column, columns));
  }

  function initNotesColumnModal(column, columns) {
    const form = document.getElementById('notesColumnForm');
    const codeInput = document.getElementById('notesColumnCode');
    const weightInput = document.getElementById('notesColumnWeight');
    const colorInput = document.getElementById('notesColumnColor');
    const preview = document.getElementById('notesColumnPreview');
    const weightPreview = document.getElementById('notesWeightPreview');
    const originalWeight = Number(column.weight || 0);
    const currentTotal = columns.reduce((sum, item) => sum + Number(item.weight || 0), 0);

    const refresh = () => {
      const code = String(codeInput?.value || column.code).trim().toUpperCase().slice(0, 8);
      const weight = Math.max(0, Math.min(100, Number(weightInput?.value || 0)));
      const color = String(colorInput?.value || column.color);
      if (preview) {
        preview.style.setProperty('--em-notes-column-color', color);
        const codeNode = preview.querySelector('span');
        const weightNode = preview.querySelector('small');
        if (codeNode) codeNode.textContent = code || column.defaultCode;
        if (weightNode) weightNode.textContent = `${weight}%`;
      }
      const nextTotal = currentTotal - originalWeight + weight;
      if (weightPreview) {
        const strong = weightPreview.querySelector('strong');
        if (strong) strong.textContent = `${Math.round(nextTotal * 10) / 10}%`;
        weightPreview.classList.toggle('is-complete', Math.abs(nextTotal - 100) < .001);
      }
      document.querySelectorAll('[data-notes-color]').forEach((button) => button.classList.toggle('is-selected', String(button.dataset.notesColor || '').toLowerCase() === color.toLowerCase()));
    };

    codeInput?.addEventListener('input', () => {
      codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 8);
      refresh();
    });
    weightInput?.addEventListener('input', refresh);
    colorInput?.addEventListener('input', refresh);
    document.querySelectorAll('[data-notes-color]').forEach((button) => button.addEventListener('click', () => {
      if (colorInput) colorInput.value = button.dataset.notesColor || column.color;
      refresh();
    }));
    refresh();

    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const errorBox = document.getElementById('notesColumnError');
      const code = String(codeInput?.value || '').trim().toUpperCase();
      const weight = Number(weightInput?.value);
      const color = String(colorInput?.value || '');
      const target = Number(document.getElementById('notesRockstarTarget')?.value || column.target || 15);
      if (!code) {
        if (errorBox) errorBox.textContent = 'Escribe un código para la columna.';
        return;
      }
      if (!Number.isFinite(weight) || weight < 0 || weight > 100) {
        if (errorBox) errorBox.textContent = 'El peso debe estar entre 0 y 100.';
        return;
      }
      if (!/^#[0-9a-f]{6}$/i.test(color)) {
        if (errorBox) errorBox.textContent = 'Selecciona un color válido.';
        return;
      }
      if (column.type === 'rockstars' && (!Number.isFinite(target) || target < 1)) {
        if (errorBox) errorBox.textContent = 'La meta Rockstar debe ser mayor que cero.';
        return;
      }
      saveNotesColumnConfig(column.key, {
        code,
        color,
        weight: Math.round(weight * 10) / 10,
        ...(column.type === 'rockstars' ? { target: Math.round(target) } : {})
      });
      closeModal(false);
      renderNotesTab({ animate: true });
      toast('Configuración de la columna guardada.');
    });
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
      <div class="view-row em-content-toolbar em-content-toolbar-has-action em-quiz-toolbar">
        <button class="em-add-quiz-group-btn" id="openQuizStudioBtn" type="button" data-action="open-quiz-studio">Añadir quiz</button>
        <div class="em-view-switch" aria-label="Vista de quizzes">
          <button class="mini-btn ${state.quizViewMode === 'grid' ? 'selected' : ''}" id="quizGridModeBtn" type="button" aria-label="Vista en cuadrícula" title="Cuadrícula">▦</button>
          <button class="mini-btn ${state.quizViewMode === 'list' ? 'selected' : ''}" id="quizListModeBtn" type="button" aria-label="Vista en lista" title="Lista">☰</button>
        </div>
      </div>
      <div class="em-content-list is-${state.quizViewMode}" id="quizLibrary">
        ${quizzes.map((quiz, index) => quizCardButtonHTML(quiz, activeQuiz?.id === quiz.id, index)).join('') || emPeriodEmptyStateHTML('quizzes', state.quizPeriod)}
      </div>
    `;
    bindQuizTabEvents();
    emQzInitQuizzesHero($content);
    emPlayTabEntrance($content, 'quizzes');
    if (options.animate) pulseElement($content, 'tab-enter');
  }
  function bindQuizTabEvents() {
    const studioButton = document.getElementById('openQuizStudioBtn');
    if (studioButton && studioButton.dataset.boundQuizStudio !== 'true') {
      studioButton.dataset.boundQuizStudio = 'true';
      studioButton.addEventListener('click', () => openQuizStudio(createQuizStudioContext()));
    }
    const gridButton = document.getElementById('quizGridModeBtn');
    if (gridButton && gridButton.dataset.boundQuizView !== 'true') {
      gridButton.dataset.boundQuizView = 'true';
      gridButton.addEventListener('click', () => setQuizViewMode('grid'));
    }
    const listButton = document.getElementById('quizListModeBtn');
    if (listButton && listButton.dataset.boundQuizView !== 'true') {
      listButton.dataset.boundQuizView = 'true';
      listButton.addEventListener('click', () => setQuizViewMode('list'));
    }
    document.querySelectorAll('[data-edit-quiz-id]').forEach((button) => {
      if (button.dataset.boundQuizEdit === 'true') return;
      button.dataset.boundQuizEdit = 'true';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const quizId = button.dataset.editQuizId || button.closest('[data-quiz-id]')?.dataset.quizId || '';
        openQuizStudioForQuiz(quizId);
      });
    });
    document.querySelectorAll('[data-quiz-id]').forEach((card) => {
      if (card.dataset.boundQuizCard === 'true') return;
      card.dataset.boundQuizCard = 'true';
      const launchQuizFromCard = (event) => {
        if (event?.target?.closest?.('.em-quiz-edit')) return;
        const quizId = card.dataset.quizId || '';
        if (!quizId || card.dataset.quizGraded === 'true') return;
        if (card.dataset.quizStarting === 'true') return;
        const startButton = event?.target?.closest?.('.em-quiz-start');
        const delay = startButton ? 180 : 0;
        if (startButton) {
          event?.preventDefault?.();
          startButton.classList.remove('is-bouncing');
          void startButton.offsetWidth;
          startButton.classList.add('is-bouncing');
          setTimeout(() => startButton.classList.remove('is-bouncing'), 700);
        }
        card.dataset.quizStarting = 'true';
        setTimeout(() => {
          delete card.dataset.quizStarting;
          startQuiz(quizId);
        }, delay);
      };
      card.addEventListener('click', launchQuizFromCard);
      card.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        launchQuizFromCard(event);
      });
    });
  }
  function normalizeLocalQuizForPlayer(quiz = {}) {
    if (!quiz || typeof quiz !== 'object') return quiz;
    const safe = { ...quiz };
    if (safe.source === 'quiz-studio' || safe.legacyFormat === true || Array.isArray(safe.questions)) {
      safe.questions = filterSupportedQuizQuestions(safe.questions);
    }
    if (safe.grade !== undefined && safe.academicGrade === undefined && safe.courseGrade === undefined) {
      safe.academicGrade = safe.grade;
      safe.courseGrade = safe.grade;
      delete safe.grade;
    }
    return safe;
  }
  function getLocalQuizzes() {
    if (isCloudReady()) {
      const source = Array.isArray(state.data.quizzes) ? state.data.quizzes : (Array.isArray(state.data.quizzes?.quizzes) ? state.data.quizzes.quizzes : []);
      return source.filter((quiz) => quiz?.source === 'quiz-studio' || quiz?.legacyFormat === true).map(normalizeLocalQuizForPlayer);
    }
    const list = readJSON('encisomath:localQuizzes');
    return Array.isArray(list) ? list.map(normalizeLocalQuizForPlayer) : [];
  }
  function saveLocalQuizzes(list = []) {
    const safeList = Array.isArray(list) ? list.map(normalizeLocalQuizForPlayer) : [];
    if (!isCloudReady()) {
      localStorage.setItem('encisomath:localQuizzes', JSON.stringify(safeList));
      return Promise.resolve();
    }
    const current = Array.isArray(state.data.quizzes) ? state.data.quizzes : [];
    const incomingIds = new Set(safeList.map((quiz) => String(quiz?.id || '')).filter(Boolean));
    const preserved = current.filter((quiz) => !incomingIds.has(String(quiz?.id || '')) && quiz?.source !== 'quiz-studio' && quiz?.legacyFormat !== true);
    state.data.quizzes = [...preserved, ...safeList];
    return cloudAPI().saveQuizzes(safeList);
  }
  function getBaseQuizzes() {
    const source = state.data.quizzes;
    const base = Array.isArray(source) ? source : (Array.isArray(source?.quizzes) ? source.quizzes : []);
    const local = getLocalQuizzes();
    const localIds = new Set(local.map((quiz) => String(quiz?.id || '')).filter(Boolean));
    return [...base.filter((quiz) => !localIds.has(String(quiz?.id || ''))), ...local];
  }
  function getQuizzesForCurrentAssignment() {
    const assignment = state.assignment;
    if (!assignment) return [];
    return getBaseQuizzes().filter((quiz) => {
      if (Number(quiz.period || 1) !== Number(state.quizPeriod)) return false;
      const ids = Array.isArray(quiz.assignmentIds) ? quiz.assignmentIds : [];
      if (ids.length) return ids.includes('*') || ids.includes(assignment.id);
      if (quiz.subject && quiz.subject === assignment.subject) return true;
      if (quiz.area && quiz.area === assignment.area) return true;
      return !ids.length && !quiz.subject && !quiz.area;
    });
  }
  function normalizeQuizTypeForPlayer(type = '') {
    const raw = String(type || '').trim().toLowerCase();
    if (['multiple', 'multiple_choice', 'abcd', 'mcq', 'opcion_multiple', 'opción múltiple'].includes(raw)) return 'multiple_choice';
    if (['truefalse', 'true_false', 'boolean', 'verdadero_falso', 'verdadero / falso'].includes(raw)) return 'true_false';
    if (['organize', 'organizar', 'order', 'ordenar', 'organizar tarjetas'].includes(raw)) return 'order';
    if (['short', 'short_answer', 'respuesta_corta', 'respuesta corta', 'open', 'abierta'].includes(raw)) return 'open';
    if (raw === 'flip') return 'flip';
    return raw;
  }
  function isSupportedQuizQuestionType(type) {
    return ['multiple_choice', 'true_false', 'open', 'order', 'flip'].includes(normalizeQuizTypeForPlayer(type));
  }
  function parseQuizStudioTimeLimit(value) {
    if (value === undefined || value === null || value === '' || value === false) return null;
    const raw = String(value).trim().toLowerCase();
    if (!raw || raw === '0' || raw.includes('sin tiempo')) return null;
    const match = raw.match(/\d+/);
    if (!match) return null;
    const number = Number(match[0]);
    return Number.isFinite(number) && number > 0 ? number : null;
  }
  function normalizeQuizOptionObjects(options = [], correctIndex = 0, max = 4, fallback = []) {
    const source = Array.isArray(options) ? options.slice(0, max) : [];
    const list = source.map((option, index) => {
      const isObject = option && typeof option === 'object' && !Array.isArray(option);
      const text = isObject ? String(option.text ?? option.label ?? option.value ?? '') : String(option ?? '');
      const safe = {
        id: isObject ? String(option.id || String.fromCharCode(97 + index)) : String.fromCharCode(97 + index),
        text,
        correct: isObject ? Boolean(option.correct) : index === Number(correctIndex || 0)
      };
      if (isObject && option.color) safe.color = option.color;
      return safe;
    });
    while (list.length < max) {
      const index = list.length;
      list.push({ id: String.fromCharCode(97 + index), text: String(fallback[index] || `Opción ${index + 1}`), correct: index === Number(correctIndex || 0) });
    }
    const hasCorrect = list.some((option) => option.correct);
    if (!hasCorrect && list.length) {
      const index = Math.max(0, Math.min(list.length - 1, Number(correctIndex || 0)));
      list[index].correct = true;
    }
    return list;
  }
  function normalizeQuizQuestionForPlayer(question = {}, index = 0) {
    const raw = question && typeof question === 'object' ? question : {};
    const type = normalizeQuizTypeForPlayer(raw.type || 'multiple_choice');
    const textA = String(raw.textA ?? raw.text ?? raw.question ?? raw.prompt ?? '');
    const prompt = String(raw.prompt ?? raw.textA ?? raw.text ?? raw.question ?? '');
    const common = {
      ...raw,
      id: raw.id || `q-${index + 1}`,
      type,
      prompt,
      textA,
      textB: String(raw.textB || ''),
      image: String(raw.image || raw.imageData || raw.imageUrl || ''),
      imageAlt: String(raw.imageAlt || (raw.image || raw.imageData || raw.imageUrl ? 'Imagen de la pregunta' : ''))
    };
    const timeLimit = parseQuizStudioTimeLimit(raw.timeLimit ?? raw.time ?? raw.seconds ?? raw.duration);
    if (timeLimit) common.timeLimit = timeLimit;
    else delete common.timeLimit;

    if (type === 'flip') {
      const colors = ['red', 'blue', 'yellow', 'green', 'orange', 'purple'];
      common.options = normalizeQuizOptionObjects(raw.options, raw.correct, 6, ['Opción 1', 'Opción 2', 'Opción 3', 'Opción 4', 'Opción 5', 'Opción 6']).map((option, i) => ({ ...option, color: option.color || colors[i] || 'blue' }));
      return common;
    }
    if (type === 'order') {
      const colors = ['red', 'blue', 'yellow', 'green'];
      const rawCards = Array.isArray(raw.cards) && raw.cards.length ? raw.cards : (Array.isArray(raw.options) ? raw.options : []);
      const cards = rawCards.slice(0, 4).map((card, i) => {
        const isObject = card && typeof card === 'object' && !Array.isArray(card);
        return {
          id: isObject ? String(card.id || `card-${i + 1}`) : `card-${i + 1}`,
          text: isObject ? String(card.text ?? card.label ?? card.value ?? '') : String(card ?? ''),
          order: isObject && Number.isFinite(Number(card.order)) ? Number(card.order) : i + 1,
          color: isObject ? String(card.color || colors[i] || 'blue') : colors[i]
        };
      });
      while (cards.length < 4) cards.push({ id: `card-${cards.length + 1}`, text: `Tarjeta ${cards.length + 1}`, order: cards.length + 1, color: colors[cards.length] || 'blue' });
      common.cards = cards;
      common.correctOrder = Array.isArray(raw.correctOrder) && raw.correctOrder.length ? raw.correctOrder.map(String) : cards.slice().sort((a, b) => Number(a.order) - Number(b.order)).map((card) => card.id);
      delete common.options;
      return common;
    }
    if (type === 'true_false') {
      const rawOptions = Array.isArray(raw.options) && raw.options.length ? raw.options : ['Verdadero', 'Falso'];
      common.options = normalizeQuizOptionObjects(rawOptions, raw.correct, 2, ['Verdadero', 'Falso']).map((option, i) => ({
        id: i === 0 ? 'true' : 'false',
        text: i === 0 ? 'Verdadero' : 'Falso',
        correct: Boolean(option.correct)
      }));
      if (!common.options.some((option) => option.correct)) common.options[0].correct = true;
      return common;
    }
    if (type === 'open') {
      common.expectedAnswer = String(raw.expectedAnswer ?? raw.shortAnswer ?? raw.answer ?? '');
      common.charLimit = Math.max(1, Math.min(300, Number(raw.charLimit || raw.maxLength || 40)));
      common.maxLength = common.charLimit;
      delete common.options;
      return common;
    }
    common.options = normalizeQuizOptionObjects(raw.options, raw.correct, 4, ['Opción A', 'Opción B', 'Opción C', 'Opción D']).map(({ id, text, correct }) => ({ id, text, correct }));
    return common;
  }
  function filterSupportedQuizQuestions(questions = []) {
    return (Array.isArray(questions) ? questions : [])
      .map((question, index) => normalizeQuizQuestionForPlayer(question, index))
      .filter((question) => isSupportedQuizQuestionType(question?.type));
  }

  function emQuizShuffleArray(list = []) {
    const copy = Array.isArray(list) ? [...list] : [];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
  function emQuizRuntimeQuestionKey(question = {}, fallbackIndex = 0) {
    return String(question?.id || `q-${Number(fallbackIndex) + 1}`);
  }
  function emQuizFlagEnabled(quiz = {}, key = '') {
    return quiz?.[key] === true || String(quiz?.[key] || '').toLowerCase() === 'true';
  }
  function shouldShowCorrectAfterAttempt(quiz = getActiveQuiz()) {
    return emQuizFlagEnabled(quiz, 'showCorrectAfterAttempt');
  }
  function buildQuizRuntimeQuestion(question = {}, sourceIndex = 0, displayIndex = 0, quiz = {}, session = getQuizSession()) {
    const copy = quizStudioDeepClone(question);
    copy.__sourceIndex = sourceIndex;
    copy.__displayIndex = displayIndex;
    if (!emQuizFlagEnabled(quiz, 'shuffleOptions')) return copy;

    const key = emQuizRuntimeQuestionKey(copy, sourceIndex);
    if (!session.optionOrderByQuestionId || typeof session.optionOrderByQuestionId !== 'object') session.optionOrderByQuestionId = {};
    const stored = session.optionOrderByQuestionId;

    if (['multiple_choice', 'true_false', 'flip'].includes(copy.type)) {
      const options = Array.isArray(copy.options) ? copy.options : [];
      if (options.length > 1) {
        let order = stored[key];
        if (!Array.isArray(order) || order.length !== options.length) {
          order = emQuizShuffleArray(options.map((_, index) => index));
          stored[key] = order;
        }
        copy.options = order.map((index) => options[index]).filter(Boolean);
      }
    } else if (copy.type === 'order') {
      const cards = Array.isArray(copy.cards) ? copy.cards : [];
      if (cards.length > 1) {
        let order = stored[key];
        if (!Array.isArray(order) || order.length !== cards.length) {
          order = emQuizShuffleArray(cards.map((_, index) => index));
          stored[key] = order;
        }
        copy.cards = order.map((index) => cards[index]).filter(Boolean);
      }
    }

    return copy;
  }
  function buildQuizRuntimeQuestions(baseQuestions = [], questionOrder = [], quiz = {}, session = getQuizSession()) {
    const order = Array.isArray(questionOrder) && questionOrder.length === baseQuestions.length
      ? questionOrder
      : baseQuestions.map((_, index) => index);
    return order.map((sourceIndex, displayIndex) => buildQuizRuntimeQuestion(baseQuestions[sourceIndex], sourceIndex, displayIndex, quiz, session)).filter(Boolean);
  }
  function prepareQuizAttemptRuntime(quiz = null) {
    if (!quiz || typeof quiz !== 'object') return [];
    const session = getQuizSession();
    const baseQuestions = filterSupportedQuizQuestions(quiz.questions);
    const baseOrder = baseQuestions.map((_, index) => index);
    const questionOrder = emQuizFlagEnabled(quiz, 'shuffleQuestions') ? emQuizShuffleArray(baseOrder) : baseOrder;
    session.runtimeQuizId = quiz.id || '';
    session.runtimeQuestionOrder = questionOrder;
    session.optionOrderByQuestionId = {};
    session.runtimeQuestions = buildQuizRuntimeQuestions(baseQuestions, questionOrder, quiz, session);
    session.shuffleQuestions = emQuizFlagEnabled(quiz, 'shuffleQuestions');
    session.shuffleOptions = emQuizFlagEnabled(quiz, 'shuffleOptions');
    session.showCorrectAfterAttempt = shouldShowCorrectAfterAttempt(quiz);
    return session.runtimeQuestions;
  }
  function getQuizQuestionsForAttempt(quiz = {}) {
    const baseQuestions = filterSupportedQuizQuestions(quiz.questions);
    const session = state.quizSession && typeof state.quizSession === 'object' ? state.quizSession : null;
    if (session?.runtimeQuizId === (quiz?.id || '') && Array.isArray(session.runtimeQuestions) && session.runtimeQuestions.length) {
      return session.runtimeQuestions;
    }
    return baseQuestions;
  }
  function getActiveQuiz(quizzes = getQuizzesForCurrentAssignment()) {
    if (!quizzes.length) return null;
    const active = quizzes.find((quiz) => quiz.id === state.quizActiveId) || quizzes[0];
    state.quizActiveId = active.id;
    localStorage.setItem('encisomath:quizActiveId', active.id);
    active.questions = getQuizQuestionsForAttempt(active);
    if (state.quizQuestionIndex < 0 || state.quizQuestionIndex >= active.questions.length) state.quizQuestionIndex = 0;
    return active;
  }
  function emQuizDecimalValue(source, keys = []) {
    for (const key of keys) {
      const parts = String(key || '').split('.').filter(Boolean);
      let value = source;
      for (const part of parts) value = value?.[part];
      if (value === undefined || value === null || value === '') continue;
      const normalized = typeof value === 'string' ? value.replace(',', '.') : value;
      const number = Number(normalized);
      if (Number.isFinite(number)) return number;
    }
    return null;
  }
  function getQuizGradeRaw(quiz) {
    const directGradeKeys = [
      'finalGrade', 'nota', 'calificacion', 'calificación', 'resultGrade',
      'studentGrade', 'studentScore', 'lastGrade', 'bestGrade', 'quizGrade', 'scoreGrade'
    ];
    const resultGradeKeys = ['grade', ...directGradeKeys];
    const direct = emQuizDecimalValue(quiz, directGradeKeys);
    if (direct !== null) return direct;
    const containers = [quiz?.result, quiz?.results, quiz?.lastResult, quiz?.attempt, quiz?.lastAttempt, quiz?.bestAttempt, quiz?.studentResult, quiz?.submission];
    for (const container of containers) {
      if (Array.isArray(container)) {
        for (let index = container.length - 1; index >= 0; index -= 1) {
          const value = emQuizDecimalValue(container[index], resultGradeKeys);
          if (value !== null) return value;
        }
      } else if (container && typeof container === 'object') {
        const value = emQuizDecimalValue(container, resultGradeKeys);
        if (value !== null) return value;
      }
    }
    return null;
  }
  function getQuizGradeColor(grade) {
    const value = Number(grade);
    if (value >= 9) return '#58cc02';
    if (value >= 7) return '#54c600';
    if (value >= 6) return '#EBB513';
    if (value >= 4) return '#ff7a00';
    return '#e21b3c';
  }
  function getQuizGradeInfo(quiz) {
    const raw = getQuizGradeRaw(quiz);
    if (raw === null) return null;
    const value = Math.max(0, Math.min(10, Number(raw)));
    if (!Number.isFinite(value)) return null;
    return {
      value,
      text: value.toFixed(1),
      color: getQuizGradeColor(value)
    };
  }
  function getQuizCardCleanColor(index = 0, gradeInfo = null) {
    if (gradeInfo?.color) return gradeInfo.color;
    return EM_QUIZ_CARD_CLEAN_COLORS[Math.abs(Number(index) || 0) % EM_QUIZ_CARD_CLEAN_COLORS.length] || EM_QUIZ_CARD_CLEAN_COLORS[0];
  }
  function quizCardButtonHTML(quiz, active, index = 0) {
    const gradeInfo = getQuizGradeInfo(quiz);
    const graded = Boolean(gradeInfo);
    const color = getQuizCardCleanColor(index, gradeInfo);
    const title = quiz.title || 'Quiz sin título';
    const closeLabel = getQuizCloseLabel(quiz);
    const period = Number(quiz.period || state.quizPeriod || 1);
    const style = `--quiz-color:${color};--active-color:${color};--grade-accent:${gradeInfo?.color || color};`;
    const actionAttrs = graded ? 'aria-hidden="true" tabindex="-1" disabled' : 'tabindex="-1"';
    return `
      <article class="em-quiz-card-clean ${active ? 'active ' : ''}${graded ? 'is-graded' : ''}" data-quiz-id="${escapeAttr(quiz.id)}" data-period="${escapeAttr(period)}" data-quiz-graded="${graded ? 'true' : 'false'}" ${graded ? 'role="article" tabindex="-1"' : `role="button" tabindex="0" aria-label="Iniciar ${escapeAttr(title)}"`} style="${escapeAttr(style)}">
        <header class="em-quiz-top">
          <span class="em-quiz-shape circle" aria-hidden="true"></span>
          <span class="em-quiz-shape x" aria-hidden="true"></span>

          <h3 class="em-quiz-title">${escapeHTML(title)}</h3>

          <div class="em-quiz-action-slot">
            <button class="em-quiz-edit" type="button" tabindex="-1" data-edit-quiz-id="${escapeAttr(quiz.id)}">Editar</button>
            <button class="em-quiz-start" type="button" ${actionAttrs}>Iniciar</button>
          </div>
        </header>

        <section class="em-quiz-bottom">
          <div class="em-quiz-available">
            <span class="em-quiz-available-label">Disponible hasta:</span>
            <strong class="em-quiz-available-date">${escapeHTML(closeLabel)}</strong>
          </div>

          <div class="em-quiz-graded">
            <span class="em-quiz-grade-label">Calificado:</span>
            <strong class="em-quiz-grade-value">${escapeHTML(gradeInfo?.text || '')}</strong>
          </div>
        </section>
      </article>
    `;
  }

  function createQuizStudioContext() {
    const assignment = state.assignment || {};
    return {
      assignmentId: assignment.id || '',
      subjectId: assignment.id || '',
      courseId: assignment.id || '',
      groupId: assignment.id || '',
      grade: assignment.grade || '',
      subjectName: assignment.subject || '',
      courseName: assignment.course || '',
      area: assignment.area || '',
      sede: assignment.sede || '',
      period: Number(state.quizPeriod || 1)
    };
  }
  function quizStudioId(prefix = 'id') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }
  function quizStudioDeepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }
  function createQuizStudioQuestion(type = 'multiple_choice') {
    const base = {
      id: quizStudioId('studio_q'),
      type,
      time: '20',
      text: 'Escribe aquí la pregunta.',
      image: '',
      options: ['Opción A', 'Opción B', 'Opción C', 'Opción D'],
      correct: 0,
      shortAnswer: '',
      charLimit: 40
    };
    return normalizeQuizStudioQuestion(base);
  }
  function quizStudioDefaultUntilValue() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 0, 0);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const dd = String(tomorrow.getDate()).padStart(2, '0');
    const hh = String(tomorrow.getHours()).padStart(2, '0');
    const mi = String(tomorrow.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  }
  function createEmptyQuizStudioDraft(context = createQuizStudioContext()) {
    return {
      title: '',
      availableUntil: quizStudioDefaultUntilValue(),
      attempts: '1',
      shuffleQuestions: true,
      shuffleOptions: true,
      showCorrectAfterAttempt: false,
      replicateAssignmentIds: [],
      context: { ...context },
      questions: [createQuizStudioQuestion('multiple_choice')]
    };
  }
  const QUIZ_STUDIO_TYPES = {
    multiple_choice: {
      label: 'Opción múltiple',
      count: 4,
      infoTitle: 'Opción múltiple · ABCD',
      infoText: 'Escribe directamente sobre cada tarjeta. Marca la respuesta correcta con el check.',
      defaults: ['Opción A', 'Opción B', 'Opción C', 'Opción D']
    },
    flip: {
      label: 'Quiz flip',
      count: 6,
      infoTitle: 'Quiz flip · 6 opciones',
      infoText: 'Se ve como el juego real: seis tarjetas editables y un check para la correcta.',
      defaults: ['Opción 1', 'Opción 2', 'Opción 3', 'Opción 4', 'Opción 5', 'Opción 6']
    },
    order: {
      label: 'Organizar tarjetas',
      count: 4,
      organize: true,
      infoTitle: 'Organizar tarjetas · 4 ítems',
      infoText: 'Escribe cada tarjeta en el orden correcto. El estudiante deberá organizarlas.',
      defaults: ['Primero', 'Segundo', 'Tercero', 'Cuarto']
    },
    true_false: {
      label: 'Verdadero / falso',
      count: 2,
      fixed: true,
      infoTitle: 'Verdadero / falso · 2 opciones fijas',
      infoText: 'Las tarjetas no se editan. Solo marca cuál es la respuesta correcta.',
      defaults: ['Verdadero', 'Falso']
    },
    open: {
      label: 'Respuesta corta',
      count: 0,
      short: true,
      fixed: true,
      infoTitle: 'Respuesta corta',
      infoText: 'Configura la respuesta esperada y el límite de caracteres.',
      defaults: []
    }
  };
  function normalizeQuizStudioQuestion(question = {}) {
    const type = QUIZ_STUDIO_TYPES[question.type] ? question.type : 'multiple_choice';
    const config = QUIZ_STUDIO_TYPES[type];
    const safe = {
      id: question.id || quizStudioId('studio_q'),
      type,
      time: String(question.time ?? '20'),
      text: String(question.text || ''),
      image: String(question.image || ''),
      options: Array.isArray(question.options) ? question.options.map((item) => String(item || '')) : [],
      correct: Number.isFinite(Number(question.correct)) ? Number(question.correct) : 0,
      shortAnswer: String(question.shortAnswer || ''),
      charLimit: Math.max(1, Math.min(300, Number(question.charLimit || 40)))
    };
    if (config.short) {
      safe.options = [];
      safe.correct = 0;
      return safe;
    }
    if (config.fixed) safe.options = [...config.defaults];
    while (safe.options.length < config.count) safe.options.push(config.defaults[safe.options.length] || `Opción ${safe.options.length + 1}`);
    safe.options = safe.options.slice(0, config.count);
    safe.correct = Math.max(0, Math.min(config.count - 1, safe.correct));
    return safe;
  }
  function getQuizStudioDraft() {
    if (!state.quizStudioDraft) state.quizStudioDraft = createEmptyQuizStudioDraft(createQuizStudioContext());
    state.quizStudioDraft.questions = (Array.isArray(state.quizStudioDraft.questions) && state.quizStudioDraft.questions.length ? state.quizStudioDraft.questions : [createQuizStudioQuestion()]).map(normalizeQuizStudioQuestion);
    state.quizStudioQuestionIndex = Math.max(0, Math.min(Number(state.quizStudioQuestionIndex || 0), state.quizStudioDraft.questions.length - 1));
    return state.quizStudioDraft;
  }
  function getSameGradeQuizStudioTargets(context = state.quizStudioContext || createQuizStudioContext()) {
    const teacherId = state.user?.id || '';
    return state.data.assignments
      .filter((assignment) => String(assignment.teacherId || '') === String(teacherId || assignment.teacherId || ''))
      .filter((assignment) => String(assignment.grade || '') === String(context.grade || ''))
      .filter((assignment) => String(assignment.id || '') !== String(context.assignmentId || ''))
      .sort((a, b) => `${a.subject} ${a.course}`.localeCompare(`${b.subject} ${b.course}`, 'es'));
  }
  function getQuizById(quizId = '') {
    const id = String(quizId || '');
    if (!id) return null;
    return getBaseQuizzes().find((quiz) => String(quiz?.id || '') === id) || null;
  }
  function quizAttemptValueForStudio(quiz = {}) {
    const value = quiz.attempts ?? quiz.maxAttempts ?? quiz.attemptLimit ?? quiz.availableAttempts;
    if (value === null || value === undefined || value === '' || String(value) === 'Infinity') return '∞';
    return String(value || '1');
  }
  function quizQuestionToStudioQuestion(question = {}, index = 0) {
    const normalized = normalizeQuizQuestionForPlayer(question, index);
    const type = QUIZ_STUDIO_TYPES[normalized.type] ? normalized.type : 'multiple_choice';
    const base = {
      id: quizStudioId('studio_q'),
      type,
      time: String(normalized.timeLimit ?? normalized.time ?? normalized.seconds ?? '20'),
      text: String(normalized.textA || normalized.prompt || normalized.text || normalized.question || ''),
      image: String(normalized.image || ''),
      options: [],
      correct: 0,
      shortAnswer: '',
      charLimit: Number(normalized.charLimit || normalized.maxLength || 40)
    };
    if (type === 'open') {
      base.shortAnswer = String(normalized.expectedAnswer || normalized.shortAnswer || normalized.answer || '');
      return normalizeQuizStudioQuestion(base);
    }
    if (type === 'order') {
      const cards = Array.isArray(normalized.cards) ? normalized.cards : [];
      const cardById = new Map(cards.map((card) => [String(card.id || ''), card]));
      const orderedIds = Array.isArray(normalized.correctOrder) && normalized.correctOrder.length ? normalized.correctOrder.map(String) : cards.slice().sort((a, b) => Number(a.order || 0) - Number(b.order || 0)).map((card) => String(card.id || ''));
      base.options = orderedIds.map((id) => String(cardById.get(id)?.text || '')).filter(Boolean);
      if (!base.options.length) base.options = cards.map((card) => String(card.text || ''));
      return normalizeQuizStudioQuestion(base);
    }
    const options = Array.isArray(normalized.options) ? normalized.options : [];
    base.options = options.map((option) => String(option?.text ?? option?.label ?? option ?? ''));
    const correctIndex = options.findIndex((option) => Boolean(option?.correct));
    base.correct = correctIndex >= 0 ? correctIndex : 0;
    if (type === 'true_false') base.options = ['Verdadero', 'Falso'];
    return normalizeQuizStudioQuestion(base);
  }
  function quizToQuizStudioDraft(quiz = {}, context = createQuizStudioContext()) {
    const questions = filterSupportedQuizQuestions(quiz.questions || []).map(quizQuestionToStudioQuestion);
    return {
      editQuizId: quiz.id || '',
      createdAt: quiz.createdAt || Date.now(),
      title: String(quiz.title || ''),
      availableUntil: String(quiz.availableUntil || quiz.closeAt || quiz.endsAt || quiz.dueAt || quiz.deadline || quizStudioDefaultUntilValue()),
      attempts: quizAttemptValueForStudio(quiz),
      shuffleQuestions: Boolean(quiz.shuffleQuestions),
      shuffleOptions: Boolean(quiz.shuffleOptions),
      showCorrectAfterAttempt: Boolean(quiz.showCorrectAfterAttempt),
      replicateAssignmentIds: [],
      context: { ...context, editQuizId: quiz.id || '', editing: true },
      questions: questions.length ? questions : [createQuizStudioQuestion('multiple_choice')]
    };
  }
  function openQuizStudioForQuiz(quizId = '') {
    const quiz = getQuizById(quizId);
    if (!quiz) { toast('No encontré ese quiz para editar.'); return; }
    const assignment = state.assignment || {};
    const context = {
      ...createQuizStudioContext(),
      assignmentId: assignment.id || quiz.assignmentIds?.[0] || '',
      subjectName: assignment.subject || quiz.subject || '',
      courseName: assignment.course || quiz.course || '',
      grade: assignment.grade || quiz.academicGrade || quiz.courseGrade || '',
      area: assignment.area || quiz.area || '',
      period: Number(quiz.period || state.quizPeriod || 1),
      editQuizId: quiz.id || '',
      editing: true
    };
    openQuizStudio(context, quiz);
  }
  function openQuizStudio(context = createQuizStudioContext(), sourceQuiz = null) {
    state.quizStudioContext = { ...context };
    state.quizStudioDraft = sourceQuiz ? quizToQuizStudioDraft(sourceQuiz, context) : createEmptyQuizStudioDraft(context);
    state.quizStudioQuestionIndex = 0;
    state.quizStudioTab = 'data';
    renderQuizStudio();
  }
  function closeQuizStudio() {
    state.quizStudioContext = null;
    state.quizStudioDraft = null;
    state.quizStudioQuestionIndex = 0;
    state.quizStudioTab = 'data';
    renderSubjectDetail('quizzes', { replaceHistory: true });
  }
  function renderQuizStudio() {
    const context = state.quizStudioContext || createQuizStudioContext();
    const draft = getQuizStudioDraft();
    const validTabs = ['data', 'questions', 'replicate'];
    const tab = validTabs.includes(state.quizStudioTab) ? state.quizStudioTab : 'data';
    state.quizStudioTab = tab;
    const existingScreen = document.querySelector('.em-quiz-studio-screen');
    const scrollEl = document.scrollingElement || document.documentElement;
    const preserveScroll = Boolean(existingScreen);
    const scrollX = preserveScroll ? scrollEl.scrollLeft : 0;
    const scrollY = preserveScroll ? scrollEl.scrollTop : 0;
    mount(quizStudioHTML(context, draft, tab), () => {
      bindQuizStudioEvents();
      emPlayQuizStudioEntrance(document.querySelector('.em-quiz-studio-screen'));
      if (preserveScroll) {
        const restore = () => window.scrollTo(scrollX, scrollY);
        requestAnimationFrame(restore);
        window.setTimeout(restore, 60);
      }
    }, { noTransition: true });
  }
  function quizStudioReplicatePanelHTML(targets, selected = []) {
    return `
      <section class="em-quiz-studio-card">
        <header class="em-quiz-studio-card-head"><div><h2 class="em-quiz-studio-card-title">Replicar quiz</h2><p class="em-quiz-studio-card-mini">Otros cursos del mismo grado</p></div></header>
        <div class="em-quiz-studio-card-body">
          <div class="em-quiz-studio-replicate-list" id="quizStudioReplicateList">
            ${targets.length ? targets.map((assignment) => quizStudioReplicateItemHTML(assignment, selected)).join('') : '<div class="em-quiz-studio-empty">No hay otros cursos de este mismo grado.</div>'}
          </div>
        </div>
      </section>
    `;
  }
  function quizStudioQuestionControlsHTML(question) {
    return `
      <div class="em-quiz-studio-type-time-row">
        <label class="em-quiz-studio-field"><span class="em-quiz-studio-label">Tipo de pregunta</span><select class="em-quiz-studio-select" id="quizStudioQuestionType">${quizStudioTypeOptionsHTML(question.type)}</select></label>
        <label class="em-quiz-studio-field"><span class="em-quiz-studio-label">Tiempo</span><select class="em-quiz-studio-select" id="quizStudioQuestionTime">${quizStudioTimeOptionsHTML(question.time)}</select></label>
      </div>
    `;
  }
  function quizStudioHTML(context, draft, tab) {
    const question = normalizeQuizStudioQuestion(draft.questions[state.quizStudioQuestionIndex] || createQuizStudioQuestion());
    const typeConfig = QUIZ_STUDIO_TYPES[question.type];
    const targets = getSameGradeQuizStudioTargets(context);
    return `
      <main class="screen em-quiz-studio-screen">
        <header class="em-quiz-studio-topbar">
          <button class="em-quiz-studio-back" id="quizStudioBackBtn" type="button" aria-label="Volver a quizzes">←</button>
          <span>${escapeHTML(context.subjectName || 'Quizzes')} ${escapeHTML(context.grade || '')}${context.courseName ? `-${escapeHTML(context.courseName)}` : ''}</span>
        </header>
        <section class="em-quiz-studio-page">
          <header class="em-quiz-studio-hero">
            <span class="em-quiz-studio-shape circle" aria-hidden="true"></span>
            <span class="em-quiz-studio-shape x" aria-hidden="true"></span>
            <div class="em-quiz-studio-hero-copy">
              <h1 class="em-quiz-studio-title">${draft.editQuizId ? 'Editar quiz' : 'Quiz Studio'}</h1>
            </div>
          </header>
          <nav class="em-quiz-studio-tabs" aria-label="Pestañas del creador">
            <button class="em-quiz-studio-tab-btn ${tab === 'data' ? 'active' : ''}" type="button" data-studio-tab="data">Datos rápidos</button>
            <button class="em-quiz-studio-tab-btn ${tab === 'questions' ? 'active' : ''}" type="button" data-studio-tab="questions">Preguntas</button>
            <button class="em-quiz-studio-tab-btn ${tab === 'replicate' ? 'active' : ''}" type="button" data-studio-tab="replicate">Replicar</button>
          </nav>
          <section class="em-quiz-studio-tab-panel ${tab === 'data' ? 'active' : ''}" id="quizStudioTabData">
            <section class="em-quiz-studio-card">
              <header class="em-quiz-studio-card-head"><div><h2 class="em-quiz-studio-card-title">Datos rápidos</h2><p class="em-quiz-studio-card-mini">Nombre y reglas base</p></div></header>
              <div class="em-quiz-studio-card-body">
                <div class="em-quiz-studio-grid">
                  <label class="em-quiz-studio-field full"><span class="em-quiz-studio-label">Nombre del quiz</span><input class="em-quiz-studio-input" id="quizStudioTitle" value="${escapeAttr(draft.title || '')}" placeholder="Ejemplo: Tablas de frecuencia" /></label>
                  <label class="em-quiz-studio-field"><span class="em-quiz-studio-label">Disponible hasta</span><input class="em-quiz-studio-input" id="quizStudioUntil" type="datetime-local" value="${escapeAttr(draft.availableUntil || '')}" /></label>
                  <label class="em-quiz-studio-field"><span class="em-quiz-studio-label">Intentos permitidos</span><select class="em-quiz-studio-select" id="quizStudioAttempts">${quizStudioAttemptOptionsHTML(draft.attempts)}</select></label>
                </div>
                <div class="em-quiz-studio-toggles">
                  <button class="em-quiz-studio-toggle ${draft.shuffleQuestions ? 'active' : ''}" type="button" id="quizStudioShuffleQuestions"><strong>Preguntas en desorden</strong><span>Mezcla los ítems</span></button>
                  <button class="em-quiz-studio-toggle ${draft.shuffleOptions ? 'active' : ''}" type="button" id="quizStudioShuffleOptions"><strong>Opciones en desorden</strong><span>Mezcla respuestas o tarjetas</span></button>
                  <button class="em-quiz-studio-toggle ${draft.showCorrectAfterAttempt ? 'active' : ''}" type="button" id="quizStudioShowCorrectAfterAttempt"><strong>Mostrar respuesta correcta después del intento</strong><span>El estudiante ve la correcta al terminar</span></button>
                </div>
              </div>
            </section>
          </section>
          <section class="em-quiz-studio-tab-panel ${tab === 'questions' ? 'active' : ''}" id="quizStudioTabQuestions">
            <section class="em-quiz-studio-card">
              <header class="em-quiz-studio-card-head"><div><h2 class="em-quiz-studio-card-title">Preguntas</h2><p class="em-quiz-studio-card-mini" id="quizStudioQuestionCounter">Pregunta ${state.quizStudioQuestionIndex + 1} de ${draft.questions.length}</p></div></header>
              <div class="em-quiz-studio-card-body"><div class="em-quiz-studio-question-strip" id="quizStudioQuestionStrip">${quizStudioQuestionStripHTML(draft)}</div></div>
            </section>
            <section class="em-quiz-studio-card">
              <header class="em-quiz-studio-card-head"><div><h2 class="em-quiz-studio-card-title">Pregunta actual</h2><p class="em-quiz-studio-card-mini">Imagen, tipo, tiempo y enunciado</p></div></header>
              <div class="em-quiz-studio-card-body">
                <label class="em-quiz-studio-field full"><span class="em-quiz-studio-label">Enunciado</span><textarea class="em-quiz-studio-textarea" id="quizStudioQuestionText">${escapeHTML(question.text || '')}</textarea></label>
                ${quizStudioImageEditorHTML(question)}
                ${quizStudioQuestionControlsHTML(question)}
                <div class="em-quiz-studio-type-info" id="quizStudioTypeInfo"><strong>${escapeHTML(typeConfig.infoTitle)}</strong><span>${escapeHTML(typeConfig.infoText)}</span></div>
              </div>
            </section>
            <section class="em-quiz-studio-card">
              <header class="em-quiz-studio-card-head"><div><h2 class="em-quiz-studio-card-title">${typeConfig.short ? 'Respuesta corta' : (typeConfig.organize ? 'Tarjetas en orden' : 'Tarjetas de respuesta')}</h2><p class="em-quiz-studio-card-mini">${typeConfig.short ? 'Respuesta y límite' : (typeConfig.organize ? 'Edita el orden correcto' : 'Toca el check correcto')}</p></div></header>
              <div class="em-quiz-studio-card-body">
                ${typeConfig.short ? quizStudioShortEditorHTML(question) : `<div class="em-quiz-studio-answer-grid" id="quizStudioAnswerGrid">${quizStudioAnswerCardsHTML(question)}</div>`}
                <div class="em-quiz-studio-mini-actions"><button class="em-quiz-studio-mini-btn" type="button" id="quizStudioDuplicateBtn">Duplicar pregunta</button><button class="em-quiz-studio-mini-btn" type="button" id="quizStudioDeleteBtn">Eliminar pregunta</button></div>
              </div>
            </section>
            <section class="em-quiz-studio-preview-box" id="quizStudioPreviewBox" hidden></section>
          </section>
          <section class="em-quiz-studio-tab-panel ${tab === 'replicate' ? 'active' : ''}" id="quizStudioTabReplicate">
            ${quizStudioReplicatePanelHTML(targets, draft.replicateAssignmentIds || [])}
          </section>
        </section>
        <footer class="em-quiz-studio-savebar">
          <button class="em-quiz-studio-save-btn" type="button" id="quizStudioSaveBtn">Guardar</button>
          <button class="em-quiz-studio-save-btn publish" type="button" id="quizStudioPublishBtn">Publicar</button>
        </footer>
      </main>
    `;
  }
  function quizStudioAttemptOptionsHTML(selected) {
    const options = [
      ['∞', 'Ilimitados'], ['1', '1 intento'], ['2', '2 intentos'], ['3', '3 intentos'], ['4', '4 intentos'], ['5', '5 intentos']
    ];
    return options.map(([value, label]) => `<option value="${escapeAttr(value)}" ${String(selected || '1') === value ? 'selected' : ''}>${escapeHTML(label)}</option>`).join('');
  }
  function quizStudioTypeOptionsHTML(selected) {
    return Object.entries(QUIZ_STUDIO_TYPES).map(([value, config]) => `<option value="${escapeAttr(value)}" ${selected === value ? 'selected' : ''}>${escapeHTML(config.label)}</option>`).join('');
  }
  function quizStudioTimeOptionsHTML(selected) {
    const options = [['', 'Sin tiempo'], ['10', '10 segundos'], ['20', '20 segundos'], ['30', '30 segundos'], ['60', '60 segundos'], ['90', '90 segundos'], ['120', '120 segundos']];
    return options.map(([value, label]) => `<option value="${escapeAttr(value)}" ${String(selected || '') === value ? 'selected' : ''}>${escapeHTML(label)}</option>`).join('');
  }
  function quizStudioReplicateItemHTML(assignment, selected = []) {
    const active = selected.includes(assignment.id);
    return `
      <button class="em-quiz-studio-replicate-item ${active ? 'active' : ''}" type="button" data-studio-replicate="${escapeAttr(assignment.id)}">
        <span class="em-quiz-studio-replicate-copy"><strong>${escapeHTML(assignment.subject)} ${escapeHTML(assignment.grade)}-${escapeHTML(assignment.course)}</strong><span>Mismo grado</span></span>
        <span class="em-quiz-studio-replicate-check">✓</span>
      </button>
    `;
  }
  function quizStudioQuestionStripHTML(draft) {
    return `${draft.questions.map((question, index) => `<button class="em-quiz-studio-q-chip ${index === state.quizStudioQuestionIndex ? 'active' : ''}" type="button" data-studio-question-index="${index}">${index + 1}</button>`).join('')}<button class="em-quiz-studio-add-question" type="button" id="quizStudioAddQuestionBtn">+ Añadir pregunta</button>`;
  }
  function quizStudioImageEditorHTML(question) {
    const hasImage = Boolean(question.image);
    return `
      <section class="em-quiz-studio-image-uploader">
        <div class="em-quiz-studio-image-head">
          <div class="em-quiz-studio-image-title"><strong>Imagen de la pregunta</strong><span>Opcional. Cada pregunta guarda su propia imagen.</span></div>
          <label class="em-quiz-studio-image-btn">Añadir imagen<input class="em-quiz-studio-file-input" id="quizStudioQuestionImage" type="file" accept="image/*" /></label>
        </div>
        <div class="em-quiz-studio-image-preview ${hasImage ? 'is-filled' : ''}" id="quizStudioImagePreviewBox" role="button" tabindex="0" aria-label="Añadir o cambiar imagen de la pregunta">
          ${hasImage ? `<img src="${escapeAttr(question.image)}" alt="Imagen de la pregunta" />` : '<div class="em-quiz-studio-image-empty"><strong>Sin imagen</strong><span>Puedes subir una gráfica, foto, captura o recurso visual para esta pregunta.</span></div>'}
        </div>
        <div class="em-quiz-studio-image-actions">
          <label class="em-quiz-studio-image-btn">Cambiar imagen<input class="em-quiz-studio-file-input" id="quizStudioQuestionImageAlt" type="file" accept="image/*" /></label>
          <button class="em-quiz-studio-image-remove" type="button" id="quizStudioRemoveImageBtn">Quitar imagen</button>
        </div>
      </section>
    `;
  }
  function quizStudioAnswerCardsHTML(question) {
    const config = QUIZ_STUDIO_TYPES[question.type] || QUIZ_STUDIO_TYPES.multiple_choice;
    return question.options.map((value, index) => `
      <article class="em-quiz-studio-answer-card ${config.fixed ? 'is-fixed' : ''} ${config.organize ? 'is-organize' : ''}">
        ${config.organize ? `<span class="em-quiz-studio-order-badge">${index + 1}</span>` : ''}
        ${config.organize ? '' : `<button class="em-quiz-studio-answer-check ${index === question.correct ? 'active' : ''}" type="button" data-studio-correct-index="${index}" aria-label="Marcar como correcta">✓</button>`}
        <textarea class="em-quiz-studio-answer-text" data-studio-option-index="${index}" ${config.fixed ? 'readonly' : ''}>${escapeHTML(value || '')}</textarea>
      </article>
    `).join('');
  }
  function quizStudioShortEditorHTML(question) {
    return `
      <div class="em-quiz-studio-short-box active">
        <div class="em-quiz-studio-short-answer-card">
          <label class="em-quiz-studio-field"><span class="em-quiz-studio-label">Respuesta esperada</span><input class="em-quiz-studio-input" id="quizStudioShortAnswer" value="${escapeAttr(question.shortAnswer || '')}" /></label>
          <label class="em-quiz-studio-field"><span class="em-quiz-studio-label">Límite de caracteres</span><input class="em-quiz-studio-input" id="quizStudioShortLimit" type="number" min="1" max="300" value="${escapeAttr(question.charLimit || 40)}" /></label>
        </div>
      </div>
    `;
  }
  function activateQuizStudioTab(tab = 'data') {
    if (!['data', 'questions', 'replicate'].includes(tab)) tab = 'data';
    state.quizStudioTab = tab;
    document.querySelectorAll('[data-studio-tab]').forEach((button) => {
      button.classList.toggle('active', button.dataset.studioTab === tab);
    });
    document.querySelectorAll('.em-quiz-studio-tab-panel').forEach((panel) => {
      panel.classList.toggle('active', panel.id === `quizStudioTab${tab.charAt(0).toUpperCase()}${tab.slice(1)}`);
    });
  }
  function bindQuizStudioEvents() {
    document.getElementById('quizStudioBackBtn')?.addEventListener('click', closeQuizStudio);
    document.querySelectorAll('[data-studio-tab]').forEach((button) => button.addEventListener('click', () => { saveQuizStudioFromDOM(); activateQuizStudioTab(button.dataset.studioTab || 'data'); }));
    document.getElementById('quizStudioTitle')?.addEventListener('input', saveQuizStudioFromDOM);
    const untilInput = document.getElementById('quizStudioUntil');
    untilInput?.addEventListener('change', saveQuizStudioFromDOM);
    untilInput?.addEventListener('click', () => { try { untilInput.showPicker?.(); } catch (error) {} });
    untilInput?.addEventListener('focus', () => { try { untilInput.showPicker?.(); } catch (error) {} });
    document.getElementById('quizStudioAttempts')?.addEventListener('change', saveQuizStudioFromDOM);
    document.getElementById('quizStudioShuffleQuestions')?.addEventListener('click', (event) => { const draft = getQuizStudioDraft(); draft.shuffleQuestions = !draft.shuffleQuestions; event.currentTarget.classList.toggle('active', draft.shuffleQuestions); });
    document.getElementById('quizStudioShuffleOptions')?.addEventListener('click', (event) => { const draft = getQuizStudioDraft(); draft.shuffleOptions = !draft.shuffleOptions; event.currentTarget.classList.toggle('active', draft.shuffleOptions); });
    document.getElementById('quizStudioShowCorrectAfterAttempt')?.addEventListener('click', (event) => { const draft = getQuizStudioDraft(); draft.showCorrectAfterAttempt = !draft.showCorrectAfterAttempt; event.currentTarget.classList.toggle('active', draft.showCorrectAfterAttempt); });
    document.querySelectorAll('[data-studio-replicate]').forEach((button) => button.addEventListener('click', () => { const draft = getQuizStudioDraft(); const id = button.dataset.studioReplicate || ''; const set = new Set(draft.replicateAssignmentIds || []); if (set.has(id)) set.delete(id); else set.add(id); draft.replicateAssignmentIds = [...set]; button.classList.toggle('active', set.has(id)); }));
    document.querySelectorAll('[data-studio-question-index]').forEach((button) => button.addEventListener('click', () => { saveQuizStudioFromDOM(); state.quizStudioQuestionIndex = Number(button.dataset.studioQuestionIndex || 0); state.quizStudioTab = 'questions'; renderQuizStudio(); }));
    document.getElementById('quizStudioAddQuestionBtn')?.addEventListener('click', () => { saveQuizStudioFromDOM(); const draft = getQuizStudioDraft(); draft.questions.push(createQuizStudioQuestion('multiple_choice')); state.quizStudioQuestionIndex = draft.questions.length - 1; state.quizStudioTab = 'questions'; renderQuizStudio(); toast('Pregunta añadida.'); });
    document.getElementById('quizStudioQuestionType')?.addEventListener('change', (event) => { const draft = getQuizStudioDraft(); const question = draft.questions[state.quizStudioQuestionIndex]; question.type = event.target.value; Object.assign(question, normalizeQuizStudioQuestion({ ...question, type: event.target.value, options: [...(QUIZ_STUDIO_TYPES[event.target.value]?.defaults || [])], correct: 0 })); state.quizStudioTab = 'questions'; renderQuizStudio(); });
    document.getElementById('quizStudioQuestionTime')?.addEventListener('change', saveQuizStudioFromDOM);
    ['quizStudioQuestionText','quizStudioShortAnswer','quizStudioShortLimit'].forEach((id) => document.getElementById(id)?.addEventListener('input', saveQuizStudioFromDOM));
    document.querySelectorAll('[data-studio-option-index]').forEach((input) => input.addEventListener('input', saveQuizStudioFromDOM));
    document.querySelectorAll('[data-studio-correct-index]').forEach((button) => button.addEventListener('click', () => { const draft = getQuizStudioDraft(); draft.questions[state.quizStudioQuestionIndex].correct = Number(button.dataset.studioCorrectIndex || 0); document.querySelectorAll('[data-studio-correct-index]').forEach((item) => item.classList.toggle('active', item === button)); }));
    document.getElementById('quizStudioQuestionImage')?.addEventListener('change', handleQuizStudioImage);
    document.getElementById('quizStudioQuestionImageAlt')?.addEventListener('change', handleQuizStudioImage);
    const imagePreview = document.getElementById('quizStudioImagePreviewBox');
    imagePreview?.addEventListener('click', () => document.getElementById('quizStudioQuestionImage')?.click());
    imagePreview?.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); document.getElementById('quizStudioQuestionImage')?.click(); } });
    document.getElementById('quizStudioRemoveImageBtn')?.addEventListener('click', () => { getQuizStudioDraft().questions[state.quizStudioQuestionIndex].image = ''; state.quizStudioTab = 'questions'; renderQuizStudio(); toast('Imagen quitada.'); });
    document.getElementById('quizStudioDuplicateBtn')?.addEventListener('click', duplicateQuizStudioQuestion);
    document.getElementById('quizStudioDeleteBtn')?.addEventListener('click', deleteQuizStudioQuestion);
    document.getElementById('quizStudioSaveBtn')?.addEventListener('click', () => saveQuizStudio('draft'));
    document.getElementById('quizStudioPublishBtn')?.addEventListener('click', () => saveQuizStudio('published'));
  }
  function saveQuizStudioFromDOM() {
    const draft = getQuizStudioDraft();
    const title = document.getElementById('quizStudioTitle');
    const until = document.getElementById('quizStudioUntil');
    const attempts = document.getElementById('quizStudioAttempts');
    if (title) draft.title = title.value;
    if (until) draft.availableUntil = until.value;
    if (attempts) draft.attempts = attempts.value;
    const showCorrect = document.getElementById('quizStudioShowCorrectAfterAttempt');
    if (showCorrect) draft.showCorrectAfterAttempt = showCorrect.classList.contains('active');
    const question = draft.questions[state.quizStudioQuestionIndex];
    if (!question) return draft;
    const type = document.getElementById('quizStudioQuestionType');
    const time = document.getElementById('quizStudioQuestionTime');
    const text = document.getElementById('quizStudioQuestionText');
    if (type) question.type = type.value;
    if (time) question.time = time.value;
    if (text) question.text = text.value;
    const config = QUIZ_STUDIO_TYPES[question.type] || QUIZ_STUDIO_TYPES.multiple_choice;
    if (config.short) {
      const shortAnswer = document.getElementById('quizStudioShortAnswer');
      const shortLimit = document.getElementById('quizStudioShortLimit');
      if (shortAnswer) question.shortAnswer = shortAnswer.value;
      if (shortLimit) question.charLimit = Number(shortLimit.value || 40);
    } else if (!config.fixed) {
      document.querySelectorAll('[data-studio-option-index]').forEach((input) => {
        question.options[Number(input.dataset.studioOptionIndex || 0)] = input.value;
      });
    }
    draft.questions[state.quizStudioQuestionIndex] = normalizeQuizStudioQuestion(question);
    return draft;
  }
  function handleQuizStudioImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast('Solo imagen.'); return; }
    if (file.size > 1800000) { toast('Imagen muy pesada.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      getQuizStudioDraft().questions[state.quizStudioQuestionIndex].image = String(reader.result || '');
      renderQuizStudio();
      toast('Imagen añadida.');
    };
    reader.readAsDataURL(file);
  }
  function duplicateQuizStudioQuestion() {
    saveQuizStudioFromDOM();
    const draft = getQuizStudioDraft();
    const copy = quizStudioDeepClone(draft.questions[state.quizStudioQuestionIndex]);
    copy.id = quizStudioId('studio_q');
    draft.questions.splice(state.quizStudioQuestionIndex + 1, 0, copy);
    state.quizStudioQuestionIndex += 1;
    renderQuizStudio();
    toast('Pregunta duplicada.');
  }
  function deleteQuizStudioQuestion() {
    const draft = getQuizStudioDraft();
    if (draft.questions.length <= 1) { toast('Debe quedar 1 pregunta.'); return; }
    draft.questions.splice(state.quizStudioQuestionIndex, 1);
    state.quizStudioQuestionIndex = Math.max(0, state.quizStudioQuestionIndex - 1);
    renderQuizStudio();
    toast('Pregunta eliminada.');
  }
  function openQuizStudioPreview() {
    saveQuizStudioFromDOM();
    const box = document.getElementById('quizStudioPreviewBox');
    if (!box) return;
    box.hidden = false;
    box.innerHTML = quizStudioPreviewHTML();
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function quizStudioPreviewHTML() {
    const draft = getQuizStudioDraft();
    const question = normalizeQuizStudioQuestion(draft.questions[state.quizStudioQuestionIndex]);
    const config = QUIZ_STUDIO_TYPES[question.type] || QUIZ_STUDIO_TYPES.multiple_choice;
    const timeText = question.time ? `${question.time} segundos` : 'Sin tiempo';
    return `
      <header class="em-quiz-studio-preview-top"><strong class="em-quiz-studio-preview-title">${escapeHTML(draft.title || 'Quiz sin nombre')}</strong><span class="em-quiz-studio-preview-meta">Pregunta ${state.quizStudioQuestionIndex + 1} · ${escapeHTML(config.label)} · ${escapeHTML(timeText)}</span></header>
      <div class="em-quiz-studio-preview-body">
        ${question.image ? `<div class="em-quiz-studio-preview-image show"><img src="${escapeAttr(question.image)}" alt="Imagen de vista previa" /></div>` : ''}
        <p class="em-quiz-studio-preview-question">${escapeHTML(question.text || 'Pregunta sin texto')}</p>
        ${config.short ? `<div class="em-quiz-studio-preview-short"><input placeholder="Escribe tu respuesta..." maxlength="${Number(question.charLimit || 40)}" /><span>Máximo ${Number(question.charLimit || 40)} caracteres</span></div>` : `<div class="em-quiz-studio-preview-options">${question.options.map((option) => `<button class="em-quiz-studio-preview-option" type="button">${escapeHTML(option || 'Opción')}</button>`).join('')}</div>`}
      </div>
    `;
  }
  function validateQuizStudioDraft() {
    const draft = saveQuizStudioFromDOM();
    if (!String(draft.title || '').trim()) { toast('Falta nombre.'); state.quizStudioTab = 'data'; renderQuizStudio(); return false; }
    if (!draft.questions.length) { toast('Falta pregunta.'); state.quizStudioTab = 'questions'; renderQuizStudio(); return false; }
    for (let index = 0; index < draft.questions.length; index += 1) {
      const question = normalizeQuizStudioQuestion(draft.questions[index]);
      const config = QUIZ_STUDIO_TYPES[question.type] || QUIZ_STUDIO_TYPES.multiple_choice;
      if (!String(question.text || '').trim()) { toast(`Falta texto P${index + 1}.`); state.quizStudioQuestionIndex = index; state.quizStudioTab = 'questions'; renderQuizStudio(); return false; }
      if (config.short) {
        if (!String(question.shortAnswer || '').trim()) { toast(`Falta respuesta P${index + 1}.`); state.quizStudioQuestionIndex = index; state.quizStudioTab = 'questions'; renderQuizStudio(); return false; }
        if (!Number(question.charLimit || 0)) { toast(`Falta límite P${index + 1}.`); state.quizStudioQuestionIndex = index; state.quizStudioTab = 'questions'; renderQuizStudio(); return false; }
      } else {
        if (question.options.some((option) => !String(option || '').trim())) { toast(`Faltan opciones P${index + 1}.`); state.quizStudioQuestionIndex = index; state.quizStudioTab = 'questions'; renderQuizStudio(); return false; }
        if (!config.organize && (question.correct < 0 || question.correct >= question.options.length)) { toast(`Falta correcta P${index + 1}.`); state.quizStudioQuestionIndex = index; state.quizStudioTab = 'questions'; renderQuizStudio(); return false; }
      }
    }
    return true;
  }
  function quizStudioQuestionToApp(question, index = 0) {
    const q = normalizeQuizStudioQuestion(question);
    const id = quizStudioId('q');
    const timeLimit = parseQuizStudioTimeLimit(q.time);
    const common = {
      id,
      type: q.type,
      prompt: q.text,
      textA: q.text,
      textB: '',
      image: q.image || '',
      imageAlt: q.image ? 'Imagen de la pregunta' : '',
      source: 'quiz-studio'
    };
    if (timeLimit) common.timeLimit = timeLimit;
    if (q.type === 'flip') {
      const colors = ['red', 'blue', 'yellow', 'green', 'orange', 'purple'];
      common.options = q.options.slice(0, 6).map((text, i) => ({
        id: String.fromCharCode(97 + i),
        text,
        correct: i === q.correct,
        color: colors[i] || 'blue'
      }));
      return normalizeQuizQuestionForPlayer(common, index);
    }
    if (q.type === 'order') {
      const colors = ['red', 'blue', 'yellow', 'green'];
      const cards = q.options.slice(0, 4).map((text, i) => ({
        id: `card-${i + 1}`,
        text,
        order: i + 1,
        color: colors[i] || 'blue'
      }));
      common.cards = cards;
      common.correctOrder = cards.map((card) => card.id);
      return normalizeQuizQuestionForPlayer(common, index);
    }
    if (q.type === 'true_false') {
      common.options = [
        { id: 'true', text: 'Verdadero', correct: q.correct === 0 },
        { id: 'false', text: 'Falso', correct: q.correct === 1 }
      ];
      return normalizeQuizQuestionForPlayer(common, index);
    }
    if (q.type === 'open') {
      common.expectedAnswer = q.shortAnswer;
      common.charLimit = Number(q.charLimit || 40);
      common.maxLength = Number(q.charLimit || 40);
      return normalizeQuizQuestionForPlayer(common, index);
    }
    common.options = q.options.slice(0, 4).map((text, i) => ({
      id: String.fromCharCode(97 + i),
      text,
      correct: i === q.correct
    }));
    return normalizeQuizQuestionForPlayer(common, index);
  }
  function quizStudioDraftToAppQuiz(draft, assignment, status = 'draft') {
    const now = Date.now();
    const attempts = String(draft.attempts || '1') === '∞' ? null : Number(draft.attempts || 1);
    const editQuizId = String(draft.editQuizId || draft.context?.editQuizId || '');
    const quiz = {
      id: editQuizId || quizStudioId('quiz'),
      title: String(draft.title || '').trim(),
      emoji: '🎮',
      mode: status === 'published' ? 'Publicado' : 'Borrador',
      status,
      source: 'quiz-studio',
      legacyFormat: true,
      period: Number(draft.context?.period || state.quizPeriod || 1),
      assignmentIds: [assignment.id],
      subject: assignment.subject,
      area: assignment.area,
      academicGrade: assignment.grade,
      courseGrade: assignment.grade,
      course: assignment.course,
      groupId: assignment.id,
      availableUntil: draft.availableUntil || '',
      attempts,
      shuffleQuestions: Boolean(draft.shuffleQuestions),
      shuffleOptions: Boolean(draft.shuffleOptions),
      showCorrectAfterAttempt: Boolean(draft.showCorrectAfterAttempt),
      createdAt: draft.createdAt || now,
      updatedAt: now,
      questions: draft.questions.map(quizStudioQuestionToApp)
    };
    return quiz;
  }
  function cloneQuizForAssignment(baseQuiz, assignment) {
    const copy = quizStudioDeepClone(baseQuiz);
    copy.id = quizStudioId('quiz');
    copy.assignmentIds = [assignment.id];
    copy.subject = assignment.subject;
    copy.area = assignment.area;
    delete copy.grade;
    copy.academicGrade = assignment.grade;
    copy.courseGrade = assignment.grade;
    copy.course = assignment.course;
    copy.groupId = assignment.id;
    copy.createdAt = Date.now();
    copy.updatedAt = Date.now();
    copy.questions = (copy.questions || []).map((question) => ({ ...quizStudioDeepClone(question), id: quizStudioId('q') }));
    return copy;
  }
  async function saveQuizStudio(status = 'draft') {
    if (!validateQuizStudioDraft()) return;
    const draft = getQuizStudioDraft();
    const context = state.quizStudioContext || createQuizStudioContext();
    const currentAssignment = state.data.assignments.find((item) => item.id === context.assignmentId) || state.assignment;
    if (!currentAssignment) { toast('No hay grupo activo.'); return; }
    const baseQuiz = quizStudioDraftToAppQuiz(draft, currentAssignment, status);
    const targets = getSameGradeQuizStudioTargets(context).filter((assignment) => (draft.replicateAssignmentIds || []).includes(assignment.id));
    const copies = targets.map((assignment) => cloneQuizForAssignment(baseQuiz, assignment));
    const local = getLocalQuizzes().filter((quiz) => String(quiz?.id || '') !== String(baseQuiz.id || ''));
    try {
      await saveLocalQuizzes([...local, baseQuiz, ...copies]);
      state.quizActiveId = baseQuiz.id;
      localStorage.setItem('encisomath:quizActiveId', baseQuiz.id);
      toast(copies.length ? `Quiz ${status === 'published' ? 'publicado' : 'guardado'} y replicado en ${copies.length} cursos.` : `Quiz ${status === 'published' ? 'publicado' : 'guardado'}.`);
      window.setTimeout(closeQuizStudio, 720);
    } catch (error) {
      reportCloudError('No se pudo guardar el quiz en Supabase', error);
    }
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
    const studioSourceClass = quiz.source === 'quiz-studio' || question.source === 'quiz-studio' || quiz.legacyFormat === true ? 'quiz-source-studio' : '';
    return `
      <section class="quiz-stage quiz-type-${escapeAttr(question.type || 'question')} ${studioSourceClass} ${fullscreen ? 'quiz-stage-fullscreen quiz-item-enter-ready' : ''}" data-quiz-stage="${escapeAttr(quiz.id)}" data-quiz-question-index="${index}" data-quiz-has-image="${question.image ? 'true' : 'false'}" data-quiz-image-preview-key="${escapeAttr(`${quiz.id || 'quiz'}:${question.id || index}`)}">
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
          savePreferencesToCloud();
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
            const revealCorrect = shouldShowCorrectAfterAttempt();
            if (revealCorrect && correctCard && correctCard !== selected) {
              setQuizFlipCardOpen(correctCard, true);
              window.setTimeout(() => runRevealAnimation(correctCard, true), 430);
            }
            showQuizFeedbackBandAfterDelay(stage, false, question, '', Math.max(QUIZ_FEEDBACK_AFTER_CHOICE_REVEAL_MS, revealCorrect && correctCard && correctCard !== selected ? 980 : 720));
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
        const revealOrderCorrect = ok || shouldShowCorrectAfterAttempt();
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
          const matched = revealOrderCorrect && selected[index] === correctOrder[index];
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
          recordQuizAnswer(question, ok, { order: selected, correctOrder, revealCorrectAfterAttempt: revealOrderCorrect, timing: answerTiming });
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
      runtimeQuizId: '',
      runtimeQuestionOrder: [],
      optionOrderByQuestionId: {},
      runtimeQuestions: [],
      shuffleQuestions: false,
      shuffleOptions: false,
      showCorrectAfterAttempt: false,
      timeScoringMode: normalizeQuizTimeScoringMode(state.quizTimeScoringMode),
      cloudAttemptId: '',
      cloudAttemptPromise: null,
      cloudSubmitted: false
    };
    return state.quizSession;
  }
  function beginCloudQuizAttempt(quiz) {
    const quizSession = getQuizSession();
    if (!isCloudReady() || !quiz || !state.assignment?.id) return;
    quizSession.cloudSubmitted = false;
    quizSession.cloudAttemptPromise = cloudAPI().startQuizAttempt({
      quiz,
      assignmentId: state.assignment.id
    }).then((attempt) => {
      quizSession.cloudAttemptId = attempt?.id || '';
      return quizSession.cloudAttemptId;
    }).catch((error) => {
      reportCloudError('El quiz comenzó, pero no se creó el intento en Supabase', error);
      return '';
    });
  }
  async function persistCloudQuizAttempt(quiz) {
    const quizSession = getQuizSession();
    if (!isCloudReady() || quizSession.cloudSubmitted || !quiz || !state.assignment?.id) return;
    quizSession.cloudSubmitted = true;
    try {
      const attemptId = quizSession.cloudAttemptId || await quizSession.cloudAttemptPromise;
      if (!attemptId) {
        quizSession.cloudSubmitted = false;
        return;
      }
      await cloudAPI().submitQuizAttempt({
        attemptId,
        quiz,
        assignmentId: state.assignment.id,
        answers: quizSession.answers || [],
        securityEvents: quizSession.securityEvents || [],
        terminatedReason: quizSession.securityTerminatedReason || ''
      });
    } catch (error) {
      quizSession.cloudSubmitted = false;
      reportCloudError('No se guardó el resultado del quiz en Supabase', error);
    }
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

  // v0.24.299: centra horizontalmente quiz-question-content contra el viewport real
  // sin cambiar alturas, grillas, respuestas, imagen ni contenido interno.
  function quizQuestionContentTarget(root = document) {
    return root?.querySelector?.('.quiz-fullscreen-layer:not(.quiz-phase-transition):not(.quiz-phase-results) .quiz-stage-fullscreen .quiz-question-content') || null;
  }

  function quizQuestionContentViewportWidth() {
    return Math.floor(window.visualViewport?.width || window.innerWidth || document.documentElement.clientWidth || 0);
  }

  function quizQuestionContentCurrentShift(node) {
    const raw = Number.parseFloat(node?.style?.getPropertyValue?.('--em-qcontent-stable-x') || '0');
    return Number.isFinite(raw) ? raw : 0;
  }

  function centerQuizQuestionContent(iteration = 0) {
    const node = quizQuestionContentTarget();
    const viewport = quizQuestionContentViewportWidth();
    if (!node || !viewport) return;

    const rect = node.getBoundingClientRect();
    const currentX = quizQuestionContentCurrentShift(node);
    const leftGap = rect.left;
    const rightGap = viewport - rect.right;
    const correction = (rightGap - leftGap) / 2;
    const nextX = Math.round(currentX + correction);

    node.style.setProperty('--em-qcontent-stable-x', `${nextX}px`);

    if (iteration < 4 && Math.abs(correction) > 0.35) {
      window.requestAnimationFrame(() => centerQuizQuestionContent(iteration + 1));
    }
  }

  function scheduleQuizQuestionContentCenter() {
    window.clearTimeout(state.quizQuestionContentCenterTimer);
    state.quizQuestionContentCenterTimer = window.setTimeout(() => centerQuizQuestionContent(0), 80);
  }

  function bindQuizQuestionContentCenterResize() {
    if (state.quizQuestionContentCenterResizeBound) return;
    state.quizQuestionContentCenterResizeBound = true;
    window.addEventListener('resize', scheduleQuizQuestionContentCenter, { passive: true });
    window.visualViewport?.addEventListener?.('resize', scheduleQuizQuestionContentCenter, { passive: true });
  }

  // v0.24.302: ajustes persistentes del player para que ABCD no se corte
  // y Verdadero/Falso conserve el flujo normal con el texto de pregunta centrado verticalmente y alineado a la izquierda.
  function quizActiveFullscreenStage(root = document) {
    return root?.querySelector?.('.quiz-fullscreen-layer:not(.quiz-phase-transition):not(.quiz-phase-results) .quiz-stage-fullscreen') || null;
  }

  function quizStageAnswerParts(stage) {
    const answerZone = stage?.querySelector?.('.quiz-answer-zone.quiz-tune-box') || null;
    const grid = stage?.querySelector?.('.kahoot-grid') || null;
    const options = grid ? Array.from(grid.querySelectorAll('.kahoot-option')) : [];
    return { answerZone, grid, options };
  }

  function quizStageIsTrueFalse(stage) {
    if (!stage?.classList?.contains?.('quiz-type-true_false')) return false;
    const { options } = quizStageAnswerParts(stage);
    if (options.length !== 2) return false;
    const txt = options.map((option) => String(option.textContent || '').trim().toLowerCase()).join(' ');
    return txt.includes('verdadero') && txt.includes('falso');
  }

  function quizStageIsAbcd(stage) {
    if (!stage?.classList?.contains?.('quiz-type-multiple_choice')) return false;
    const { grid, options } = quizStageAnswerParts(stage);
    return Boolean(grid && options.length >= 4 && !stage.querySelector('textarea, input[type="text"]'));
  }

  function removeQuizAnswerInlineLayout(nodes = []) {
    const props = [
      'position', 'left', 'right', 'top', 'bottom', 'transform', 'translate', 'z-index',
      'width', 'max-width', 'min-width', 'height', 'max-height', 'min-height',
      'margin', 'margin-left', 'margin-right', 'padding', 'grid-template-columns', 'grid-template-rows'
    ];
    nodes.filter(Boolean).forEach((node) => {
      props.forEach((prop) => node.style?.removeProperty?.(prop));
    });
  }

  function quizViewportHeight() {
    return Math.floor(window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight || 0);
  }

  function applyQuizAbcdNoCutLayout(root = document) {
    const stage = quizActiveFullscreenStage(root);
    if (!stage) return;
    const { answerZone, grid, options } = quizStageAnswerParts(stage);
    if (!answerZone || !grid || !quizStageIsAbcd(stage)) {
      stage.classList?.remove?.('em-abcd-no-cut-hard');
      stage.style?.removeProperty?.('--em-abcd-hard-zone-h');
      stage.style?.removeProperty?.('--em-abcd-hard-grid-h');
      return;
    }

    stage.classList.add('em-abcd-no-cut-hard');

    const viewportH = quizViewportHeight();
    const gridTop = Math.ceil(grid.getBoundingClientRect().top);
    const safe = Number(state.emAbcdBottomSafe || 38);
    const available = Math.max(120, viewportH - gridTop - safe);

    stage.style.setProperty('--em-abcd-hard-zone-h', `${available}px`);
    stage.style.setProperty('--em-abcd-hard-grid-h', `${available}px`);
  }

  function applyQuizTrueFalseFlowCleanLayout(root = document) {
    const stage = quizActiveFullscreenStage(root);
    if (!stage) return;
    const { answerZone, grid, options } = quizStageAnswerParts(stage);
    const textA = stage.querySelector('.quiz-text-a.quiz-tune-box');

    if (!answerZone || !grid || !quizStageIsTrueFalse(stage)) {
      stage.classList.remove('em-tf-flow-clean');
      stage.style.removeProperty('--em-tf-clean-answer-h');
      return;
    }

    removeQuizAnswerInlineLayout([answerZone, grid, ...options]);

    stage.classList.add('em-tf-flow-clean');
    stage.classList.remove('em-tf-exact-match', 'em-tf-colchon-text', 'em-tf-match-abcd');

    const viewportH = quizViewportHeight();
    const zoneTop = Math.ceil(answerZone.getBoundingClientRect().top);
    const safe = Number(state.emTfCleanBottomSafe || state.emAbcdBottomSafe || 38);
    const h = Math.max(105, viewportH - zoneTop - safe);

    stage.style.setProperty('--em-tf-clean-answer-h', `${h}px`);

    answerZone.style.setProperty('position', 'relative', 'important');
    answerZone.style.setProperty('width', '100%', 'important');
    answerZone.style.setProperty('max-width', '100%', 'important');
    answerZone.style.setProperty('height', `${h}px`, 'important');
    answerZone.style.setProperty('max-height', `${h}px`, 'important');
    answerZone.style.setProperty('padding', '0', 'important');
    answerZone.style.setProperty('margin', '0', 'important');
    answerZone.style.setProperty('overflow', 'hidden', 'important');
    answerZone.style.setProperty('box-sizing', 'border-box', 'important');

    grid.style.setProperty('width', '100%', 'important');
    grid.style.setProperty('height', '100%', 'important');
    grid.style.setProperty('display', 'grid', 'important');
    grid.style.setProperty('grid-template-columns', 'repeat(2, minmax(0, 1fr))', 'important');
    grid.style.setProperty('grid-template-rows', '1fr', 'important');
    grid.style.setProperty('gap', '6px', 'important');
    grid.style.setProperty('padding', '0', 'important');
    grid.style.setProperty('margin', '0', 'important');
    grid.style.setProperty('box-sizing', 'border-box', 'important');

    options.forEach((option) => {
      option.style.setProperty('width', '100%', 'important');
      option.style.setProperty('height', '100%', 'important');
      option.style.setProperty('min-width', '0', 'important');
      option.style.setProperty('min-height', '0', 'important');
      option.style.setProperty('display', 'flex', 'important');
      option.style.setProperty('align-items', 'center', 'important');
      option.style.setProperty('justify-content', 'center', 'important');
      option.style.setProperty('text-align', 'center', 'important');
      option.style.setProperty('padding', '8px 10px', 'important');
      option.style.setProperty('margin', '0', 'important');
      option.style.setProperty('box-sizing', 'border-box', 'important');
    });

    if (textA) {
      textA.style.setProperty('display', 'flex', 'important');
      textA.style.setProperty('flex-direction', 'column', 'important');
      textA.style.setProperty('justify-content', 'center', 'important');
      textA.style.setProperty('align-items', 'flex-start', 'important');
      textA.style.setProperty('text-align', 'left', 'important');
      textA.querySelectorAll('*').forEach((node) => {
        node.style.setProperty('text-align', 'left', 'important');
        node.style.setProperty('width', '100%', 'important');
      });
    }
  }

  function applyQuizAnswerLayoutFixes(root = document) {
    applyQuizAbcdNoCutLayout(root);
    applyQuizTrueFalseFlowCleanLayout(root);
  }

  function scheduleQuizAnswerLayoutFixes() {
    window.clearTimeout(state.quizAnswerLayoutFixTimer);
    state.quizAnswerLayoutFixTimer = window.setTimeout(() => applyQuizAnswerLayoutFixes(document), 80);
  }

  function bindQuizAnswerLayoutFixResize() {
    if (state.quizAnswerLayoutFixResizeBound) return;
    state.quizAnswerLayoutFixResizeBound = true;
    window.addEventListener('resize', scheduleQuizAnswerLayoutFixes, { passive: true });
    window.visualViewport?.addEventListener?.('resize', scheduleQuizAnswerLayoutFixes, { passive: true });
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
    bindQuizQuestionContentCenterResize();
    scheduleQuizQuestionContentCenter();
    bindQuizAnswerLayoutFixResize();
    scheduleQuizAnswerLayoutFixes();
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
  function refreshQuizLibrary(animate = false) {
    const library = document.getElementById('quizLibrary');
    if (!library) return;
    const quizzes = getQuizzesForCurrentAssignment();
    const activeQuiz = getActiveQuiz(quizzes);
    library.className = `em-content-list is-${state.quizViewMode}`;
    library.innerHTML = quizzes.map((quiz, index) => quizCardButtonHTML(quiz, activeQuiz?.id === quiz.id, index)).join('') || emPeriodEmptyStateHTML('quizzes', state.quizPeriod);
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
      const correctButton = stage.querySelector('[data-quiz-answer][data-correct="true"]');
      recordQuizAnswer(question, selectedCorrect, { selected: session.selectedAnswerId, correctAnswer: correctButton?.dataset.quizAnswer || '', timing: answerTiming });
      revealQuizAnswer(stage, button, selectedCorrect, shouldShowCorrectAfterAttempt());
      playQuizSound(selectedCorrect ? 'correct' : 'wrong');
      showQuizFeedbackBandAfterDelay(stage, selectedCorrect, question, '', QUIZ_FEEDBACK_AFTER_CHOICE_REVEAL_MS);
    }, 1000);
  }
  function revealQuizAnswer(stage, selectedButton, selectedCorrect, showCorrectAfterAttempt = shouldShowCorrectAfterAttempt()) {
    stage.classList.remove('quiz-choice-pending');
    stage.classList.add('quiz-choice-revealed');
    keepQuizRevealOverflowOpen(1700);
    const revealCorrect = selectedCorrect || Boolean(showCorrectAfterAttempt);
    const items = Array.from(stage.querySelectorAll('[data-quiz-answer]'));
    const revealItems = [];
    items.forEach((item) => {
      const isCorrect = item.dataset.correct === 'true';
      const isWrongSelection = item === selectedButton && !selectedCorrect;
      const shouldRevealItem = isWrongSelection || (isCorrect && revealCorrect);
      const unused = !shouldRevealItem;
      item.classList.remove('selected', 'correct-reveal', 'wrong-reveal', 'unused-reveal', 'kahoot-reveal-pop', 'kahoot-reveal-wrong', 'kahoot-reveal-correct');
      item.classList.toggle('is-dimmed', unused);
      item.classList.toggle('unused-reveal', unused);
      if (shouldRevealItem) revealItems.push({ item, isCorrect });
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
    prepareQuizAttemptRuntime(quiz);
    beginCloudQuizAttempt(quiz);
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
    persistCloudQuizAttempt(quiz);
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

  function emActActivitiesHeroHTML(subjectName = 'ESTADÍSTICA', gradeCourse = '113PPAL') {
    const eyebrow = `${escapeHTML(subjectName)} • ${escapeHTML(gradeCourse)}`;
    return `
      <div class="em-act-shapes" aria-hidden="true">
        <span class="em-act-shape em-act-shape-circle"></span>
        <span class="em-act-shape em-act-shape-square"></span>
        <span class="em-act-shape em-act-shape-triangle"></span>
        <span class="em-act-shape em-act-shape-x"></span>
      </div>
      <div class="em-act-board" aria-hidden="true">
        <span class="em-act-sheet em-act-sheet-back"></span>
        <span class="em-act-sheet em-act-sheet-mid"></span>
        <span class="em-act-sheet em-act-sheet-front">
          <i class="em-act-sheet-line em-act-line-one"></i>
          <i class="em-act-sheet-line em-act-line-two"></i>
          <i class="em-act-sheet-line em-act-line-three"></i>
          <i class="em-act-check em-act-check-one">✓</i>
          <i class="em-act-check em-act-check-two">✓</i>
        </span>
        <span class="em-act-pencil">✎</span>
      </div>
      <div class="em-act-content">
        <span class="em-act-eyebrow">${eyebrow}</span>
        <h1 class="em-act-title">ACTIVIDADES</h1>
        <p class="em-act-subtitle">Práctica, creación y trabajo para entregar.</p>
      </div>
    `;
  }

  function emPeriodEmptyStateHTML(type, period) {
    const safePeriod = [1, 2, 3, 4].includes(Number(period)) ? Number(period) : 1;
    const content = {
      activities: {
        icon: '📝',
        title: 'Aún no hay actividades',
        copy: 'Este espacio queda para las actividades, entregas y trabajos del periodo.'
      },
      classes: {
        icon: '📚',
        title: 'Aún no hay clases',
        copy: 'Este espacio queda para las clases, explicaciones y recursos del periodo.'
      },
      quizzes: {
        icon: '🎮',
        title: 'Aún no hay quizzes',
        copy: 'Este espacio queda para las evaluaciones, prácticas y retos del periodo.'
      }
    }[type] || {
      icon: '📂',
      title: 'Aún no hay contenido',
      copy: 'Este espacio queda preparado para el contenido del periodo.'
    };
    return `
      <section class="em-period-empty em-period-empty-${escapeAttr(type)}" aria-live="polite">
        <div class="em-period-empty-icon" aria-hidden="true">${content.icon}</div>
        <p class="section-kicker">PERIODO ${safePeriod}</p>
        <h2>${content.title}</h2>
        <p>${content.copy}</p>
      </section>
    `;
  }

  function emActInitActivitiesHero(root = document) {
    const hero = root.querySelector?.('[data-em-activities-hero]');
    if (!hero) return;
    hero.classList.remove('is-live');
    // Reinicia las animaciones al entrar a la pestaña, incluso si el DOM se
    // acaba de reconstruir o una preferencia antigua había pausado efectos.
    void hero.offsetWidth;
    hero.classList.add('is-live');
    hero.querySelectorAll('.em-act-shape').forEach((shape, index) => {
      shape.style.setProperty('--em-act-shape-delay', `${-1.4 * (index + 1)}s`);
      shape.style.setProperty('--em-act-shape-duration', `${7.6 + index * 1.15}s`);
    });
  }

  function getActivitiesForCurrentAssignment() {
    const assignmentId = String(state.assignment?.id || '');
    return (state.data.activities || [])
      .filter((item) => {
        const ids = Array.isArray(item.assignmentIds) ? item.assignmentIds : [item.assignmentId].filter(Boolean);
        return ids.includes(assignmentId);
      })
      .sort((a, b) => Number(b.sortOrder || 0) - Number(a.sortOrder || 0));
  }

  function activityTypeLabel(type) {
    return ({ pdf: 'PDF', image: 'Imágenes', rich_text: 'Texto enriquecido', html_css: 'HTML + CSS' })[type] || 'Contenido';
  }

  function activityRelatedLesson(activity) {
    return (state.data.classes || []).find((item) => String(item.id) === String(activity.lessonId || '')) || null;
  }

  function activityProgressForCurrentAssignment(activity) {
    const assignmentId = String(state.assignment?.id || '');
    const stored = activity?.progressByAssignment?.[assignmentId] || {};
    const fallbackTotal = state.assignment ? getStudentsForAssignment(state.assignment).length : 0;
    const total = Math.max(0, Number(stored.total ?? fallbackTotal) || 0);
    const delivered = Math.max(0, Math.min(total || Number.MAX_SAFE_INTEGER, Number(stored.delivered || 0)));
    const graded = Math.max(0, Math.min(total || Number.MAX_SAFE_INTEGER, Number(stored.graded || 0)));
    const percentage = total ? Math.round((graded / total) * 100) : 0;
    const rawAverage = stored.average;
    const average = rawAverage === null || rawAverage === undefined || rawAverage === ''
      ? null
      : Math.max(0, Math.min(100, Number(rawAverage)));
    return {
      total,
      delivered,
      graded,
      percentage,
      average: Number.isFinite(average) ? average : null,
      pending: Math.max(0, total - graded)
    };
  }

  function activityAverageBand(average) {
    if (!Number.isFinite(average)) return 'is-empty';
    if (average >= 90) return 'is-gold';
    if (average >= 80) return 'is-green';
    if (average >= 70) return 'is-yellow';
    if (average >= 60) return 'is-orange';
    return 'is-red';
  }

  function formatActivityAverage(average) {
    if (!Number.isFinite(average)) return '—';
    return Number.isInteger(average) ? String(average) : average.toFixed(1);
  }

  function activityOverviewHTML(progress) {
    const average = Number.isFinite(progress?.average) ? progress.average : null;
    const averageWidth = average === null ? 0 : Math.max(0, Math.min(100, average));
    return `
      <article><small>Entregaron</small><strong><b>${progress.delivered}</b><em>/${progress.total}</em></strong></article>
      <article><small>Calificados</small><strong><b>${progress.graded}</b><em>/${progress.total}</em></strong></article>
      <article><small>Avance</small><strong><b>${progress.percentage}</b><em>%</em></strong></article>
      <article class="em-activity-average-card ${activityAverageBand(average)}">
        <small>Promedio</small>
        <strong><b>${formatActivityAverage(average)}</b></strong>
        <span class="em-activity-average-track" aria-label="Promedio ${average === null ? 'sin calificaciones' : `${formatActivityAverage(average)} de 100`}"><i style="width:${averageWidth}%"></i></span>
      </article>
    `;
  }

  function refreshActivityOverview(activity) {
    const host = document.getElementById('activityOverviewGrid');
    if (!host || !activity) return;
    host.innerHTML = activityOverviewHTML(activityProgressForCurrentAssignment(activity));
  }

  function updateActivityProgressFromGradebook(activity, rows = []) {
    if (!activity || !state.assignment) return;
    const assignmentId = String(state.assignment.id || '');
    const submittedStatuses = new Set(['delivered', 'late', 'incomplete', 'resubmit']);
    const progress = (rows || []).reduce((acc, row) => {
      const file = row?.submissionFile && typeof row.submissionFile === 'object' ? row.submissionFile : {};
      const graded = Boolean(row?.gradedAt);
      const delivered = graded || Boolean(file.path || file.url || file.name) || submittedStatuses.has(String(row?.latestDeliveryStatus || ''));
      const score = Number(row?.score);
      acc.total += 1;
      if (delivered) acc.delivered += 1;
      if (graded) {
        acc.graded += 1;
        if (Number.isFinite(score)) {
          acc.scoreTotal += score;
          acc.scoreCount += 1;
        }
      }
      return acc;
    }, { total: 0, delivered: 0, graded: 0, scoreTotal: 0, scoreCount: 0 });
    progress.average = progress.scoreCount
      ? Math.round((progress.scoreTotal / progress.scoreCount) * 10) / 10
      : null;
    delete progress.scoreTotal;
    delete progress.scoreCount;
    activity.progressByAssignment = { ...(activity.progressByAssignment || {}), [assignmentId]: progress };
    refreshActivityOverview(activity);
  }

  function formatActivityCardDate(value) {
    const raw = String(value || '').slice(0, 10);
    if (!raw) return 'SIN FECHA';
    const parts = raw.split('-').map(Number);
    if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return 'SIN FECHA';
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    const month = new Intl.DateTimeFormat('es-CO', { month: 'long' }).format(date).toUpperCase();
    return `${month} ${date.getDate()}`;
  }

  function activityCardHTML(activity, index = 0) {
    const lesson = activityRelatedLesson(activity);
    const start = activity.startsAt ? formatActivityCardDate(activity.startsAt) : 'SIN FECHA';
    const due = activity.dueAt ? formatActivityCardDate(activity.dueAt) : 'SIN FECHA';
    const progress = activityProgressForCurrentAssignment(activity);
    return `
      <article class="em-activity-card" data-activity-id="${escapeAttr(activity.id)}" tabindex="0" style="--activity-index:${index};--activity-progress:${progress.percentage}%">
        <div class="em-activity-card-title-row">
          <h3>${escapeHTML(activity.title || 'Actividad')}</h3>
          <span class="em-activity-card-percent">${progress.percentage}%</span>
        </div>
        <div class="em-activity-card-copy">
          <p class="em-activity-card-topic">${lesson ? escapeHTML(lesson.title || 'Clase') : 'Actividad independiente'}</p>
          <div class="em-activity-card-dates">
            <span><small>Asignada</small><strong>${escapeHTML(start)}</strong></span>
            <span><small>Finaliza</small><strong>${escapeHTML(due)}</strong></span>
          </div>
          <div class="em-activity-card-progress" aria-label="${progress.percentage}% calificado">
            <div><span>Avance de calificación</span><strong>${progress.graded}/${progress.total}</strong></div>
            <i><b></b></i>
          </div>
        </div>
      </article>
    `;
  }

  function activitiesPeriodHTML() {
    const activities = getActivitiesForCurrentAssignment().filter((item) => Number(item.period) === Number(state.activitiesPeriod));
    return activities.map(activityCardHTML).join('') || emPeriodEmptyStateHTML('activities', state.activitiesPeriod);
  }

  function renderActivitiesTab(options = {}) {
    const assignment = state.assignment;
    const $content = document.getElementById('tabContent');
    if (!assignment || !$content) return;
    setActiveSubjectTabMeta('activities');

    $content.innerHTML = `
      <section class="activity-hero em-act-hero-host" data-em-activities-hero aria-label="Actividades de la asignatura">
        ${emActActivitiesHeroHTML(assignment.subject || 'ESTADÍSTICA', emRsGetAssignmentGradeCourse(assignment))}
      </section>
      <div class="view-row em-content-toolbar em-content-toolbar-has-action">
        <button class="em-add-content-btn" id="openAddActivityBtn" type="button">＋ Añadir actividad</button>
        <div class="em-view-switch" aria-label="Vista de actividades">
          <button class="mini-btn ${state.activityViewMode === 'grid' ? 'selected' : ''}" id="activityGridModeBtn" type="button" aria-label="Vista en cuadrícula" title="Cuadrícula">▦</button>
          <button class="mini-btn ${state.activityViewMode === 'list' ? 'selected' : ''}" id="activityListModeBtn" type="button" aria-label="Vista en lista" title="Lista">☰</button>
        </div>
      </div>
      <div id="activitiesPeriodContent" class="em-content-list is-${state.activityViewMode}">
        ${activitiesPeriodHTML()}
      </div>
    `;

    bindActivityViewButtons();
    bindActivityCards();
    document.getElementById('openAddActivityBtn')?.addEventListener('click', openAddActivityModal);
    emActInitActivitiesHero($content);
    emPlayTabEntrance($content, 'activities');
    if (options.animate) pulseElement($content, 'tab-enter');
  }

  function bindActivityViewButtons() {
    document.getElementById('activityGridModeBtn')?.addEventListener('click', () => setActivityViewMode('grid'));
    document.getElementById('activityListModeBtn')?.addEventListener('click', () => setActivityViewMode('list'));
  }

  function bindActivityCards() {
    document.querySelectorAll('[data-activity-id]').forEach((card) => {
      const open = () => {
        const activity = (state.data.activities || []).find((item) => item.id === card.dataset.activityId);
        if (activity) renderActivityDetail(activity);
      };
      card.addEventListener('click', open);
      card.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        open();
      });
    });
  }

  function activityPayloadFiles(payload) {
    return Array.isArray(payload?.files) ? payload.files.filter((file) => file?.url) : [];
  }

  function activityContentShellHTML(activity, source = 'content') {
    const isReview = source === 'review';
    const type = (isReview ? activity.reviewType : activity.contentType) || 'rich_text';
    const payload = isReview ? activity.reviewPayload : activity.contentPayload;
    const files = activityPayloadFiles(payload);
    const prefix = isReview ? 'activityReview' : 'activity';
    const label = isReview ? 'resultado' : 'actividad';
    if (type === 'pdf') {
      const file = files[0];
      return file
        ? `<div class="em-activity-pdf-viewer" id="${prefix}PdfViewer" data-pdf-url="${escapeAttr(file.url)}"><div class="em-activity-content-loader"><span></span><p>Cargando ${label}…</p></div></div>`
        : `<div class="em-activity-content-empty">El PDF de ${label} no está disponible.</div>`;
    }
    if (type === 'image') {
      return files.length
        ? `<div class="em-activity-image-sequence">${files.map((file, index) => `<figure><img src="${escapeAttr(file.url)}" alt="Imagen ${index + 1} de ${label}" loading="lazy" /><figcaption>${index + 1}/${files.length}</figcaption></figure>`).join('')}</div>`
        : `<div class="em-activity-content-empty">No hay imágenes disponibles en ${label}.</div>`;
    }
    if (type === 'html_css') {
      return `<iframe class="em-activity-html-frame" id="${prefix}HtmlFrame" sandbox="allow-same-origin" title="${isReview ? 'Resultado o guía de revisión' : 'Contenido interactivo de la actividad'}"></iframe>`;
    }
    return `<article class="em-activity-rich-view" id="${prefix}RichView"></article>`;
  }

  function sanitizeActivityRichHtml(html) {
    const template = document.createElement('template');
    template.innerHTML = String(html || '');
    template.content.querySelectorAll('script,iframe,object,embed,link,meta,base,form').forEach((node) => node.remove());
    template.content.querySelectorAll('*').forEach((node) => {
      [...node.attributes].forEach((attribute) => {
        const name = attribute.name.toLowerCase();
        const value = String(attribute.value || '').trim().toLowerCase();
        if (name.startsWith('on') || value.startsWith('javascript:')) node.removeAttribute(attribute.name);
      });
    });
    return template.innerHTML;
  }

  async function renderActivityPdfContent(activity, source = 'content') {
    const isReview = source === 'review';
    const host = document.getElementById(isReview ? 'activityReviewPdfViewer' : 'activityPdfViewer');
    const url = host?.dataset.pdfUrl;
    if (!host || !url || host.dataset.rendered === 'true') return;
    host.dataset.rendered = 'true';
    try {
      const pdfjs = await loadPdfJs();
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`El PDF respondió con estado ${response.status}.`);
      const bytes = await response.arrayBuffer();
      const pdfDocument = await pdfjs.getDocument({ data: bytes, isEvalSupported: false }).promise;
      const pages = document.createElement('div');
      pages.className = 'em-activity-pdf-pages';
      host.innerHTML = '';
      host.appendChild(pages);
      const availableWidth = Math.max(260, Math.min(980, host.clientWidth - 2));
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
      for (let number = 1; number <= pdfDocument.numPages; number += 1) {
        const page = await pdfDocument.getPage(number);
        const base = page.getViewport({ scale: 1 });
        const cssScale = availableWidth / Math.max(1, base.width);
        const viewport = page.getViewport({ scale: cssScale * pixelRatio });
        const canvas = document.createElement('canvas');
        canvas.className = 'em-activity-pdf-page';
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        canvas.style.width = `${Math.round(viewport.width / pixelRatio)}px`;
        canvas.style.height = `${Math.round(viewport.height / pixelRatio)}px`;
        canvas.setAttribute('aria-label', `Página ${number} de ${pdfDocument.numPages}`);
        const context = canvas.getContext('2d', { alpha: false });
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        pages.appendChild(canvas);
        await page.render({ canvasContext: context, viewport }).promise;
        page.cleanup?.();
      }
      await pdfDocument.destroy?.();
    } catch (error) {
      host.dataset.rendered = 'false';
      host.innerHTML = `<div class="em-activity-content-empty">${escapeHTML(error?.message || 'No se pudo cargar el PDF.')}</div>`;
    }
  }

  function initActivityDetailContent(activity, source = 'content') {
    const isReview = source === 'review';
    const type = (isReview ? activity.reviewType : activity.contentType) || 'rich_text';
    const payload = isReview ? activity.reviewPayload : activity.contentPayload;
    const prefix = isReview ? 'activityReview' : 'activity';
    if (type === 'pdf') {
      renderActivityPdfContent(activity, source);
      return;
    }
    if (type === 'rich_text') {
      const host = document.getElementById(`${prefix}RichView`);
      if (host) host.innerHTML = sanitizeActivityRichHtml(payload?.text || '<p>Sin contenido.</p>');
      return;
    }
    if (type === 'html_css') {
      const frame = document.getElementById(`${prefix}HtmlFrame`);
      if (!frame || frame.dataset.rendered === 'true') return;
      frame.dataset.rendered = 'true';
      const html = String(payload?.html || '<p>Sin contenido.</p>');
      const css = String(payload?.css || '');
      frame.srcdoc = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;background:#fff;color:#111;font-family:Arial,sans-serif}body{padding:18px;box-sizing:border-box}${css}</style></head><body>${html}</body></html>`;
      frame.addEventListener('load', () => {
        try {
          const height = frame.contentDocument?.documentElement?.scrollHeight || frame.contentDocument?.body?.scrollHeight || 0;
          if (height) frame.style.height = `${Math.max(320, height + 4)}px`;
        } catch (_) {}
      }, { once: true });
    }
  }

  const ACTIVITY_GROUP_COLORS = [
    '#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7',
    '#f97316', '#06b6d4', '#ec4899', '#84cc16', '#6366f1'
  ];

  function activitySemaphore(score) {
    const value = Number(score || 0);
    if (value >= 90) return { emoji: '🏆', label: 'Superior', className: 'is-trophy', rank: 4 };
    if (value >= 80) return { emoji: '🟢', label: 'Alto', className: 'is-green', rank: 3 };
    if (value >= 70) return { emoji: '🟡', label: 'Básico', className: 'is-yellow', rank: 2 };
    if (value >= 60) return { emoji: '🟠', label: 'Básico', className: 'is-orange', rank: 2 };
    return { emoji: '🔴', label: 'Bajo', className: 'is-red', rank: 1 };
  }

  function activityGroupMetaMap(rows = []) {
    const groups = new Map();
    (rows || []).forEach((row) => {
      const id = String(row?.gradingGroupId || '');
      if (!id) return;
      const parsed = Date.parse(row?.gradedAt || row?.updatedAt || '');
      const time = Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
      const current = groups.get(id);
      if (!current || time < current.time) groups.set(id, { id, time });
    });
    const ordered = [...groups.values()].sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
    return new Map(ordered.map((group, index) => [group.id, {
      number: index + 1,
      color: ACTIVITY_GROUP_COLORS[index % ACTIVITY_GROUP_COLORS.length]
    }]));
  }

  function activityGradeSortValue(row, key, groupMap) {
    if (key === 'group') return groupMap.get(String(row?.gradingGroupId || ''))?.number || Number.MAX_SAFE_INTEGER;
    if (key === 'firstName') return normalizeSearch(row?.firstName || '');
    if (key === 'score') return Number(row?.score ?? 40);
    if (key === 'performance') return activitySemaphore(row?.score).rank;
    return normalizeSearch(row?.lastName || row?.fullName || '');
  }

  function sortedActivityGradebookRows(rows = [], groupMap = activityGroupMetaMap(rows)) {
    const sort = state.activityGradeSort || { key: 'lastName', direction: 'asc' };
    const direction = sort.direction === 'desc' ? -1 : 1;
    const sorted = [...rows].sort((a, b) => {
      const av = activityGradeSortValue(a, sort.key, groupMap);
      const bv = activityGradeSortValue(b, sort.key, groupMap);
      let comparison = 0;
      if (typeof av === 'number' && typeof bv === 'number') comparison = av - bv;
      else comparison = String(av).localeCompare(String(bv), 'es', { sensitivity: 'base' });
      if (!comparison) comparison = normalizeSearch(`${a.lastName} ${a.firstName}`).localeCompare(normalizeSearch(`${b.lastName} ${b.firstName}`), 'es');
      return comparison * direction;
    });
    return { rows: sorted, groupMap };
  }

  function activityGradebookRowsHTML(rows, query = '') {
    const normalized = normalizeSearch(query);
    const sourceRows = rows || [];
    const filtered = sourceRows.filter((row) => !normalized || normalizeSearch(`${row.lastName} ${row.firstName} ${row.fullName} ${row.studentCode}`).includes(normalized));
    if (!filtered.length) return '<tr><td class="em-activity-grade-empty" colspan="4">No hay estudiantes con ese filtro.</td></tr>';
    const groupMap = activityGroupMetaMap(sourceRows);
    const { rows: sortedRows } = sortedActivityGradebookRows(filtered, groupMap);
    return sortedRows.map((row) => {
      const semaphore = activitySemaphore(row.score);
      const group = groupMap.get(String(row.gradingGroupId || ''));
      const name = notesStudentNameParts(row);
      return `
        <tr class="em-activity-grade-row" data-activity-record-id="${escapeAttr(row.recordId)}" tabindex="0" role="button" aria-label="Calificar a ${escapeAttr(row.fullName || `${name.lastName} ${name.firstName}`)}">
          <td class="em-activity-grade-group-cell">${group ? `<i style="--em-grade-group-color:${group.color}">${group.number}</i>` : '<i class="is-empty">—</i>'}</td>
          <th class="em-activity-grade-student-cell" scope="row" title="${escapeAttr(row.fullName || '')}">
            <small class="em-notes-student-code">${escapeHTML(name.code)}</small>
            <strong class="em-notes-student-lastname">${escapeHTML(name.lastName)}</strong>
            <span class="em-notes-student-firstname">${escapeHTML(name.firstName)}</span>
          </th>
          <td class="em-activity-grade-score-cell"><strong class="${notesScoreClass(row.score)}">${Number(row.score ?? 40)}</strong></td>
          <td class="em-activity-grade-performance-cell"><span class="em-grade-light ${semaphore.className}"><b>${semaphore.emoji}</b><small>${semaphore.label}</small></span></td>
        </tr>
      `;
    }).join('');
  }

  function updateActivityGradeSortIndicators() {
    const sort = state.activityGradeSort || { key: 'lastName', direction: 'asc' };
    document.querySelectorAll('[data-activity-grade-sort]').forEach((button) => {
      const active = button.dataset.activityGradeSort === sort.key;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      const indicator = button.querySelector('.em-grade-sort-indicator');
      if (indicator) indicator.textContent = active ? (sort.direction === 'asc' ? '↑' : '↓') : '↕';
    });
  }

  function bindActivityGradeSortButtons() {
    document.querySelectorAll('[data-activity-grade-sort]').forEach((button) => {
      button.addEventListener('click', () => {
        const key = button.dataset.activityGradeSort || 'lastName';
        const current = state.activityGradeSort || { key: 'lastName', direction: 'asc' };
        state.activityGradeSort = current.key === key
          ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
          : { key, direction: key === 'score' || key === 'performance' ? 'desc' : 'asc' };
        refreshActivityGradebookList();
      });
    });
    updateActivityGradeSortIndicators();
  }

  function refreshActivityGradebookList() {
    const list = document.getElementById('activityGradebookList');
    if (!list) return;
    const query = document.getElementById('activityGradeSearch')?.value || '';
    list.innerHTML = activityGradebookRowsHTML(state.activityGradebook || [], query);
    updateActivityGradeSortIndicators();
    bindActivityGradeRows();
  }

  function bindActivityGradeRows() {
    const openRecord = (row) => {
      const record = (state.activityGradebook || []).find((item) => item.recordId === row.dataset.activityRecordId);
      const activity = (state.data.activities || []).find((item) => item.id === state.activeActivityId);
      if (activity && record) openActivityGradeModal(activity, record);
    };
    document.querySelectorAll('[data-activity-record-id]').forEach((row) => {
      row.addEventListener('click', () => openRecord(row));
      row.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openRecord(row);
      });
    });
  }

  async function loadActivityGradebook(activity) {
    const list = document.getElementById('activityGradebookList');
    if (!list) return;
    list.innerHTML = '<tr><td colspan="4"><div class="em-activity-grade-loading"><span></span><p>Preparando lista de estudiantes…</p></div></td></tr>';
    try {
      state.activityGradebook = await cloudAPI().getActivityGradebook({
        activityId: activity.id,
        assignmentId: state.assignment?.id || ''
      });
      syncActivityGradesFromGradebook(activity.id, state.assignment?.id || '', state.activityGradebook);
      updateActivityProgressFromGradebook(activity, state.activityGradebook);
      refreshActivityGradebookList();
    } catch (error) {
      list.innerHTML = `<tr><td class="em-activity-grade-empty" colspan="4">${escapeHTML(error?.message || 'No se pudo cargar la lista de calificaciones.')}</td></tr>`;
      reportCloudError('No se pudo cargar la actividad', error, { silent: true });
    }
  }

  function renderActivityDetail(activity, options = {}) {
    if (!activity || !state.assignment) return renderSubjectDetail('activities', options);
    state.activeActivityId = activity.id;
    commitAppRoute({ screen: 'activity', assignmentId: state.assignment.id, activityId: activity.id }, options);
    emSetCurrentSubjectColor(emGetSubjectColorForAssignment(state.assignment));
    const lesson = activityRelatedLesson(activity);
    const due = activity.dueAt ? formatAcademicDate(String(activity.dueAt).slice(0, 10)) : 'Sin fecha';
    const start = activity.startsAt ? formatAcademicDate(String(activity.startsAt).slice(0, 10)) : 'Sin fecha';
    const progress = activityProgressForCurrentAssignment(activity);
    const gradeCourse = emRsGetAssignmentGradeCourse(state.assignment);
    const activityStudentColumnWidth = notesStudentColumnWidth(getStudentsForAssignment(state.assignment));
    mount(`
      <main class="screen em-activity-detail-screen">
        <header class="topbar fixed-lock em-activity-detail-topbar">
          <button class="icon-btn" id="backBtn" aria-label="Volver">←</button>
          <h1>Actividad</h1>
          <span class="spacer"></span>
        </header>
        <div class="em-activity-detail-wrap">
          <section class="activity-hero em-act-hero-host em-activity-detail-hero" data-em-activities-hero aria-label="Detalle de la actividad">
            <div class="em-act-shapes" aria-hidden="true">
              <span class="em-act-shape em-act-shape-circle"></span>
              <span class="em-act-shape em-act-shape-square"></span>
              <span class="em-act-shape em-act-shape-triangle"></span>
              <span class="em-act-shape em-act-shape-x"></span>
            </div>
            <div class="em-act-board" aria-hidden="true">
              <span class="em-act-sheet em-act-sheet-back"></span>
              <span class="em-act-sheet em-act-sheet-mid"></span>
              <span class="em-act-sheet em-act-sheet-front">
                <i class="em-act-sheet-line em-act-line-one"></i>
                <i class="em-act-sheet-line em-act-line-two"></i>
                <i class="em-act-sheet-line em-act-line-three"></i>
                <i class="em-act-check em-act-check-one">✓</i>
                <i class="em-act-check em-act-check-two">✓</i>
              </span>
              <span class="em-act-pencil">✎</span>
            </div>
            <div class="em-act-content em-activity-detail-hero-copy">
              <h2 class="em-act-title em-activity-detail-title">${escapeHTML(activity.title || 'Actividad')}</h2>
              <p class="em-act-subtitle">${lesson ? `Clase relacionada: ${escapeHTML(lesson.title || 'Clase')}` : 'Actividad independiente'}</p>
              <div class="em-activity-detail-dates" aria-label="Fechas de la actividad">
                <span>📍 ${escapeHTML(start)}</span>
                <span>🏁 ${escapeHTML(due)}</span>
              </div>
            </div>
          </section>

          <section class="em-activity-detail-main">
            <div class="em-activity-overview-grid" id="activityOverviewGrid" aria-label="Resumen de la actividad">
              ${activityOverviewHTML(progress)}
            </div>
            <div class="em-activity-detail-content-tabs" role="tablist" aria-label="Contenido de la actividad">
              <button class="is-active" type="button" role="tab" aria-selected="true" data-activity-detail-tab="content">Actividad</button>
              <button type="button" role="tab" aria-selected="false" data-activity-detail-tab="review">Resultado</button>
            </div>
            <section class="em-activity-content-stage" data-activity-detail-panel="content" aria-label="Contenido de la actividad">
              ${activityContentShellHTML(activity, 'content')}
            </section>
            <section class="em-activity-content-stage" data-activity-detail-panel="review" aria-label="Resultado o guía de revisión" hidden>
              ${activityContentShellHTML(activity, 'review')}
            </section>
            <div class="em-activity-detail-actions">
              <button class="primary-btn" id="editActivityBtn" type="button">Editar actividad</button>
              <button class="ghost-btn em-activity-delete-btn" id="deleteActivityBtn" type="button">Eliminar actividad</button>
            </div>
          </section>

          <section class="em-activity-gradebook" style="--em-activity-student-width:${activityStudentColumnWidth}px">
            <div class="em-activity-gradebook-head">
              <div><p class="section-kicker">Calificaciones</p><h2>Estudiantes</h2></div>
              <label class="em-activity-grade-search"><span aria-hidden="true">⌕</span><input id="activityGradeSearch" type="search" placeholder="Buscar estudiante" autocomplete="off" /></label>
            </div>
            <div class="em-activity-grade-table-scroll">
              <table class="em-activity-grade-table">
                <thead>
                  <tr>
                    <th class="em-activity-grade-group-header" scope="col"><button type="button" data-activity-grade-sort="group" aria-label="Ordenar por grupo">G <span class="em-grade-sort-indicator">↕</span></button></th>
                    <th class="em-activity-grade-student-header" scope="col"><button type="button" data-activity-grade-sort="lastName">Estudiante <span class="em-grade-sort-indicator">↑</span></button></th>
                    <th class="em-activity-grade-score-header" scope="col"><button type="button" data-activity-grade-sort="score">Cal. <span class="em-grade-sort-indicator">↕</span></button></th>
                    <th class="em-activity-grade-performance-header" scope="col"><button type="button" data-activity-grade-sort="performance">Desempeño <span class="em-grade-sort-indicator">↕</span></button></th>
                  </tr>
                </thead>
                <tbody id="activityGradebookList" class="em-activity-gradebook-list"></tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    `, () => {
      document.getElementById('backBtn')?.addEventListener('click', () => {
        if (window.history?.length > 1) window.history.back();
        else renderSubjectDetail('activities');
      });
      document.getElementById('editActivityBtn')?.addEventListener('click', () => openEditActivityModal(activity));
      document.getElementById('deleteActivityBtn')?.addEventListener('click', () => openDeleteActivityModal(activity));
      document.getElementById('activityGradeSearch')?.addEventListener('input', refreshActivityGradebookList);
      bindActivityGradeSortButtons();
      const setActivityDetailTab = (tabName = 'content') => {
        document.querySelectorAll('[data-activity-detail-tab]').forEach((button) => {
          const active = button.dataset.activityDetailTab === tabName;
          button.classList.toggle('is-active', active);
          button.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        document.querySelectorAll('[data-activity-detail-panel]').forEach((panel) => {
          panel.hidden = panel.dataset.activityDetailPanel !== tabName;
        });
        initActivityDetailContent(activity, tabName);
      };
      document.querySelectorAll('[data-activity-detail-tab]').forEach((button) => {
        button.addEventListener('click', () => setActivityDetailTab(button.dataset.activityDetailTab || 'content'));
      });
      setActivityDetailTab('content');
      loadActivityGradebook(activity);
      emActInitActivitiesHero(document);
      emPlayEntranceSequence(document.querySelector('.em-activity-detail-wrap'), ['.em-activity-detail-hero', '.em-activity-overview-grid > *', '.em-activity-content-stage > *', '.em-activity-detail-actions > *', '.em-activity-gradebook'], { duration: 480, stagger: 35, distance: 14, scale: .985 });
    });
  }

  function activityContentEditorHTML(prefix, type = 'pdf', payload = {}) {
    const files = activityPayloadFiles(payload);
    const fileText = files.length ? files.map((file) => file.name || 'Archivo guardado').join(', ') : '';
    return `
      <div class="em-activity-content-editor" data-content-editor="${escapeAttr(prefix)}">
        <div class="em-activity-format-head">
          <span class="field-label">Formato</span>
          <small>Selecciona una sola opción</small>
        </div>
        <div class="em-activity-type-grid" role="radiogroup" aria-label="Formato del contenido">
          ${[
            ['pdf', 'PDF', '📄'],
            ['image', 'Imágenes', '🖼️'],
            ['rich_text', 'Texto enriquecido', '✍️'],
            ['html_css', 'HTML + CSS', '⌨️']
          ].map(([value, label, icon]) => `<label class="em-activity-type-option"><input type="radio" name="${prefix}Type" value="${value}" ${type === value ? 'checked' : ''}/><span><b>${icon}</b>${label}</span></label>`).join('')}
        </div>
        <div class="em-activity-editor-panel" data-editor-panel="pdf">
          <label class="em-file-drop" for="${prefix}PdfInput"><strong>Seleccionar PDF</strong><span data-file-name>${escapeHTML(type === 'pdf' && fileText ? fileText : 'Máximo 20 MB')}</span></label>
          <input class="em-hidden-file" id="${prefix}PdfInput" type="file" accept="application/pdf,.pdf" />
        </div>
        <div class="em-activity-editor-panel" data-editor-panel="image" hidden>
          <label class="em-file-drop" for="${prefix}ImageInput"><strong>Seleccionar imágenes</strong><span data-file-name>${escapeHTML(type === 'image' && fileText ? fileText : 'PNG, JPG o WEBP · hasta 10 imágenes')}</span></label>
          <input class="em-hidden-file" id="${prefix}ImageInput" type="file" accept="image/png,image/jpeg,image/webp" multiple />
        </div>
        <div class="em-activity-editor-panel" data-editor-panel="rich_text" hidden>
          <div class="em-rich-toolbar" role="toolbar" aria-label="Formato de texto">
            <button type="button" data-rich-command="bold"><b>B</b></button>
            <button type="button" data-rich-command="italic"><i>I</i></button>
            <button type="button" data-rich-command="insertUnorderedList">• Lista</button>
          </div>
          <div class="em-rich-editor" id="${prefix}RichInput" contenteditable="true" data-placeholder="Escribe el contenido…">${type === 'rich_text' ? sanitizeActivityRichHtml(payload.text || '') : ''}</div>
        </div>
        <div class="em-activity-editor-panel" data-editor-panel="html_css" hidden>
          <label class="field-label" for="${prefix}HtmlInput">HTML</label>
          <textarea class="input em-code-input" id="${prefix}HtmlInput" rows="7" spellcheck="false" placeholder="<section>...</section>">${type === 'html_css' ? escapeHTML(payload.html || '') : ''}</textarea>
          <label class="field-label" for="${prefix}CssInput">CSS</label>
          <textarea class="input em-code-input" id="${prefix}CssInput" rows="6" spellcheck="false" placeholder=".actividad { ... }">${type === 'html_css' ? escapeHTML(payload.css || '') : ''}</textarea>
        </div>
      </div>
    `;
  }

  function openAddActivityModal() {
    openActivityEditorModal(null);
  }

  function openEditActivityModal(activity) {
    openActivityEditorModal(activity);
  }

  function openActivityEditorModal(activity = null) {
    const assignment = state.assignment;
    if (!assignment) return;
    const editing = Boolean(activity?.id);
    const lessons = getClassesForCurrentAssignment();
    const automaticPeriod = getAutomaticAcademicPeriod();
    const today = todayISO();
    const gradeTargets = getClassTargetAssignments('grade');
    const gradeCourses = gradeTargets.map((item) => `${item.grade}-${item.course}`).join(', ');
    const activityIds = Array.isArray(activity?.assignmentIds) ? activity.assignmentIds : [];
    const gradeScope = activityIds.length > 1;
    openModal(`
      <section class="modal-card em-activity-create-modal" role="dialog" aria-modal="true" aria-labelledby="addActivityTitle">
        <button class="modal-close" data-close-modal aria-label="Cerrar">×</button>
        <p class="section-kicker">Gestión de actividades</p>
        <h2 id="addActivityTitle">${editing ? 'Editar actividad' : 'Añadir actividad'}</h2>
        <div class="em-activity-modal-tabs" role="tablist">
          <button class="is-active" type="button" role="tab" aria-selected="true" data-activity-modal-tab="assign">Asignar actividad</button>
          <button type="button" role="tab" aria-selected="false" data-activity-modal-tab="review">Revisión de actividad</button>
        </div>
        <form id="addActivityForm" class="em-activity-create-form">
          <section class="em-activity-tab-page" data-activity-tab-panel="assign">
            <div class="em-activity-form-block">
              <div class="em-activity-block-head"><span class="em-activity-step-badge">1</span><div><h3>Información principal</h3><p>Identifica la actividad y, si corresponde, relaciónala con una clase o tema.</p></div></div>
              <div class="em-activity-field-stack">
                <label class="field-label" for="activityTitleInput">Nombre de la actividad</label>
                <input class="input" id="activityTitleInput" maxlength="140" autocomplete="off" placeholder="Ejemplo: Taller de gráficos de líneas" value="${escapeAttr(activity?.title || '')}" required />
              </div>
              <div class="em-activity-field-stack">
                <label class="field-label" for="activityLessonInput">Clase o tema relacionado <small>(opcional)</small></label>
                <select class="select" id="activityLessonInput">
                  <option value="">Sin clase relacionada</option>
                  ${lessons.map((lesson) => `<option value="${escapeAttr(lesson.id)}" ${String(activity?.lessonId || '') === String(lesson.id) ? 'selected' : ''}>${escapeHTML(lesson.title || 'Clase')} · Periodo ${Number(lesson.period || 1)}</option>`).join('')}
                </select>
                <p class="em-activity-field-hint">Puedes dejarla como actividad independiente y vincularla después.</p>
              </div>
            </div>

            <div class="em-activity-form-block">
              <div class="em-activity-block-head"><span class="em-activity-step-badge">2</span><div><h3>Calendario y alcance</h3><p>El periodo y la fecha de inicio se completan automáticamente, pero puedes cambiarlos.</p></div></div>
              <div class="em-activity-date-grid">
                <label><span>Periodo</span><select class="select" id="activityPeriodInput">${[1,2,3,4].map((period) => `<option value="${period}" ${period === Number(activity?.period || automaticPeriod) ? 'selected' : ''}>Periodo ${period}</option>`).join('')}</select></label>
                <label><span>Fecha de inicio</span><input class="input" id="activityStartInput" type="date" value="${escapeAttr(String(activity?.startsAt || today).slice(0, 10))}" required /></label>
                <label><span>Fecha de entrega máxima</span><input class="input" id="activityDueInput" type="date" value="${escapeAttr(String(activity?.dueAt || today).slice(0, 10))}" required /></label>
              </div>
              <fieldset class="em-class-scope em-activity-scope">
                <legend>¿Dónde estará disponible?</legend>
                <label><input type="radio" name="activityScope" value="course" ${gradeScope ? '' : 'checked'} /><span><strong>Solo este curso</strong><small>${escapeHTML(assignment.grade)}-${escapeHTML(assignment.course)}</small></span></label>
                <label><input type="radio" name="activityScope" value="grade" ${gradeScope ? 'checked' : ''} /><span><strong>Todo el grado ${escapeHTML(assignment.grade)}</strong><small>${escapeHTML(gradeCourses || `${assignment.grade}-${assignment.course}`)}</small></span></label>
              </fieldset>
            </div>

            <div class="em-activity-form-block">
              <div class="em-activity-block-head"><span class="em-activity-step-badge">3</span><div><h3>Contenido de la actividad</h3><p>Elige cómo recibirán los estudiantes las instrucciones.</p></div></div>
              ${activityContentEditorHTML('activityContent', activity?.contentType || 'pdf', activity?.contentPayload || {})}
            </div>
          </section>

          <section class="em-activity-tab-page" data-activity-tab-panel="review" hidden>
            <div class="em-activity-form-block">
              <div class="em-activity-block-head"><span class="em-activity-step-badge">4</span><div><h3>Respuesta o guía de revisión</h3><p>Añade la solución, respuesta esperada o material que usarás para revisar.</p></div></div>
              ${activityContentEditorHTML('activityReview', activity?.reviewType || 'rich_text', activity?.reviewPayload || {})}
            </div>
            <div class="em-activity-form-block em-activity-rubric-block">
              <div class="em-rubric-head"><div class="em-activity-block-head em-activity-block-head-compact"><span class="em-activity-step-badge">5</span><div><h3>Criterios de evaluación</h3><p>La suma debe ser exactamente 100% para guardar.</p></div></div><button class="mini-btn" id="addRubricCriterionBtn" type="button">＋ Criterio</button></div>
              <div class="em-rubric-list" id="activityRubricList"></div>
              <div class="em-rubric-total" id="activityRubricTotal"><span>Total</span><strong>0%</strong></div>
            </div>
          </section>
          <p class="em-class-create-error" id="activityCreateError" role="alert"></p>
          <div class="em-activity-modal-actions">
            <button class="ghost-btn" type="button" id="activityPreviousTabBtn" hidden>Volver</button>
            <button class="primary-btn" type="button" id="activityNextTabBtn">Continuar</button>
            <button class="primary-btn" type="submit" id="createActivitySubmitBtn" hidden disabled>${editing ? 'Guardar cambios' : 'Guardar actividad'}</button>
          </div>
        </form>
      </section>
    `, () => initActivityEditorModal(activity));
  }

  function initActivityEditorModal(activity = null) {
    const modal = document.querySelector('.em-activity-create-modal');
    const form = document.getElementById('addActivityForm');
    const next = document.getElementById('activityNextTabBtn');
    const previous = document.getElementById('activityPreviousTabBtn');
    const submit = document.getElementById('createActivitySubmitBtn');
    const showTab = (tab) => {
      modal?.querySelectorAll('[data-activity-modal-tab]').forEach((button) => {
        const active = button.dataset.activityModalTab === tab;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      modal?.querySelectorAll('[data-activity-tab-panel]').forEach((panel) => { panel.hidden = panel.dataset.activityTabPanel !== tab; });
      next.hidden = tab !== 'assign';
      previous.hidden = tab !== 'review';
      submit.hidden = tab !== 'review';
      if (tab === 'review') updateRubricTotal();
    };
    modal?.querySelectorAll('[data-activity-modal-tab]').forEach((button) => button.addEventListener('click', () => showTab(button.dataset.activityModalTab)));
    next?.addEventListener('click', () => {
      const title = document.getElementById('activityTitleInput')?.value.trim();
      const start = document.getElementById('activityStartInput')?.value;
      const due = document.getElementById('activityDueInput')?.value;
      const errorBox = document.getElementById('activityCreateError');
      if (errorBox) errorBox.textContent = '';
      if (!title) return errorBox.textContent = 'Escribe el nombre de la actividad.';
      if (!start || !due) return errorBox.textContent = 'Completa las fechas de inicio y entrega.';
      if (due < start) return errorBox.textContent = 'La fecha de entrega no puede ser anterior a la fecha de inicio.';
      showTab('review');
    });
    previous?.addEventListener('click', () => showTab('assign'));
    modal?.querySelectorAll('[data-content-editor]').forEach(initActivityContentEditor);
    document.getElementById('addRubricCriterionBtn')?.addEventListener('click', () => addRubricCriterion());
    const rubric = Array.isArray(activity?.rubric) && activity.rubric.length
      ? activity.rubric
      : [{ name: 'Comprensión y desarrollo', percentage: 50 }, { name: 'Procedimiento, presentación y entrega', percentage: 50 }];
    rubric.forEach((item) => addRubricCriterion(item.name, item.percentage));
    form?.addEventListener('submit', (event) => submitActivityEditor(event, activity));
    document.getElementById('activityTitleInput')?.focus();
  }

  function initActivityContentEditor(editor) {
    const prefix = editor.dataset.contentEditor;
    const update = () => {
      const type = editor.querySelector(`input[name="${prefix}Type"]:checked`)?.value || 'pdf';
      editor.querySelectorAll('[data-editor-panel]').forEach((panel) => { panel.hidden = panel.dataset.editorPanel !== type; });
    };
    editor.querySelectorAll(`input[name="${prefix}Type"]`).forEach((input) => input.addEventListener('change', update));
    editor.querySelectorAll('input[type="file"]').forEach((input) => input.addEventListener('change', () => {
      const label = input.closest('.em-activity-editor-panel')?.querySelector('[data-file-name]');
      const files = [...(input.files || [])];
      if (label) label.textContent = files.length ? files.map((file) => file.name).join(', ') : 'Selecciona archivos';
    }));
    editor.querySelectorAll('[data-rich-command]').forEach((button) => button.addEventListener('click', () => {
      document.execCommand(button.dataset.richCommand, false, null);
      editor.querySelector('.em-rich-editor')?.focus();
    }));
    update();
  }

  function addRubricCriterion(name = '', percentage = '') {
    const list = document.getElementById('activityRubricList');
    if (!list) return;
    const row = document.createElement('div');
    row.className = 'em-rubric-row';
    row.innerHTML = `<input class="input" data-rubric-name maxlength="120" placeholder="Nombre del criterio" value="${escapeAttr(name)}" /><label><input class="input" data-rubric-percentage type="number" min="0" max="100" step="1" value="${escapeAttr(String(percentage))}" /><span>%</span></label><button type="button" data-remove-rubric aria-label="Eliminar criterio">×</button>`;
    row.querySelectorAll('input').forEach((input) => input.addEventListener('input', updateRubricTotal));
    row.querySelector('[data-remove-rubric]')?.addEventListener('click', () => { row.remove(); updateRubricTotal(); });
    list.appendChild(row);
    updateRubricTotal();
  }

  function getRubricCriteria() {
    return [...document.querySelectorAll('#activityRubricList .em-rubric-row')].map((row) => ({
      name: row.querySelector('[data-rubric-name]')?.value.trim() || '',
      percentage: Number(row.querySelector('[data-rubric-percentage]')?.value || 0)
    }));
  }

  function updateRubricTotal() {
    const criteria = getRubricCriteria();
    const total = criteria.reduce((sum, item) => sum + Number(item.percentage || 0), 0);
    const box = document.getElementById('activityRubricTotal');
    const submit = document.getElementById('createActivitySubmitBtn');
    if (box) {
      box.querySelector('strong').textContent = `${total}%`;
      box.classList.toggle('is-valid', total === 100 && criteria.length > 0 && criteria.every((item) => item.name));
      box.classList.toggle('is-invalid', total !== 100);
    }
    if (submit) submit.disabled = !(total === 100 && criteria.length > 0 && criteria.every((item) => item.name));
    return { criteria, total };
  }

  function collectActivityEditor(prefix) {
    const type = document.querySelector(`input[name="${prefix}Type"]:checked`)?.value || 'pdf';
    return {
      type,
      text: document.getElementById(`${prefix}RichInput`)?.innerHTML.trim() || '',
      html: document.getElementById(`${prefix}HtmlInput`)?.value.trim() || '',
      css: document.getElementById(`${prefix}CssInput`)?.value.trim() || '',
      files: type === 'pdf'
        ? [...(document.getElementById(`${prefix}PdfInput`)?.files || [])]
        : type === 'image'
          ? [...(document.getElementById(`${prefix}ImageInput`)?.files || [])]
          : []
    };
  }

  function validateActivityEditor(editor, label, existingPayload = {}, existingType = '') {
    const existingFiles = existingType === editor.type ? activityPayloadFiles(existingPayload) : [];
    if (editor.type === 'pdf') {
      if (editor.files.length !== 1 && !existingFiles.length) return `${label}: selecciona un archivo PDF.`;
      if (editor.files[0]?.size > 20 * 1024 * 1024) return `${label}: el PDF supera 20 MB.`;
    }
    if (editor.type === 'image') {
      if (!editor.files.length && !existingFiles.length) return `${label}: selecciona al menos una imagen.`;
      if (editor.files.length > 10) return `${label}: puedes subir máximo 10 imágenes.`;
      if (editor.files.some((file) => file.size > 5 * 1024 * 1024)) return `${label}: una imagen supera 5 MB.`;
    }
    if (editor.type === 'rich_text' && !editor.text.replace(/<[^>]*>/g, '').trim()) return `${label}: escribe el texto enriquecido.`;
    if (editor.type === 'html_css' && !editor.html) return `${label}: escribe el contenido HTML.`;
    return '';
  }

  async function submitActivityEditor(event, existingActivity = null) {
    event.preventDefault();
    const errorBox = document.getElementById('activityCreateError');
    const submit = document.getElementById('createActivitySubmitBtn');
    const fail = (message) => { if (errorBox) errorBox.textContent = message; };
    fail('');
    const title = document.getElementById('activityTitleInput')?.value.trim() || '';
    const lessonId = document.getElementById('activityLessonInput')?.value || '';
    const period = Number(document.getElementById('activityPeriodInput')?.value || getAutomaticAcademicPeriod());
    const startsAt = document.getElementById('activityStartInput')?.value || '';
    const dueAt = document.getElementById('activityDueInput')?.value || '';
    const scope = document.querySelector('input[name="activityScope"]:checked')?.value || 'course';
    const targets = getClassTargetAssignments(scope);
    const content = collectActivityEditor('activityContent');
    const review = collectActivityEditor('activityReview');
    const { criteria, total } = updateRubricTotal();
    if (!title) return fail('Escribe el nombre de la actividad.');
    if (!startsAt || !dueAt || dueAt < startsAt) return fail('Revisa las fechas de inicio y entrega.');
    if (!targets.length) return fail('No se encontraron cursos compatibles para esta actividad.');
    const contentError = validateActivityEditor(content, 'Actividad', existingActivity?.contentPayload, existingActivity?.contentType);
    if (contentError) return fail(contentError);
    const reviewError = validateActivityEditor(review, 'Revisión', existingActivity?.reviewPayload, existingActivity?.reviewType);
    if (reviewError) return fail(reviewError);
    if (total !== 100 || !criteria.length || criteria.some((item) => !item.name)) return fail('Los criterios completos deben sumar exactamente 100%.');
    if (!isCloudReady()) return fail('Necesitas una sesión activa de Supabase.');
    submit.disabled = true;
    submit.textContent = existingActivity ? 'Guardando cambios…' : 'Guardando…';
    try {
      const payload = {
        activityId: existingActivity?.id || '',
        currentAssignment: state.assignment,
        targetAssignmentIds: targets.map((item) => item.id),
        title,
        lessonId,
        period,
        startsAt,
        dueAt,
        contentType: content.type,
        contentText: content.text,
        contentHtml: content.html,
        contentCss: content.css,
        contentFiles: content.files,
        existingContentPayload: existingActivity?.contentPayload || {},
        existingContentType: existingActivity?.contentType || '',
        reviewType: review.type,
        reviewText: review.text,
        reviewHtml: review.html,
        reviewCss: review.css,
        reviewFiles: review.files,
        existingReviewPayload: existingActivity?.reviewPayload || {},
        existingReviewType: existingActivity?.reviewType || '',
        rubric: criteria
      };
      const activity = existingActivity
        ? await cloudAPI().updateActivity(payload)
        : await cloudAPI().createActivity(payload);
      activity.progressByAssignment = { ...(existingActivity?.progressByAssignment || activity.progressByAssignment || {}) };
      targets.forEach((target) => {
        if (!activity.progressByAssignment[target.id]) {
          activity.progressByAssignment[target.id] = {
            total: getStudentsForAssignment(target).length,
            delivered: 0,
            graded: 0
          };
        }
      });
      state.data.activities = state.data.activities || [];
      if (existingActivity) {
        const index = state.data.activities.findIndex((item) => item.id === existingActivity.id);
        if (index >= 0) state.data.activities[index] = activity;
      } else {
        state.data.activities.push(activity);
      }
      closeModal(false);
      syncAcademicPeriodState(period);
      if (existingActivity) renderActivityDetail(activity, { replaceHistory: true });
      else renderActivitiesTab({ animate: true });
      toast(existingActivity ? 'Actividad actualizada en Supabase.' : `Actividad guardada para ${targets.length} curso${targets.length === 1 ? '' : 's'}.`);
    } catch (error) {
      fail(error?.message || 'No se pudo guardar la actividad.');
      reportCloudError('No se pudo guardar la actividad', error, { silent: true });
      submit.disabled = false;
      submit.textContent = existingActivity ? 'Guardar cambios' : 'Guardar actividad';
    }
  }

  const ACTIVITY_DELIVERY_STATUSES = [
    ['delivered', 'Entregada'],
    ['not_brought', 'No la trajo'],
    ['not_done', 'No la hizo'],
    ['next_class', 'Entregará próxima clase'],
    ['incomplete', 'Incompleta'],
    ['resubmit', 'Corrección solicitada'],
    ['late', 'Entrega tardía'],
    ['absent', 'Ausente'],
    ['excused', 'Excusa / justificada']
  ];

  function activityDeliveryLabel(status) {
    return Object.fromEntries(ACTIVITY_DELIVERY_STATUSES)[status] || status || 'Sin estado';
  }

  function formatActivityTrackingDateTime(value) {
    if (!value) return 'Fecha y hora no disponibles';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const dateLabel = date.toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    const timeLabel = date.toLocaleTimeString('es-CO', {
      hour: 'numeric',
      minute: '2-digit'
    })
      .replace(' a. m.', ' a.m.')
      .replace(' p. m.', ' p.m.')
      .replace(' a. m.', ' a.m.')
      .replace(' p. m.', ' p.m.');
    return `${dateLabel} · ${timeLabel}`;
  }

  function openActivityGradeModal(activity, record) {
    const gradebook = state.activityGradebook || [];
    const currentGroup = record.gradingGroupId
      ? gradebook.filter((item) => item.gradingGroupId === record.gradingGroupId)
      : [record];
    const currentCodes = new Set(currentGroup.map((item) => item.studentCode));
    const eligibleGroupRows = gradebook
      .filter((item) => currentCodes.has(item.studentCode) || !item.gradingGroupId)
      .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'es'));
    const eventHistory = Array.isArray(record.deliveryEvents) ? record.deliveryEvents : [];
    const existingFile = record.submissionFile?.url ? record.submissionFile : null;
    const trackingCount = eventHistory.length;
    const rubricCriteria = Array.isArray(activity?.rubric)
      ? activity.rubric.filter((item) => item && String(item.name || '').trim() && Number(item.percentage || 0) > 0)
      : [];
    const storedRubric = record.rubricScores && typeof record.rubricScores === 'object' ? record.rubricScores : {};
    const storedRubricCriteria = Array.isArray(storedRubric.criteria) ? storedRubric.criteria : [];
    const rubricScoreAt = (criterion, index) => {
      const saved = storedRubricCriteria[index] || storedRubricCriteria.find((item) => String(item?.name || '') === String(criterion?.name || ''));
      const value = Number(saved?.score);
      return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
    };
    const initialGradingMode = storedRubric.mode === 'rubric' && rubricCriteria.length ? 'rubric' : 'normal';
    openModal(`
      <section class="modal-card em-activity-grade-modal" role="dialog" aria-modal="true" aria-labelledby="activityGradeTitle">
        <button class="modal-close" data-close-modal aria-label="Cerrar">×</button>
        <p class="section-kicker">Calificar actividad</p>
        <h2 id="activityGradeTitle">${escapeHTML(record.fullName)}</h2>
        <div class="em-activity-grade-tabbar" role="tablist" aria-label="Opciones de calificación">
          <button class="is-active" type="button" role="tab" aria-selected="true" data-grade-modal-tab="score">Calificación</button>
          <button type="button" role="tab" aria-selected="false" data-grade-modal-tab="delivery">Entrega</button>
          <button type="button" role="tab" aria-selected="false" data-grade-modal-tab="group">Grupo</button>
          <button type="button" role="tab" aria-selected="false" data-grade-modal-tab="tracking">Seguimiento${trackingCount ? `<span class="em-grade-tab-count">${trackingCount}</span>` : ''}</button>
        </div>
        <form id="activityGradeForm" class="em-activity-grade-form">
          <section class="em-grade-form-section" data-grade-modal-panel="score">
            <div class="em-grade-form-heading"><h3>Calificación</h3><p>Escoge si deseas calificar directamente o utilizar la rúbrica definida para esta actividad.</p></div>
            <div class="em-grade-score-mode-tabs" role="tablist" aria-label="Método de calificación">
              <button class="${initialGradingMode === 'normal' ? 'is-active' : ''}" type="button" role="tab" aria-selected="${initialGradingMode === 'normal' ? 'true' : 'false'}" data-grade-score-mode="normal">Calificar normal</button>
              <button class="${initialGradingMode === 'rubric' ? 'is-active' : ''}" type="button" role="tab" aria-selected="${initialGradingMode === 'rubric' ? 'true' : 'false'}" data-grade-score-mode="rubric" ${rubricCriteria.length ? '' : 'disabled'}>Calificar con rúbrica</button>
            </div>

            <div class="em-grade-score-mode-panel" data-grade-score-panel="normal" ${initialGradingMode === 'normal' ? '' : 'hidden'}>
              <label class="field-label" for="activityScoreInput">Nota</label>
              <input class="input em-grade-main-score" id="activityScoreInput" type="number" min="0" max="100" step="1" value="${Number(record.score ?? 40)}" required />
              <div class="em-quick-grades" aria-label="Calificaciones rápidas">
                ${[100,95,90,85,80,75,70,65,60,55,50,45,40].map((score) => `<button type="button" data-quick-grade="${score}" ${Number(record.score) === score ? 'class="is-selected"' : ''}>${score}</button>`).join('')}
              </div>
            </div>

            <div class="em-grade-score-mode-panel em-rubric-grade-panel" data-grade-score-panel="rubric" ${initialGradingMode === 'rubric' ? '' : 'hidden'}>
              ${rubricCriteria.length ? `
                <div class="em-rubric-grade-head"><span>Criterio</span><span>Peso</span><span>Nota</span><span>Aporte</span></div>
                <div class="em-rubric-grade-list">
                  ${rubricCriteria.map((criterion, index) => {
                    const score = rubricScoreAt(criterion, index);
                    const contribution = score * Number(criterion.percentage || 0) / 100;
                    return `<label class="em-rubric-grade-row"><span><strong>${escapeHTML(criterion.name)}</strong></span><b>${Number(criterion.percentage || 0)}%</b><input class="input" type="number" min="0" max="100" step="1" value="${score}" data-rubric-grade-score="${index}" aria-label="Calificación para ${escapeAttr(criterion.name)}"/><output data-rubric-grade-contribution="${index}">${contribution.toFixed(2)}</output></label>`;
                  }).join('')}
                </div>
                <div class="em-rubric-grade-total"><span>Calificación calculada</span><strong id="activityRubricCalculatedScore">0.00</strong><small>/100</small></div>
              ` : '<div class="em-activity-panel-empty">Esta actividad no tiene una rúbrica disponible.</div>'}
            </div>

            <div class="em-grade-shared-comment">
              <label class="field-label" for="activityObservationsInput">Comentario de la calificación</label>
              <textarea class="input" id="activityObservationsInput" rows="5" placeholder="Escribe el comentario correspondiente a esta nota…">${escapeHTML(record.observations || '')}</textarea>
            </div>
          </section>

          <section class="em-grade-form-section" data-grade-modal-panel="delivery" hidden>
            <div class="em-grade-form-heading"><h3>Entrega</h3><p>Consulta o reemplaza el archivo entregado por el estudiante.</p></div>
            ${existingFile ? `<a class="em-submission-current-file" href="${escapeAttr(existingFile.url)}" target="_blank" rel="noopener">📎 ${escapeHTML(existingFile.name || 'Abrir archivo actual')}</a>` : '<p class="em-activity-panel-empty">Este estudiante aún no tiene archivo adjunto.</p>'}
            <label class="em-file-drop is-optional" for="activitySubmissionFile"><strong>${existingFile ? 'Reemplazar archivo' : 'Adjuntar archivo'}</strong><span id="activitySubmissionFileName">PDF o imagen · máximo 20 MB</span></label>
            <input class="em-hidden-file" id="activitySubmissionFile" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" />
          </section>

          <section class="em-grade-form-section" data-grade-modal-panel="group" hidden>
            <div class="em-grade-form-heading"><h3>Grupo</h3><p>Solo aparecen estudiantes sin grupo y los integrantes del grupo actual.</p></div>
            <label class="em-grade-group-search"><span>⌕</span><input id="activityGroupSearch" type="search" placeholder="Buscar estudiante" /></label>
            <div class="em-grade-group-options" id="activityGroupOptions">
              ${eligibleGroupRows.map((item) => `<label data-group-option data-search="${escapeAttr(normalizeSearch(`${item.lastName} ${item.firstName} ${item.fullName}`))}"><input type="checkbox" data-group-student="${escapeAttr(item.studentCode)}" ${item.studentCode === record.studentCode || currentCodes.has(item.studentCode) ? 'checked' : ''} ${item.studentCode === record.studentCode ? 'disabled' : ''}/><span>${escapeHTML(item.fullName)}</span></label>`).join('')}
            </div>
            <div class="em-group-score-overrides" id="activityGroupScoreOverrides"></div>
          </section>

          <section class="em-grade-form-section em-tracking-panel" data-grade-modal-panel="tracking" hidden>
            <div class="em-grade-form-heading"><h3>Seguimiento</h3><p>Registra cada solicitud, novedad o intento de entrega de manera cronológica.</p></div>
            <div class="em-tracking-compose">
              <label><span>Tipo de seguimiento</span><select class="select" id="activityDeliveryStatus"><option value="">Selecciona un estado</option>${ACTIVITY_DELIVERY_STATUSES.map(([value, label]) => `<option value="${value}">${escapeHTML(label)}</option>`).join('')}</select></label>
              <label><span>Observación del seguimiento</span><textarea class="input" id="activityDeliveryNote" rows="3" maxlength="240" placeholder="Ejemplo: Se solicitó nuevamente la actividad y se acordó una nueva fecha."></textarea></label>
            </div>
            <div class="em-delivery-history em-tracking-history">
              ${eventHistory.length ? eventHistory.slice().reverse().map((event, index) => {
                const sequence = eventHistory.length - index;
                return `<article><b>${sequence}</b><div><strong>${escapeHTML(activityDeliveryLabel(event.status))}</strong><time datetime="${escapeAttr(event.occurredAt || '')}">${escapeHTML(formatActivityTrackingDateTime(event.occurredAt))}</time>${event.note ? `<p>${escapeHTML(event.note)}</p>` : '<p>Sin observación adicional.</p>'}</div></article>`;
              }).join('') : '<div class="em-tracking-empty">Aún no hay seguimientos registrados.</div>'}
            </div>
          </section>

          <p class="em-class-create-error" id="activityGradeError" role="alert"></p>
          <div class="em-activity-grade-actions"><button class="ghost-btn" type="button" data-close-modal>Cancelar</button><button class="primary-btn" id="saveActivityGradeBtn" type="submit">Enviar calificación</button></div>
        </form>
      </section>
    `, () => initActivityGradeModal(activity, record, currentGroup));
  }

  function initActivityGradeModal(activity, record, currentGroup) {
    const form = document.getElementById('activityGradeForm');
    const groupOptions = document.getElementById('activityGroupOptions');
    const mainScore = document.getElementById('activityScoreInput');
    const gradeModal = document.querySelector('.em-activity-grade-modal');
    gradeModal?.closest('.modal-layer')?.classList.add('em-grade-modal-layer');
    const existingScores = new Map((currentGroup || []).map((item) => [item.studentCode, Number(item.score ?? record.score ?? 40)]));
    const rubricCriteria = Array.isArray(activity?.rubric)
      ? activity.rubric.filter((item) => item && String(item.name || '').trim() && Number(item.percentage || 0) > 0)
      : [];
    let gradingMode = record.rubricScores?.mode === 'rubric' && rubricCriteria.length ? 'rubric' : 'normal';
    let calculatedRubricScore = Number(record.rubricScores?.calculatedScore || record.score || 0);

    const GRADE_FLOW_OUT_MS = 170;
    const GRADE_FLOW_IN_MS = 260;
    let gradeTabAnimating = false;
    let scoreModeAnimating = false;

    const resetGradeFlow = (element) => {
      if (!element) return;
      element.classList.remove('em-enciso-flow-in', 'em-enciso-flow-out');
    };

    const playGradeFlow = (element, direction = 'in') => {
      if (!element) return;
      resetGradeFlow(element);
      void element.offsetWidth;
      element.classList.add(direction === 'out' ? 'em-enciso-flow-out' : 'em-enciso-flow-in');
    };

    const setActiveTab = (tabName = 'score', animate = true) => {
      const buttons = [...(gradeModal?.querySelectorAll('[data-grade-modal-tab]') || [])];
      const panels = [...(gradeModal?.querySelectorAll('[data-grade-modal-panel]') || [])];
      const incomingButton = buttons.find((button) => button.dataset.gradeModalTab === tabName);
      const incomingPanel = panels.find((panel) => panel.dataset.gradeModalPanel === tabName);
      const outgoingButton = buttons.find((button) => button.classList.contains('is-active'));
      const outgoingPanel = panels.find((panel) => !panel.hidden && panel.classList.contains('is-active'))
        || panels.find((panel) => !panel.hidden);

      if (!incomingButton || !incomingPanel || gradeTabAnimating) return;

      const activateImmediately = () => {
        buttons.forEach((button) => {
          const active = button === incomingButton;
          resetGradeFlow(button);
          button.classList.toggle('is-active', active);
          button.setAttribute('aria-selected', active ? 'true' : 'false');
          button.tabIndex = active ? 0 : -1;
        });
        panels.forEach((panel) => {
          const active = panel === incomingPanel;
          resetGradeFlow(panel);
          panel.hidden = !active;
          panel.classList.toggle('is-active', active);
          panel.style.display = active ? 'grid' : 'none';
        });
      };

      if (outgoingPanel === incomingPanel || !animate || !outgoingPanel || !outgoingButton) {
        activateImmediately();
        return;
      }

      gradeTabAnimating = true;
      playGradeFlow(outgoingPanel, 'out');
      playGradeFlow(outgoingButton, 'out');

      window.setTimeout(() => {
        buttons.forEach((button) => {
          const active = button === incomingButton;
          resetGradeFlow(button);
          button.classList.toggle('is-active', active);
          button.setAttribute('aria-selected', active ? 'true' : 'false');
          button.tabIndex = active ? 0 : -1;
        });
        panels.forEach((panel) => {
          const active = panel === incomingPanel;
          resetGradeFlow(panel);
          panel.hidden = !active;
          panel.classList.toggle('is-active', active);
          panel.style.display = active ? 'grid' : 'none';
        });
        playGradeFlow(incomingPanel, 'in');
        playGradeFlow(incomingButton, 'in');

        window.setTimeout(() => {
          resetGradeFlow(incomingPanel);
          resetGradeFlow(incomingButton);
          gradeTabAnimating = false;
        }, GRADE_FLOW_IN_MS + 40);
      }, GRADE_FLOW_OUT_MS);
    };

    const getEffectivePrimaryScore = () => gradingMode === 'rubric'
      ? calculatedRubricScore
      : Number(mainScore?.value || 0);

    const updateRubricCalculation = () => {
      if (!rubricCriteria.length) {
        calculatedRubricScore = Number(mainScore?.value || 0);
        return calculatedRubricScore;
      }
      let total = 0;
      rubricCriteria.forEach((criterion, index) => {
        const input = gradeModal?.querySelector(`[data-rubric-grade-score="${index}"]`);
        const raw = Number(input?.value || 0);
        const score = Math.max(0, Math.min(100, Number.isFinite(raw) ? raw : 0));
        if (input && Number(input.value) !== score) input.value = String(score);
        const contribution = score * Number(criterion.percentage || 0) / 100;
        total += contribution;
        const output = gradeModal?.querySelector(`[data-rubric-grade-contribution="${index}"]`);
        if (output) output.textContent = contribution.toFixed(2);
      });
      calculatedRubricScore = Math.round(total * 100) / 100;
      const totalBox = document.getElementById('activityRubricCalculatedScore');
      if (totalBox) totalBox.textContent = calculatedRubricScore.toFixed(2);
      return calculatedRubricScore;
    };

    const setScoreMode = (mode = 'normal', animate = true) => {
      const requestedMode = mode === 'rubric' && rubricCriteria.length ? 'rubric' : 'normal';
      const buttons = [...(gradeModal?.querySelectorAll('[data-grade-score-mode]') || [])];
      const panels = [...(gradeModal?.querySelectorAll('[data-grade-score-panel]') || [])];
      const incomingButton = buttons.find((button) => button.dataset.gradeScoreMode === requestedMode);
      const incomingPanel = panels.find((panel) => panel.dataset.gradeScorePanel === requestedMode);
      const outgoingButton = buttons.find((button) => button.classList.contains('is-active'));
      const outgoingPanel = panels.find((panel) => !panel.hidden);

      if (!incomingButton || !incomingPanel || scoreModeAnimating) return;

      gradingMode = requestedMode;
      if (gradingMode === 'rubric') updateRubricCalculation();
      refreshOverrides();

      const activateImmediately = () => {
        buttons.forEach((button) => {
          const active = button === incomingButton;
          resetGradeFlow(button);
          button.classList.toggle('is-active', active);
          button.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        panels.forEach((panel) => {
          const active = panel === incomingPanel;
          resetGradeFlow(panel);
          panel.hidden = !active;
          panel.style.display = active ? 'grid' : 'none';
        });
      };

      if (outgoingPanel === incomingPanel || !animate || !outgoingPanel || !outgoingButton) {
        activateImmediately();
        return;
      }

      scoreModeAnimating = true;
      playGradeFlow(outgoingPanel, 'out');
      playGradeFlow(outgoingButton, 'out');

      window.setTimeout(() => {
        buttons.forEach((button) => {
          const active = button === incomingButton;
          resetGradeFlow(button);
          button.classList.toggle('is-active', active);
          button.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        panels.forEach((panel) => {
          const active = panel === incomingPanel;
          resetGradeFlow(panel);
          panel.hidden = !active;
          panel.style.display = active ? 'grid' : 'none';
        });
        playGradeFlow(incomingPanel, 'in');
        playGradeFlow(incomingButton, 'in');

        window.setTimeout(() => {
          resetGradeFlow(incomingPanel);
          resetGradeFlow(incomingButton);
          scoreModeAnimating = false;
        }, GRADE_FLOW_IN_MS + 40);
      }, GRADE_FLOW_OUT_MS);
    };

    const refreshOverrides = () => {
      const host = document.getElementById('activityGroupScoreOverrides');
      if (!host) return;
      const checkedCodes = [...gradeModal.querySelectorAll('[data-group-student]:checked')].map((input) => input.dataset.groupStudent);
      const extras = checkedCodes.filter((code) => code !== record.studentCode);
      host.innerHTML = extras.length ? `<p>Puedes ajustar la nota de cada integrante sin romper el grupo.</p>${extras.map((code) => {
        const member = (state.activityGradebook || []).find((item) => item.studentCode === code);
        const value = existingScores.has(code) ? existingScores.get(code) : Number(getEffectivePrimaryScore() || 40);
        return `<label><span>${escapeHTML(member?.fullName || code)}</span><input class="input" type="number" min="0" max="100" step="1" data-group-score="${escapeAttr(code)}" value="${value}" /></label>`;
      }).join('')}` : '<p>Si no seleccionas compañeros, la calificación será individual.</p>';
    };

    gradeModal?.querySelectorAll('[data-grade-modal-tab]').forEach((button) => button.addEventListener('click', () => setActiveTab(button.dataset.gradeModalTab || 'score')));
    gradeModal?.querySelectorAll('[data-grade-score-mode]').forEach((button) => button.addEventListener('click', () => setScoreMode(button.dataset.gradeScoreMode || 'normal')));
    gradeModal?.querySelectorAll('[data-rubric-grade-score]').forEach((input) => input.addEventListener('input', () => {
      updateRubricCalculation();
      refreshOverrides();
    }));
    mainScore?.addEventListener('input', refreshOverrides);
    groupOptions?.querySelectorAll('[data-group-student]').forEach((input) => input.addEventListener('change', refreshOverrides));
    document.getElementById('activityGroupSearch')?.addEventListener('input', (event) => {
      const query = normalizeSearch(event.target.value || '');
      groupOptions?.querySelectorAll('[data-group-option]').forEach((label) => { label.hidden = Boolean(query) && !String(label.dataset.search || '').includes(query); });
    });
    gradeModal?.querySelectorAll('[data-quick-grade]').forEach((button) => button.addEventListener('click', () => {
      const value = Number(button.dataset.quickGrade || 40);
      if (mainScore) mainScore.value = String(value);
      gradeModal.querySelectorAll('[data-group-score]').forEach((input) => { input.value = String(value); });
      gradeModal.querySelectorAll('[data-quick-grade]').forEach((item) => item.classList.toggle('is-selected', item === button));
    }));
    document.getElementById('activitySubmissionFile')?.addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      const label = document.getElementById('activitySubmissionFileName');
      if (label) label.textContent = file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB` : 'PDF o imagen · máximo 20 MB';
    });
    updateRubricCalculation();
    setScoreMode(gradingMode, false);
    setActiveTab('score', false);

    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const errorBox = document.getElementById('activityGradeError');
      const save = document.getElementById('saveActivityGradeBtn');
      const primaryScore = gradingMode === 'rubric' ? updateRubricCalculation() : Number(mainScore?.value || 0);
      const rubricScores = gradingMode === 'rubric'
        ? {
            mode: 'rubric',
            calculatedScore: primaryScore,
            criteria: rubricCriteria.map((criterion, index) => {
              const score = Math.max(0, Math.min(100, Number(gradeModal?.querySelector(`[data-rubric-grade-score="${index}"]`)?.value || 0)));
              return {
                name: String(criterion.name || ''),
                percentage: Number(criterion.percentage || 0),
                score,
                contribution: Math.round((score * Number(criterion.percentage || 0) / 100) * 100) / 100
              };
            })
          }
        : { mode: 'normal', calculatedScore: primaryScore, criteria: [] };
      const selectedCodes = [...gradeModal.querySelectorAll('[data-group-student]:checked')].map((input) => input.dataset.groupStudent);
      const scores = { [record.studentCode]: primaryScore };
      gradeModal.querySelectorAll('[data-group-score]').forEach((input) => { scores[input.dataset.groupScore] = Number(input.value || primaryScore); });
      if (Object.values(scores).some((score) => !Number.isFinite(score) || score < 0 || score > 100)) {
        if (errorBox) errorBox.textContent = 'Todas las calificaciones deben estar entre 0 y 100.';
        return;
      }
      const file = document.getElementById('activitySubmissionFile')?.files?.[0] || null;
      if (file && file.size > 20 * 1024 * 1024) {
        if (errorBox) errorBox.textContent = 'El archivo de entrega supera 20 MB.';
        return;
      }
      const deliveryStatus = document.getElementById('activityDeliveryStatus')?.value || '';
      save.disabled = true;
      save.textContent = 'Guardando…';
      if (errorBox) errorBox.textContent = '';
      try {
        state.activityGradebook = await cloudAPI().saveActivityGrades({
          activityId: activity.id,
          assignmentId: state.assignment?.id || '',
          primaryStudentCode: record.studentCode,
          selectedStudentCodes: selectedCodes,
          previousGroupStudentCodes: (currentGroup || []).map((item) => item.studentCode),
          gradingGroupId: record.gradingGroupId || '',
          scores,
          rubricScores,
          observations: document.getElementById('activityObservationsInput')?.value.trim() || '',
          existingSubmissionFile: record.submissionFile || {},
          submissionFile: file,
          deliveryStatus,
          deliveryNote: document.getElementById('activityDeliveryNote')?.value.trim() || ''
        });
        syncActivityGradesFromGradebook(activity.id, state.assignment?.id || '', state.activityGradebook);
        updateActivityProgressFromGradebook(activity, state.activityGradebook);
        closeModal(false);
        refreshActivityGradebookList();
        toast(selectedCodes.length > 1 ? `Calificación guardada para ${selectedCodes.length} estudiantes.` : 'Calificación guardada.');
      } catch (error) {
        if (errorBox) errorBox.textContent = error?.message || 'No se pudo guardar la calificación.';
        reportCloudError('No se pudo guardar la calificación', error, { silent: true });
        save.disabled = false;
        save.textContent = 'Enviar calificación';
      }
    });
  }

  function openDeleteActivityModal(activity) {
    const assignmentIds = [...new Set(Array.isArray(activity.assignmentIds) ? activity.assignmentIds.filter(Boolean) : [])];
    const shared = assignmentIds.length > 1;
    const currentCourse = `${state.assignment?.grade || ''}-${state.assignment?.course || ''}`;
    openModal(`
      <div class="modal-card danger-modal" role="dialog" aria-modal="true" aria-labelledby="deleteActivityTitle">
        <div class="danger-head">
          <span class="danger-red-mesh" aria-hidden="true"></span>
          <div class="warning-tune-stack"><div class="warning-icon warning-duo" aria-hidden="true"><span class="warning-bounce warning-bounce-a"><img class="warning-mark warning-mark-a" src="./assets/warn-exp2.png" alt="" /></span><span class="warning-bounce warning-bounce-b"><img class="warning-mark warning-mark-b" src="./assets/warn-exp1.png" alt="" /></span></div></div>
          <div class="danger-copy"><h2 id="deleteActivityTitle">${shared ? 'ELIMINARÁS O RETIRARÁS ESTA ACTIVIDAD' : 'ELIMINARÁS ESTA ACTIVIDAD'}</h2><p>${shared ? `Está compartida con ${assignmentIds.length} cursos. Puedes retirarla solo de ${escapeHTML(currentCourse)} o borrarla completamente.` : 'Se eliminarán la actividad, sus archivos y únicamente sus registros de calificación.'}</p></div>
          <button class="modal-close danger-close" data-close-modal aria-label="Cerrar">×</button>
        </div>
        <div class="danger-body">
          <div class="delete-target"><strong>${escapeHTML(activity.title || 'Actividad')}</strong><span>Curso ${escapeHTML(currentCourse)} · Periodo ${Number(activity.period || 1)}</span></div>
          <p class="em-delete-class-error" id="deleteActivityError" role="alert"></p>
          <div class="danger-actions">${shared ? `<button class="ghost-btn" id="removeActivityFromCourseBtn" type="button">Quitar solo de ${escapeHTML(currentCourse)}</button>` : ''}<button class="danger-confirm" id="deleteActivityEverywhereBtn" type="button">${shared ? 'Eliminar de todos los cursos' : 'Sí, eliminar actividad'}</button><button class="ghost-btn" type="button" data-close-modal>Cancelar</button></div>
        </div>
      </div>
    `, () => {
      document.getElementById('removeActivityFromCourseBtn')?.addEventListener('click', () => deleteActivityRecord(activity, 'course'));
      document.getElementById('deleteActivityEverywhereBtn')?.addEventListener('click', () => deleteActivityRecord(activity, 'all'));
      startDeleteWarningMotion();
    });
  }

  async function deleteActivityRecord(activity, mode = 'all') {
    const errorBox = document.getElementById('deleteActivityError');
    const buttons = document.querySelectorAll('#removeActivityFromCourseBtn, #deleteActivityEverywhereBtn');
    buttons.forEach((button) => { button.disabled = true; });
    try {
      await cloudAPI().deleteActivity({ activityId: activity.id, assignmentId: state.assignment?.id || '', mode });
      if (mode === 'course') {
        activity.assignmentIds = (activity.assignmentIds || []).filter((id) => id !== state.assignment?.id);
        activity.assignmentId = activity.assignmentIds[0] || '';
      } else {
        state.data.activities = (state.data.activities || []).filter((item) => item.id !== activity.id);
      }
      closeModal(false);
      renderSubjectDetail('activities');
      toast(mode === 'course' ? 'Actividad retirada de este curso.' : 'Actividad y sus calificaciones fueron eliminadas.');
    } catch (error) {
      if (errorBox) errorBox.textContent = error?.message || 'No se pudo eliminar la actividad.';
      reportCloudError('No se pudo eliminar la actividad', error, { silent: true });
      buttons.forEach((button) => { button.disabled = false; });
    }
  }


  function renderClassesTab(options = {}) {
    const $content = document.getElementById('tabContent');
    if (!$content) return;
    setActiveSubjectTabMeta('classes');

    $content.innerHTML = `
      <section class="class-hero em-cl-hero-host" data-em-classes-hero aria-label="Clases de la asignatura">
        ${emClClassesHeroHTML()}
      </section>
      <div class="view-row em-content-toolbar em-content-toolbar-has-action em-class-view-only">
        <button class="em-add-content-btn" id="openAddClassBtn" type="button">＋ Añadir clase</button>
        <div class="em-view-switch" aria-label="Vista de clases">
          <button class="mini-btn ${state.classViewMode === 'grid' ? 'selected' : ''}" id="gridModeBtn" type="button" aria-label="Vista en cuadrícula" title="Cuadrícula">▦</button>
          <button class="mini-btn ${state.classViewMode === 'list' ? 'selected' : ''}" id="listModeBtn" type="button" aria-label="Vista en lista" title="Lista">☰</button>
        </div>
      </div>
      <div id="classGrid" class="em-content-list is-${state.classViewMode}">
        ${renderClassCardsHTML()}
      </div>
    `;

    bindClassViewButtons();
    bindClassCards();
    document.getElementById('openAddClassBtn')?.addEventListener('click', openAddClassModal);
    emClInitClassesHero($content);
    emPlayTabEntrance($content, 'classes');
    if (options.animate) pulseElement($content, 'tab-enter');
  }
  function getClassesForCurrentAssignment() {
    const assignment = state.assignment;
    if (!assignment) return [];
    return state.data.classes.filter((item) => {
      const ids = Array.isArray(item.assignmentIds) ? item.assignmentIds : [];
      if (ids.length) return ids.includes(assignment.id);
      return item.assignmentId === assignment.id || item.subject === assignment.subject || item.area === assignment.area;
    });
  }
  function getClassTargetAssignments(scope = 'course') {
    const current = state.assignment;
    if (!current) return [];
    if (scope !== 'grade') return [current];
    return (state.data.assignments || []).filter((assignment) => {
      const sameGrade = String(assignment.grade || '') === String(current.grade || '');
      const sameSubject = current.subjectId && assignment.subjectId
        ? assignment.subjectId === current.subjectId
        : assignment.subject === current.subject && assignment.area === current.area;
      return assignment.active !== false && sameGrade && sameSubject;
    });
  }

  async function loadPdfJs() {
    if (!pdfJsModulePromise) {
      pdfJsModulePromise = import(`./vendor/pdfjs/pdf.min.mjs?v=${PDFJS_VERSION}`).then((pdfjs) => {
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(`./vendor/pdfjs/pdf.worker.min.mjs?v=${PDFJS_VERSION}`, document.baseURI).href;
        return pdfjs;
      });
    }
    return pdfJsModulePromise;
  }

  function canvasToBlob(canvas, type = 'image/webp', quality = .88) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('No se pudo generar la portada del PDF.')), type, quality);
    });
  }

  async function inspectClassPdf(file, createThumbnail = false) {
    const pdfjs = await loadPdfJs();
    const bytes = await file.arrayBuffer();
    const documentTask = pdfjs.getDocument({ data: bytes, isEvalSupported: false });
    const pdfDocument = await documentTask.promise;
    let thumbnailFile = null;
    try {
      if (createThumbnail) {
        const page = await pdfDocument.getPage(1);
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(2.2, Math.max(1, 720 / Math.max(1, baseViewport.width)));
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { alpha: false });
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: context, viewport }).promise;
        const blob = await canvasToBlob(canvas);
        thumbnailFile = new File([blob], 'portada-generada.webp', { type: 'image/webp' });
        page.cleanup?.();
      }
      return { pageCount: pdfDocument.numPages || 1, thumbnailFile };
    } finally {
      await pdfDocument.destroy?.();
    }
  }

  function openAddClassModal() {
    const assignment = state.assignment;
    if (!assignment) return;
    const gradeTargets = getClassTargetAssignments('grade');
    const gradeCourses = gradeTargets.map((item) => `${item.grade}-${item.course}`).join(', ');
    openModal(`
      <section class="modal-card em-class-create-modal" role="dialog" aria-modal="true" aria-labelledby="addClassTitle">
        <button class="modal-close" data-close-modal aria-label="Cerrar">×</button>
        <p class="section-kicker">Biblioteca de clases</p>
        <h2 id="addClassTitle">Añadir clase</h2>
        <p class="card-sub">Sube el material en PDF. La primera página será la portada cuando no elijas una imagen.</p>
        <form id="addClassForm" class="em-class-create-form">
          <label class="field-label" for="classTitleInput">Nombre del tema</label>
          <input class="input" id="classTitleInput" maxlength="120" autocomplete="off" placeholder="Ejemplo: Gráficos de barras" required />

          <label class="field-label" for="classPeriodInput">Periodo</label>
          <select class="select" id="classPeriodInput" required>
            ${[1, 2, 3, 4].map((period) => `<option value="${period}" ${Number(getAutomaticAcademicPeriod()) === period ? 'selected' : ''}>Periodo ${period}</option>`).join('')}
          </select>

          <label class="field-label" for="classPdfInput">Archivo PDF</label>
          <label class="em-file-drop" for="classPdfInput" id="classPdfDrop">
            <strong>Seleccionar PDF</strong>
            <span id="classPdfName">Máximo 20 MB</span>
          </label>
          <input class="em-hidden-file" id="classPdfInput" type="file" accept="application/pdf,.pdf" required />

          <label class="field-label" for="classThumbInput">Imagen de portada <span>(opcional)</span></label>
          <label class="em-file-drop is-optional" for="classThumbInput" id="classThumbDrop">
            <strong>Seleccionar imagen</strong>
            <span id="classThumbName">PNG, JPG o WEBP. Si la omites se usará la primera página.</span>
          </label>
          <input class="em-hidden-file" id="classThumbInput" type="file" accept="image/png,image/jpeg,image/webp" />

          <fieldset class="em-class-scope">
            <legend>¿Dónde estará disponible?</legend>
            <label>
              <input type="radio" name="classScope" value="course" checked />
              <span><strong>Solo este curso</strong><small>${escapeHTML(assignment.grade)}-${escapeHTML(assignment.course)}</small></span>
            </label>
            <label>
              <input type="radio" name="classScope" value="grade" />
              <span><strong>Todo el grado ${escapeHTML(assignment.grade)}</strong><small>${escapeHTML(gradeCourses || `${assignment.grade}-${assignment.course}`)}</small></span>
            </label>
          </fieldset>

          <p class="em-class-create-error" id="classCreateError" role="alert"></p>
          <button class="primary-btn full" id="createClassSubmitBtn" type="submit">Guardar clase</button>
        </form>
      </section>
    `, () => {
      const form = document.getElementById('addClassForm');
      const pdfInput = document.getElementById('classPdfInput');
      const thumbInput = document.getElementById('classThumbInput');
      const pdfName = document.getElementById('classPdfName');
      const thumbName = document.getElementById('classThumbName');
      document.getElementById('classTitleInput')?.focus();
      pdfInput?.addEventListener('change', () => {
        const file = pdfInput.files?.[0];
        pdfName.textContent = file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB` : 'Máximo 20 MB';
      });
      thumbInput?.addEventListener('change', () => {
        const file = thumbInput.files?.[0];
        thumbName.textContent = file ? file.name : 'PNG, JPG o WEBP. Si la omites se usará la primera página.';
      });
      form?.addEventListener('submit', submitNewClass);
    });
  }

  async function submitNewClass(event) {
    event.preventDefault();
    const assignment = state.assignment;
    const title = document.getElementById('classTitleInput')?.value.trim() || '';
    const period = Number(document.getElementById('classPeriodInput')?.value || state.period || 1);
    const pdfFile = document.getElementById('classPdfInput')?.files?.[0] || null;
    const selectedThumb = document.getElementById('classThumbInput')?.files?.[0] || null;
    const scope = document.querySelector('input[name="classScope"]:checked')?.value || 'course';
    const submit = document.getElementById('createClassSubmitBtn');
    const errorBox = document.getElementById('classCreateError');
    const fail = (message) => {
      if (errorBox) errorBox.textContent = message;
    };
    fail('');
    if (!title) return fail('Escribe el nombre del tema.');
    if (!pdfFile) return fail('Selecciona un archivo PDF.');
    const isPdf = pdfFile.type === 'application/pdf' || /\.pdf$/i.test(pdfFile.name || '');
    if (!isPdf) return fail('El material debe ser un archivo PDF válido.');
    if (pdfFile.size > MAX_CLASS_PDF_BYTES) return fail('El PDF supera el máximo de 20 MB.');
    if (selectedThumb && !/^image\/(png|jpeg|webp)$/i.test(selectedThumb.type || '')) return fail('La portada debe ser PNG, JPG o WEBP.');
    if (selectedThumb && selectedThumb.size > MAX_CLASS_THUMB_BYTES) return fail('La imagen de portada supera el máximo de 5 MB.');
    if (!isCloudReady()) return fail('Necesitas una sesión activa de Supabase para guardar la clase.');

    submit.disabled = true;
    submit.textContent = 'Preparando PDF...';
    try {
      const pdfInfo = await inspectClassPdf(pdfFile, !selectedThumb);
      const thumbnailFile = selectedThumb || pdfInfo.thumbnailFile;
      const targets = getClassTargetAssignments(scope);
      if (!targets.length) throw new Error('No se encontraron cursos compatibles para esta clase.');
      submit.textContent = 'Subiendo archivos...';
      const lesson = await cloudAPI().createPdfLesson({
        currentAssignment: assignment,
        targetAssignmentIds: targets.map((item) => item.id),
        title,
        period,
        pdfFile,
        thumbnailFile,
        pageCount: pdfInfo.pageCount
      });
      state.data.classes.push(lesson);
      closeModal(false);
      syncAcademicPeriodState(period);
      renderClassesTab({ animate: true });
      toast(scope === 'grade'
        ? `Clase guardada para ${targets.length} cursos del grado ${assignment.grade}.`
        : `Clase guardada para ${assignment.grade}-${assignment.course}.`);
    } catch (error) {
      fail(error?.message || 'No se pudo guardar la clase.');
      reportCloudError('No se pudo guardar la clase', error, { silent: true });
    } finally {
      if (document.body.contains(submit)) {
        submit.disabled = false;
        submit.textContent = 'Guardar clase';
      }
    }
  }

  function renderClassCardsHTML() {
    const filtered = getClassesForCurrentAssignment().filter((item) => Number(item.period) === Number(state.period));
    return filtered.map((item, index) => classCardHTML(item, index)).join('') || emPeriodEmptyStateHTML('classes', state.period);
  }
  function bindClassViewButtons() {
    document.getElementById('gridModeBtn')?.addEventListener('click', () => setClassViewMode('grid'));
    document.getElementById('listModeBtn')?.addEventListener('click', () => setClassViewMode('list'));
  }
  function bindClassCards() {
    document.querySelectorAll('[data-delete-class-id]').forEach((button) => {
      if (button.dataset.boundClassDelete === 'true') return;
      button.dataset.boundClassDelete = 'true';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const item = state.data.classes.find((lesson) => lesson.id === button.dataset.deleteClassId);
        if (item) openDeleteClassModal(item);
      });
    });
    document.querySelectorAll('[data-class-id]').forEach((button) => {
      if (button.dataset.boundClassCard === 'true') return;
      button.dataset.boundClassCard = 'true';
      button.addEventListener('click', (event) => {
        if (event.target.closest('[data-delete-class-id]')) return;
        const item = state.data.classes.find((lesson) => lesson.id === button.dataset.classId);
        if (item) renderLesson(item);
      });
      button.addEventListener('keydown', (event) => {
        if (event.target.closest('[data-delete-class-id]')) return;
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        const item = state.data.classes.find((lesson) => lesson.id === button.dataset.classId);
        if (item) renderLesson(item);
      });
    });
  }

  function openDeleteClassModal(lesson) {
    const assignmentIds = [...new Set(Array.isArray(lesson.assignmentIds) ? lesson.assignmentIds.filter(Boolean) : [])];
    const shared = assignmentIds.length > 1;
    const currentCourse = `${state.assignment?.grade || ''}-${state.assignment?.course || ''}`;
    openModal(`
      <div class="modal-card danger-modal" role="dialog" aria-modal="true" aria-labelledby="deleteClassTitle">
        <div class="danger-head">
          <span class="danger-red-mesh" aria-hidden="true"></span>
          <div class="warning-tune-stack">
            <div class="warning-icon warning-duo" aria-hidden="true">
              <span class="warning-bounce warning-bounce-a"><img class="warning-mark warning-mark-a" src="./assets/warn-exp2.png" alt="" /></span>
              <span class="warning-bounce warning-bounce-b"><img class="warning-mark warning-mark-b" src="./assets/warn-exp1.png" alt="" /></span>
            </div>
          </div>
          <div class="danger-copy">
            <h2 id="deleteClassTitle">${shared ? 'ELIMINARÁS O RETIRARÁS ESTA CLASE' : 'ELIMINARÁS ESTA CLASE'}</h2>
            <p>${shared
              ? `Está compartida con ${assignmentIds.length} cursos. Puedes retirarla solo de ${escapeHTML(currentCourse)} o borrarla completamente.`
              : 'Se eliminarán la clase, el PDF y su portada. Esta acción no se puede deshacer.'}</p>
          </div>
          <button class="modal-close danger-close" data-close-modal aria-label="Cerrar">×</button>
        </div>
        <div class="danger-body">
          <div class="delete-target">
            <strong>${escapeHTML(lesson.title || 'Clase sin nombre')}</strong>
            <span>${shared
              ? `Disponible en ${assignmentIds.length} cursos · Curso actual ${escapeHTML(currentCourse)}`
              : `Curso ${escapeHTML(currentCourse)} · Periodo ${escapeHTML(String(lesson.period || state.period || 1))}`}</span>
          </div>
          <p class="em-delete-class-error" id="deleteClassError" role="alert"></p>
          <div class="danger-actions">
            ${shared ? `<button class="ghost-btn" id="removeClassFromCourseBtn" type="button">Quitar solo de ${escapeHTML(currentCourse)}</button>` : ''}
            <button class="danger-confirm" id="deleteClassEverywhereBtn" type="button">${shared ? 'Eliminar de todos los cursos' : 'Sí, eliminar clase'}</button>
            <button class="ghost-btn" type="button" data-close-modal>Cancelar</button>
          </div>
        </div>
      </div>
    `, () => {
      document.getElementById('removeClassFromCourseBtn')?.addEventListener('click', () => deleteClassRecord(lesson, 'course'));
      document.getElementById('deleteClassEverywhereBtn')?.addEventListener('click', () => deleteClassRecord(lesson, 'all'));
      startDeleteWarningMotion();
    });
  }

  async function deleteClassRecord(lesson, mode = 'all') {
    const errorBox = document.getElementById('deleteClassError');
    const buttons = document.querySelectorAll('#removeClassFromCourseBtn, #deleteClassEverywhereBtn');
    const fail = (message) => { if (errorBox) errorBox.textContent = message; };
    fail('');
    if (!isCloudReady()) return fail('Necesitas una sesión activa de Supabase para eliminar la clase.');
    buttons.forEach((button) => { button.disabled = true; });
    try {
      await cloudAPI().deletePdfLesson({
        lessonId: lesson.id,
        assignmentId: state.assignment?.id || '',
        mode,
        storagePdfPath: lesson.storagePdfPath || '',
        storageThumbnailPath: lesson.storageThumbnailPath || ''
      });
      if (mode === 'course') {
        lesson.assignmentIds = (lesson.assignmentIds || []).filter((id) => id !== state.assignment?.id);
        if (lesson.assignmentId === state.assignment?.id) lesson.assignmentId = lesson.assignmentIds[0] || '';
        if (!lesson.assignmentIds.length) state.data.classes = state.data.classes.filter((item) => item.id !== lesson.id);
      } else {
        state.data.classes = state.data.classes.filter((item) => item.id !== lesson.id);
      }
      closeModal(false);
      updateClassGrid(true);
      toast(mode === 'course' ? 'Clase retirada de este curso.' : 'Clase eliminada de todos los cursos.');
    } catch (error) {
      fail(error?.message || 'No se pudo eliminar la clase.');
      reportCloudError('No se pudo eliminar la clase', error, { silent: true });
      buttons.forEach((button) => { button.disabled = false; });
    }
  }

  function updateClassGrid(animate = false) {
    const grid = document.getElementById('classGrid');
    if (!grid) return;
    grid.className = `em-content-list is-${state.classViewMode}`;
    grid.innerHTML = renderClassCardsHTML();
    bindClassCards();
    if (animate) {
      pulseElement(grid, 'class-grid-update');
      emPlayTabEntrance(document.getElementById('tabContent') || grid, 'classes');
    }
  }
  function cleanupActivePdfViewer() {
    if (typeof activePdfViewerCleanup !== 'function') return;
    const cleanup = activePdfViewerCleanup;
    activePdfViewerCleanup = null;
    try { cleanup(); } catch (_) {}
  }

  function renderLesson(lesson, options = {}) {
    cleanupActivePdfViewer();
    const assignment = state.assignment;
    if (assignment?.id && lesson?.id) commitAppRoute({ screen: 'lesson', assignmentId: assignment.id, lessonId: lesson.id }, options);
    if (isCloudReady() && assignment?.id && lesson?.id) {
      cloudAPI().recordLessonView({ assignmentId: assignment.id, lessonId: lesson.id })
        .catch((error) => reportCloudError('No se registró la apertura de la clase', error, { silent: true }));
    }
    const isPdf = lesson.lessonType === 'PDF' || lesson.type === 'PDF' || /\.pdf(?:$|[?#])/i.test(String(lesson.contentUrl || ''));
    const markup = `
      <main class="screen class-screen ${isPdf ? 'em-pdf-class-screen' : ''}">
        ${isPdf ? `
          <section class="em-pdf-notebook is-preparing" id="pdfNotebook" aria-label="Lector de ${escapeAttr(lesson.title || 'clase')}">
            <div class="em-pdf-loading" id="pdfLoading" role="status" aria-live="polite" aria-label="Cargando clase">
              <div class="em-pdf-loader-geometry" aria-hidden="true">
                <span class="em-pdf-loader-shape circle shape-a"></span>
                <span class="em-pdf-loader-shape square shape-b"></span>
                <span class="em-pdf-loader-shape triangle shape-c"></span>
                <span class="em-pdf-loader-shape x shape-d"></span>
                <span class="em-pdf-loader-shape circle outline shape-e"></span>
                <span class="em-pdf-loader-shape square outline shape-f"></span>
              </div>
              <div class="em-pdf-loader-track" aria-hidden="true">
                <span class="em-pdf-loader-bar" id="pdfLoadingBar"></span>
              </div>
              <span class="sr-only">Cargando clase</span>
            </div>
            <button class="em-pdf-float-btn em-pdf-back" id="backBtn" type="button" aria-label="Volver">←</button>
            <div class="em-pdf-stage" id="pdfStage">
              <button class="em-pdf-nav em-pdf-prev" id="pdfPrevBtn" type="button" aria-label="Página anterior">‹</button>
              <div class="em-pdf-page-viewport" id="pdfPageViewport">
                <div class="em-pdf-page-shell" id="pdfPageShell">
                  <span class="em-pdf-spiral" aria-hidden="true"></span>
                  <canvas class="em-pdf-page-canvas is-active" id="pdfPageCanvas" aria-label="Página del PDF"></canvas>
                  <canvas class="em-pdf-page-canvas" id="pdfPageCanvasNext" aria-hidden="true" hidden></canvas>
                  <span class="em-pdf-page-shine" aria-hidden="true"></span>
                </div>
              </div>
              <button class="em-pdf-nav em-pdf-next" id="pdfNextBtn" type="button" aria-label="Página siguiente">›</button>
            </div>
            <div class="em-pdf-floating-zoom" aria-label="Controles de zoom">
              <button class="em-pdf-float-btn" type="button" id="pdfZoomOutBtn" aria-label="Alejar">−</button>
              <button class="em-pdf-float-btn em-pdf-fit-btn" type="button" id="pdfZoomFitBtn" aria-label="Ajustar" title="Ajustar a pantalla">
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M8 4H5v3M16 4h3v3M8 20H5v-3M16 20h3v-3" />
                </svg>
              </button>
              <button class="em-pdf-float-btn" type="button" id="pdfZoomInBtn" aria-label="Acercar">＋</button>
            </div>
            <strong class="em-pdf-page-pill" id="pdfPageIndicator" aria-live="polite">1/1</strong>
          </section>
        ` : `
          <header class="topbar fixed-lock lesson-topbar">
            <button class="icon-btn" id="backBtn" aria-label="Volver">←</button>
            <h1>${escapeHTML(lesson.title || 'Clase')}</h1>
            <span class="spacer"></span>
          </header>
          <iframe class="lesson-frame" src="${escapeAttr(lesson.contentUrl || '')}" title="${escapeAttr(lesson.title || 'Clase')}"></iframe>
        `}
      </main>
    `;
    mount(markup, () => {
      document.getElementById('backBtn').addEventListener('click', () => {
        cleanupActivePdfViewer();
        renderSubjectDetail('classes');
      });
      emPlayLessonEntrance(document.querySelector('.class-screen'));
      if (isPdf) initPdfNotebookViewer(lesson).catch((error) => showPdfViewerError(error));
    });
  }

  function showPdfViewerError(error) {
    const loading = document.getElementById('pdfLoading');
    const notebook = document.getElementById('pdfNotebook');
    if (!loading) return;
    notebook?.classList.remove('is-ready');
    notebook?.classList.add('is-preparing');
    loading.hidden = false;
    loading.style.removeProperty('display');
    loading.className = 'em-pdf-loading is-error';
    loading.innerHTML = `<div class="em-pdf-loader-error"><strong>No se pudo abrir la clase.</strong><span>${escapeHTML(error?.message || 'Revisa el archivo PDF.')}</span></div>`;
  }

  async function initPdfNotebookViewer(lesson) {
    const loading = document.getElementById('pdfLoading');
    const loadingBar = document.getElementById('pdfLoadingBar');
    const notebook = document.getElementById('pdfNotebook');
    const setLoadingProgress = (value) => {
      if (!loadingBar) return;
      const safeValue = Math.max(4, Math.min(100, Number(value) || 4));
      loadingBar.style.setProperty('--em-pdf-load-progress', `${safeValue}%`);
    };
    if (loading) {
      loading.hidden = false;
      loading.style.removeProperty('display');
      loading.classList.remove('is-error', 'is-complete');
    }
    notebook?.classList.add('is-preparing');
    notebook?.classList.remove('is-ready');
    setLoadingProgress(8);

    const pdfjs = await loadPdfJs();
    setLoadingProgress(22);
    const viewportHost = document.getElementById('pdfPageViewport');
    const shell = document.getElementById('pdfPageShell');
    let activeCanvas = document.getElementById('pdfPageCanvas');
    let standbyCanvas = document.getElementById('pdfPageCanvasNext');
    const prev = document.getElementById('pdfPrevBtn');
    const next = document.getElementById('pdfNextBtn');
    const indicator = document.getElementById('pdfPageIndicator');
    const zoomOut = document.getElementById('pdfZoomOutBtn');
    const zoomFit = document.getElementById('pdfZoomFitBtn');
    const zoomIn = document.getElementById('pdfZoomInBtn');
    if (!loading || !viewportHost || !shell || !activeCanvas || !standbyCanvas || !prev || !next || !indicator) return;

    const response = await fetch(lesson.contentUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error(`El PDF respondió con estado ${response.status}.`);
    setLoadingProgress(40);
    const bytes = await response.arrayBuffer();
    setLoadingProgress(62);
    const documentTask = pdfjs.getDocument({ data: bytes, isEvalSupported: false });
    const pdfDocument = await documentTask.promise;
    setLoadingProgress(78);
    const viewerController = new AbortController();
    const viewerSignal = viewerController.signal;
    let resizeTimer = 0;
    let renderTask = null;
    activePdfViewerCleanup = () => {
      viewerController.abort();
      clearTimeout(resizeTimer);
      try { renderTask?.cancel?.(); } catch (_) {}
      try { pdfDocument.destroy?.(); } catch (_) {}
    };

    let pageNumber = 1;
    let rendering = false;
    let pendingRender = null;
    let zoom = 1;
    let fitScale = 1;
    let touchStartX = 0;
    let touchStartY = 0;
    let dragStartScrollLeft = 0;
    let dragStartScrollTop = 0;
    let dragged = false;
    const activePointers = new Map();
    let pinchStartDistance = 0;
    let pinchStartZoom = 1;
    let pinchPreviewZoom = 1;

    const clampZoom = (value) => Math.max(.65, Math.min(4, Number(value) || 1));
    const updateControls = () => {
      prev.disabled = pageNumber <= 1 || rendering;
      next.disabled = pageNumber >= pdfDocument.numPages || rendering;
      indicator.textContent = `${pageNumber}/${pdfDocument.numPages}`;
      if (zoomOut) zoomOut.disabled = zoom <= .66 || rendering;
      if (zoomFit) zoomFit.disabled = Math.abs(zoom - 1) < .01 || rendering;
      if (zoomIn) zoomIn.disabled = zoom >= 3.99 || rendering;
    };

    const getFitScale = (baseViewport) => {
      const stageRect = viewportHost.getBoundingClientRect();
      const availableWidth = Math.max(220, stageRect.width - 4);
      const availableHeight = Math.max(260, stageRect.height - 4);
      const isNarrow = window.matchMedia('(max-width: 720px)').matches || availableWidth < 620;
      if (isNarrow) return availableWidth / baseViewport.width;
      return Math.min(availableHeight / baseViewport.height, availableWidth / baseViewport.width);
    };

    const paintPage = async (number, canvas, requestedZoom = zoom) => {
      const page = await pdfDocument.getPage(number);
      const baseViewport = page.getViewport({ scale: 1 });
      fitScale = getFitScale(baseViewport);
      const cssScale = fitScale * requestedZoom;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const renderViewport = page.getViewport({ scale: cssScale * pixelRatio });
      const cssWidth = Math.max(1, Math.round(renderViewport.width / pixelRatio));
      const cssHeight = Math.max(1, Math.round(renderViewport.height / pixelRatio));
      const context = canvas.getContext('2d', { alpha: false });
      canvas.width = Math.max(1, Math.ceil(renderViewport.width));
      canvas.height = Math.max(1, Math.ceil(renderViewport.height));
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      renderTask = page.render({ canvasContext: context, viewport: renderViewport });
      await renderTask.promise;
      renderTask = null;
      page.cleanup?.();
      return { cssWidth, cssHeight };
    };

    const SLIDE_DURATION = 500;
    const SLIDE_EASING = 'cubic-bezier(0.190, 1.000, 0.220, 1.000)';
    let hasRenderedPage = false;
    let viewerReady = false;

    const waitForPaint = () => new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });

    const applyShellSize = ({ cssWidth, cssHeight }) => {
      shell.style.width = `${cssWidth}px`;
      shell.style.height = `${cssHeight}px`;
    };

    const resetCanvasVisual = (canvas) => {
      canvas.getAnimations?.().forEach((animation) => animation.cancel());
      canvas.classList.remove(
        'slide-left',
        'slide-right',
        'em-pdf-slide-out-left',
        'em-pdf-slide-out-right',
        'em-pdf-slide-ready-left',
        'em-pdf-slide-ready-right'
      );
      canvas.style.removeProperty('transform');
      canvas.style.removeProperty('opacity');
      canvas.style.removeProperty('z-index');
      canvas.style.removeProperty('visibility');
    };

    const exposeCanvas = (canvas, isActive = false) => {
      canvas.hidden = false;
      canvas.style.visibility = 'visible';
      canvas.classList.toggle('is-active', isActive);
      if (isActive) canvas.removeAttribute('aria-hidden');
      else canvas.setAttribute('aria-hidden', 'true');
    };

    const hideCanvas = (canvas) => {
      resetCanvasVisual(canvas);
      canvas.hidden = true;
      canvas.classList.remove('is-active');
      canvas.setAttribute('aria-hidden', 'true');
    };

    const completeCanvasSwap = (targetSize, { clearPinchPreview = false } = {}) => {
      applyShellSize(targetSize);
      resetCanvasVisual(activeCanvas);
      resetCanvasVisual(standbyCanvas);
      hideCanvas(activeCanvas);
      exposeCanvas(standbyCanvas, true);

      const oldCanvas = activeCanvas;
      activeCanvas = standbyCanvas;
      standbyCanvas = oldCanvas;

      if (clearPinchPreview) {
        shell.classList.remove('is-pinching');
        shell.style.removeProperty('--em-pdf-pinch-scale');
      }
      shell.classList.remove('is-slide-turning');
    };

    const animateWithCssFallback = async (movingForward) => {
      const enteringClass = movingForward ? 'slide-left' : 'slide-right';
      const leavingClass = movingForward ? 'em-pdf-slide-out-left' : 'em-pdf-slide-out-right';
      standbyCanvas.classList.add(enteringClass);
      activeCanvas.classList.add(leavingClass);
      const animations = [...standbyCanvas.getAnimations(), ...activeCanvas.getAnimations()];
      if (animations.length) {
        await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
      } else {
        await new Promise((resolve) => window.setTimeout(resolve, SLIDE_DURATION + 80));
      }
    };

    const animatePageSlide = async (direction, targetSize) => {
      const movingForward = direction === 'next';
      resetCanvasVisual(activeCanvas);
      resetCanvasVisual(standbyCanvas);
      applyShellSize(targetSize);
      exposeCanvas(activeCanvas, true);
      exposeCanvas(standbyCanvas, false);
      shell.classList.add('is-slide-turning');

      const enterFrom = movingForward ? 'translate3d(100%, 0, 0)' : 'translate3d(-100%, 0, 0)';
      const leaveTo = movingForward ? 'translate3d(-100%, 0, 0)' : 'translate3d(100%, 0, 0)';
      const timing = { duration: SLIDE_DURATION, easing: SLIDE_EASING, fill: 'both' };

      // La página destino ya está pintada. Se coloca fuera del borde antes del
      // primer frame visible; la actual permanece completa debajo. Así nunca se
      // muestra el destino de golpe ni aparece un lienzo blanco.
      standbyCanvas.style.zIndex = '3';
      activeCanvas.style.zIndex = '2';
      standbyCanvas.style.transform = enterFrom;
      activeCanvas.style.transform = 'translate3d(0, 0, 0)';
      await waitForPaint();

      if (typeof standbyCanvas.animate !== 'function' || typeof activeCanvas.animate !== 'function') {
        standbyCanvas.style.removeProperty('transform');
        activeCanvas.style.removeProperty('transform');
        await animateWithCssFallback(movingForward);
        return;
      }

      const entering = standbyCanvas.animate([
        { transform: enterFrom, opacity: 1 },
        { transform: 'translate3d(0, 0, 0)', opacity: 1 }
      ], timing);
      const leaving = activeCanvas.animate([
        { transform: 'translate3d(0, 0, 0)', opacity: 1 },
        { transform: leaveTo, opacity: 1 }
      ], timing);

      await Promise.all([
        entering.finished.catch(() => undefined),
        leaving.finished.catch(() => undefined)
      ]);
    };

    const replacePageWithoutFlash = async (targetSize, { clearPinchPreview = false } = {}) => {
      // El canvas actual permanece visible hasta que el nuevo esté renderizado.
      // El intercambio, el nuevo tamaño y el fin del preview de pellizco ocurren
      // dentro del mismo frame, por lo que nunca se limpia el lienzo en pantalla.
      await new Promise((resolve) => {
        requestAnimationFrame(() => {
          completeCanvasSwap(targetSize, { clearPinchPreview });
          resolve();
        });
      });
    };

    const renderPage = async (number, direction = 'none', options = {}) => {
      if (rendering) {
        pendingRender = { number, direction, options };
        return;
      }
      rendering = true;
      updateControls();
      const targetZoom = clampZoom(options.zoom ?? zoom);
      try {
        if (!hasRenderedPage) {
          const targetSize = await paintPage(number, activeCanvas, targetZoom);
          applyShellSize(targetSize);
          exposeCanvas(activeCanvas, true);
          hideCanvas(standbyCanvas);
          hasRenderedPage = true;
        } else {
          hideCanvas(standbyCanvas);
          standbyCanvas.className = 'em-pdf-page-canvas';
          const targetSize = await paintPage(number, standbyCanvas, targetZoom);
          if (direction === 'next' || direction === 'prev') {
            await animatePageSlide(direction, targetSize);
            completeCanvasSwap(targetSize);
          } else {
            await replacePageWithoutFlash(targetSize, {
              clearPinchPreview: Boolean(options.clearPinchPreview)
            });
          }
        }

        pageNumber = number;
        zoom = targetZoom;
        if (!viewerReady) {
          viewerReady = true;
          setLoadingProgress(100);
          await waitForPaint();
          notebook?.classList.remove('is-preparing');
          notebook?.classList.add('is-ready');
          loading.classList.add('is-complete');
          window.setTimeout(() => {
            if (!document.body.contains(loading)) return;
            loading.hidden = true;
            loading.style.setProperty('display', 'none', 'important');
          }, 420);
        }
        if (zoom <= 1.01) {
          viewportHost.scrollLeft = 0;
          viewportHost.scrollTop = 0;
        }
      } finally {
        rendering = false;
        updateControls();
        if (pendingRender) {
          const queued = pendingRender;
          pendingRender = null;
          renderPage(queued.number, queued.direction, queued.options).catch(showPdfViewerError);
        }
      }
    };

    const go = (delta) => {
      if (rendering) return;
      const target = Math.max(1, Math.min(pdfDocument.numPages, pageNumber + delta));
      if (target === pageNumber) return;
      renderPage(target, delta > 0 ? 'next' : 'prev').catch(showPdfViewerError);
    };

    const clearPinchPreview = () => {
      shell.classList.remove('is-pinching');
      shell.style.removeProperty('--em-pdf-pinch-scale');
      pinchStartDistance = 0;
      pinchPreviewZoom = zoom;
    };

    const setZoom = (nextZoom, options = {}) => {
      if (rendering) return;
      const target = clampZoom(nextZoom);
      const fromPinch = Boolean(options.fromPinch);
      if (Math.abs(target - zoom) < .01) {
        if (fromPinch) clearPinchPreview();
        return;
      }
      const previousZoom = zoom;
      const centerX = viewportHost.scrollLeft + viewportHost.clientWidth / 2;
      const centerY = viewportHost.scrollTop + viewportHost.clientHeight / 2;
      const ratio = target / previousZoom;
      renderPage(pageNumber, 'none', {
        zoom: target,
        clearPinchPreview: fromPinch
      }).then(() => {
        viewportHost.scrollLeft = Math.max(0, centerX * ratio - viewportHost.clientWidth / 2);
        viewportHost.scrollTop = Math.max(0, centerY * ratio - viewportHost.clientHeight / 2);
      }).catch((error) => {
        if (fromPinch) clearPinchPreview();
        showPdfViewerError(error);
      });
    };

    prev.addEventListener('click', () => go(-1), { signal: viewerSignal });
    next.addEventListener('click', () => go(1), { signal: viewerSignal });
    zoomOut?.addEventListener('click', () => setZoom(zoom - .25), { signal: viewerSignal });
    zoomFit?.addEventListener('click', () => setZoom(1), { signal: viewerSignal });
    zoomIn?.addEventListener('click', () => setZoom(zoom + .25), { signal: viewerSignal });

    viewportHost.addEventListener('pointerdown', (event) => {
      if (rendering) return;
      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      viewportHost.setPointerCapture?.(event.pointerId);
      if (activePointers.size === 1) {
        touchStartX = event.clientX;
        touchStartY = event.clientY;
        dragStartScrollLeft = viewportHost.scrollLeft;
        dragStartScrollTop = viewportHost.scrollTop;
        dragged = false;
      } else if (activePointers.size === 2) {
        const points = [...activePointers.values()];
        pinchStartDistance = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
        pinchStartZoom = zoom;
        pinchPreviewZoom = zoom;
      }
    }, { signal: viewerSignal });

    viewportHost.addEventListener('pointermove', (event) => {
      if (!activePointers.has(event.pointerId) || rendering) return;
      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (activePointers.size === 2 && pinchStartDistance > 0) {
        event.preventDefault();
        const points = [...activePointers.values()];
        const distance = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
        pinchPreviewZoom = clampZoom(pinchStartZoom * (distance / pinchStartDistance));
        const ratio = pinchPreviewZoom / zoom;
        shell.style.setProperty('--em-pdf-pinch-scale', String(ratio));
        shell.classList.add('is-pinching');
        return;
      }
      if (activePointers.size === 1 && zoom > 1.01) {
        const dx = event.clientX - touchStartX;
        const dy = event.clientY - touchStartY;
        if (Math.abs(dx) + Math.abs(dy) > 4) dragged = true;
        viewportHost.scrollLeft = dragStartScrollLeft - dx;
        viewportHost.scrollTop = dragStartScrollTop - dy;
      }
    }, { signal: viewerSignal });

    const endPointer = (event) => {
      const point = activePointers.get(event.pointerId);
      activePointers.delete(event.pointerId);
      if (shell.classList.contains('is-pinching') && activePointers.size < 2) {
        const target = pinchPreviewZoom;
        pinchStartDistance = 0;
        // Conserva el bitmap escalado mientras se genera el canvas nítido.
        // El preview solo se retira en el mismo frame del intercambio final.
        setZoom(target, { fromPinch: true });
        return;
      }
      if (activePointers.size === 0 && zoom <= 1.01 && point && !dragged && !rendering) {
        const dx = point.x - touchStartX;
        const dy = point.y - touchStartY;
        if (Math.abs(dx) > 46 && Math.abs(dx) > Math.abs(dy) * 1.2) go(dx < 0 ? 1 : -1);
      }
    };
    viewportHost.addEventListener('pointerup', endPointer, { signal: viewerSignal });
    viewportHost.addEventListener('pointercancel', endPointer, { signal: viewerSignal });

    viewportHost.addEventListener('wheel', (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setZoom(zoom + (event.deltaY < 0 ? .15 : -.15));
    }, { passive: false, signal: viewerSignal });

    window.addEventListener('keydown', (event) => {
      if (!document.getElementById('pdfNotebook')) return;
      if (event.key === 'ArrowLeft') go(-1);
      if (event.key === 'ArrowRight') go(1);
      if (event.key === '+' || event.key === '=') setZoom(zoom + .25);
      if (event.key === '-') setZoom(zoom - .25);
      if (event.key === '0') setZoom(1);
    }, { signal: viewerSignal });

    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => renderPage(pageNumber, 'none', { zoom }).catch(showPdfViewerError), 160);
    }, { signal: viewerSignal });

    updateControls();
    await renderPage(1, 'none', { zoom: 1 });
  }

  function renderStudentPlaceholder(options = {}) {
    commitAppRoute({ screen: 'student' }, options);
    const student = state.user || {};
    mount(`<main class="screen mobile-pad"><h1>Hola, ${escapeHTML(student.fullName || 'estudiante')}</h1><p>Tu cuenta ya está autenticada con Supabase. La siguiente fase habilitará aquí clases, quizzes, asistencia y resultados de tus asignaturas.</p><p class="card-sub">Usuario: ${escapeHTML(student.email || student.username || student.id || '')}</p><button class="primary-btn" id="logoutBtn">Cerrar sesión</button></main>`, () => {
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

        <button class="em-rs-trash-btn" type="button" data-delete-student="${escapeAttr(id)}" aria-label="Pasar estudiante a inactivo" title="Pasar estudiante a inactivo">🗑️</button>

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
    const thumb = item.thumbnailUrl || '';
    return `
      <article class="em-class-card em-notebook-card" data-class-id="${escapeAttr(item.id)}" role="button" tabindex="0" aria-label="Abrir ${escapeAttr(item.title || 'clase')}">
        <button class="em-class-delete-btn" type="button" data-delete-class-id="${escapeAttr(item.id)}" aria-label="Eliminar ${escapeAttr(item.title || 'clase')}" title="Eliminar clase">🗑</button>
        <div class="em-class-cover ${thumb ? 'has-thumb' : ''}">
          <span class="em-notebook-binding" aria-hidden="true"></span>
          ${thumb ? `<img src="${escapeAttr(thumb)}" alt="" loading="lazy" />` : `<div class="em-class-cover-fallback">${emContentShapePairHTML('em-content-shape', index)}<span>PDF</span></div>`}
          <span class="em-notebook-page-edge" aria-hidden="true"></span>
        </div>
        <div class="em-class-body">
          <div>
            <h3 class="em-class-title">${escapeHTML(item.title || 'Clase sin título')}</h3>
            <p class="em-class-meta">Periodo ${Number(item.period || 1)} · ${Number(item.pageCount || 1)} pág.</p>
          </div>
          <span class="em-class-open-mark" aria-hidden="true">›</span>
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
    const palette = ['#e21b3c', '#1368ce', '#54c600', '#EBB513', '#ff7a00', '#24b49a'];
    const colorFor = (index) => palette[(index + Math.floor(Math.random() * palette.length)) % palette.length];
    const loginShapeBlueprints = [
      ['circle', '--w:52px;--h:52px;left:6%;top:9%;--o:.92;--dx:34px;--dy:42px;--r1:120deg;--dur:7.6s;--delay:-1.2s'],
      ['triangle', '--w:58px;--h:54px;left:78%;top:5%;--o:.90;--dx:-28px;--dy:54px;--r1:-150deg;--dur:8.1s;--delay:-2.1s'],
      ['square', '--w:40px;--h:40px;left:87%;top:17%;--o:.86;--dx:-36px;--dy:28px;--r1:210deg;--dur:8.4s;--delay:-3.3s'],
      ['x', '--w:34px;--h:34px;left:77%;top:24%;--o:.84;--dx:22px;--dy:-38px;--r1:-70deg;--dur:7.2s;--delay:-5.7s'],
      ['square', '--w:56px;--h:56px;left:11%;top:23%;--o:.82;--dx:-42px;--dy:-36px;--r1:38deg;--dur:9.6s;--delay:-6.2s'],
      ['circle', '--w:30px;--h:30px;left:7%;top:79%;--o:.86;--dx:50px;--dy:-46px;--r1:120deg;--dur:8.7s;--delay:-4.4s'],
      ['triangle', '--w:42px;--h:40px;left:20%;top:90%;--o:.90;--dx:42px;--dy:-56px;--r1:240deg;--dur:8.8s;--delay:-6s'],
      ['square', '--w:28px;--h:28px;left:83%;top:88%;--o:.90;--dx:-58px;--dy:-54px;--r1:190deg;--dur:7.3s;--delay:-2.8s'],
      ['x', '--w:46px;--h:46px;left:66%;top:80%;--o:.82;--dx:-38px;--dy:60px;--r1:-130deg;--dur:10.2s;--delay:-6.8s'],
      ['circle', '--w:20px;--h:20px;left:14%;top:70%;--o:.88;--dx:30px;--dy:52px;--r1:90deg;--dur:6.4s;--delay:-1.8s'],
      ['triangle', '--w:34px;--h:32px;left:88%;top:70%;--o:.86;--dx:-46px;--dy:62px;--r1:190deg;--dur:7.6s;--delay:-3.7s'],
      ['x', '--w:40px;--h:40px;left:72%;top:94%;--o:.82;--dx:-72px;--dy:-68px;--r1:-210deg;--dur:10.8s;--delay:-5.1s']
    ];
    const loadingShapes = [
      ['circle', '--w:54px;--h:54px;left:5%;top:7%;--c:#1976D2;--o:.78;--dx:42px;--dy:98px;--r1:120deg;--dur:7.4s;--delay:-1.2s'],
      ['triangle', '--w:58px;--h:54px;left:78%;top:5%;--c:#FBC02D;--o:.82;--dx:-34px;--dy:110px;--r1:-150deg;--dur:8.2s;--delay:-2.2s']
    ];
    const shapes = mode === 'login'
      ? loginShapeBlueprints.map(([className, style], index) => [className, `${style};--c:${colorFor(index)}`])
      : loadingShapes;
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
    if (isCloudReady()) {
      return state.data.students
        .filter((student) => student.active !== false && (assignment.groupId ? student.groupId === assignment.groupId : (student.grade === assignment.grade && student.course === assignment.course && student.sede === assignment.sede)))
        .sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));
    }
    const removed = new Set(readJSON(`encisomath:removedStudents:${assignment.id}`) || []);
    const base = state.data.students.filter((student) => {
      return student.grade === assignment.grade && student.course === assignment.course && student.sede === assignment.sede && !removed.has(student.id);
    });
    const added = (readJSON(`encisomath:addedStudents:${assignment.id}`) || []).filter((student) => !removed.has(student.id));
    return [...base, ...added].sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));
  }
  function getAttendance(assignmentId, date) {
    if (isCloudReady()) return { ...(state.cloud.attendance[cloudAttendanceKey(assignmentId, date)] || {}) };
    return readJSON(`encisomath:attendance:${assignmentId}:${date}`) || {};
  }
  function saveAttendance(assignmentId, date, attendance) {
    if (!isCloudReady()) {
      localStorage.setItem(`encisomath:attendance:${assignmentId}:${date}`, JSON.stringify(attendance));
      return;
    }
    const key = cloudAttendanceKey(assignmentId, date);
    const previous = { ...(state.cloud.attendance[key] || {}) };
    const next = { ...(attendance || {}) };
    state.cloud.attendance[key] = next;
    const changedIds = new Set([...Object.keys(previous), ...Object.keys(next)]);
    changedIds.forEach((studentCode) => {
      if ((previous[studentCode] || '') === (next[studentCode] || '')) return;
      cloudAPI().saveAttendanceStatus({
        assignmentId,
        studentCode,
        attendanceDate: date,
        status: next[studentCode] || ''
      }).catch((error) => {
        state.cloud.attendance[key] = previous;
        reportCloudError('No se guardó la asistencia en Supabase', error);
        if (state.assignment?.id === assignmentId && state.attendanceDate === date) refreshStudentList();
      });
    });
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
    if (isCloudReady()) return [];
    return normalizeRockstarEvents(readJSON(`encisomath:rockstars:${assignmentId}`) || []);
  }
  function saveLocalRockstarEvents(assignmentId, events) {
    if (isCloudReady()) return;
    localStorage.setItem(`encisomath:rockstars:${assignmentId}`, JSON.stringify(normalizeRockstarEvents(events)));
  }
  function getRockstarEvents(assignmentId) {
    if (isCloudReady()) return getBaseRockstarEvents().filter((entry) => entry.assignmentId === assignmentId);
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
    if (isCloudReady()) return assignment.icon || './assets/subject-statistics.svg';
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
    if (isCloudReady()) return assignment.cover || '';
    return localStorage.getItem(`encisomath:assignmentCover:${assignment.id}`) || localStorage.getItem(`encisomath:cover:${assignment.id}`) || '';
  }
  function coverBackgroundStyle(assignment) {
    const cover = getAssignmentCover(assignment);
    if (!cover) return '';
    return `style="--cover-image: url('${escapeAttr(cover)}');"`;
  }
  async function saveImageOverride(event, type) {
    const file = event.target.files?.[0];
    if (!file || !state.assignment) return;
    if (file.size > 900000) {
      toast('La imagen pesa mucho. Prueba una imagen menor a 900 KB.');
      return;
    }
    if (!isCloudReady()) {
      toast('Necesitas una sesión de Supabase para guardar imágenes.');
      return;
    }
    try {
      const url = await cloudAPI().uploadAssignmentImage({ assignmentId: state.assignment.id, type, file });
      const assignment = state.data.assignments.find((item) => item.id === state.assignment.id);
      if (type === 'cover') {
        state.assignment.cover = url;
        if (assignment) assignment.cover = url;
      } else {
        state.assignment.icon = url;
        if (assignment) assignment.icon = url;
      }
      toast(type === 'cover' ? 'Portada guardada en Supabase.' : 'Icono guardado en Supabase.');
      closeModal();
      renderSubjectDetail('students');
    } catch (error) {
      reportCloudError('No se pudo guardar la imagen', error);
    }
  }
  async function resetAssignmentVisual(type) {
    if (!state.assignment) return;
    if (!isCloudReady()) {
      toast('Necesitas una sesión de Supabase para restablecer imágenes.');
      return;
    }
    try {
      await cloudAPI().resetAssignmentImage({ assignmentId: state.assignment.id, type });
      const assignment = state.data.assignments.find((item) => item.id === state.assignment.id);
      if (type === 'cover') {
        state.assignment.cover = '';
        if (assignment) assignment.cover = '';
        toast('Portada restablecida en Supabase.');
      } else {
        state.assignment.icon = './assets/subject-statistics.svg';
        if (assignment) assignment.icon = './assets/subject-statistics.svg';
        toast('Icono restablecido en Supabase.');
      }
      closeModal();
      renderSubjectDetail('students');
    } catch (error) {
      reportCloudError('No se pudo restablecer la imagen', error);
    }
  }
  function setClassViewMode(mode) {
    if (!['grid', 'list'].includes(mode) || state.classViewMode === mode) return;
    state.classViewMode = mode;
    localStorage.setItem('encisomath:classViewMode', mode);
    document.getElementById('gridModeBtn')?.classList.toggle('selected', mode === 'grid');
    document.getElementById('listModeBtn')?.classList.toggle('selected', mode === 'list');
    const content = document.getElementById('classGrid');
    if (content) {
      content.classList.toggle('is-grid', mode === 'grid');
      content.classList.toggle('is-list', mode === 'list');
      pulseElement(content, 'class-grid-update');
    }
  }
  function setActivityViewMode(mode) {
    if (!['grid', 'list'].includes(mode) || state.activityViewMode === mode) return;
    state.activityViewMode = mode;
    localStorage.setItem('encisomath:activityViewMode', mode);
    document.getElementById('activityGridModeBtn')?.classList.toggle('selected', mode === 'grid');
    document.getElementById('activityListModeBtn')?.classList.toggle('selected', mode === 'list');
    const content = document.getElementById('activitiesPeriodContent');
    if (content) {
      content.classList.toggle('is-grid', mode === 'grid');
      content.classList.toggle('is-list', mode === 'list');
      pulseElement(content, 'class-grid-update');
    }
  }
  function setQuizViewMode(mode) {
    if (!['grid', 'list'].includes(mode) || state.quizViewMode === mode) return;
    state.quizViewMode = mode;
    localStorage.setItem('encisomath:quizViewMode', mode);
    document.getElementById('quizGridModeBtn')?.classList.toggle('selected', mode === 'grid');
    document.getElementById('quizListModeBtn')?.classList.toggle('selected', mode === 'list');
    const content = document.getElementById('quizLibrary');
    if (content) {
      content.classList.toggle('is-grid', mode === 'grid');
      content.classList.toggle('is-list', mode === 'list');
      pulseElement(content, 'class-grid-update');
    }
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
  async function logout() {
    try {
      if (cloudAPI()) await cloudAPI().signOut();
    } catch (error) {
      console.warn('No se pudo cerrar la sesión remota.', error);
    }
    localStorage.removeItem('encisomath:session');
    localStorage.removeItem(CLOUD_SESSION_MODE_KEY);
    sessionStorage.removeItem(CLOUD_SESSION_TAB_KEY);
    state.user = null;
    state.assignment = null;
    state.cloud.enabled = false;
    state.cloud.attendance = {};
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
        icon: './assets/app-icon-192.png',
        badge: './assets/notification-icon-96.png',
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
    root.dataset.heroAnimations = 'on';
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
    savePreferencesToCloud();
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
    const appRoot = document.getElementById('app');
    if (appRoot) {
      appRoot.inert = true;
      appRoot.setAttribute('aria-hidden', 'true');
    }
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
      const appRoot = document.getElementById('app');
      if (appRoot) {
        appRoot.inert = false;
        appRoot.removeAttribute('aria-hidden');
      }
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
  const EM_TAB_ENTRANCE_SELECTORS = {
    classes: [
      '[data-em-classes-hero]',
      '.em-class-view-only',
      '.em-class-view-only .mini-btn',
      '#openAddClassBtn',
      '#classGrid > *',
      '#classGrid button',
      '#classGrid [role="button"]',
      '#classGrid > .em-period-empty',
      '#classGrid > .em-period-empty > *'
    ],
    activities: [
      '[data-em-activities-hero]',
      '.em-content-toolbar',
      '#activityGridModeBtn',
      '#activityListModeBtn',
      '#activitiesPeriodContent > *',
      '#activitiesPeriodContent article',
      '#activitiesPeriodContent button',
      '#activitiesPeriodContent [role="button"]',
      '#activitiesPeriodContent > .em-period-empty > *'
    ],
    notes: [
      '[data-em-notes-hero]',
      '.em-notes-grade-card',
      '.em-notes-hero-content > *',
      '.em-notes-toolbar > *',
      '.em-notes-weight-summary > *',
      '.em-notes-sheet-shell',
      '.em-notes-sheet thead th',
      '.em-notes-sheet tbody tr'
    ],
    rockstars: [
      '[data-em-rockstars-hero]',
      '#rockstarList > *',
      '#rockstarList > .empty',
      '#rockstarList .em-rs-avatar',
      '#rockstarList .em-rs-info',
      '#rockstarList .em-rs-points',
      '#rockstarList .em-rs-score-btn'
    ],
    quizzes: [
      '[data-em-quizzes-hero]',
      '.em-quiz-toolbar',
      '#quizGridModeBtn',
      '#quizListModeBtn',
      '#openQuizStudioBtn',
      '#quizLibrary > *',
      '#quizLibrary > [data-quiz-id]',
      '#quizLibrary > .em-period-empty',
      '#quizLibrary > .em-period-empty > *',
      '#quizLibrary .em-quiz-edit',
      '#quizLibrary .em-quiz-start'
    ]
  };

  function emUniqueVisibleElements(root, selectors = []) {
    const seen = new Set();
    const elements = [];
    selectors.forEach((selector) => {
      root.querySelectorAll?.(selector).forEach((element) => {
        if (!element || seen.has(element)) return;
        seen.add(element);
        const style = window.getComputedStyle?.(element);
        if (style && (style.display === 'none' || style.visibility === 'hidden')) return;
        elements.push(element);
      });
    });
    return elements;
  }

  function emPlayEntranceSequence(root, selectors = [], options = {}) {
    if (!root) return;
    const elements = emUniqueVisibleElements(root, selectors);
    const duration = Number(options.duration) || 500;
    const stagger = Number(options.stagger) || 34;
    const maxDelay = Number(options.maxDelay) || 420;
    const baseDelay = Number(options.baseDelay) || 0;
    const distance = Number(options.distance) || 18;
    const scale = Number(options.scale) || 0.965;

    elements.forEach((element, index) => {
      element.getAnimations?.().forEach((animation) => {
        if (String(animation.id || '').startsWith('enciso-entry-')) animation.cancel();
      });
      if (typeof element.animate !== 'function') {
        element.classList.remove('em-entry-fallback');
        void element.offsetWidth;
        element.classList.add('em-entry-fallback');
        return;
      }
      const animation = element.animate([
        { opacity: 0, transform: `translate3d(0, ${distance}px, 0) scale(${scale})`, filter: 'blur(7px)' },
        { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)', filter: 'blur(0px)' }
      ], {
        duration,
        delay: baseDelay + Math.min(index * stagger, maxDelay),
        easing: 'cubic-bezier(.16, 1, .3, 1)',
        fill: 'backwards'
      });
      try { animation.id = `enciso-entry-${Date.now()}-${index}`; } catch (_) {}
    });
  }

  function emPlayTabEntrance(root, tab) {
    emPlayEntranceSequence(root, EM_TAB_ENTRANCE_SELECTORS[tab] || [], {
      duration: 520,
      stagger: 36,
      maxDelay: 430,
      distance: 18,
      scale: 0.965
    });
  }

  function emPlayQuizStudioEntrance(root) {
    emPlayEntranceSequence(root, [
      '.em-quiz-studio-topbar > *',
      '.em-quiz-studio-hero',
      '.em-quiz-studio-hero-copy > *',
      '.em-quiz-studio-tabs',
      '.em-quiz-studio-tabs > *',
      '.em-quiz-studio-card',
      '.em-quiz-studio-card-head > *',
      '.em-quiz-studio-card-body > *',
      '.em-quiz-studio-field',
      '.em-quiz-studio-field input',
      '.em-quiz-studio-field select',
      '.em-quiz-studio-field textarea',
      '.em-quiz-studio-question-tab',
      '.em-quiz-studio-option-row',
      '.em-quiz-studio-footer > *',
      '.em-quiz-studio-actions > *',
      '.em-quiz-studio-empty'
    ], {
      duration: 470,
      stagger: 24,
      maxDelay: 360,
      distance: 15,
      scale: 0.975
    });
  }

  function emPlayLessonEntrance(root) {
    emPlayEntranceSequence(root, [
      '.lesson-topbar > *',
      '.lesson-head',
      '.lesson-head > *',
      '.lesson-frame'
    ], {
      duration: 520,
      stagger: 52,
      maxDelay: 260,
      distance: 18,
      scale: 0.975
    });
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
        const registration = await navigator.serviceWorker.register('./sw.js?v=0.25.005', { updateViaCache: 'none' });
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
