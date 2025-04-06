// Configuración de Firebase
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
  
  // Inicializar Firebase y Firestore
  firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();
  
  // Guardar estudiante
  document.getElementById("saveBtn").addEventListener("click", async () => {
    const name = document.getElementById("nameInput").value.trim();
    const grade = document.getElementById("gradeInput").value.trim();
  
    if (!name || !grade) {
      alert("Por favor, completa ambos campos.");
      return;
    }
  
    try {
      await db.collection("students").add({ name, grade });
      alert("Estudiante guardado exitosamente.");
      document.getElementById("nameInput").value = "";
      document.getElementById("gradeInput").value = "";
      loadStudents();
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
      const querySnapshot = await db.collection("students").get();
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
  