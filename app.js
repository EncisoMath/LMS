import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const studentsCollection = collection(db, "students");
const tableBody = document.querySelector("#studentsTable tbody");
const form = document.getElementById("studentForm");
const csvInput = document.getElementById("csvInput");
const importBtn = document.getElementById("importBtn");

// Mostrar / Ocultar modales
function toggleModal(id, show = true) {
  document.getElementById(id).classList.toggle("show", show);
}

document.getElementById("openRegisterModal").addEventListener("click", () => toggleModal("registerModal", true));
document.getElementById("openImportModal").addEventListener("click", () => toggleModal("importModal", true));

// Generar ID aleatorio
function generarID() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Cargar estudiantes
async function loadStudents() {
  tableBody.innerHTML = "";

  const snapshot = await getDocs(studentsCollection);
  const data = [];

  snapshot.forEach(docSnap => {
    const student = docSnap.data();
    data.push({ ...student, firebaseId: docSnap.id });
  });

  // Agrupar por grado
  const grouped = {};
  data.forEach(student => {
    if (!grouped[student.grade]) grouped[student.grade] = [];
    grouped[student.grade].push(student);
  });

  const grades = Object.keys(grouped).sort();

  grades.forEach(grade => {
    const students = grouped[grade].sort((a, b) => {
      const lastA = a.lastname.toLowerCase();
      const lastB = b.lastname.toLowerCase();
      if (lastA === lastB) return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      return lastA.localeCompare(lastB);
    });

    const headerRow = document.createElement("tr");
    headerRow.innerHTML = `<td colspan="5" style="background:#dbeafe; font-weight:bold;">Grado ${grade}</td>`;
    tableBody.appendChild(headerRow);

    students.forEach(s => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${s.id}</td>
        <td><input type="text" value="${s.name}" class="name-input" disabled /></td>
        <td><input type="text" value="${s.lastname}" class="lastname-input" disabled /></td>
        <td><input type="text" value="${s.grade}" class="grade-input" disabled /></td>
        <td>
          <button class="edit-btn" data-id="${s.firebaseId}">✏️</button>
          <button class="save-btn" data-id="${s.firebaseId}" style="display:none;">💾</button>
          <button class="delete-btn" data-id="${s.firebaseId}">🗑️</button>
        </td>
      `;
      tableBody.appendChild(tr);
    });
  });

  addEventListeners();
}

// Agregar eventos a botones
function addEventListeners() {
  document.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (confirm("¿Estás seguro de eliminar este estudiante?")) {
        await deleteDoc(doc(db, "students", btn.dataset.id));
        loadStudents();
      }
    });
  });

  document.querySelectorAll(".edit-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const row = btn.closest("tr");
      row.querySelectorAll("input").forEach(input => input.disabled = false);
      row.querySelector(".save-btn").style.display = "inline-block";
      btn.style.display = "none";
    });
  });

  document.querySelectorAll(".save-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const row = btn.closest("tr");
      const name = row.querySelector(".name-input").value.trim();
      const lastname = row.querySelector(".lastname-input").value.trim();
      const grade = row.querySelector(".grade-input").value.trim();

      if (!name || !lastname || !grade) {
        alert("Todos los campos son obligatorios.");
        return;
      }

      await updateDoc(doc(db, "students", btn.dataset.id), {
        name, lastname, grade
      });

      alert("Estudiante actualizado correctamente.");
      loadStudents();
    });
  });
}

// Registrar estudiante nuevo
form.addEventListener("submit", async e => {
  e.preventDefault();

  const name = document.getElementById("nameInput").value.trim();
  const lastname = document.getElementById("lastnameInput").value.trim();
  const grade = document.getElementById("gradeInput").value.trim();
  const id = generarID();

  if (!name || !lastname || !grade) {
    alert("Todos los campos son obligatorios.");
    return;
  }

  await addDoc(studentsCollection, { id, name, lastname, grade });

  form.reset();
  toggleModal("registerModal", false);
  loadStudents();
});

// Importar CSV
importBtn.addEventListener("click", () => {
  const file = csvInput.files[0];
  if (!file) {
    alert("Selecciona un archivo CSV primero.");
    return;
  }

  const reader = new FileReader();
  reader.onload = async function (e) {
    const lines = e.target.result.split("\n");
    for (let line of lines) {
      const [id, name, lastname, grade] = line.trim().split(",");

      if (id && name && lastname && grade) {
        await addDoc(studentsCollection, { id, name, lastname, grade });
      }
    }
    alert("Importación completada.");
    toggleModal("importModal", false);
    loadStudents();
  };
  reader.readAsText(file);
});

loadStudents();
