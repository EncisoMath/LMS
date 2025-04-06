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
  const students = [];

  snapshot.forEach(docSnap => {
    students.push({ id: docSnap.id, ...docSnap.data() });
  });

  // Agrupar por grado y ordenar
  const grouped = {};
  students.forEach(s => {
    if (!grouped[s.grade]) grouped[s.grade] = [];
    grouped[s.grade].push(s);
  });

  for (const grade in grouped) {
    const gradeRow = document.createElement("tr");
    gradeRow.innerHTML = `<td colspan="5" style="background:#ddd; font-weight:bold; cursor:pointer;">${grade}</td>`;
    gradeRow.classList.add("grade-header");
    tableBody.appendChild(gradeRow);

    grouped[grade]
      .sort((a, b) => a.lastname.localeCompare(b.lastname) || a.name.localeCompare(b.name))
      .forEach(data => {
        const tr = document.createElement("tr");
        tr.classList.add("student-row");

        tr.innerHTML = `
          <td>${data.id}</td>
          <td><input type="text" value="${data.name}" class="name-input" disabled /></td>
          <td><input type="text" value="${data.lastname}" class="lastname-input" disabled /></td>
          <td><input type="text" value="${data.grade}" class="grade-input" disabled /></td>
          <td>
            <button class="edit-btn" data-id="${data.id}">✏️</button>
            <button class="save-btn" data-id="${data.id}" style="display:none;">💾</button>
            <button class="delete-btn" data-id="${data.id}">🗑️</button>
          </td>
        `;
        tableBody.appendChild(tr);
      });
  }

  document.querySelectorAll(".grade-header").forEach(header => {
    header.addEventListener("click", () => {
      let next = header.nextElementSibling;
      while (next && next.classList.contains("student-row")) {
        next.style.display = next.style.display === "none" ? "table-row" : "none";
        next = next.nextElementSibling;
      }
    });
  });

  document.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      await deleteDoc(doc(db, "students", btn.dataset.id));
      loadStudents();
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
  document.getElementById("modalForm").style.display = "none";
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
    document.getElementById("modalCSV").style.display = "none";
    loadStudents();
  };
  reader.readAsText(file);
});

// MODALES
const modalForm = document.getElementById("modalForm");
const modalCSV = document.getElementById("modalCSV");

document.getElementById("openFormBtn").addEventListener("click", () => {
  modalForm.style.display = "block";
});

document.getElementById("openCSVBtn").addEventListener("click", () => {
  modalCSV.style.display = "block";
});

document.querySelectorAll(".close").forEach(span => {
  span.addEventListener("click", () => {
    const id = span.getAttribute("data-close");
    document.getElementById(id).style.display = "none";
  });
});

window.addEventListener("click", e => {
  if (e.target.classList.contains("modal")) {
    e.target.style.display = "none";
  }
});

loadStudents();
