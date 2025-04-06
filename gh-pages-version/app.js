// app.js
import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Agregar estudiante
document.getElementById("saveBtn").addEventListener("click", async () => {
  const name = document.getElementById("nameInput").value.trim();
  const grade = document.getElementById("gradeInput").value.trim();

  if (!name || !grade) {
    alert("Por favor, completa ambos campos.");
    return;
  }

  try {
    await addDoc(collection(db, "students"), {
      name,
      grade
    });
    alert("Estudiante guardado exitosamente.");
    document.getElementById("nameInput").value = "";
    document.getElementById("gradeInput").value = "";
    loadStudents(); // recargar la lista después de guardar
  } catch (e) {
    console.error("Error al guardar:", e);
    alert("Hubo un error al guardar.");
  }
});

// Mostrar lista de estudiantes
async function loadStudents() {
  const studentsCol = collection(db, "students");
  const studentSnapshot = await getDocs(studentsCol);
  const listContainer = document.getElementById("studentList");
  listContainer.innerHTML = ""; // limpiar lista

  studentSnapshot.forEach((doc) => {
    const student = doc.data();
    const item = document.createElement("li");
    item.textContent = `${student.name} - Grado: ${student.grade}`;
    listContainer.appendChild(item);
  });
}

loadStudents(); // cargar estudiantes al iniciar
