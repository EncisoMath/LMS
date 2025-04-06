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
  const grouped = {};

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const grade = data.grade.trim();

    if (!grouped[grade]) {
      grouped[grade] = [];
    }

    grouped[grade].push({
      id: docSnap.id,
      ...data
    });
  });

  const grades = Object.keys(grouped).sort();

  grades.forEach(grade => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td colspan="5" style="text-align:left; background:#ecf0f1; font-weight:bold; cursor:pointer;">
        📁 ${grade}
      </td>
    `;
    tableBody.appendChild(row);

    grouped[grade]
      .sort((a, b) => {
        const lastComp = a.lastname.localeCompare(b.lastname);
        return lastComp !== 0 ? lastComp : a.name.localeCompare(b.name);
      })
      .forEach(data => {
        const tr = document.createElement("tr");
        tr.classList.add("student-row");
        tr.style.display = "none";

        tr.innerHTML = `
          <td>${data.id}</td>
          <td><input type="text" value="${data.name}" class="name-input" disabled /></td>
          <td><input type="text" value="${data.lastname}" class="lastname-input" disabled /></td>
          <td><input type="text" value="${data.grade}" class="grade-input" disabled /></td>
          <td>
            <button class="edit-btn">✏️</button>
            <button class="save-btn" data-id="${data.idFirebase || data.id}">💾</button>
            <button class="delete-btn" data-id="${data.idFirebase || data.id}">🗑️</button>
          </td>
        `;
        tableBody.appendChild(tr);
        tr.dataset.docid = data.id;
      });

    row.addEventListener("click", () => {
      let current = row.nextElementSibling;
      while (current && current.classList.contains("student-row")) {
        current.style.display = current.style.display === "none" ? "table-row" : "none";
        current = current.nextElementSibling;
      }
    });
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
      const id = row.dataset.docid;

      await updateDoc(doc(db, "students", id), {
        name,
        lastname,
        grade
      });
      alert("Estudiante actualizado");
      loadStudents();
    });
  });

  document.querySelectorAll(".edit-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const row = btn.closest("tr");
      row.querySelector(".name-input").disabled = false;
      row.querySelector(".lastname-input").disabled = false;
      row.querySelector(".grade-input").disabled = false;
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
