(() => {
  'use strict';

  const APP_VERSION = '0.1.0';
  const DATA_FILES = {
    users: './data/users.json',
    assignments: './data/assignments.json',
    students: './data/students.json',
    classes: './data/classes.json'
  };

  const $app = document.getElementById('app');
  const $toast = document.getElementById('toast');

  const state = {
    data: { users: [], assignments: [], students: [], classes: [] },
    user: null,
    assignment: null,
    period: 1,
    classViewMode: localStorage.getItem('encisomath:classViewMode') || 'grid',
    attendanceDate: todayISO(),
    filters: { grade: 'all', area: 'all', course: 'all' }
  };

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
    registerServiceWorker();
    renderLoading('Preparando EncisoMath...');
    try {
      state.data = await loadAllData();
      const session = readJSON('encisomath:session');
      if (session?.remember && session?.userId) {
        const user = findUser(session.userId);
        if (user) {
          state.user = user;
          renderLoading(randomPhrase());
          window.setTimeout(() => renderTeacherHome(), 700);
          return;
        }
      }
      renderLogin();
    } catch (error) {
      console.error(error);
      $app.innerHTML = `<main class="screen mobile-pad"><h1>No se pudo cargar EncisoMath</h1><p class="card-sub">Revisa que los archivos JSON existan en la carpeta <strong>data</strong>.</p><button class="primary-btn" onclick="location.reload()">Reintentar</button></main>`;
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

  function renderLogin() {
    const last = readJSON('encisomath:lastUser');
    $app.innerHTML = `
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
              <span>Último usuario:</span>
              <button type="button" class="mini-btn" id="lastUserBtn">${last ? `${escapeHTML(last.name)} · ${escapeHTML(last.id)}` : 'Sin registro'}</button>
            </div>
            <p class="login-hint">Demo inicial: docente <strong>0720</strong>. Luego se cambian los usuarios en <strong>data/users.json</strong>.</p>
          </form>
        </section>
      </main>
    `;

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
      renderLoading(randomPhrase());
      window.setTimeout(() => {
        if (user.role === 'teacher') renderTeacherHome();
        else renderStudentPlaceholder();
      }, 850);
    });
  }

  function renderLoading(text = randomPhrase()) {
    $app.innerHTML = `
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

    $app.innerHTML = `
      <main class="screen">
        <div class="cover"></div>
        <section class="profile-row">
          <img class="avatar" src="${escapeAttr(teacher.photo || './assets/default-avatar.svg')}" alt="Foto de perfil" />
          <div class="welcome">
            <h2>Bienvenido, ${escapeHTML(teacher.fullName)}</h2>
            <p>${assignments.length} cargas asignadas · Docente</p>
          </div>
        </section>
        <div class="actions-row">
          <button class="primary-btn" id="manageProfileBtn">🪪 Gestionar perfil</button>
          <button class="ghost-btn" id="notifyBtn">🔔 Notificaciones</button>
          <button class="ghost-btn" id="logoutBtn">↩ Cerrar sesión</button>
        </div>
        <section class="section">
          <h1 class="section-title">Asignaturas</h1>
          <div class="filter-row three">
            ${selectHTML('gradeFilter', 'Grado', grades, state.filters.grade)}
            ${selectHTML('areaFilter', 'Área', areas, state.filters.area)}
            ${selectHTML('courseFilter', 'Curso', courses, state.filters.course)}
          </div>
          <div class="grid">
            ${filtered.map(assignmentCardHTML).join('') || `<div class="empty">No hay asignaturas con esos filtros.</div>`}
          </div>
        </section>
        ${bottomNav('profe')}
      </main>
    `;

    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('notifyBtn').addEventListener('click', requestNotificationTest);
    document.getElementById('manageProfileBtn').addEventListener('click', () => toast('Perfil local listo. En una siguiente fase se conectan edición y respaldo.'));
    bindFilter('gradeFilter', 'grade', renderTeacherHome);
    bindFilter('areaFilter', 'area', renderTeacherHome);
    bindFilter('courseFilter', 'course', renderTeacherHome);
    document.querySelectorAll('[data-assignment-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const assignment = assignments.find((item) => item.id === button.dataset.assignmentId);
        if (!assignment) return;
        state.assignment = assignment;
        renderSubjectDetail('students');
      });
    });
  }

  function renderSubjectDetail(tab = 'students') {
    const assignment = state.assignment;
    if (!assignment) return renderTeacherHome();
    const coverOverride = localStorage.getItem(`encisomath:cover:${assignment.id}`);
    const coverStyle = coverOverride ? `style="background-image: linear-gradient(rgba(6,47,79,.18), rgba(6,47,79,.28)), url('${coverOverride}'); background-size: cover; background-position: center;"` : '';

    $app.innerHTML = `
      <main class="screen">
        <header class="topbar">
          <button class="icon-btn" id="backBtn" aria-label="Volver">←</button>
          <h1>${escapeHTML(assignment.subject)}</h1>
          <span class="spacer"></span>
          <button class="icon-btn" id="homeBtn" aria-label="Inicio">⌂</button>
        </header>
        <div class="cover" ${coverStyle}></div>
        <section class="subject-hero">
          <article class="subject-panel">
            <img class="subject-icon" src="${escapeAttr(assignment.icon || './assets/subject-statistics.svg')}" alt="Icono de asignatura" />
            <div>
              <div class="subject-line1">${escapeHTML(assignment.subject)}</div>
              <div class="subject-line2">Grado ${escapeHTML(assignment.grade)}-${escapeHTML(assignment.course)} · ${escapeHTML(assignment.sede)} · ${getStudentsForAssignment(assignment).length} estudiantes · ${escapeHTML(assignment.area)}</div>
              <label class="mini-btn" style="display:inline-flex;margin-top:10px;align-items:center;gap:6px;">
                🎨 Personalizar portada
                <input id="coverInput" type="file" accept="image/*" hidden />
              </label>
            </div>
          </article>
        </section>
        <div class="tab-row">
          <button class="tab-btn ${tab === 'students' ? 'active' : ''}" id="studentsTab">👥 Estudiantes</button>
          <button class="tab-btn ${tab === 'classes' ? 'active' : ''}" id="classesTab">📚 Clases</button>
        </div>
        <section id="tabContent" class="section"></section>
      </main>
    `;

    document.getElementById('backBtn').addEventListener('click', renderTeacherHome);
    document.getElementById('homeBtn').addEventListener('click', renderTeacherHome);
    document.getElementById('studentsTab').addEventListener('click', () => renderSubjectDetail('students'));
    document.getElementById('classesTab').addEventListener('click', () => renderSubjectDetail('classes'));
    document.getElementById('coverInput').addEventListener('change', saveCoverOverride);

    if (tab === 'students') renderStudentsTab();
    else renderClassesTab();
  }

  function renderStudentsTab() {
    const assignment = state.assignment;
    const students = getStudentsForAssignment(assignment);
    const attendance = getAttendance(assignment.id, state.attendanceDate);
    const $content = document.getElementById('tabContent');
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

    document.getElementById('attendanceDate').addEventListener('change', (event) => {
      state.attendanceDate = event.target.value || todayISO();
      renderStudentsTab();
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
      renderStudentsTab();
    });

    document.querySelectorAll('[data-student-id][data-status]').forEach((button) => {
      button.addEventListener('click', () => {
        const studentId = button.dataset.studentId;
        const status = button.dataset.status;
        const current = getAttendance(assignment.id, state.attendanceDate);
        current[studentId] = status;
        saveAttendance(assignment.id, state.attendanceDate, current);
        renderStudentsTab();
      });
    });
  }

  function renderClassesTab() {
    const assignment = state.assignment;
    const classes = state.data.classes.filter((item) => item.subject === assignment.subject || item.area === assignment.area);
    const periods = [1, 2, 3, 4];
    const filtered = classes.filter((item) => Number(item.period) === Number(state.period));
    const $content = document.getElementById('tabContent');
    $content.innerHTML = `
      <div class="period-tabs">
        ${periods.map((period) => `<button class="period-btn ${Number(state.period) === period ? 'active' : ''}" data-period="${period}">${period}°</button>`).join('')}
      </div>
      <div class="view-row">
        <strong>Periodo ${state.period}</strong>
        <div>
          <button class="mini-btn" id="gridModeBtn">▦ Cuadrícula</button>
          <button class="mini-btn" id="listModeBtn">☰ Lista</button>
        </div>
      </div>
      <div class="class-grid ${state.classViewMode}-mode">
        ${filtered.map(classCardHTML).join('') || `<div class="empty">Aún no hay clases para este periodo.</div>`}
      </div>
    `;

    document.querySelectorAll('[data-period]').forEach((button) => {
      button.addEventListener('click', () => {
        state.period = Number(button.dataset.period);
        renderClassesTab();
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
  }

  function renderLesson(lesson) {
    const assignment = state.assignment;
    const src = `${lesson.contentUrl}?v=${Date.now()}&assignment=${encodeURIComponent(assignment.id)}`;
    $app.innerHTML = `
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
    document.getElementById('backBtn').addEventListener('click', () => renderSubjectDetail('classes'));
    document.getElementById('homeBtn').addEventListener('click', renderTeacherHome);
  }

  function renderStudentPlaceholder() {
    $app.innerHTML = `<main class="screen mobile-pad"><h1>Vista estudiante</h1><p>La primera fase está centrada en docentes. La vista estudiante se conecta después con las clases y actividades.</p><button class="primary-btn" id="logoutBtn">Cerrar sesión</button></main>`;
    document.getElementById('logoutBtn').addEventListener('click', logout);
  }

  function assignmentCardHTML(item) {
    return `
      <button class="assignment-card" data-assignment-id="${escapeAttr(item.id)}">
        <img class="subject-icon" src="${escapeAttr(item.icon || './assets/subject-statistics.svg')}" alt="" />
        <div>
          <div class="kicker">${escapeHTML(item.area)}</div>
          <div class="card-title">${escapeHTML(item.subject)}</div>
          <div class="card-sub">${escapeHTML(item.grade)}-${escapeHTML(item.course)} · ${escapeHTML(item.sede)}</div>
        </div>
      </button>
    `;
  }

  function studentCardHTML(student, status) {
    const statusInfo = statusMap[status] || null;
    return `
      <article class="student-card ${statusInfo ? statusInfo.className : ''}">
        <div class="student-main">
          <img class="student-photo" src="${escapeAttr(student.photo || './assets/default-avatar.svg')}" alt="Foto de ${escapeAttr(student.fullName)}" />
          <div>
            <div class="student-name">${escapeHTML(student.fullName)}</div>
            <div class="student-meta">🆔 ${escapeHTML(student.id)} · ${escapeHTML(student.username || '')}</div>
            <div class="student-meta">📅 Asistencia: ${statusInfo ? `${statusInfo.emoji} ${statusInfo.label}` : 'Sin marcar'}</div>
          </div>
        </div>
        <div class="attendance-buttons">
          ${attendanceButtonHTML(student.id, 'absent', status)}
          ${attendanceButtonHTML(student.id, 'excused', status)}
          ${attendanceButtonHTML(student.id, 'present', status)}
        </div>
      </article>
    `;
  }

  function attendanceButtonHTML(studentId, status, current) {
    const info = statusMap[status];
    return `<button class="att-btn ${current === status ? 'active' : ''}" data-student-id="${escapeAttr(studentId)}" data-status="${status}" title="${info.label}">${info.emoji}</button>`;
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
        <button class="nav-item ${active === 'perfil' ? 'active' : ''}" onclick="window.EncisoMathNav.profile()"><span class="nav-icon">👤</span><span>Perfil</span></button>
      </nav>
    `;
  }

  window.EncisoMathNav = {
    home: () => renderTeacherHome(),
    profile: () => toast('Perfil docente: editable en una siguiente iteración.')
  };

  function animatedShapes() {
    return `
      <div class="math-bg" aria-hidden="true">
        <span class="shape circle" style="width:72px;height:72px;left:8%;top:9%;animation-delay:-1s"></span>
        <span class="shape triangle" style="left:72%;top:12%;animation-delay:-2s"></span>
        <span class="shape square" style="width:54px;height:54px;left:82%;top:68%;animation-delay:-3s"></span>
        <span class="shape rect" style="width:94px;height:46px;left:9%;top:78%;animation-delay:-4s"></span>
        <span class="shape circle" style="width:42px;height:42px;left:48%;top:18%;animation-delay:-5s"></span>
        <span class="shape triangle" style="left:18%;top:55%;animation-delay:-6s;transform:scale(.6)"></span>
      </div>
    `;
  }

  function getTeacherAssignments(teacherId) {
    return state.data.assignments.filter((item) => item.teacherId === teacherId);
  }

  function getStudentsForAssignment(assignment) {
    const base = state.data.students.filter((student) => {
      return student.grade === assignment.grade && student.course === assignment.course && student.sede === assignment.sede;
    });
    const added = readJSON(`encisomath:addedStudents:${assignment.id}`) || [];
    return [...base, ...added].sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));
  }

  function getAttendance(assignmentId, date) {
    return readJSON(`encisomath:attendance:${assignmentId}:${date}`) || {};
  }

  function saveAttendance(assignmentId, date, attendance) {
    localStorage.setItem(`encisomath:attendance:${assignmentId}:${date}`, JSON.stringify(attendance));
  }

  function saveCoverOverride(event) {
    const file = event.target.files?.[0];
    if (!file || !state.assignment) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        localStorage.setItem(`encisomath:cover:${state.assignment.id}`, reader.result);
        toast('Portada personalizada guardada en este dispositivo.');
        renderSubjectDetail('students');
      } catch (error) {
        toast('La imagen es muy pesada para guardarla localmente. Prueba una más liviana.');
      }
    };
    reader.readAsDataURL(file);
  }

  function setClassViewMode(mode) {
    state.classViewMode = mode;
    localStorage.setItem('encisomath:classViewMode', mode);
    renderClassesTab();
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
