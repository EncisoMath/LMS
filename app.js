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
const form = document.getElementById("studentForm");
const tableBody = document.querySelector("#studentsTable tbody");
const csvInput = document.getElementById("csvInput");
const importBtn = document.getElementById("importBtn");

function generarID() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

async function loadStudents() {
  tableBody.innerHTML = "";
  const snapshot = await getDocs(studentsCollection);
  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${data.id}</td>
      <td><input type="text" value="${data.name}" class="name-input" /></td>
      <td><input type="text" value="${data.lastname}" class="lastname-input" /></td>
      <td><input type="text" value="${data.grade}" class="grade-input" /></td>
      <td>
        <button class="save-btn" data-id="${docSnap.id}">💾</button>
        <button class="delete-btn" data-id="${docSnap.id}">🗑️</button>
      </td>
    `;
    tableBody.appendChild(tr);
  });

  document.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      await deleteDoc(doc(db, "students", btn.dataset.id));
      loadStudents();
    });
  });

  document.querySelectorAll(".save-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const row = btn.closest("tr");
      const name = row.querySelector(".name-input").value.trim();
      const lastname = row.querySelector(".lastname-input").value.trim();
      const grade = row.querySelector(".grade-input").value.trim();

      await updateDoc(doc(db, "students", btn.dataset.id), {
        name,
        lastname,
        grade
      });
      alert("Estudiante actualizado");
      loadStudents();
    });
  });
}

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

  await addDoc(studentsCollection, {
    id,
    name,
    lastname,
    grade
  });

  form.reset();
  loadStudents();
});

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
        await addDoc(studentsCollection, {
          id,
          name,
          lastname,
          grade
        });
      }
    }
    alert("Importación completada.");
    loadStudents();
  };
  reader.readAsText(file);
});

loadStudents();
