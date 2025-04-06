import { db } from './firebase.js';
import {
  collection,
  addDoc,
  getDocs
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

// Referencias al DOM
const form = document.getElementById('studentForm');
const studentList = document.getElementById('studentList');

// Función para agregar estudiante
async function agregarEstudiante(nombre, grado) {
  try {
    await addDoc(collection(db, 'estudiantes'), {
      nombre,
      grado
    });
    mostrarEstudiantes(); // refrescar lista
    form.reset();
  } catch (e) {
    console.error('Error al agregar estudiante:', e);
  }
}

// Función para mostrar estudiantes
async function mostrarEstudiantes() {
  studentList.innerHTML = ''; // limpiar lista
  const querySnapshot = await getDocs(collection(db, 'estudiantes'));
  querySnapshot.forEach((doc) => {
    const est = doc.data();
    const li = document.createElement('li');
    li.textContent = `${est.nombre} - Grado: ${est.grado}`;
    studentList.appendChild(li);
  });
}

// Escuchar envío del formulario
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const nombre = form.nombre.value;
  const grado = form.grado.value;
  agregarEstudiante(nombre, grado);
});

// Mostrar al cargar
mostrarEstudiantes();
