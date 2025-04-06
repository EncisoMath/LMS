import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Menú responsivo
document.getElementById('menu-toggle').addEventListener('click', () => {
  document.querySelector('aside').classList.toggle('active');
});

// Mostrar sección de estudiantes
window.mostrarEstudiantes = async () => {
  document.getElementById("seccion-estudiantes").style.display = "block";
  await cargarEstudiantes();
};

document.getElementById("studentForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("idInput").value.trim();
  const apellido = document.getElementById("apellidoInput").value.trim();
  const nombre = document.getElementById("nombreInput").value.trim();
  const grado = document.getElementById("gradoInput").value.trim();

  if (!id || !apellido || !nombre || !grado) {
    alert("Completa todos los campos.");
    return;
  }

  try {
    await addDoc(collection(db, "students"), { id, apellido, nombre, grado });
    alert("Estudiante guardado.");
    document.getElementById("studentForm").reset();
    cargarEstudiantes();
  } catch (e) {
    console.error("Error al guardar:", e);
  }
});

async function cargarEstudiantes() {
  const snapshot = await getDocs(query(collection(db, "students")));
  const estudiantes = snapshot.docs.map(doc => ({ ...doc.data(), docId: doc.id }));
  const grados = {};

  estudiantes.forEach(est => {
    if (!grados[est.grado]) grados[est.grado] = [];
    grados[est.grado].push(est);
  });

  // Ordenar estudiantes dentro de cada grado
  Object.keys(grados).forEach(grado => {
    grados[grado].sort((a, b) => {
      const nombreA = `${a.apellido} ${a.nombre}`.toLowerCase();
      const nombreB = `${b.apellido} ${b.nombre}`.toLowerCase();
      return nombreA.localeCompare(nombreB);
    });
  });

  const container = document.getElementById("gradosContainer");
  container.innerHTML = "";

  for (const grado in grados) {
    const grupo = document.createElement("div");
    grupo.className = "grade-group";

    const titulo = document.createElement("h3");
    titulo.textContent = grado;
    grupo.appendChild(titulo);

    grados[grado].forEach(est => {
      const item = document.createElement("div");
      item.className = "student-item";

      item.innerHTML = `
        <input value="${est.id}" disabled />
        <input value="${est.apellido}" disabled />
        <input value="${est.nombre}" disabled />
        <input value="${est.grado}" disabled />
        <button class="editar">Editar</button>
        <button class="eliminar">Eliminar</button>
      `;

      const inputs = item.querySelectorAll("input");

      item.querySelector(".editar").addEventListener("click", async () => {
        const isDisabled = inputs[0].disabled;
        inputs.forEach(input => input.disabled = !isDisabled);
        if (isDisabled) {
          item.querySelector(".editar").textContent = "Guardar";
        } else {
          const [idEl, apEl, nomEl, grEl] = inputs;
          await updateDoc(doc(db, "students", est.docId), {
            id: idEl.value.trim(),
            apellido: apEl.value.trim(),
            nombre: nomEl.value.trim(),
            grado: grEl.value.trim()
          });
          alert("Estudiante actualizado.");
          cargarEstudiantes();
        }
      });

      item.querySelector(".eliminar").addEventListener("click", async () => {
        if (confirm("¿Eliminar este estudiante?")) {
          await deleteDoc(doc(db, "students", est.docId));
          cargarEstudiantes();
        }
      });

      grupo.appendChild(item);
    });

    container.appendChild(grupo);
  }
}

// Importar CSV
window.importarCSV = () => {
  const fileInput = document.getElementById("csvFile");
  const file = fileInput.files[0];

  if (!file) return alert("Selecciona un archivo CSV");

  const reader = new FileReader();
  reader.onload = async (e) => {
    const lines = e.target.result.split("\n").map(line => line.trim()).filter(l => l);
    for (let line of lines) {
      const [id, nombre, apellido, grado] = line.split(",");
      if (id && nombre && apellido && grado) {
        await addDoc(collection(db, "students"), {
          id: id.trim(),
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          grado: grado.trim()
        });
      }
    }
    alert("Importación completa.");
    cargarEstudiantes();
  };
  reader.readAsText(file);
};
