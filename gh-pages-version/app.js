import { db } from "./firebase.js";
import {
  collection,
  addDoc
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
  } catch (e) {
    console.error("Error al guardar:", e);
    alert("Hubo un error al guardar.");
  }
});
