const firebaseConfig = {
  apiKey: "AIzaSyC5-6jxxqj0kqjejlGFViA9GsbRZAebMu0",
  authDomain: "lmsenciso.firebaseapp.com",
  databaseURL: "https://lmsenciso-default-rtdb.firebaseio.com",
  projectId: "lmsenciso",
  storageBucket: "lmsenciso.appspot.com",
  messagingSenderId: "831119379631",
  appId: "1:831119379631:web:9dea9bf8b679e1f896985a",
  measurementId: "G-BGKGV7QPPG"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const studentsRef = db.collection("students");

document.getElementById("saveBtn").addEventListener("click", async () => {
  const name = document.getElementById("nameInput").value.trim();
  const grade = document.getElementById("gradeInput").value.trim();

  if (!name || !grade) {
    alert("Por favor, completa ambos campos.");
    return;
  }

  try {
    await studentsRef.add({ name, grade });
    document.getElementById("nameInput").value = "";
    document.getElementById("gradeInput").value = "";
    loadStudents(); // recargar lista
  } catch (error) {
    console.error("Error al guardar:", error);
    alert("Error al guardar el estudiante.");
  }
});

async function loadStudents() {
  const listDiv = document.getElementById("students-list");
  listDiv.innerHTML = "";
  const snapshot = await studentsRef.get();

  snapshot.forEach(doc => {
    const student = doc.data();
    const div = document.createElement("div");
    div.className = "student-card";
    div.textContent = `📘 ${student.name} - ${student.grade}`;
    listDiv.appendChild(div);
  });
}

// Cargar estudiantes al abrir la página
loadStudents();
