(() => {
  'use strict';

  const APP_VERSION = '0.24.84';
  const QUIZ_SECURITY_ENABLED = false; // v0.24.84: modo seguro de Quizzes desactivado temporalmente
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
    background: '#000000'
  };

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

  const QUIZ_FEEDBACK_TUNE_KEY = 'encisomath:quizFeedbackTune';
  const QUIZ_FEEDBACK_TUNE_DEFAULTS = {
    curve: 12,
    spread: 18,
    height: 122,
    lift: 0,
    bounce: 22,
    bandX: 0,
    bandY: 13,
    bandZoom: 110,
    emojiX: 25,
    emojiY: -11,
    emojiZoom: 132,
    titleX: 30,
    titleY: 0,
    titleZoom: 138,
    textX: 30,
    textY: -18,
    textZoom: 83
  };
  const QUIZ_FEEDBACK_AFTER_PAINT_DELAY_MS = 420;
  const QUIZ_FEEDBACK_AFTER_CHOICE_REVEAL_MS = 460;
  const QUIZ_FEEDBACK_AFTER_SLIDER_REVEAL_MS = 360;
  const QUIZ_FEEDBACK_NEUTRAL_DELAY_MS = 220;
  const QUIZ_FEEDBACK_TUNE_FIELDS = [
    { key: 'curve', group: 'Banda', label: 'Curva superior', min: 0, max: 70, step: 1, unit: 'px' },
    { key: 'spread', group: 'Banda', label: 'Ancho de curva', min: 0, max: 22, step: 1, unit: 'vw' },
    { key: 'height', group: 'Banda', label: 'Alto de banda', min: 72, max: 180, step: 1, unit: 'px' },
    { key: 'lift', group: 'Banda', label: 'Subir contenido (desactivado)', min: 0, max: 0, step: 1, unit: 'px' },
    { key: 'bounce', group: 'Banda', label: 'Rebote entrada', min: 0, max: 28, step: 1, unit: 'px' },
    { key: 'bandX', group: 'Banda', label: 'Mover banda X', min: -80, max: 80, step: 1, unit: 'px' },
    { key: 'bandY', group: 'Banda', label: 'Mover banda Y', min: -60, max: 60, step: 1, unit: 'px' },
    { key: 'bandZoom', group: 'Banda', label: 'Zoom banda', min: 70, max: 130, step: 1, unit: '%' },
    { key: 'emojiX', group: 'Emoji', label: 'Mover emoji X', min: -90, max: 90, step: 1, unit: 'px' },
    { key: 'emojiY', group: 'Emoji', label: 'Mover emoji Y', min: -56, max: 56, step: 1, unit: 'px' },
    { key: 'emojiZoom', group: 'Emoji', label: 'Zoom emoji', min: 50, max: 160, step: 1, unit: '%' },
    { key: 'titleX', group: 'Titulo', label: 'Mover titulo X', min: -90, max: 90, step: 1, unit: 'px' },
    { key: 'titleY', group: 'Titulo', label: 'Mover titulo Y', min: -56, max: 56, step: 1, unit: 'px' },
    { key: 'titleZoom', group: 'Titulo', label: 'Zoom titulo', min: 70, max: 150, step: 1, unit: '%' },
    { key: 'textX', group: 'Frase', label: 'Mover frase X', min: -90, max: 90, step: 1, unit: 'px' },
    { key: 'textY', group: 'Frase', label: 'Mover frase Y', min: -56, max: 56, step: 1, unit: 'px' },
    { key: 'textZoom', group: 'Frase', label: 'Zoom frase', min: 70, max: 150, step: 1, unit: '%' }
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
    prefs: { ...DEFAULT_PREFS, ...(readJSON('encisomath:prefs') || {}) }
  };

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
    const paint = () => {
      $app.innerHTML = markup;
      $app.classList.remove('is-leaving');
      $app.classList.add('is-entering');
      if (typeof afterRender === 'function') afterRender();
      window.setTimeout(() => $app.classList.remove('is-entering'), 620);
      firstPaint = false;
    };

    window.clearTimeout(transitionTimer);
    if (firstPaint || options.instant || options.noTransition) {
      paint();
      return;
    }

    $app.classList.add('is-leaving');
    transitionTimer = window.setTimeout(paint, 285);
  }

  function renderLogin() {
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

  function renderTeacherHome() {
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

  function renderSubjectDetail(tab = 'students') {
    const assignment = state.assignment;
    if (!assignment) return renderTeacherHome();
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

  function setSubjectTab(tab) {
    document.getElementById('studentsTab')?.classList.toggle('active', tab === 'students');
    document.getElementById('classesTab')?.classList.toggle('active', tab === 'classes');
    document.getElementById('rockstarsTab')?.classList.toggle('active', tab === 'rockstars');
    document.getElementById('quizzesTab')?.classList.toggle('active', tab === 'quizzes');
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
        <div class="rockstar-title-block">
          <div class="rockstar-title-neon" data-text="ROCKSTARS">ROCKSTARS</div>
          <p>Participación · Periodo ${state.rockstarPeriod} · ${escapeHTML(assignment.subject)} ${escapeHTML(assignment.grade)}-${escapeHTML(assignment.course)}</p>
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
    const students = getStudentsForAssignment(assignment).filter((student) => {
      if (!query) return true;
      return normalizeSearch(`${student.fullName} ${student.id} ${student.username || ''}`).includes(query);
    });
    return students.map((student) => {
      const points = getRockstarPoints(assignment.id, student.id, state.rockstarPeriod);
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
    const titleBlock = document.querySelector('.rockstar-title-block p');
    if (titleBlock && state.assignment) {
      titleBlock.textContent = `Participación · Periodo ${state.rockstarPeriod} · ${state.assignment.subject} ${state.assignment.grade}-${state.assignment.course}`;
      pulseElement(titleBlock, 'text-pop');
    }
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
        <div class="quiz-title-block">
          <div class="quiz-title-neon" data-text="QUIZZES">QUIZZES</div>
          <p>Retos interactivos · Periodo ${state.quizPeriod} · ${escapeHTML(assignment.subject)} ${escapeHTML(assignment.grade)}-${escapeHTML(assignment.course)}</p>
        </div>
      </section>
      <div class="period-tabs quiz-period-tabs" id="quizPeriodTabs">
        ${[1, 2, 3, 4].map((period) => `<button class="period-btn ${Number(state.quizPeriod) === period ? 'active' : ''}" data-quiz-period="${period}">${period}°</button>`).join('')}
      </div>
      <div class="quiz-library" id="quizLibrary">
        ${quizzes.map((quiz) => quizCardButtonHTML(quiz, activeQuiz?.id === quiz.id)).join('') || `<div class="empty">Aún no hay quizzes para este periodo.</div>`}
      </div>
      ${activeQuiz ? `<div class="quiz-launch-note">Toca un quiz para ver el aviso de inicio.</div>` : ''}
    `;
    bindQuizTabEvents();
    if (options.animate) pulseElement($content, 'tab-enter');
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

  function getActiveQuiz(quizzes = getQuizzesForCurrentAssignment()) {
    if (!quizzes.length) return null;
    const active = quizzes.find((quiz) => quiz.id === state.quizActiveId) || quizzes[0];
    state.quizActiveId = active.id;
    localStorage.setItem('encisomath:quizActiveId', active.id);
    if (!Array.isArray(active.questions)) active.questions = [];
    if (state.quizQuestionIndex < 0 || state.quizQuestionIndex >= active.questions.length) state.quizQuestionIndex = 0;
    return active;
  }

  function quizCardButtonHTML(quiz, active) {
    const total = Array.isArray(quiz.questions) ? quiz.questions.length : 0;
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
    const calibratable = ['multiple_choice', 'true_false', 'open', 'slider'].includes(question.type);
    return `
      <section class="quiz-stage quiz-type-${escapeAttr(question.type || 'question')} ${fullscreen ? 'quiz-stage-fullscreen' : ''} ${calibratable ? 'quiz-calibration-mode' : ''}" data-quiz-stage="${escapeAttr(quiz.id)}" data-quiz-question-index="${index}" data-quiz-has-image="${question.image ? 'true' : 'false'}">
        <div class="quiz-stage-head">
          <div class="quiz-stage-meta-row">
            <div class="quiz-eyebrow">Pregunta ${index + 1} de ${questions.length} · ${escapeHTML(quizTypeLabel(question.type))}</div>
            <span class="quiz-timer-pill">Item ${index + 1}</span>
            ${calibratable ? '<button class="quiz-tune-gear" type="button" data-quiz-layout-tune-open aria-label="Abrir ajustes de layout" title="Ajustar layout">⚙️</button>' : ''}
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
        ${calibratable ? quizLayoutTunePanelHTML(question.type, questions.length, index, Boolean(question.image)) : ''}
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

  const QUIZ_LAYOUT_TUNE_FIELDS = [
    { key: 'image_y', label: 'Imagen Y', min: -80, max: 160, step: 1, unit: 'px' },
    { key: 'image_h', label: 'Imagen alto', min: 70, max: 220, step: 1, unit: 'px' },
    { key: 'textA_y', label: 'Texto Y', min: -80, max: 180, step: 1, unit: 'px' },
    { key: 'textA_h', label: 'Texto alto', min: 70, max: 320, step: 1, unit: 'px' },
    { key: 'answers_y', label: 'Opciones Y', min: -80, max: 180, step: 1, unit: 'px' },
    { key: 'answers_h', label: 'Opciones alto', min: 70, max: 280, step: 1, unit: 'px' }
  ];

  const QUIZ_LAYOUT_TUNE_DEFAULTS = {
    textA_y: 0, textA_h: 120, text_font: 20,
    image_y: 0, image_h: 210,
    answers_y: 0, answers_h: 200
  };

  const QUIZ_LAYOUT_TUNE_TYPE_DEFAULTS = {
    multiple_choice: { textA_y: 0, textA_h: 135, text_font: 20, image_y: 0, image_h: 126, answers_y: 0, answers_h: 146 },
    true_false: { textA_y: 0, textA_h: 145, text_font: 20, image_y: 0, image_h: 126, answers_y: 0, answers_h: 104 },
    open: { textA_y: 0, textA_h: 150, text_font: 20, image_y: 0, image_h: 126, answers_y: 0, answers_h: 142 },
    slider: { textA_y: 0, textA_h: 140, text_font: 20, image_y: 0, image_h: 118, answers_y: 0, answers_h: 198 }
  };

  const QUIZ_LAYOUT_TUNE_STORAGE_VERSION = 'v0.24.84';
  const QUIZ_CASCADE_TUNE_STORAGE_VERSION = 'v0.24.84';
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
    if (type === 'slider') {
      return { textA_y: 35, image_y: 35, textB_y: 35, answers_y: 85 };
    }
    if (type === 'open') {
      return { textA_y: 35, image_y: 35, textB_y: 35, answers_y: 90 };
    }
    if (type === 'true_false') {
      return { textA_y: 25, image_y: 25, textB_y: 25, answers_y: 80 };
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
    return type || 'default';
  }

  let quizCascadeReplayTimer = null;

  function getQuizLayoutTuneDefaults(type = 'default') {
    return { ...QUIZ_LAYOUT_TUNE_DEFAULTS, ...(QUIZ_LAYOUT_TUNE_TYPE_DEFAULTS[type] || {}) };
  }

  function quizLayoutTuneKey(type = 'default') {
    return `encisomath:quizLayoutTune:${QUIZ_LAYOUT_TUNE_STORAGE_VERSION}:${type || 'default'}`;
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
    const normalized = { ...defaults, text_font: 20 };
    QUIZ_LAYOUT_TUNE_FIELDS.forEach((field) => {
      const raw = Number(tune[field.key]);
      normalized[field.key] = Number.isFinite(raw) ? Math.max(field.min, Math.min(field.max, raw)) : defaults[field.key];
    });
    normalized.text_font = 20;
    return normalized;
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

  function quizLayoutTunePanelHTML(type = 'default', totalQuestions = 0, currentIndex = 0, hasImage = false) {
    if (!['multiple_choice', 'true_false', 'open', 'slider'].includes(type)) return '';
    const cascadeTune = getQuizCascadeTune(type, hasImage);
    const layoutTune = getQuizLayoutTune(type);
    const layoutFields = QUIZ_LAYOUT_TUNE_FIELDS.filter((field) => hasImage || !field.key.startsWith('image_'));
    return `
      <section class="quiz-layout-tune-panel quiz-cascade-tune-panel" data-quiz-layout-tune-panel data-quiz-layout-type="${escapeAttr(type)}" data-quiz-has-image="${hasImage ? 'true' : 'false'}" hidden aria-hidden="true">
        <div class="quiz-layout-tune-dialog" role="dialog" aria-modal="true" aria-label="Ajustes temporales del quiz">
          <div class="quiz-layout-tune-dialog-head">
            <div>
              <strong>Ajustes temporales</strong>
              <small>Layout responsive por examen y pestaña separada para animación de cascada.</small>
            </div>
            <button class="quiz-layout-tune-close" type="button" data-quiz-layout-tune-close aria-label="Cerrar ajustes">×</button>
          </div>
          ${quizLayoutTuneNavHTML(totalQuestions, currentIndex)}
          <div class="quiz-layout-tune-tabs" role="tablist" aria-label="Opciones de ajuste">
            <button class="quiz-layout-tab is-active" type="button" role="tab" aria-selected="true" data-quiz-tune-tab="layout">Layout</button>
            <button class="quiz-layout-tab" type="button" role="tab" aria-selected="false" data-quiz-tune-tab="cascade">Animación</button>
          </div>
          <div class="quiz-layout-tab-panel is-active" data-quiz-tune-panel="layout">
            ${hasImage ? `
            <div class="quiz-layout-image-preview-row">
              <label class="quiz-layout-image-preview-toggle">
                <input type="checkbox" data-quiz-image-preview-toggle ${getQuizImagePreviewVisible(type) ? 'checked' : ''} />
                <span>Mostrar imagen en vista previa</span>
              </label>
              <small>La imagen sigue siendo ampliable con toque.</small>
            </div>` : ''}
            <div class="quiz-layout-tune-scroll">
              ${layoutFields.map((field) => `
                <label class="quiz-layout-tune-row">
                  <span>${escapeHTML(field.label)} <b data-quiz-layout-tune-value="${escapeAttr(field.key)}">${layoutTune[field.key]}${field.unit}</b></span>
                  <input type="range" min="${field.min}" max="${field.max}" step="${field.step}" value="${layoutTune[field.key]}" data-quiz-layout-tune="${escapeAttr(field.key)}" />
                </label>
              `).join('')}
            </div>
            <div class="quiz-cascade-tune-actions">
              <button class="btn ghost small" type="button" data-quiz-layout-tune-reset>Restablecer layout</button>
            </div>
          </div>
          <div class="quiz-layout-tab-panel" data-quiz-tune-panel="cascade" hidden>
            <div class="quiz-layout-tune-scroll quiz-cascade-tune-scroll">
              ${QUIZ_CASCADE_TUNE_FIELDS.map((field) => `
                <label class="quiz-layout-tune-row quiz-cascade-tune-row">
                  <span>${escapeHTML(field.label)} <b data-quiz-cascade-tune-value="${escapeAttr(field.key)}">${cascadeTune[field.key]}${field.unit}</b></span>
                  <input type="range" min="${field.min}" max="${field.max}" step="${field.step}" value="${cascadeTune[field.key]}" data-quiz-cascade-tune="${escapeAttr(field.key)}" />
                </label>
              `).join('')}
            </div>
            <div class="quiz-cascade-tune-actions">
              <button class="primary-btn small" type="button" data-quiz-cascade-replay>Reproducir animación</button>
              <button class="btn ghost small" type="button" data-quiz-cascade-tune-reset>Restablecer cascada</button>
            </div>
          </div>
        </div>
      </section>
    `;
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
        const type = panel.dataset.quizLayoutType || 'default';
        applyQuizLayoutTune(type, getQuizLayoutTune(type));
        applyQuizCascadeTune(type, getQuizCascadeTune(type, stage.dataset.quizHasImage === 'true'), stage, stage.dataset.quizHasImage === 'true');
      });
    });
    document.querySelectorAll('[data-quiz-layout-tune-panel]').forEach((panel) => {
      const type = panel.dataset.quizLayoutType || 'default';
      const panelStage = panel.closest('.quiz-stage');
      const panelHasImage = panel.dataset.quizHasImage === 'true';
      applyQuizLayoutTune(type, getQuizLayoutTune(type));
      applyQuizCascadeTune(type, getQuizCascadeTune(type, panelHasImage), panelStage, panelHasImage);
      const closePanel = () => {
        panel.classList.remove('is-open');
        panel.setAttribute('aria-hidden', 'true');
        panel.hidden = true;
      };
      panel.querySelectorAll('[data-quiz-layout-tune-close]').forEach((button) => {
        if (button.dataset.boundLayoutTuneClose === 'true') return;
        button.dataset.boundLayoutTuneClose = 'true';
        button.addEventListener('click', closePanel);
      });
      if (panel.dataset.boundLayoutTuneBackdrop !== 'true') {
        panel.dataset.boundLayoutTuneBackdrop = 'true';
        panel.addEventListener('click', (event) => {
          if (event.target === panel) closePanel();
        });
      }
      const imagePreviewToggle = panel.querySelector('[data-quiz-image-preview-toggle]');
      if (imagePreviewToggle && imagePreviewToggle.dataset.boundImagePreviewToggle !== 'true') {
        imagePreviewToggle.dataset.boundImagePreviewToggle = 'true';
        imagePreviewToggle.checked = getQuizImagePreviewVisible(type);
        imagePreviewToggle.addEventListener('change', () => {
          setQuizImagePreviewVisible(type, imagePreviewToggle.checked);
          applyQuizLayoutTune(type, getQuizLayoutTune(type));
        });
      }
      panel.querySelectorAll('[data-quiz-tune-tab]').forEach((button) => {
        if (button.dataset.boundQuizTuneTab === 'true') return;
        button.dataset.boundQuizTuneTab = 'true';
        button.addEventListener('click', () => {
          const target = button.dataset.quizTuneTab;
          panel.querySelectorAll('[data-quiz-tune-tab]').forEach((tab) => {
            const active = tab === button;
            tab.classList.toggle('is-active', active);
            tab.setAttribute('aria-selected', active ? 'true' : 'false');
          });
          panel.querySelectorAll('[data-quiz-tune-panel]').forEach((section) => {
            const active = section.dataset.quizTunePanel === target;
            section.classList.toggle('is-active', active);
            section.hidden = !active;
          });
        });
      });
      panel.querySelectorAll('[data-quiz-layout-tune]').forEach((input) => {
        if (input.dataset.boundLayoutTune === 'true') return;
        input.dataset.boundLayoutTune = 'true';
        input.addEventListener('input', () => {
          const current = getQuizLayoutTune(type);
          const key = input.dataset.quizLayoutTune;
          current[key] = Number(input.value);
          saveQuizLayoutTune(type, current);
          applyQuizLayoutTune(type, current);
          const field = QUIZ_LAYOUT_TUNE_FIELDS.find((item) => item.key === key);
          const output = panel.querySelector(`[data-quiz-layout-tune-value="${escapeSelector(key)}"]`);
          if (output && field) output.textContent = `${current[key]}${field.unit}`;
        });
      });
      panel.querySelector('[data-quiz-layout-tune-reset]')?.addEventListener('click', () => {
        const defaults = saveQuizLayoutTune(type, getQuizLayoutTuneDefaults(type));
        applyQuizLayoutTune(type, defaults);
        panel.querySelectorAll('[data-quiz-layout-tune]').forEach((input) => {
          const key = input.dataset.quizLayoutTune;
          input.value = defaults[key];
          const field = QUIZ_LAYOUT_TUNE_FIELDS.find((item) => item.key === key);
          const output = panel.querySelector(`[data-quiz-layout-tune-value="${escapeSelector(key)}"]`);
          if (output && field) output.textContent = `${defaults[key]}${field.unit}`;
        });
      });
      panel.querySelectorAll('[data-quiz-cascade-tune]').forEach((input) => {
        if (input.dataset.boundCascadeTune === 'true') return;
        input.dataset.boundCascadeTune = 'true';
        input.addEventListener('input', () => {
          const current = getQuizCascadeTune(type, panelHasImage);
          const key = input.dataset.quizCascadeTune;
          current[key] = Number(input.value);
          saveQuizCascadeTune(type, current, panelHasImage);
          applyQuizCascadeTune(type, current, panel.closest('.quiz-stage'), panelHasImage);
          const field = QUIZ_CASCADE_TUNE_FIELDS.find((item) => item.key === key);
          const output = panel.querySelector(`[data-quiz-cascade-tune-value="${escapeSelector(key)}"]`);
          if (output && field) output.textContent = `${current[key]}${field.unit}`;
        });
      });
      const replayButton = panel.querySelector('[data-quiz-cascade-replay]');
      if (replayButton && replayButton.dataset.boundCascadeReplay !== 'true') {
        replayButton.dataset.boundCascadeReplay = 'true';
        replayButton.addEventListener('click', () => replayQuizCascadePreview(replayButton));
      }
      panel.querySelector('[data-quiz-cascade-tune-reset]')?.addEventListener('click', () => {
        const defaults = saveQuizCascadeTune(type, getQuizCascadeTuneDefaults(type, panelHasImage), panelHasImage);
        applyQuizCascadeTune(type, defaults, panel.closest('.quiz-stage'), panelHasImage);
        panel.querySelectorAll('[data-quiz-cascade-tune]').forEach((input) => {
          const key = input.dataset.quizCascadeTune;
          input.value = defaults[key];
          const field = QUIZ_CASCADE_TUNE_FIELDS.find((item) => item.key === key);
          const output = panel.querySelector(`[data-quiz-cascade-tune-value="${escapeSelector(key)}"]`);
          if (output && field) output.textContent = `${defaults[key]}${field.unit}`;
        });
      });
    });
  }

  function applyQuizLayoutTune(type = 'default', tune = getQuizLayoutTune(type)) {
    const stage = document.querySelector(`.quiz-stage-fullscreen.quiz-type-${escapeSelector(type)}`) || document.querySelector('.quiz-stage');
    if (!stage) return;
    stage.classList.toggle('quiz-hide-image-preview', !getQuizImagePreviewVisible(type));
    const safe = normalizeQuizLayoutTune(tune, type);
    const unifiedFont = `${safe.text_font}px`;
    stage.style.setProperty('--quiz-text-font', unifiedFont);
    stage.style.setProperty('--quiz-text-a-font', unifiedFont);
    stage.style.setProperty('--quiz-text-b-font', unifiedFont);
    stage.style.setProperty('--quiz-fill-font', unifiedFont);
    const answerZone = stage.querySelector('[data-quiz-tune-target="answers"]');
    if (answerZone) {
      answerZone.style.setProperty('--quiz-text-font', unifiedFont);
      answerZone.style.setProperty('--quiz-text-a-font', unifiedFont);
      answerZone.style.setProperty('--quiz-text-b-font', unifiedFont);
      answerZone.style.setProperty('--quiz-fill-font', unifiedFont);
    }
    const setBox = (name, prefix) => {
      const box = stage.querySelector(`[data-quiz-tune-target="${name}"]`);
      if (!box) return;
      box.style.removeProperty('--quiz-tune-x');
      box.style.removeProperty('--quiz-tune-w');
      box.style.setProperty('--quiz-tune-y', `${safe[`${prefix}_y`] || 0}px`);
      if (Number(safe[`${prefix}_h`]) > 0) box.style.setProperty('--quiz-tune-h', `${safe[`${prefix}_h`]}px`);
      else box.style.removeProperty('--quiz-tune-h');
      if (prefix === 'textA') {
        box.style.setProperty('--quiz-text-font', `${safe.text_font}px`);
        box.style.setProperty('--quiz-text-a-font', `${safe.text_font}px`);
        box.style.setProperty('--quiz-text-b-font', `${safe.text_font}px`);
      }
    };
    setBox('textA', 'textA');
    setBox('image', 'image');
    setBox('answers', 'answers');
    applyQuizCascadeTune(type, getQuizCascadeTune(type, stage.dataset.quizHasImage === 'true'), stage, stage.dataset.quizHasImage === 'true');
  }

  function quizTypeLabel(type) {
    const labels = {
      multiple_choice: 'Opción múltiple',
      true_false: 'Verdadero / falso',
      open: 'Pregunta abierta',
      match: 'Arrastrar para unir',
      fill_text: 'Completar texto',
      slider: 'Respuesta con slider'
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
    if (question.type === 'open') return quizOpenHTML(question);
    if (question.type === 'true_false') return quizTrueFalseHTML(question);
    if (question.type === 'match') return quizMatchHTML(question);
    if (question.type === 'fill_text') return quizFillTextHTML(question);
    if (question.type === 'slider') return quizSliderHTML(question);
    return quizMultipleChoiceHTML(question);
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

  function quizMatchHTML(question) {
    const pairs = Array.isArray(question.pairs) ? question.pairs : [];
    const palette = ['red', 'blue', 'yellow', 'green'];
    const colorHex = { red: '#e21b3c', blue: '#1368ce', yellow: '#d89e00', green: '#26890c' };
    return `
      <div class="quiz-match-shell" data-quiz-match-board>
        <div class="quiz-match-board">
          <div class="quiz-match-column match-source-column">
            <strong>Opciones</strong>
            <div class="match-source" data-match-source>
              ${pairs.map((pair, index) => {
                const color = palette[index % palette.length];
                return `<button class="match-card match-${color}" style="--match-color:${colorHex[color]}" type="button" draggable="true" data-match-color="${color}" data-match-left="${escapeAttr(pair.id)}">${escapeHTML(pair.left)}</button>`;
              }).join('')}
            </div>
          </div>
          <div class="quiz-match-column">
            <strong>Une aquí</strong>
            ${pairs.map((pair) => `
              <div class="match-drop match-empty" data-match-right="${escapeAttr(pair.id)}" data-match-empty="true">
                <span class="match-drop-label">${escapeHTML(pair.right)}</span>
                <div class="match-slot" data-match-slot><small>Suelta o toca una opción</small></div>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="quiz-match-actions">
          <button class="mini-btn quiz-match-reset" type="button" data-match-reset>Reiniciar</button>
          <button class="primary-btn quiz-match-validate" type="button" data-match-validate>Validar uniones</button>
        </div>
        <p class="quiz-match-feedback" data-match-feedback hidden></p>
      </div>
    `;
  }


  function quizFillTextHTML(question) {
    const blanks = Array.isArray(question.blanks) ? question.blanks : [];
    const textParts = Array.isArray(question.textParts) ? question.textParts : [];
    const options = Array.isArray(question.options) ? question.options : [];
    const palette = ['red', 'blue', 'yellow', 'green', 'purple', 'orange', 'cyan', 'pink'];
    const colorHex = {
      red: '#e21b3c', blue: '#1368ce', yellow: '#d89e00', green: '#26890c',
      purple: '#7b2ff7', orange: '#f57c00', cyan: '#00bcd4', pink: '#e91e63'
    };
    const fillText = blanks.map((blank, index) => {
      const before = textParts[index] || '';
      return `${escapeHTML(before)}<span class="fill-drop fill-empty" data-fill-blank="${escapeAttr(blank.id || `blank${index + 1}`)}" data-fill-answer="${escapeAttr(blank.answerId || blank.correctOptionId || '')}" data-fill-empty="true"><span class="fill-slot" data-fill-slot><small>Arrastra aquí</small></span></span>`;
    }).join('') + escapeHTML(textParts[blanks.length] || '');
    return `
      <div class="quiz-fill-shell" data-quiz-fill-board>
        <div class="quiz-fill-text" data-fill-text>${fillText}</div>
        <div class="quiz-fill-options" data-fill-source>
          ${options.slice(0, 6).map((option, index) => {
            const color = palette[index % palette.length];
            return `<button class="fill-option fill-${color}" style="--fill-color:${colorHex[color]}" type="button" draggable="true" data-fill-color="${color}" data-fill-option="${escapeAttr(option.id || String(index))}">${escapeHTML(option.text || '')}</button>`;
          }).join('')}
        </div>
        <div class="quiz-fill-actions">
          <button class="mini-btn quiz-fill-reset" type="button" data-fill-reset>Reiniciar</button>
          <button class="primary-btn quiz-fill-validate" type="button" data-fill-validate>Validar texto</button>
        </div>
        <p class="quiz-match-feedback quiz-fill-feedback" data-fill-feedback hidden></p>
      </div>
    `;
  }

  function sliderDecimals(value) {
    const text = String(value ?? '');
    if (text.includes('e-')) return Math.max(0, Number(text.split('e-')[1]) || 0);
    const point = text.split('.')[1] || '';
    return point.length;
  }

  function formatSliderNumber(value, step = 1) {
    const decimals = Math.min(6, Math.max(sliderDecimals(step), sliderDecimals(value)));
    const fixed = Number(value).toFixed(decimals);
    return fixed.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
  }

  function snapSliderValue(value, min = 0, step = 1) {
    const safeStep = Math.abs(Number(step)) || 1;
    const safeMin = Number(min) || 0;
    const raw = Number(value);
    const snapped = safeMin + Math.round((raw - safeMin) / safeStep) * safeStep;
    return Number(formatSliderNumber(snapped, safeStep));
  }

  function quizSliderRange(question) {
    const step = Math.abs(Number(question.step)) || 1;
    const correctRaw = Number.isFinite(Number(question.correct)) ? Number(question.correct) : 0;
    const correct = snapSliderValue(correctRaw, 0, step);
    const hasMin = Number.isFinite(Number(question.min));
    const hasMax = Number.isFinite(Number(question.max));
    const originalMin = hasMin ? snapSliderValue(Number(question.min), 0, step) : snapSliderValue(correct - (step * 5), 0, step);
    const originalMax = hasMax ? snapSliderValue(Number(question.max), 0, step) : snapSliderValue(originalMin + (step * 9), 0, step);
    const maxValues = Math.max(2, Math.min(10, Number(question.rangeSteps) || 10));
    const maxIntervals = Math.max(1, maxValues - 1);
    const span = maxIntervals * step;
    let min = originalMin;
    let max = originalMax;
    const originalValues = Math.round(Math.abs((originalMax - originalMin) / step)) + 1;
    if (question.randomRange !== false || originalValues > maxValues) {
      const lowerBound = hasMin ? originalMin : snapSliderValue(correct - span, 0, step);
      const upperBound = hasMax ? originalMax : snapSliderValue(correct + span, 0, step);
      let minStart = Math.max(lowerBound, snapSliderValue(correct - span, 0, step));
      let maxStart = Math.min(correct, snapSliderValue(upperBound - span, 0, step));
      if (maxStart < minStart) {
        minStart = snapSliderValue(correct - span, 0, step);
        maxStart = correct;
      }
      const possibleStarts = Math.max(0, Math.round((maxStart - minStart) / step));
      const leftSteps = Math.floor(Math.random() * (possibleStarts + 1));
      min = snapSliderValue(minStart + (leftSteps * step), 0, step);
      max = snapSliderValue(min + span, 0, step);
    }
    if (max <= min) max = snapSliderValue(min + span, 0, step);
    if (correct < min) {
      min = correct;
      max = snapSliderValue(min + span, 0, step);
    }
    if (correct > max) {
      max = correct;
      min = snapSliderValue(max - span, 0, step);
    }
    const valueCount = Math.max(2, Math.min(maxValues, Math.round(Math.abs((max - min) / step)) + 1));
    max = snapSliderValue(min + ((valueCount - 1) * step), 0, step);
    if (correct > max) {
      max = correct;
      min = snapSliderValue(max - ((valueCount - 1) * step), 0, step);
    }
    let initial = Number.isFinite(Number(question.initial)) ? snapSliderValue(Number(question.initial), min, step) : snapSliderValue(min + (Math.floor((valueCount - 1) / 2) * step), min, step);
    if (initial < min || initial > max) initial = snapSliderValue(min + (Math.floor((valueCount - 1) / 2) * step), min, step);
    return { min, max, step, correct, initial, tickCount: valueCount };
  }

  function getQuizSliderTune() {
    return { userY: -15, userZoom: 61, correctY: 13, correctZoom: 118 };
  }

  function quizSliderTunePanelHTML(last = false) {
    const tune = getQuizSliderTune();
    return `
      <div class="quiz-slider-tune-panel" data-slider-y-panel>
        <strong>Ajuste temporal slider</strong>
        <small>Mueve la paleta azul hasta que quede arriba del bullet. Pásame el valor final.</small>
        <label class="slider-tune-row">
          <span>Mover paleta azul Y <b data-slider-tune-value="userY">${tune.userY}px</b></span>
          <input type="range" min="-40" max="80" step="1" value="${tune.userY}" data-slider-tune="userY" data-unit="px" />
        </label>
      </div>
    `;
  }

  function quizSliderHTML(question) {
    const range = quizSliderRange(question);
    const min = range.min;
    const max = range.max;
    const step = range.step;
    const correct = range.correct;
    const initial = range.initial;
    const tolerance = Number.isFinite(Number(question.tolerance)) ? Number(question.tolerance) : 0;
    const unit = escapeHTML(question.unit || '');
    const tickCount = range.tickCount;
    const sliderTicks = Array.from({ length: tickCount }, (_, index) => `<span data-slider-tick="${index}"></span>`).join('');
    const quiz = getActiveQuiz();
    const total = Array.isArray(quiz?.questions) ? quiz.questions.length : 0;
    const last = state.quizQuestionIndex >= total - 1;
    return `
      <div class="quiz-slider-shell" data-quiz-slider-board data-slider-correct="${correct}" data-slider-tolerance="${tolerance}" data-slider-tick-count="${tickCount}" data-slider-step="${step}">
        <div class="quiz-slider-visual-stage">
          <div class="quiz-slider-widget" aria-label="Respuesta numérica tipo slider">
            <div class="quiz-slider-bubble" data-slider-bubble>
              <span data-slider-value>${formatSliderNumber(initial, step)}</span>
            </div>
            <div class="quiz-slider-ticks" data-slider-ticks>${sliderTicks}</div>
            <div class="slider-correct-bubble" data-slider-correct-bubble hidden><span>${formatSliderNumber(correct, step)}</span></div>
            <input class="quiz-phone-range" type="range" min="${min}" max="${max}" step="${step}" value="${initial}" aria-label="Selecciona tu respuesta" data-quiz-slider />
          </div>
        </div>
        <div class="quiz-slider-limits"><span>${formatSliderNumber(min, step)}${unit ? ` ${unit}` : ''}</span><span>${formatSliderNumber(max, step)}${unit ? ` ${unit}` : ''}</span></div>
        <button class="primary-btn quiz-slider-submit" type="button" data-slider-validate>Validar número</button>
      </div>
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


  function quizFeedbackTunePanelHTML(options = {}) {
    const tune = getQuizFeedbackTune();
    const groups = QUIZ_FEEDBACK_TUNE_FIELDS.reduce((acc, field) => {
      const group = field.group || 'Ajustes';
      if (!acc[group]) acc[group] = [];
      acc[group].push(field);
      return acc;
    }, {});
    const rows = Object.entries(groups).map(([group, fields]) => `
      <div class="quiz-feedback-tune-group">
        <h4>${escapeHTML(group)}</h4>
        ${fields.map((field) => {
          const value = tune[field.key];
          return `
            <label class="quiz-feedback-tune-row">
              <span class="quiz-feedback-tune-head"><strong>${escapeHTML(field.label)}</strong><output data-quiz-feedback-tune-value="${escapeAttr(field.key)}">${value}${field.unit}</output></span>
              <input type="range" min="${field.min}" max="${field.max}" step="${field.step}" value="${value}" data-quiz-feedback-tune="${escapeAttr(field.key)}" />
            </label>
          `;
        }).join('')}
      </div>
    `).join('');
    return `
      <section class="quiz-feedback-tune-panel ${options.live ? 'is-live' : ''}" data-quiz-feedback-tune-live="${options.live ? 'true' : 'false'}" aria-label="Ajuste temporal de la banda de feedback">
        <div class="quiz-feedback-tune-title">Ajuste temporal banda quiz</div>
        <div class="quiz-feedback-tune-help">Avance automático desactivado. Ajusta banda, emoji y textos; luego pásame los valores.</div>
        ${rows}
        <div class="quiz-feedback-tune-actions">
          <button class="btn ghost small quiz-feedback-tune-reset" type="button" data-quiz-feedback-tune-reset>Restablecer banda</button>
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
      input.addEventListener('input', () => {
        const current = getQuizFeedbackTune();
        const key = input.dataset.quizFeedbackTune;
        current[key] = Number(input.value);
        saveQuizFeedbackTune(current);
        applyQuizFeedbackTune(current);
        updateQuizFeedbackTuneOutput(key, current[key]);
      });
    });
    document.querySelectorAll('[data-quiz-feedback-tune-reset]').forEach((button) => {
      if (button.dataset.boundTuneReset === 'true') return;
      button.dataset.boundTuneReset = 'true';
      button.addEventListener('click', () => {
        saveQuizFeedbackTune({ ...QUIZ_FEEDBACK_TUNE_DEFAULTS });
        applyQuizFeedbackTune({ ...QUIZ_FEEDBACK_TUNE_DEFAULTS });
        document.querySelectorAll('[data-quiz-feedback-tune]').forEach((input) => {
          const key = input.dataset.quizFeedbackTune;
          input.value = QUIZ_FEEDBACK_TUNE_DEFAULTS[key];
          updateQuizFeedbackTuneOutput(key, QUIZ_FEEDBACK_TUNE_DEFAULTS[key]);
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
    return { ...QUIZ_FEEDBACK_TUNE_DEFAULTS };
  }

  function normalizeQuizFeedbackTune(tune = {}) {
    const normalized = { ...QUIZ_FEEDBACK_TUNE_DEFAULTS };
    QUIZ_FEEDBACK_TUNE_FIELDS.forEach((field) => {
      const raw = Number(tune[field.key]);
      normalized[field.key] = Number.isFinite(raw) ? Math.max(field.min, Math.min(field.max, raw)) : QUIZ_FEEDBACK_TUNE_DEFAULTS[field.key];
    });
    return normalized;
  }

  function saveQuizFeedbackTune(tune) {
    return normalizeQuizFeedbackTune(tune);
  }

  function updateQuizFeedbackTuneOutput(key, value) {
    const field = QUIZ_FEEDBACK_TUNE_FIELDS.find((item) => item.key === key);
    const output = document.querySelector(`[data-quiz-feedback-tune-value="${escapeSelector(key)}"]`);
    if (output && field) output.textContent = `${value}${field.unit}`;
  }

  function applyQuizFeedbackTune(tune = getQuizFeedbackTune()) {
    const root = document.documentElement;
    const safe = normalizeQuizFeedbackTune(tune);
    root.style.setProperty('--quiz-feedback-curve', `${Number(safe.curve) || QUIZ_FEEDBACK_TUNE_DEFAULTS.curve}px`);
    root.style.setProperty('--quiz-feedback-spread', `${Number(safe.spread) || 0}vw`);
    root.style.setProperty('--quiz-feedback-height', `${Number(safe.height) || QUIZ_FEEDBACK_TUNE_DEFAULTS.height}px`);
    root.style.setProperty('--quiz-feedback-lift', `${Number(safe.lift) || 0}px`);
    root.style.setProperty('--quiz-feedback-bounce', `${Number(safe.bounce) || 0}px`);
    root.style.setProperty('--quiz-feedback-band-x', `${Number(safe.bandX) || 0}px`);
    root.style.setProperty('--quiz-feedback-band-y', `${Number(safe.bandY) || 0}px`);
    root.style.setProperty('--quiz-feedback-band-scale', `${(Number(safe.bandZoom) || 100) / 100}`);
    root.style.setProperty('--quiz-feedback-emoji-x', `${Number(safe.emojiX) || 0}px`);
    root.style.setProperty('--quiz-feedback-emoji-y', `${Number(safe.emojiY) || 0}px`);
    root.style.setProperty('--quiz-feedback-emoji-scale', `${(Number(safe.emojiZoom) || 100) / 100}`);
    root.style.setProperty('--quiz-feedback-title-x', `${Number(safe.titleX) || 0}px`);
    root.style.setProperty('--quiz-feedback-title-y', `${Number(safe.titleY) || 0}px`);
    root.style.setProperty('--quiz-feedback-title-scale', `${(Number(safe.titleZoom) || 100) / 100}`);
    root.style.setProperty('--quiz-feedback-text-x', `${Number(safe.textX) || 0}px`);
    root.style.setProperty('--quiz-feedback-text-y', `${Number(safe.textY) || 0}px`);
    root.style.setProperty('--quiz-feedback-text-scale', `${(Number(safe.textZoom) || 100) / 100}`);
  }

  function bindQuizTabEvents() {
    bindQuizFeedbackTunePanel();
    document.querySelectorAll('[data-quiz-period]').forEach((button) => {
      button.addEventListener('click', () => setQuizPeriod(Number(button.dataset.quizPeriod)));
    });
    document.querySelectorAll('[data-quiz-id]').forEach((button) => {
      button.addEventListener('click', () => startQuiz(button.dataset.quizId));
    });
    bindQuizPlayerEvents();
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
    document.querySelectorAll('.quiz-open-input').forEach((input) => {
      input.addEventListener('focus', () => {
        window.setTimeout(() => {
          input.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
        }, 260);
      });
    });
    bindQuizLayoutTunePanel();
    bindQuizMatchEvents();
    bindQuizFillTextEvents();
    bindQuizSliderEvents();
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
    state.quizPeriod = Number(period);
    state.quizQuestionIndex = 0;
    state.quizActiveId = '';
    localStorage.setItem('encisomath:quizPeriod', String(state.quizPeriod));
    renderQuizzesTab({ animate: true });
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
      return `<div class="quiz-feedback-card is-neutral"><span>✍️</span><strong>Respuesta enviada</strong><p>${escapeHTML(neutralText)}</p></div>`;
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

  function showQuizFeedbackBand(stage, correct, question = null, neutralText = '') {
    const feedback = stage?.querySelector('[data-quiz-feedback]');
    if (!feedback) return;
    feedback.hidden = false;
    feedback.innerHTML = quizAnswerFeedbackHTML(correct, neutralText, question);
    feedback.className = neutralText
      ? 'quiz-answer-feedback is-neutral'
      : `quiz-answer-feedback ${correct ? 'is-correct' : 'is-wrong'}`;
    stage?.classList.add('quiz-feedback-visible');
  }

  function showQuizFeedbackBandAfterDelay(stage, correct, question = null, neutralText = '', delayMs = null) {
    const fallbackDelay = neutralText ? QUIZ_FEEDBACK_NEUTRAL_DELAY_MS : QUIZ_FEEDBACK_AFTER_PAINT_DELAY_MS;
    const effectiveDelay = Number.isFinite(Number(delayMs)) ? Math.max(0, Number(delayMs)) : fallbackDelay;
    scheduleQuizTimer(() => {
      showQuizFeedbackBand(stage, correct, question, neutralText);
      scheduleQuizAdvance();
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
    bindQuizFeedbackTunePanel();
  }

  function continueQuizAfterFeedback() {
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
    form.querySelectorAll('textarea, button').forEach((item) => { item.disabled = true; });
    const stage = form.closest('.quiz-stage');
    recordQuizAnswer(question, null, { text: value });
    pulseElement(form, 'text-pop');
    showQuizFeedbackBandAfterDelay(stage, null, question, value ? 'Tu respuesta quedó registrada en este intento.' : 'Enviada sin texto. La próxima escribe alguito, profe.', QUIZ_FEEDBACK_NEUTRAL_DELAY_MS);
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
    clearQuizTimers();
    state.quizFullscreenActive = true;
    state.quizSecurityGraceUntil = Date.now() + 2400;
    lockQuizHistory();
    const session = getQuizSession();
    session.phase = 'intro';
    session.locked = false;
    renderQuizFullscreen(quiz);
    requestQuizFullscreenMode();
    scheduleQuizTimer(() => {
      document.getElementById('quizFullscreenLayer')?.classList.add('quiz-intro-fadeout');
    }, 1680);
    scheduleQuizTimer(() => showQuizItemTransition(0, { fromIntro: true }), 2200);
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
    renderQuizFullscreen(quiz);
    scheduleQuizTimer(() => {
      const current = getQuizSession();
      current.phase = 'question';
      current.locked = false;
      current.selectedAnswerId = '';
      current.transitionFromIntro = false;
      renderQuizFullscreen(quiz);
    }, 1500);
  }

  function showQuizResults() {
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
    layer.className = `quiz-fullscreen-layer quiz-phase-${phase}${phase === 'transition' && session.transitionFromIntro ? ' quiz-transition-from-intro' : ''}`;
    let content = '';
    if (phase === 'confirm') content = quizStartGateHTML(quiz);
    else if (phase === 'intro') content = quizIntroSplashHTML(quiz);
    else if (phase === 'transition') content = quizItemTransitionHTML(state.quizQuestionIndex + 1, questions.length);
    else if (phase === 'results') content = quizResultsHTML(quiz);
    else content = quizPlayerHTML(quiz, { fullscreen: true });
    const showTop = phase === 'question' || phase === 'results';

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

  function quizItemTransitionHTML(item, total) {
    return `
      <section class="quiz-item-transition quiz-burst-scene" aria-live="polite">
        <div class="quiz-burst-shapes" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><span></span></div>
        <div class="quiz-transition-count"><em>Ítem</em><span>${item}<small>/${total}</small></span></div>
        <div class="quiz-transition-progress"><span></span></div>
      </section>
    `;
  }

  function quizResultsHTML(quiz) {
    const stats = getQuizStats(quiz);
    const session = getQuizSession();
    const securedOut = Boolean(session.securityTerminated);
    const win = !securedOut && (stats.scorable === 0 || stats.correct >= Math.ceil(stats.scorable * 0.6));
    return `
      <section class="quiz-results-screen ${securedOut ? 'is-security-ended' : (win ? 'is-win' : 'is-try')}">
        <div class="quiz-results-burst" aria-hidden="true"></div>
        <div class="quiz-results-emoji">${securedOut ? '😡' : (win ? '🏆' : '💪')}</div>
        <p class="section-kicker">${securedOut ? 'Quiz anulado' : 'Resultados'}</p>
        <h2>${securedOut ? 'Quiz terminado por seguridad' : (win ? '¡Quiz completado!' : 'Quiz terminado')}</h2>
        <p>${securedOut ? 'Se detectó un segundo intento sospechoso durante el quiz.' : (win ? 'Buen trabajo. Esa mente vino en modo turbo.' : 'No pasa nada. La próxima ronda viene con revancha.')}</p>
        ${securedOut ? `<div class="quiz-security-result-note">Motivo: ${escapeHTML(session.securityTerminatedReason || 'Acción sospechosa repetida')}</div>` : ''}
        <div class="quiz-score-board">
          <strong>${stats.correct}<small>/${stats.scorable || stats.total}</small></strong>
          <span>${securedOut ? 'resultado no válido' : (stats.scorable ? 'respuestas correctas' : 'respuestas revisables')}</span>
        </div>
        <div class="quiz-results-actions">
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
    resetQuizSession('intro');
    lockQuizHistory();
    renderQuizFullscreen(quiz);
    requestQuizFullscreenMode();
    scheduleQuizTimer(() => {
      document.getElementById('quizFullscreenLayer')?.classList.add('quiz-intro-fadeout');
    }, 1550);
    scheduleQuizTimer(() => showQuizItemTransition(0, { fromIntro: true }), 2000);
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

  function bindQuizMatchEvents() {
    document.querySelectorAll('[data-quiz-match-board]').forEach((board) => {
      const source = board.querySelector('[data-match-source]');
      let selectedCard = null;
      let draggedId = '';

      const resetDropColor = (drop) => {
        if (!drop) return;
        ['red', 'blue', 'yellow', 'green'].forEach((color) => drop.classList.remove(`match-color-${color}`));
        drop.style.removeProperty('--match-color');
        drop.classList.remove('match-filled', 'matched', 'wrong', 'match-reveal-pending', 'match-reveal-pop');
        drop.classList.add('match-empty');
        delete drop.dataset.matchColor;
        delete drop.dataset.resultMark;
      };

      const clearFeedback = () => {
        board.querySelectorAll('.match-drop').forEach((drop) => {
          drop.classList.remove('matched', 'wrong', 'match-reveal-pending', 'match-reveal-pop');
          drop.querySelectorAll('[data-match-left]').forEach((card) => card.classList.remove('matched', 'wrong', 'match-reveal-pop'));
          delete drop.dataset.resultMark;
        });
        const feedback = board.querySelector('[data-match-feedback]');
        if (feedback) { feedback.hidden = true; feedback.textContent = ''; feedback.className = 'quiz-match-feedback'; }
      };

      const returnCardToSource = (card) => {
        if (!card || !source) return;
        const oldDrop = card.closest('.match-drop');
        card.classList.remove('selected', 'dragging');
        source.appendChild(card);
        if (oldDrop && !oldDrop.querySelector('[data-match-left]')) {
          delete oldDrop.dataset.placedId;
          oldDrop.dataset.matchEmpty = 'true';
          resetDropColor(oldDrop);
          const oldSlot = oldDrop.querySelector('[data-match-slot]');
          if (oldSlot) oldSlot.innerHTML = '<small>Suelta o toca una opción</small>';
        }
      };

      const applyDropColor = (drop, card) => {
        const color = card?.dataset.matchColor || 'blue';
        const value = card?.style.getPropertyValue('--match-color') || '';
        ['red', 'blue', 'yellow', 'green'].forEach((item) => drop.classList.remove(`match-color-${item}`));
        drop.classList.remove('match-empty');
        drop.classList.add('match-filled', `match-color-${color}`);
        drop.dataset.matchColor = color;
        if (value) drop.style.setProperty('--match-color', value.trim());
      };

      const placeCard = (card, drop) => {
        if (getQuizSession().locked || !card || !drop) return;
        clearFeedback();
        const slot = drop.querySelector('[data-match-slot]');
        if (!slot) return;
        const previous = slot.querySelector('[data-match-left]');
        if (previous && previous !== card) returnCardToSource(previous);
        const oldDrop = card.closest('.match-drop');
        slot.innerHTML = '';
        slot.appendChild(card);
        if (oldDrop && oldDrop !== drop) {
          delete oldDrop.dataset.placedId;
          oldDrop.dataset.matchEmpty = 'true';
          resetDropColor(oldDrop);
          const oldSlot = oldDrop.querySelector('[data-match-slot]');
          if (oldSlot && !oldSlot.querySelector('[data-match-left]')) oldSlot.innerHTML = '<small>Suelta o toca una opción</small>';
        }
        card.classList.remove('selected', 'dragging');
        drop.dataset.placedId = card.dataset.matchLeft || '';
        drop.dataset.matchEmpty = 'false';
        applyDropColor(drop, card);
        pulseElement(drop, 'match-join-pop');
      };

      board.querySelectorAll('[data-match-left]').forEach((card) => {
        card.addEventListener('dragstart', (event) => {
          if (getQuizSession().locked) { event.preventDefault(); return; }
          draggedId = card.dataset.matchLeft || '';
          selectedCard = card;
          event.dataTransfer?.setData('text/plain', draggedId);
          card.classList.add('dragging');
        });
        card.addEventListener('dragend', () => card.classList.remove('dragging'));
        card.addEventListener('click', () => {
          if (getQuizSession().locked) return;
          board.querySelectorAll('[data-match-left]').forEach((item) => item.classList.remove('selected'));
          selectedCard = card;
          card.classList.add('selected');
        });
      });

      board.querySelectorAll('[data-match-right]').forEach((drop) => {
        drop.addEventListener('dragover', (event) => {
          if (getQuizSession().locked) return;
          event.preventDefault();
          drop.classList.add('over');
        });
        drop.addEventListener('dragleave', () => drop.classList.remove('over'));
        drop.addEventListener('drop', (event) => {
          if (getQuizSession().locked) return;
          event.preventDefault();
          const id = event.dataTransfer?.getData('text/plain') || draggedId;
          const card = board.querySelector(`[data-match-left="${escapeSelector(id)}"]`);
          drop.classList.remove('over');
          placeCard(card, drop);
        });
        drop.addEventListener('click', () => {
          if (getQuizSession().locked) return;
          if (selectedCard) placeCard(selectedCard, drop);
        });
      });

      board.querySelector('[data-match-reset]')?.addEventListener('click', () => {
        if (getQuizSession().locked) return;
        board.querySelectorAll('[data-match-left]').forEach((card) => returnCardToSource(card));
        board.querySelectorAll('.match-drop').forEach((drop) => {
          delete drop.dataset.placedId;
          drop.dataset.matchEmpty = 'true';
          drop.classList.remove('over');
          resetDropColor(drop);
          const slot = drop.querySelector('[data-match-slot]');
          if (slot) slot.innerHTML = '<small>Suelta o toca una opción</small>';
        });
        clearFeedback();
      });

      board.querySelector('[data-match-validate]')?.addEventListener('click', () => {
        const session = getQuizSession();
        if (session.locked) return;
        session.locked = true;
        const drops = Array.from(board.querySelectorAll('.match-drop'));
        const total = drops.length;
        let correct = 0;
        board.querySelectorAll('[data-match-left], [data-match-reset], [data-match-validate]').forEach((item) => { item.disabled = true; });
        drops.forEach((drop) => {
          drop.classList.remove('matched', 'wrong', 'match-reveal-pop');
          drop.querySelectorAll('[data-match-left]').forEach((card) => card.classList.remove('matched', 'wrong', 'match-reveal-pop'));
          delete drop.dataset.resultMark;
          drop.classList.add('match-reveal-pending');
        });
        drops.forEach((drop, index) => {
          scheduleQuizTimer(() => {
            const ok = Boolean(drop.dataset.placedId) && drop.dataset.placedId === drop.dataset.matchRight;
            if (ok) correct += 1;
            drop.classList.remove('match-reveal-pending', 'matched', 'wrong', 'match-reveal-pop');
            drop.classList.add(ok ? 'matched' : 'wrong', 'match-reveal-pop');
            const placedCard = drop.querySelector('[data-match-left]');
            if (placedCard) {
              placedCard.classList.remove('matched', 'wrong', 'match-reveal-pop');
              placedCard.classList.add(ok ? 'matched' : 'wrong', 'match-reveal-pop');
            }
            drop.dataset.resultMark = ok ? '✓' : '×';
          }, 333 * (index + 1));
        });
        scheduleQuizTimer(() => {
          const allCorrect = correct === total;
          const currentQuestion = getCurrentQuizQuestion();
          recordQuizAnswer(currentQuestion, allCorrect, { correctPairs: correct, totalPairs: total });
          const feedback = board.querySelector('[data-match-feedback]');
          if (feedback) {
            feedback.hidden = true;
            feedback.innerHTML = '';
            feedback.className = 'quiz-match-feedback';
          }
          const stage = board.closest('.quiz-stage');
          showQuizFeedbackBandAfterDelay(stage, allCorrect, currentQuestion);
        }, (333 * total));
      });
    });
  }


  function bindQuizFillTextEvents() {
    document.querySelectorAll('[data-quiz-fill-board]').forEach((board) => {
      const source = board.querySelector('[data-fill-source]');
      let selectedCard = null;
      let draggedId = '';
      const colors = ['red', 'blue', 'yellow', 'green', 'purple', 'orange', 'cyan', 'pink'];
      const resetDropColor = (drop) => {
        if (!drop) return;
        colors.forEach((color) => drop.classList.remove(`fill-color-${color}`));
        drop.style.removeProperty('--fill-color');
        drop.classList.remove('fill-filled', 'matched', 'wrong', 'match-reveal-pending', 'match-reveal-pop');
        drop.classList.add('fill-empty');
        delete drop.dataset.fillColor;
        delete drop.dataset.resultMark;
      };
      const returnCardToSource = (card) => {
        if (!card || !source) return;
        const oldDrop = card.closest('.fill-drop');
        card.classList.remove('selected', 'dragging');
        source.appendChild(card);
        if (oldDrop && !oldDrop.querySelector('[data-fill-option]')) {
          delete oldDrop.dataset.placedId;
          oldDrop.dataset.fillEmpty = 'true';
          resetDropColor(oldDrop);
          const slot = oldDrop.querySelector('[data-fill-slot]');
          if (slot) slot.innerHTML = '<small>Arrastra aquí</small>';
        }
      };
      const clearFeedback = () => {
        board.querySelectorAll('.fill-drop').forEach((drop) => {
          drop.classList.remove('matched', 'wrong', 'match-reveal-pending', 'match-reveal-pop');
          drop.querySelectorAll('[data-fill-option]').forEach((card) => card.classList.remove('matched', 'wrong', 'match-reveal-pop'));
          delete drop.dataset.resultMark;
        });
        const feedback = board.querySelector('[data-fill-feedback]');
        if (feedback) { feedback.hidden = true; feedback.textContent = ''; feedback.className = 'quiz-match-feedback quiz-fill-feedback'; }
      };
      const applyDropColor = (drop, card) => {
        const color = card?.dataset.fillColor || 'blue';
        const value = card?.style.getPropertyValue('--fill-color') || '';
        colors.forEach((item) => drop.classList.remove(`fill-color-${item}`));
        drop.classList.remove('fill-empty');
        drop.classList.add('fill-filled', `fill-color-${color}`);
        drop.dataset.fillColor = color;
        if (value) drop.style.setProperty('--fill-color', value.trim());
      };
      const placeCard = (card, drop) => {
        if (getQuizSession().locked || !card || !drop) return;
        clearFeedback();
        const slot = drop.querySelector('[data-fill-slot]');
        if (!slot) return;
        const previous = slot.querySelector('[data-fill-option]');
        if (previous && previous !== card) returnCardToSource(previous);
        const oldDrop = card.closest('.fill-drop');
        slot.innerHTML = '';
        slot.appendChild(card);
        if (oldDrop && oldDrop !== drop) {
          delete oldDrop.dataset.placedId;
          oldDrop.dataset.fillEmpty = 'true';
          resetDropColor(oldDrop);
          const oldSlot = oldDrop.querySelector('[data-fill-slot]');
          if (oldSlot && !oldSlot.querySelector('[data-fill-option]')) oldSlot.innerHTML = '<small>Arrastra aquí</small>';
        }
        card.classList.remove('selected', 'dragging');
        drop.dataset.placedId = card.dataset.fillOption || '';
        drop.dataset.fillEmpty = 'false';
        applyDropColor(drop, card);
        pulseElement(drop, 'match-join-pop');
      };
      board.querySelectorAll('[data-fill-option]').forEach((card) => {
        card.addEventListener('dragstart', (event) => {
          if (getQuizSession().locked) { event.preventDefault(); return; }
          draggedId = card.dataset.fillOption || '';
          selectedCard = card;
          event.dataTransfer?.setData('text/plain', draggedId);
          card.classList.add('dragging');
        });
        card.addEventListener('dragend', () => card.classList.remove('dragging'));
        card.addEventListener('click', () => {
          if (getQuizSession().locked) return;
          board.querySelectorAll('[data-fill-option]').forEach((item) => item.classList.remove('selected'));
          selectedCard = card;
          card.classList.add('selected');
        });
      });
      board.querySelectorAll('[data-fill-blank]').forEach((drop) => {
        drop.addEventListener('dragover', (event) => {
          if (getQuizSession().locked) return;
          event.preventDefault();
          drop.classList.add('over');
        });
        drop.addEventListener('dragleave', () => drop.classList.remove('over'));
        drop.addEventListener('drop', (event) => {
          if (getQuizSession().locked) return;
          event.preventDefault();
          const id = event.dataTransfer?.getData('text/plain') || draggedId;
          const card = board.querySelector(`[data-fill-option="${escapeSelector(id)}"]`);
          drop.classList.remove('over');
          placeCard(card, drop);
        });
        drop.addEventListener('click', () => {
          if (getQuizSession().locked) return;
          if (selectedCard) placeCard(selectedCard, drop);
        });
      });
      board.querySelector('[data-fill-reset]')?.addEventListener('click', () => {
        if (getQuizSession().locked) return;
        board.querySelectorAll('[data-fill-option]').forEach((card) => returnCardToSource(card));
        board.querySelectorAll('.fill-drop').forEach((drop) => {
          delete drop.dataset.placedId;
          drop.dataset.fillEmpty = 'true';
          drop.classList.remove('over');
          resetDropColor(drop);
          const slot = drop.querySelector('[data-fill-slot]');
          if (slot) slot.innerHTML = '<small>Arrastra aquí</small>';
        });
        clearFeedback();
      });
      board.querySelector('[data-fill-validate]')?.addEventListener('click', () => {
        const session = getQuizSession();
        if (session.locked) return;
        session.locked = true;
        const drops = Array.from(board.querySelectorAll('.fill-drop'));
        const total = drops.length;
        let correct = 0;
        board.querySelectorAll('[data-fill-option], [data-fill-reset], [data-fill-validate]').forEach((item) => { item.disabled = true; });
        drops.forEach((drop) => {
          drop.classList.remove('matched', 'wrong', 'match-reveal-pop');
          drop.querySelectorAll('[data-fill-option]').forEach((card) => card.classList.remove('matched', 'wrong', 'match-reveal-pop'));
          delete drop.dataset.resultMark;
          drop.classList.add('match-reveal-pending');
        });
        drops.forEach((drop, index) => {
          scheduleQuizTimer(() => {
            const ok = Boolean(drop.dataset.placedId) && drop.dataset.placedId === drop.dataset.fillAnswer;
            if (ok) correct += 1;
            drop.classList.remove('match-reveal-pending', 'matched', 'wrong', 'match-reveal-pop');
            drop.classList.add(ok ? 'matched' : 'wrong', 'match-reveal-pop');
            const placedCard = drop.querySelector('[data-fill-option]');
            if (placedCard) {
              placedCard.classList.remove('matched', 'wrong', 'match-reveal-pop');
              placedCard.classList.add(ok ? 'matched' : 'wrong', 'match-reveal-pop');
            }
            drop.dataset.resultMark = ok ? '✓' : '×';
          }, 333 * (index + 1));
        });
        scheduleQuizTimer(() => {
          const allCorrect = correct === total;
          const currentQuestion = getCurrentQuizQuestion();
          recordQuizAnswer(currentQuestion, allCorrect, { correctBlanks: correct, totalBlanks: total });
          const feedback = board.querySelector('[data-fill-feedback]');
          if (feedback) {
            feedback.hidden = true;
            feedback.innerHTML = '';
            feedback.className = 'quiz-match-feedback quiz-fill-feedback';
          }
          const stage = board.closest('.quiz-stage');
          showQuizFeedbackBandAfterDelay(stage, allCorrect, currentQuestion);
        }, (333 * total));
      });
    });
  }

  function bindQuizSliderEvents() {
    document.querySelectorAll('[data-quiz-slider-board]').forEach((board) => {
      const slider = board.querySelector('[data-quiz-slider]');
      const valueLabel = board.querySelector('[data-slider-value]');
      const validate = board.querySelector('[data-slider-validate]');
      const correctBubble = board.querySelector('[data-slider-correct-bubble]');
      const applyTune = () => {
        const tune = getQuizSliderTune();
        board.style.setProperty('--slider-user-y', `${tune.userY}px`);
        board.style.setProperty('--slider-user-scale', `${tune.userZoom / 100}`);
        board.style.setProperty('--slider-correct-y', `${tune.correctY}px`);
        board.style.setProperty('--slider-correct-scale', `${tune.correctZoom / 100}`);
        board.querySelectorAll('[data-slider-tune]').forEach((input) => {
          if (tune[input.dataset.sliderTune] !== undefined && String(input.value) !== String(tune[input.dataset.sliderTune])) {
            input.value = tune[input.dataset.sliderTune];
          }
        });
        board.querySelectorAll('[data-slider-tune-value]').forEach((label) => {
          const key = label.dataset.sliderTuneValue;
          const input = board.querySelector(`[data-slider-tune="${escapeSelector(key)}"]`);
          const unit = input?.dataset.unit || '';
          if (tune[key] !== undefined) label.textContent = `${tune[key]}${unit}`;
        });
      };
      const tuneInputs = Array.from(board.querySelectorAll('[data-slider-tune]'));
      tuneInputs.forEach((input) => {
        input.addEventListener('input', () => {
          const current = getQuizSliderTune();
          const next = { ...current, [input.dataset.sliderTune]: Number(input.value) };
          localStorage.setItem('encisomath:quizSliderTune', JSON.stringify(next));
          applyTune();
        });
      });
      board.querySelector('[data-slider-tune-continue]')?.addEventListener('click', () => {
        continueQuizAfterFeedback();
      });
      const getSliderMetrics = () => {
        const min = Number(slider?.min || 0);
        const max = Number(slider?.max || 100);
        const step = Math.abs(Number(slider?.step || board.dataset.sliderStep || 1)) || 1;
        const ticks = Array.from(board.querySelectorAll('[data-slider-tick]'));
        const tickMax = Math.max(1, ticks.length - 1);
        return { min, max, step, ticks, tickMax };
      };
      const valueToIndex = (value, min, step, tickMax) => {
        return Math.max(0, Math.min(tickMax, Math.round((Number(value) - min) / step)));
      };
      const indexToValue = (index, min, step) => snapSliderValue(min + (index * step), min, step);
      const getTickCenter = (ticks, index) => {
        const tick = ticks[index];
        const holder = board.querySelector('[data-slider-ticks]');
        if (!tick || !holder) return null;
        const widget = tick.closest('.quiz-slider-widget');
        const widgetBox = widget?.getBoundingClientRect();
        const tickBox = tick.getBoundingClientRect();
        if (!widgetBox || !tickBox || !tickBox.width) return null;
        return (tickBox.left - widgetBox.left) + (tickBox.width / 2);
      };
      const setSliderFromPointer = (event) => {
        if (!slider || slider.disabled) return;
        const { min, step, ticks, tickMax } = getSliderMetrics();
        const first = ticks[0]?.getBoundingClientRect();
        const last = ticks[tickMax]?.getBoundingClientRect();
        if (!first || !last) return;
        const firstCenter = first.left + first.width / 2;
        const lastCenter = last.left + last.width / 2;
        const clientX = event.clientX ?? event.touches?.[0]?.clientX;
        if (!Number.isFinite(clientX)) return;
        const pct = (clientX - firstCenter) / Math.max(1, lastCenter - firstCenter);
        const index = Math.max(0, Math.min(tickMax, Math.round(pct * tickMax)));
        slider.value = formatSliderNumber(indexToValue(index, min, step), step);
        update();
      };
      const update = () => {
        if (!slider) return;
        const { min, max, step, ticks, tickMax } = getSliderMetrics();
        const snapped = Math.max(min, Math.min(max, snapSliderValue(slider.value, min, step)));
        const tickIndex = valueToIndex(snapped, min, step, tickMax);
        const exactValue = indexToValue(tickIndex, min, step);
        const formatted = formatSliderNumber(exactValue, step);
        if (formatSliderNumber(slider.value, step) !== formatted) slider.value = formatted;
        if (valueLabel) valueLabel.textContent = formatted;
        const visualPct = ticks.length > 1 ? (tickIndex / tickMax) * 100 : 0;
        const tickCenter = getTickCenter(ticks, tickIndex);
        const bubbleX = tickCenter == null ? `${visualPct}%` : `${tickCenter}px`;
        slider.style.setProperty('--slider-progress', `${visualPct}%`);
        slider.style.setProperty('--slider-visual-progress', `${visualPct}%`);
        board.style.setProperty('--slider-progress', `${visualPct}%`);
        board.style.setProperty('--slider-visual-progress', `${visualPct}%`);
        board.style.setProperty('--slider-bubble-x', bubbleX);
        board.dataset.sliderVisualIndex = String(tickIndex);
        ticks.forEach((tick, index) => {
          tick.classList.toggle('active', index === tickIndex);
          tick.classList.toggle('before-active', index < tickIndex);
          tick.classList.toggle('after-active', index > tickIndex);
        });
      };
      slider?.addEventListener('input', update);
      slider?.addEventListener('change', update);
      slider?.addEventListener('pointerdown', (event) => { setSliderFromPointer(event); slider.setPointerCapture?.(event.pointerId); });
      slider?.addEventListener('pointermove', (event) => { if (event.buttons || slider.matches(':active')) setSliderFromPointer(event); });
      slider?.addEventListener('touchstart', (event) => setSliderFromPointer(event), { passive: true });
      slider?.addEventListener('touchmove', (event) => setSliderFromPointer(event), { passive: true });
      applyTune();
      update();
      setTimeout(update, 80);
      window.addEventListener('resize', update, { passive: true });
      validate?.addEventListener('click', () => {
        const session = getQuizSession();
        const question = getCurrentQuizQuestion();
        if (!slider || !question || session.locked) return;
        session.locked = true;
        update();
        slider.disabled = true;
        validate.disabled = true;
        const selected = Number(slider.value);
        const correctValue = Number(board.dataset.sliderCorrect || question.correct || 0);
        const tolerance = Math.max(0, Number(board.dataset.sliderTolerance || question.tolerance || 0));
        const ok = Math.abs(selected - correctValue) <= tolerance;
        board.classList.add(ok ? 'slider-correct' : 'slider-wrong');
        const { min: sliderMin, step: sliderStep, ticks: correctTicks, tickMax: correctTickMax } = getSliderMetrics();
        const correctTickIndex = valueToIndex(correctValue, sliderMin, sliderStep, correctTickMax);
        const correctVisualPct = correctTicks.length > 1 ? (correctTickIndex / correctTickMax) * 100 : 0;
        const correctCenter = getTickCenter(correctTicks, correctTickIndex);
        board.style.setProperty('--slider-correct-progress', correctCenter == null ? `${correctVisualPct}%` : `${correctCenter}px`);
        board.dataset.sliderCorrectVisualIndex = String(correctTickIndex);
        correctTicks.forEach((tick, index) => tick.classList.toggle('correct-answer', !ok && index === correctTickIndex));
        if (correctBubble) {
          correctBubble.hidden = ok;
          const correctBubbleText = correctBubble.querySelector('span');
          if (correctBubbleText) correctBubbleText.textContent = formatSliderNumber(correctValue, Math.abs(Number(slider.step || 1)) || 1);
        }
        recordQuizAnswer(question, ok, { value: selected, correctValue, tolerance });
        const stage = board.closest('.quiz-stage');
        board.querySelector('[data-slider-tune-continue]')?.removeAttribute('hidden');
        if (!ok) pulseElement(board, 'quiz-slider-wrong-pop');
        showQuizFeedbackBandAfterDelay(stage, ok, question, '', QUIZ_FEEDBACK_AFTER_SLIDER_REVEAL_MS);
      });
    });
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

  function renderLesson(lesson) {
    const assignment = state.assignment;
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

  function renderStudentPlaceholder() {
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
    state.prefs.accent = safeAccent;
    state.prefs.background = safeBackground;

    const root = document.documentElement;
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
        const registration = await navigator.serviceWorker.register('./sw.js?v=0.24.84', { updateViaCache: 'none' });
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
