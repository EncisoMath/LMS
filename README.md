# EncisoMath PWA - AVA/LMS en GitHub Pages

Versión actual: `0.8.0`

Este proyecto es una base funcional para migrar el AVA hecho en Glide hacia una PWA móvil instalable publicada con GitHub Pages.

## Qué incluye

- PWA instalable para Android y escritorio.
- Service Worker configurado para **no cachear** y pedir siempre la versión publicada más reciente.
- Login por ID con último usuario y opción de mantener sesión iniciada.
- Vista docente inicial.
- Portada tipo red social, foto de perfil y tarjetas de asignaturas.
- Filtros por grado, área y curso.
- Vista de asignatura con banner integrado, portada/icono personalizable localmente y gestor visual modal.
- Pestaña de estudiantes con asistencia diaria: asistió, no asistió y excusa.
- Buscador de estudiantes y creación de estudiante mediante cuadro emergente con nombre y apellido separados.
- Pestaña de clases por periodos, vista cuadrícula/lista.
- Clase interactiva de ejemplo en modo oscuro: gráficos de barras con calculadora visual en Canvas.
- Datos semilla en archivos JSON.


## Cambios v0.8

- Glows más grandes y animados en login, tanto en azul oscuro como en negro total.
- Corrección de barritas laterales en login web.
- Vista de asignatura rediseñada: icono, nombre, sede, grado, curso y cantidad de estudiantes integrados en el banner.
- Campo de estudiante convertido en buscador. El botón **Añadir** abre un modal con campos separados para nombre y apellido.
- Barras superior e inferior reforzadas para permanecer fijas.
- En vista de clase solo queda la barra superior de regreso.
- Clase de ejemplo pasada a modo oscuro.
- Warning de eliminación con estilo más cómic, glows y franjas diagonales en loop más limpio.

## Usuario demo

- Docente: `0720`

Los usuarios se editan en:

```text
data/users.json
```

## Estructura

```text
encisomath-pwa/
├── index.html
├── styles.css
├── app.js
├── sw.js
├── manifest.webmanifest
├── data/
│   ├── users.json
│   ├── assignments.json
│   ├── students.json
│   └── classes.json
├── classes/
│   └── graficos-de-barras.html
└── assets/
    ├── icon-192.png
    ├── icon-512.png
    ├── default-avatar.svg
    ├── default-profile.svg
    └── subject-statistics.svg
```

## Cómo publicarlo en GitHub Pages

1. Crea un repositorio nuevo en GitHub, por ejemplo `encisomath-ava`.
2. Sube todos los archivos de esta carpeta a la raíz del repositorio.
3. En GitHub entra a **Settings > Pages**.
4. En **Build and deployment**, selecciona:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
5. Guarda y espera el enlace de GitHub Pages.
6. Abre el enlace en Android con Chrome y usa **Agregar a pantalla principal** o **Instalar app**.

## Sobre los JSON en GitHub

GitHub Pages permite leer archivos JSON, pero no permite escribirlos desde la app de forma segura. Esta versión usa:

- JSON del repositorio como datos base.
- `localStorage` del dispositivo para sesión, asistencia, estudiantes añadidos y portada personalizada.

Para guardar asistencia y cambios en la nube sin riesgo, hace falta una segunda fase con una de estas opciones:

- Google Sheets + Apps Script.
- Supabase/Firebase.
- Backend pequeño con autenticación.
- GitHub API, pero nunca exponiendo un token privado en el navegador.

## Sobre notificaciones

Esta base incluye prueba de notificación local usando la API de notificaciones del navegador. Las notificaciones push reales cuando la app está cerrada requieren un servidor o servicio externo que envíe los mensajes push.

## Cómo crear una nueva clase interactiva

1. Crea un archivo HTML dentro de `classes/`, por ejemplo:

```text
classes/medidas-de-tendencia-central.html
```

2. Incluye HTML, CSS y JavaScript dentro de ese archivo. Puede tener gráficos, calculadoras, simuladores, preguntas, canvas, etc.
3. Registra la clase en `data/classes.json`:

```json
{
  "id": "central-tendency",
  "period": 2,
  "area": "Matemáticas",
  "subject": "Estadística",
  "title": "Media, mediana y moda",
  "emoji": "🎯",
  "type": "Clase interactiva",
  "estimatedTime": "50 min",
  "contentUrl": "./classes/medidas-de-tendencia-central.html"
}
```

## Próximas fases recomendadas

1. Completar vista estudiante.
2. Añadir exportación/importación de asistencia.
3. Crear panel de administración de JSON.
4. Conectar persistencia real en la nube.
5. Diseñar una plantilla estándar para clases generadas con ChatGPT.
