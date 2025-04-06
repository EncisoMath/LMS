const form = document.getElementById('student-form');
const studentsList = document.getElementById('students-list');

function getStudents() {
  return JSON.parse(localStorage.getItem('students')) || [];
}

function saveStudents(students) {
  localStorage.setItem('students', JSON.stringify(students));
}

function renderStudents() {
  const students = getStudents();
  studentsList.innerHTML = '';
  students.forEach((s, index) => {
    const div = document.createElement('div');
    div.className = 'student-card';
    div.innerHTML = `<strong>${s.name}</strong> - Grado: ${s.grade}`;
    studentsList.appendChild(div);
  });
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('name').value.trim();
  const grade = document.getElementById('grade').value.trim();
  if (!name || !grade) return;

  const students = getStudents();
  students.push({ name, grade });
  saveStudents(students);
  form.reset();
  renderStudents();
});

// Cargar estudiantes al iniciar
renderStudents();
