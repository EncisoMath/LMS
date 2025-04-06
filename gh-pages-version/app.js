import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Guardar estudiante
document.getElementById("saveBtn").addEventListener("click", async () => {
  const name = document.getElementById("nameInput").value.trim();
  const grade = document.getElementById("gradeInput").value.trim();

  if (!name || !grade) {
    alert("Por favor, completa ambos campos.");
    return;
  }

  try {
    await addDoc(collection(db, "students"), { name, grade });
    alert("Estudiante guardado exitosamente.");
    document.getElementById("nameInput").value = "";
    document.getElementById("gradeInput").value = "";
    loadStudents(); // recarga la lista
  } catch (e) {
    console.error("Error al guardar:", e);
    alert("Hubo un error al guardar.");
  }
});

// Cargar estudiantes existentes
async function loadStudents() {
  const list = document.getElementById("studentList");
  list.innerHTML = "";

  try {
    const querySnapshot = await getDocs(collection(db, "students"));
    querySnapshot.forEach((doc) => {
      const student = doc.data();
      const li = document.createElement("li");
      li.textContent = `${student.name} - Grado: ${student.grade}`;
      list.appendChild(li);
    });
  } catch (e) {
    console.error("Error al cargar estudiantes:", e);
  }
}

loadStudents();
