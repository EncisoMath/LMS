document.getElementById("toggleSidebar").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("visible");
});

const gradesContainer = document.getElementById("gradesContainer");

// Datos simulados
const estudiantes = [
  { id: "1234", apellido: "Gómez", nombre: "Ana", grado: "10A" },
  { id: "5678", apellido: "Martínez", nombre: "Carlos", grado: "10A" },
  { id: "9101", apellido: "Zapata", nombre: "Laura", grado: "9B" },
  { id: "1112", apellido: "Acosta", nombre: "Luis", grado: "10A" },
  { id: "1314", apellido: "Benítez", nombre: "Valeria", grado: "9B" },
  { id: "1516", apellido: "Díaz", nombre: "Julián", grado: "8C" }
];

// Agrupar por grado
const gradosMap = {};
estudiantes.forEach(est => {
  if (!gradosMap[est.grado]) {
    gradosMap[est.grado] = [];
  }
  gradosMap[est.grado].push(est);
});

// Ordenar estudiantes por apellido y nombre
for (const grado in gradosMap) {
  gradosMap[grado].sort((a, b) => {
    const nombreA = `${a.apellido} ${a.nombre}`.toLowerCase();
    const nombreB = `${b.apellido} ${b.nombre}`.toLowerCase();
    return nombreA.localeCompare(nombreB);
  });
}

// Renderizar grados
for (const grado in gradosMap) {
  const card = document.createElement("div");
  card.className = "grade-card";

  const title = document.createElement("h2");
  title.textContent = `Grado ${grado}`;
  card.appendChild(title);

  gradosMap[grado].forEach(est => {
    const row = document.createElement("div");
    row.className = "student";

    const id = createField(est.id);
    const ape = createField(est.apellido);
    const nom = createField(est.nombre);
    const gra = createField(est.grado);

    const btn = document.createElement("button");
    btn.textContent = "Editar";
    btn.className = "edit-btn";

    btn.addEventListener("click", () => {
      [id, ape, nom, gra].forEach(input => {
        input.readOnly = !input.readOnly;
        if (!input.readOnly) input.focus();
      });
    });

    row.appendChild(id);
    row.appendChild(ape);
    row.appendChild(nom);
    row.appendChild(gra);
    row.appendChild(btn);

    card.appendChild(row);
  });

  gradesContainer.appendChild(card);
}

// Crear campo de texto solo lectura
function createField(value) {
  const input = document.createElement("input");
  input.value = value;
  input.readOnly = true;
  return input;
}
