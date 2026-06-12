(() => {
  'use strict';

  const APP_VERSION = '0.3.0';
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
          window.setTimeout(() => renderTeacherHome(), 900);
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
    if (firstPaint || options.instant) {
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
              <span>Último usuario:</span>
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
        }, 950);
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
      <main class="screen">
        <div class="cover"></div>
        <section class="profile-row">
          <img class="avatar" src="${escapeAttr(teacher.photo || './assets/default-avatar.svg')}" alt="Foto de perfil" />
          <div class="welcome">
            <div class="welcome-kicker">Bienvenido</div>
            <h2>${escapeHTML(teacher.fullName)}</h2>
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

    mount(markup, () => {
      document.getElementById('logoutBtn').addEventListener('click', logout);
      document.getElementById('notifyBtn').addEventListener('click', requestNotificationTest);
      document.getElementById('manageProfileBtn').addEventListener('click', () => toast('Perfil local listo. En una siguiente fase conectamos edición completa.'));
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

      document.querySelectorAll('[data-manage-assignment]').forEach((button) => {
        button.addEventListener('click', () => {
          const assignment = assignments.find((item) => item.id === button.dataset.manageAssignment);
          if (!assignment) return;
          state.assignment = assignment;
          renderSubjectManager('home');
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
            <img class="subject-icon" src="${escapeAttr(iconSrc)}" alt="Icono de asignatura" />
            <div>
              <div class="subject-line1">${escapeHTML(assignment.subject)}</div>
              <div class="subject-line2">Grado ${escapeHTML(assignment.grade)}-${escapeHTML(assignment.course)} · ${escapeHTML(assignment.sede)} · ${getStudentsForAssignment(assignment).length} estudiantes · ${escapeHTML(assignment.area)}</div>
              <div class="subject-actions">
                <button class="mini-btn" id="visualManagerBtn">🎨 Gestor visual</button>
              </div>
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

    mount(markup, () => {
      document.getElementById('backBtn').addEventListener('click', renderTeacherHome);
      document.getElementById('homeBtn').addEventListener('click', renderTeacherHome);
      document.getElementById('studentsTab').addEventListener('click', () => renderSubjectDetail('students'));
      document.getElementById('classesTab').addEventListener('click', () => renderSubjectDetail('classes'));
      document.getElementById('visualManagerBtn').addEventListener('click', () => renderSubjectManager('subject'));
      if (tab === 'students') renderStudentsTab();
      else renderClassesTab();
    });
  }

  function renderSubjectManager(backTarget = 'subject') {
    const assignment = state.assignment;
    if (!assignment) return renderTeacherHome();
    const iconSrc = getAssignmentIcon(assignment);
    const coverStyle = coverBackgroundStyle(assignment);
    const back = backTarget === 'home' ? renderTeacherHome : () => renderSubjectDetail('students');

    const markup = `
      <main class="screen">
        <header class="topbar">
          <button class="icon-btn" id="backBtn" aria-label="Volver">←</button>
          <h1>Gestor visual</h1>
          <span class="spacer"></span>
          <button class="icon-btn" id="homeBtn" aria-label="Inicio">⌂</button>
        </header>
        <section class="section">
          <h1 class="section-title">${escapeHTML(assignment.subject)} ${escapeHTML(assignment.grade)}-${escapeHTML(assignment.course)}</h1>
          <div class="manager-grid">
            <article class="manager-card">
              <h2>Portada de la asignatura</h2>
              <p>Esta imagen aparece arriba en la vista de la asignatura y como franja en la cuadrícula.</p>
              <div class="manager-preview-cover" ${coverStyle}></div>
              <div class="manager-actions" style="margin-top:12px">
                <label class="primary-btn">Cambiar portada<input id="coverInput" type="file" accept="image/*" hidden /></label>
                <button class="danger-btn" id="resetCoverBtn">Restablecer</button>
              </div>
            </article>
            <article class="manager-card">
              <h2>Icono de la asignatura</h2>
              <p>Úsalo para diferenciar rápido cada carga académica.</p>
              <img class="manager-preview-icon" src="${escapeAttr(iconSrc)}" alt="Icono actual" />
              <div class="manager-actions">
                <label class="primary-btn">Cambiar icono<input id="iconInput" type="file" accept="image/*,.svg" hidden /></label>
                <button class="danger-btn" id="resetIconBtn">Restablecer</button>
              </div>
            </article>
          </div>
        </section>
      </main>
    `;

    mount(markup, () => {
      document.getElementById('backBtn').addEventListener('click', back);
      document.getElementById('homeBtn').addEventListener('click', renderTeacherHome);
      document.getElementById('coverInput').addEventListener('change', (event) => saveImageOverride(event, 'cover', backTarget));
      document.getElementById('iconInput').addEventListener('change', (event) => saveImageOverride(event, 'icon', backTarget));
      document.getElementById('resetCoverBtn').addEventListener('click', () => resetAssignmentVisual('cover', backTarget));
      document.getElementById('resetIconBtn').addEventListener('click', () => resetAssignmentVisual('icon', backTarget));
    });
  }

  function renderStudentsTab() {
    const assignment = state.assignment;
    const students = getStudentsForAssignment(assignment);
    const attendance = getAttendance(assignment.id, state.attendanceDate);
    const $content = document.getElementById('tabContent');
    $content.classList.remove('tab-enter');
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

    void $content.offsetWidth;
    $content.classList.add('tab-enter');

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
    $content.classList.remove('tab-enter');
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

    void $content.offsetWidth;
    $content.classList.add('tab-enter');

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
        <button class="assignment-manage" data-manage-assignment="${escapeAttr(item.id)}" aria-label="Gestionar ${escapeAttr(item.subject)} ${escapeAttr(item.grade)}-${escapeAttr(item.course)}">⚙️</button>
        <button class="assignment-open" data-open-assignment="${escapeAttr(item.id)}">
          <div class="assignment-cover-mini" ${coverStyle}></div>
          <div class="assignment-body">
            <div class="assignment-head">
              <img class="subject-icon" src="${escapeAttr(iconSrc)}" alt="" />
              <div>
                <div class="kicker">${escapeHTML(item.area)}</div>
                <div class="card-title">${escapeHTML(item.subject)}</div>
                <div class="card-sub">${escapeHTML(item.grade)}-${escapeHTML(item.course)} · ${escapeHTML(item.sede)}</div>
              </div>
            </div>
            <span class="badge">${getStudentsForAssignment(item).length} estudiantes</span>
          </div>
        </button>
      </article>
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
        <span class="shape circle" style="--w:84px;--h:84px;left:6%;top:8%;--c:#0a84ff;--o:.78;--dx:96px;--dy:180px;--r1:140deg;--dur:7.2s;--delay:-1s"></span>
        <span class="shape triangle" style="--w:76px;--h:70px;left:76%;top:7%;--c:#ffd60a;--o:.82;--dx:-120px;--dy:190px;--r1:-160deg;--dur:8.4s;--delay:-2.4s"></span>
        <span class="shape square outline" style="--w:60px;--h:60px;left:82%;top:68%;--c:#ff4d9d;--o:.8;--dx:-132px;--dy:-220px;--r1:220deg;--dur:7.8s;--delay:-3s"></span>
        <span class="shape rect" style="--w:126px;--h:44px;left:7%;top:80%;--c:#34c759;--o:.68;--dx:120px;--dy:-260px;--r1:86deg;--dur:9.5s;--delay:-4.3s"></span>
        <span class="shape circle outline" style="--w:48px;--h:48px;left:47%;top:18%;--c:#8b5cf6;--o:.78;--dx:80px;--dy:250px;--r1:180deg;--dur:7.3s;--delay:-5s"></span>
        <span class="shape triangle" style="--w:50px;--h:48px;left:18%;top:55%;--c:#33c7ff;--o:.85;--dx:155px;--dy:-140px;--r1:260deg;--dur:8.6s;--delay:-6s"></span>
        <span class="shape square" style="--w:32px;--h:32px;left:58%;top:78%;--c:#ff4d9d;--o:.82;--dx:-145px;--dy:-165px;--r1:260deg;--dur:6.8s;--delay:-2.5s"></span>
        <span class="shape rect outline" style="--w:96px;--h:36px;left:61%;top:35%;--c:#22d3ee;--o:.75;--dx:105px;--dy:-155px;--r1:-135deg;--dur:10.4s;--delay:-7s"></span>
        <span class="shape circle" style="--w:24px;--h:24px;left:30%;top:28%;--c:#ff9f1c;--o:.9;--dx:170px;--dy:95px;--r1:90deg;--dur:6.2s;--delay:-1.8s"></span>
        <span class="shape square" style="--w:26px;--h:26px;left:89%;top:42%;--c:#ff3b30;--o:.85;--dx:-150px;--dy:155px;--r1:190deg;--dur:7.6s;--delay:-3.7s"></span>
        <span class="shape circle outline" style="--w:36px;--h:36px;left:4%;top:39%;--c:#06b6d4;--o:.8;--dx:126px;--dy:130px;--r1:120deg;--dur:8.7s;--delay:-4.4s"></span>
        <span class="shape triangle outline" style="--w:62px;--h:62px;left:39%;top:62%;--c:#a855f7;--o:.76;--dx:-118px;--dy:-178px;--r1:-210deg;--dur:10.8s;--delay:-5.1s"></span>
        <span class="shape rect" style="--w:82px;--h:28px;left:37%;top:8%;--c:#00f5d4;--o:.72;--dx:140px;--dy:250px;--r1:160deg;--dur:9.2s;--delay:-2.2s"></span>
        <span class="shape square outline" style="--w:44px;--h:44px;left:16%;top:20%;--c:#ffbe0b;--o:.7;--dx:200px;--dy:215px;--r1:300deg;--dur:8.1s;--delay:-6.4s"></span>
        <span class="shape circle" style="--w:58px;--h:58px;left:70%;top:78%;--c:#7c3aed;--o:.62;--dx:-175px;--dy:-230px;--r1:-120deg;--dur:10.2s;--delay:-8s"></span>
        <span class="shape triangle" style="--w:38px;--h:36px;left:51%;top:47%;--c:#fb7185;--o:.82;--dx:-100px;--dy:170px;--r1:210deg;--dur:7s;--delay:-4.8s"></span>
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

  function getAssignmentIcon(assignment) {
    return localStorage.getItem(`encisomath:assignmentIcon:${assignment.id}`) || assignment.icon || './assets/subject-statistics.svg';
  }

  function getAssignmentCover(assignment) {
    return localStorage.getItem(`encisomath:assignmentCover:${assignment.id}`) || localStorage.getItem(`encisomath:cover:${assignment.id}`) || '';
  }

  function coverBackgroundStyle(assignment) {
    const cover = getAssignmentCover(assignment);
    if (!cover) return '';
    return `style="background-image: linear-gradient(rgba(6,37,63,.16), rgba(6,37,63,.24)), url('${escapeAttr(cover)}'); background-size: cover; background-position: center;"`;
  }

  function saveImageOverride(event, type, backTarget) {
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
        renderSubjectManager(backTarget);
      } catch (error) {
        toast('No se pudo guardar. Usa una imagen más liviana.');
      }
    };
    reader.readAsDataURL(file);
  }

  function resetAssignmentVisual(type, backTarget) {
    if (!state.assignment) return;
    if (type === 'cover') {
      localStorage.removeItem(`encisomath:assignmentCover:${state.assignment.id}`);
      localStorage.removeItem(`encisomath:cover:${state.assignment.id}`);
      toast('Portada restablecida.');
    } else {
      localStorage.removeItem(`encisomath:assignmentIcon:${state.assignment.id}`);
      toast('Icono restablecido.');
    }
    renderSubjectManager(backTarget);
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
