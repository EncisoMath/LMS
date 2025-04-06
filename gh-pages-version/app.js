// Configurar Firebase
const firebaseConfig = {
    apiKey: "AIzaSyC5-6jxxqj0kqjejlGFViA9GsbRZAebMu0",
    authDomain: "lmsenciso.firebaseapp.com",
    projectId: "lmsenciso",
    storageBucket: "lmsenciso.appspot.com",
    messagingSenderId: "831119379631",
    appId: "1:831119379631:web:9dea9bf8b679e1f896985a",
    measurementId: "G-BGKGV7QPPG"
  };
  
  firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();
  
  // Guardar estudiante al hacer clic
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
    } catch (e) {
      console.error("Error al guardar:", e);
      alert("Hubo un error al guardar.");
    }
  });
  