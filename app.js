(() => {
  'use strict';

  const APP_VERSION = '0.4.0';
  const DATA_FILES = {
    users: './data/users.json',
    assignments: './data/assignments.json',
    students: './data/students.json',
    classes: './data/classes.json'
  };

  const DEFAULT_PREFS = {
    accent: '#1b96bf',
    background: '#04101c'
  };

  const ACCENT_OPTIONS = [
    { label: 'Enciso azul', value: '#1b96bf' },
    { label: 'Duolingo verde', value: '#58cc02' },
    { label: 'Neón violeta', value: '#8b5cf6' },
    { label: 'Rojo alerta', value: '#ef4444' },
    { label: 'Dorado', value: '#f59e0b' }
  ];

  const BACKGROUND_OPTIONS = [
    { label: 'Azul oscuro', value: '#04101c' },
    { label: 'Negro total', value: '#000000' }
  ];

  const $app = document.getElementById('app');
  const $toast = document.getElementById('toast');

  const state = {
    data: { users: [], assignments: [], students: [], classes: [] },
    user: null,
    assignment: null,
    period: 1,
    classViewMode: localStorage.getItem('encisomath:classViewMode') || 'grid',
    attendanceDate: todayISO(),
    filters: { grade: 'all', area: 'all', course: 'all' },
    prefs: { ...DEFAULT_PREFS, ...(readJSON('encisomath:prefs') || {}) }
  };

  let firstPaint = true;
  let transitionTimer = null;

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
    registerServiceWorker();
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
        ${animatedShapes()}
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
        ${animatedShapes()}
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
          <div class="grid assignments-grid">
            ${filtered.map(assignmentCardHTML).join('') || `<div class="empty">No hay asignaturas con esos filtros.</div>`}
          </div>
        </section>
        ${bottomNav('profe')}
      </main>
    `;

    mount(markup, () => {
      document.getElementById('logoutBtn').addEventListener('click', logout);
      document.getElementById('notifyBtn').addEventListener('click', requestNotificationTest);
      document.getElementById('profileMenuBtn').addEventListener('click', openProfileMenuModal);
      bindFilter('gradeFilter', 'grade', renderTeacherHome);
      bindFilter('areaFilter', 'area', renderTeacherHome);
      bindFilter('courseFilter', 'course', renderTeacherHome);

      document.querySelectorAll('[data-open-assignment]').forEach((button) => {
        button.addEventListener('click', () => {
          const assignment = assignments.find((item) => item.id === button.dataset.openAssignment);
          if (!assignment) return;
          state.assignment = assignment;
          renderSubjectDetail('students');
        });
      });
    });
  }

  function renderSubjectDetail(tab = 'students') {
    const assignment = state.assignment;
    if (!assignment) return renderTeacherHome();
    const coverStyle = coverBackgroundStyle(assignment);
    const iconSrc = getAssignmentIcon(assignment);

    const markup = `
      <main class="screen subject-screen">
        <header class="topbar">
          <button class="icon-btn" id="backBtn" aria-label="Volver">←</button>
          <h1>${escapeHTML(assignment.subject)}</h1>
          <span class="spacer"></span>
          <button class="icon-btn" id="homeBtn" aria-label="Inicio">⌂</button>
        </header>
        <div class="cover animated-cover" ${coverStyle}>${coverMotionHTML('subject')}</div>
        <section class="subject-hero">
          <article class="subject-panel">
            <img class="subject-icon xl" src="${escapeAttr(iconSrc)}" alt="Icono de asignatura" />
            <div class="subject-copy">
              <p class="subject-kicker">${escapeHTML(assignment.area)}</p>
              <h2>${escapeHTML(assignment.subject)}</h2>
              <div class="subject-chips">
                <span>Grado ${escapeHTML(assignment.grade)}-${escapeHTML(assignment.course)}</span>
                <span>${escapeHTML(assignment.sede)}</span>
                <span>${getStudentsForAssignment(assignment).length} estudiantes</span>
              </div>
              <button class="mini-btn visual-btn" id="visualManagerBtn">🎨 Gestor visual</button>
            </div>
          </article>
        </section>
        <div class="tab-row">
          <button class="tab-btn ${tab === 'students' ? 'active' : ''}" id="studentsTab">👥 Estudiantes</button>
          <button class="tab-btn ${tab === 'classes' ? 'active' : ''}" id="classesTab">📚 Clases</button>
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
      document.getElementById('visualManagerBtn').addEventListener('click', openVisualManagerModal);
      if (tab === 'students') renderStudentsTab({ animate: true });
      else renderClassesTab({ animate: true });
    });
  }

  function setSubjectTab(tab) {
    document.getElementById('studentsTab')?.classList.toggle('active', tab === 'students');
    document.getElementById('classesTab')?.classList.toggle('active', tab === 'classes');
    if (tab === 'students') renderStudentsTab({ animate: true });
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
    });
  }

  function openProfileMenuModal() {
    openModal(`
      <div class="modal-card profile-menu-modal">
        <button class="modal-close" data-close-modal aria-label="Cerrar">×</button>
        <p class="section-kicker">Perfil y apariencia</p>
        <h2>Gestionar EncisoMath</h2>
        <div class="settings-group">
          <label class="settings-label" for="accentSelect">Color principal</label>
          <select id="accentSelect" class="select dark-select">
            ${ACCENT_OPTIONS.map((item) => `<option value="${escapeAttr(item.value)}" ${state.prefs.accent === item.value ? 'selected' : ''}>${escapeHTML(item.label)}</option>`).join('')}
          </select>
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
      document.getElementById('accentSelect').addEventListener('change', (event) => updatePreference('accent', event.target.value));
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
    const students = getStudentsForAssignment(assignment);
    const attendance = getAttendance(assignment.id, state.attendanceDate);
    const $content = document.getElementById('tabContent');
    if (!$content) return;

    $content.innerHTML = `
      <div class="date-card">
        <div><strong>Asistencia diaria</strong><br><span class="card-sub">${readableDate(state.attendanceDate)}</span></div>
        <input id="attendanceDate" type="date" value="${state.attendanceDate}" />
      </div>
      <form id="addStudentForm" class="add-box">
        <input class="input" id="newStudentName" placeholder="Nombre del nuevo estudiante" required />
        <button class="primary-btn" type="submit">Añadir</button>
      </form>
      <div class="student-list">
        ${students.map((student) => studentCardHTML(student, attendance[student.id])).join('') || `<div class="empty">Aún no hay estudiantes en este curso.</div>`}
      </div>
    `;

    bindStudentTabEvents();
    if (options.animate) pulseElement($content, 'tab-enter');
  }

  function bindStudentTabEvents() {
    const assignment = state.assignment;
    document.getElementById('attendanceDate').addEventListener('change', (event) => {
      state.attendanceDate = event.target.value || todayISO();
      renderStudentsTab({ animate: true });
    });

    document.getElementById('addStudentForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const name = document.getElementById('newStudentName').value.trim();
      if (!name) return;
      const student = {
        id: `local-${assignment.id}-${Date.now()}`,
        fullName: name,
        username: makeUsername(name),
        photo: './assets/default-avatar.svg',
        grade: assignment.grade,
        course: assignment.course,
        sede: assignment.sede
      };
      const key = `encisomath:addedStudents:${assignment.id}`;
      const list = readJSON(key) || [];
      list.push(student);
      localStorage.setItem(key, JSON.stringify(list));
      toast(`${name} fue añadido a ${assignment.subject} ${assignment.grade}-${assignment.course}.`);
      renderStudentsTab({ animate: true });
    });

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
          <div class="warning-icon" aria-hidden="true"><span class="bang-stick">!</span><span class="bang-dot"></span></div>
          <div>
            <h2>¡OJO! Eliminar estudiante</h2>
            <p>Esta acción sacará al estudiante de este grupo en EncisoMath. Confirma solo si estás completamente seguro.</p>
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
    });
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
    renderStudentsTab({ animate: true });
  }

  function renderClassesTab(options = {}) {
    const assignment = state.assignment;
    const classes = state.data.classes.filter((item) => item.subject === assignment.subject || item.area === assignment.area);
    const periods = [1, 2, 3, 4];
    const filtered = classes.filter((item) => Number(item.period) === Number(state.period));
    const $content = document.getElementById('tabContent');
    if (!$content) return;

    $content.innerHTML = `
      <div class="period-tabs">
        ${periods.map((period) => `<button class="period-btn ${Number(state.period) === period ? 'active' : ''}" data-period="${period}">${period}°</button>`).join('')}
      </div>
      <div class="view-row">
        <strong>Periodo ${state.period}</strong>
        <div>
          <button class="mini-btn ${state.classViewMode === 'grid' ? 'selected' : ''}" id="gridModeBtn">▦ Cuadrícula</button>
          <button class="mini-btn ${state.classViewMode === 'list' ? 'selected' : ''}" id="listModeBtn">☰ Lista</button>
        </div>
      </div>
      <div class="class-grid ${state.classViewMode}-mode">
        ${filtered.map(classCardHTML).join('') || `<div class="empty">Aún no hay clases para este periodo.</div>`}
      </div>
    `;

    document.querySelectorAll('[data-period]').forEach((button) => {
      button.addEventListener('click', () => {
        state.period = Number(button.dataset.period);
        renderClassesTab({ animate: true });
      });
    });
    document.getElementById('gridModeBtn').addEventListener('click', () => setClassViewMode('grid'));
    document.getElementById('listModeBtn').addEventListener('click', () => setClassViewMode('list'));
    document.querySelectorAll('[data-class-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const item = state.data.classes.find((lesson) => lesson.id === button.dataset.classId);
        if (item) renderLesson(item);
      });
    });
    if (options.animate) pulseElement($content, 'tab-enter');
  }

  function renderLesson(lesson) {
    const assignment = state.assignment;
    const src = `${lesson.contentUrl}?v=${Date.now()}&assignment=${encodeURIComponent(assignment.id)}`;
    const markup = `
      <main class="screen class-screen">
        <header class="topbar">
          <button class="icon-btn" id="backBtn" aria-label="Volver">←</button>
          <h1>Clase</h1>
          <span class="spacer"></span>
          <button class="icon-btn" id="homeBtn" aria-label="Inicio">⌂</button>
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
      document.getElementById('homeBtn').addEventListener('click', renderTeacherHome);
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
          <div class="assignment-cover-mini animated-cover" ${coverStyle}>${coverMotionHTML('mini')}</div>
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
    return `<button class="att-btn ${current === status ? 'active' : ''}" data-student-id="${escapeAttr(studentId)}" data-status="${status}" title="${info.label}"><span class="att-emoji">${info.emoji}</span><span class="att-label">${info.label}</span></button>`;
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

  function animatedShapes() {
    return `
      <div class="math-bg" aria-hidden="true">
        <span class="shape circle" style="--w:84px;--h:84px;left:6%;top:8%;--c:#1b96bf;--o:.82;--dx:96px;--dy:180px;--r1:140deg;--dur:7.2s;--delay:-1s"></span>
        <span class="shape triangle" style="--w:76px;--h:70px;left:76%;top:7%;--c:#ffd60a;--o:.84;--dx:-120px;--dy:190px;--r1:-160deg;--dur:8.4s;--delay:-2.4s"></span>
        <span class="shape square outline" style="--w:60px;--h:60px;left:82%;top:68%;--c:#ff4d9d;--o:.8;--dx:-132px;--dy:-220px;--r1:220deg;--dur:7.8s;--delay:-3s"></span>
        <span class="shape rect" style="--w:126px;--h:44px;left:7%;top:80%;--c:#58cc02;--o:.7;--dx:120px;--dy:-260px;--r1:86deg;--dur:9.5s;--delay:-4.3s"></span>
        <span class="shape circle outline" style="--w:48px;--h:48px;left:47%;top:18%;--c:#8b5cf6;--o:.78;--dx:80px;--dy:250px;--r1:180deg;--dur:7.3s;--delay:-5s"></span>
        <span class="shape triangle" style="--w:50px;--h:48px;left:18%;top:55%;--c:#33c7ff;--o:.85;--dx:155px;--dy:-140px;--r1:260deg;--dur:8.6s;--delay:-6s"></span>
        <span class="shape square" style="--w:32px;--h:32px;left:58%;top:78%;--c:#ff4d9d;--o:.82;--dx:-145px;--dy:-165px;--r1:260deg;--dur:6.8s;--delay:-2.5s"></span>
        <span class="shape rect outline" style="--w:96px;--h:36px;left:61%;top:35%;--c:#22d3ee;--o:.75;--dx:105px;--dy:-155px;--r1:-135deg;--dur:10.4s;--delay:-7s"></span>
        <span class="shape circle" style="--w:24px;--h:24px;left:30%;top:28%;--c:#ff9f1c;--o:.9;--dx:170px;--dy:95px;--r1:90deg;--dur:6.2s;--delay:-1.8s"></span>
        <span class="shape square" style="--w:26px;--h:26px;left:89%;top:42%;--c:#ff3b30;--o:.85;--dx:-150px;--dy:155px;--r1:190deg;--dur:7.6s;--delay:-3.7s"></span>
        <span class="shape circle outline" style="--w:36px;--h:36px;left:4%;top:39%;--c:#06b6d4;--o:.8;--dx:126px;--dy:130px;--r1:120deg;--dur:8.7s;--delay:-4.4s"></span>
        <span class="shape triangle outline" style="--w:62px;--h:62px;left:39%;top:62%;--c:#a855f7;--o:.76;--dx:-118px;--dy:-178px;--r1:-210deg;--dur:10.8s;--delay:-5.1s"></span>
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

  function getAssignmentIcon(assignment) {
    return localStorage.getItem(`encisomath:assignmentIcon:${assignment.id}`) || assignment.icon || './assets/subject-statistics.svg';
  }

  function getAssignmentCover(assignment) {
    return localStorage.getItem(`encisomath:assignmentCover:${assignment.id}`) || localStorage.getItem(`encisomath:cover:${assignment.id}`) || '';
  }

  function coverBackgroundStyle(assignment) {
    const cover = getAssignmentCover(assignment);
    if (!cover) return '';
    return `style="background-image: linear-gradient(rgba(4,16,28,.12), rgba(4,16,28,.28)), url('${escapeAttr(cover)}'); background-size: cover; background-position: center;"`;
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
    state.classViewMode = mode;
    localStorage.setItem('encisomath:classViewMode', mode);
    renderClassesTab({ animate: true });
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
    const safeAccent = ACCENT_OPTIONS.some((item) => item.value === state.prefs.accent) ? state.prefs.accent : DEFAULT_PREFS.accent;
    const safeBackground = BACKGROUND_OPTIONS.some((item) => item.value === state.prefs.background) ? state.prefs.background : DEFAULT_PREFS.background;
    state.prefs.accent = safeAccent;
    state.prefs.background = safeBackground;
    document.documentElement.style.setProperty('--maincolor', safeAccent);
    document.documentElement.style.setProperty('--app-bg', safeBackground);
    document.documentElement.style.setProperty('--app-bg-2', safeBackground === '#000000' ? '#050505' : '#071827');
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', safeBackground);
  }

  function updatePreference(key, value) {
    state.prefs[key] = value;
    localStorage.setItem('encisomath:prefs', JSON.stringify(state.prefs));
    applyPreferences();
    toast('Apariencia actualizada.');
  }

  function openModal(markup, afterRender) {
    closeModal(false);
    const wrapper = document.createElement('div');
    wrapper.id = 'modalLayer';
    wrapper.className = 'modal-layer';
    wrapper.innerHTML = markup;
    document.body.appendChild(wrapper);
    requestAnimationFrame(() => wrapper.classList.add('show'));
    wrapper.addEventListener('click', (event) => {
      if (event.target === wrapper || event.target.matches('[data-close-modal]')) closeModal();
    });
    document.addEventListener('keydown', escCloseModal);
    if (typeof afterRender === 'function') afterRender();
  }

  function closeModal(animate = true) {
    const layer = document.getElementById('modalLayer');
    if (!layer) return;
    document.removeEventListener('keydown', escCloseModal);
    if (!animate) {
      layer.remove();
      return;
    }
    layer.classList.remove('show');
    window.setTimeout(() => layer.remove(), 180);
  }

  function escCloseModal(event) {
    if (event.key === 'Escape') closeModal();
  }

  function pulseElement(element, className) {
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
        const registration = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
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

  function makeUsername(name) {
    return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/\s+/).map(part => part.slice(0, 4)).join('').slice(0, 14);
  }

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function escapeAttr(value) {
    return escapeHTML(value);
  }
})();
