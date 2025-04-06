// app.js

// Datos de prueba
let students = [];

// Elementos DOM
const registerModal = document.getElementById("registerModal");
const importModal = document.getElementById("importModal");
const nameInput = document.getElementById("nameInput");
const lastnameInput = document.getElementById("lastnameInput");
const gradeInput = document.getElementById("gradeInput");
const studentForm = document.getElementById("studentForm");
const studentList = document.createElement("ul");
studentList.classList.add("student-list");
document.querySelector(".table-container").innerHTML = ""; // Limpiamos la tabla
document.querySelector(".table-container").appendChild(studentList);

// Mostrar / ocultar modales
function toggleModal(id, show) {
  const modal = document.getElementById(id);
  if (show) {
    modal.classList.add("show");
  } else {
    modal.classList.remove("show");
  }
}

// Abrir modales desde botones flotantes
document.getElementById("openRegisterModal").addEventListener("click", () => {
  toggleModal("registerModal", true);
});

document.getElementById("openImportModal").addEventListener("click", () => {
  toggleModal("importModal", true);
});

// Registrar nuevo estudiante
studentForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  const lastname = lastnameInput.value.trim();
  const grade = gradeInput.value.trim();

  if (name && lastname && grade) {
    students.push({ name, lastname, grade });
    renderStudents();
    studentForm.reset();
    toggleModal("registerModal", false);
  }
});

// Importar CSV
document.getElementById("importBtn").addEventListener("click", () => {
  const fileInput = document.getElementById("csvInput");
  const file = fileInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const lines = e.target.result.split("\n");
    for (let i = 1; i < lines.length; i++) {
      const [name, lastname, grade] = lines[i].split(",");
      if (name && lastname && grade) {
        students.push({ name: name.trim(), lastname: lastname.trim(), grade: grade.trim() });
      }
    }
    renderStudents();
    toggleModal("importModal", false);
  };
  reader.readAsText(file);
});

// Mostrar lista de estudiantes
function renderStudents() {
  studentList.innerHTML = "";

  students.forEach((student, index) => {
    const li = document.createElement("li");
    li.className = "student-item";
    li.innerHTML = `
      <span>${student.name} ${student.lastname}</span>
      <div class="student-actions">
        <button class="edit-btn" onclick="editStudent(${index})"><i class="fas fa-edit"></i></button>
        <button class="delete-btn" onclick="deleteStudent(${index})"><i class="fas fa-trash"></i></button>
      </div>
    `;

    li.addEventListener("click", function () {
      // Cerrar otros activos
      document.querySelectorAll(".student-item").forEach(item => item.classList.remove("active"));
      this.classList.toggle("active");
    });

    studentList.appendChild(li);
  });
}

// Editar estudiante
window.editStudent = function (index) {
  const student = students[index];
  nameInput.value = student.name;
  lastnameInput.value = student.lastname;
  gradeInput.value = student.grade;

  toggleModal("registerModal", true);

  // Reemplazar evento de guardar
  studentForm.onsubmit = function (e) {
    e.preventDefault();
    students[index] = {
      name: nameInput.value.trim(),
      lastname: lastnameInput.value.trim(),
      grade: gradeInput.value.trim(),
    };
    renderStudents();
    studentForm.reset();
    studentForm.onsubmit = defaultSubmit;
    toggleModal("registerModal", false);
  };
};

// Eliminar estudiante
window.deleteStudent = function (index) {
  if (confirm("¿Seguro que deseas eliminar este estudiante?")) {
    students.splice(index, 1);
    renderStudents();
  }
};

// Restaurar evento original del formulario
function defaultSubmit(e) {
  e.preventDefault();
  const name = nameInput.value.trim();
  const lastname = lastnameInput.value.trim();
  const grade = gradeInput.value.trim();

  if (name && lastname && grade) {
    students.push({ name, lastname, grade });
    renderStudents();
    studentForm.reset();
    toggleModal("registerModal", false);
  }
}
studentForm.onsubmit = defaultSubmit;
