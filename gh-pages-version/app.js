import { db } from './firebase.js';
import {
  collection,
  addDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const form = document.getElementById('student-form');
const studentsList = document.getElementById('students-list');

async function getStudents() {
  const querySnapshot = await getDocs(collection(db, "estudiantes"));
  const students = [];
  querySnapshot.forEach((doc) => {
    students.push(doc.data());
  });
  return students;
}

async function renderStudents() {
  const students = await getStudents();
  studentsList.innerHTML = '';
  students.forEach((s) => {
    const div = document.createElement('div');
    div.className = 'student-card';
    div.innerHTML = `<strong>${s.name}</strong> - Grado: ${s.grade}`;
    studentsList.appendChild(div);
  });
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('name').value.trim();
  const grade = document.getElementById('grade').value.trim();
  if (!name || !grade) return;

  try {
    await addDoc(collection(db, "estudiantes"), {
      name,
      grade
    });
    form.reset();
    renderStudents();
  } catch (error) {
    console.error("Error al guardar estudiante:", error);
  }
});

// Cargar estudiantes al iniciar
renderStudents();
