// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Configuración del proyecto Firebase
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

// Inicializar Firebase y exportar Firestore
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
