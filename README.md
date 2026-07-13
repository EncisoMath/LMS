# EncisoMath LMS v0.24.342

Aplicación PWA educativa desplegada en GitHub Pages y conectada a Supabase para autenticación, datos académicos, clases PDF, actividades, asistencia, Rockstars y quizzes.

## Estado actual

- Inicio de sesión mediante Supabase Auth.
- Cargas académicas y estudiantes obtenidos desde Supabase.
- Asistencia y puntos Rockstar almacenados en la nube.
- Selector global y automático de periodo.
- Selector desplegable para Estudiantes, Clases, Actividades, Notas, Rockstars y Quizzes.
- Creación de clases PDF por curso o por grado.
- Creación de actividades por curso o por grado.
- Las actividades pueden vincularse opcionalmente con una clase o funcionar de forma independiente.
- Contenido de actividades en PDF, imágenes, texto enriquecido o HTML + CSS.
- Rúbricas, calificaciones, grupos de trabajo, entregas y seguimientos por estudiante.
- Tarjetas oscuras de actividades con fecha de asignación, cierre, entregas, calificaciones y porcentaje de avance.
- Vistas Cuadrícula y Lista en Clases, Actividades y Quizzes.
- Visor PDF de una página con controles flotantes, navegación táctil, teclado, zoom y pellizco.
- PWA preparada para GitHub Pages.
- El service worker no intercepta recursos externos de Supabase ni otros CDN.

## Archivos principales

- `index.html`: entrada de la aplicación.
- `app.js`: interfaz, navegación y lógica principal.
- `styles.css`: estilos y animaciones.
- `supabase-config.js`: URL y Publishable Key del proyecto.
- `supabase-adapter.js`: acceso a Auth, Database y Storage.
- `sw.js`: service worker.
- `manifest.webmanifest`: configuración PWA.
- `data/`: datos locales vacíos o de respaldo; los registros reales se obtienen desde Supabase.
- `vendor/pdfjs/`: motor local para visualizar PDFs.
- `assets/`: fuentes, imágenes, música y sonidos usados por la aplicación.

## Publicación

La aplicación está configurada para:

`https://encisomath.github.io/LMS/`

Para publicar una actualización, reemplaza los archivos modificados, realiza el commit y haz push.

## Supabase

La base de datos y sus políticas deben estar configuradas en el proyecto Supabase asociado. Este repositorio no contiene instaladores ni migraciones SQL.

`supabase-config.js` contiene únicamente la URL pública del proyecto y la Publishable Key requerida por el navegador. Nunca deben subirse aquí:

- `service_role`
- claves `sb_secret_...`
- contraseña de la base de datos
- contraseñas de usuarios
- exportaciones con datos personales
- hojas de cálculo de estudiantes

La seguridad de acceso depende de Supabase Auth y de las políticas RLS configuradas en la base de datos.

## Cambios v0.24.337
- Tarjetas Entregaron, Calificados y Avance más compactas.
- Nuevas pestañas Actividad y Resultado en el detalle de la actividad.
- Resultado muestra la respuesta o guía de revisión configurada al crear o editar la actividad.
- Paso 5 de la rúbrica corregido para alinear el número con el título.
- Acentos de CALIFICACIONES y resplandor del modal según el color del curso.
- Botonera de calificación unificada visualmente con las pestañas de crear/editar actividad.
- No requiere cambios de esquema ni SQL en Supabase.

## Cambios v0.24.340
- Se añadió la tarjeta **Promedio** al resumen de cada actividad.
- El promedio se calcula únicamente con estudiantes que ya tienen una calificación registrada.
- La barra cambia de color según el promedio: dorado (90–100), verde (80–89.9), amarillo (70–79.9), naranja (60–69.9) y rojo (menos de 60).
- No requiere cambios de esquema ni SQL en Supabase.

## Cambios v0.24.340
- Las subpestañas **Calificar normal** y **Calificar con rúbrica** adoptan el mismo estilo visual de las pestañas principales de Crear/Editar actividad.
- El modal de calificación fuerza `--maincolor` y todo su resplandor exterior al color de la asignatura, eliminando el azul global residual.
- La malla de las tarjetas de actividades ahora se desplaza de forma continua y claramente visible en cuadrícula y lista.
- No requiere cambios de esquema ni SQL en Supabase.


## Cambios v0.24.341
- Se eliminaron las dos mallas/cuadrículas anteriores de `em-activity-card`.
- Las tarjetas ahora usan la misma cuadrícula de `danger-head .danger-red-mesh`: cuadros de 24 × 24 px, inclinación de -7 grados y desplazamiento diagonal continuo de 14 segundos.
- La cuadrícula utiliza tonos apenas más claros que el fondo oscuro de la tarjeta, sin tomar el rojo del modal de peligro ni el color de la asignatura.
- No requiere cambios de esquema ni SQL en Supabase.

## Cambios v0.24.342
- Se añadió la nueva sección **NOTAS** al selector de la asignatura, junto a Estudiantes, Clases, Actividades, Rockstars y Quizzes.
- La sección muestra una hoja de calificaciones horizontal tipo hoja de cálculo, con la primera columna fija para el estudiante y su código.
- Los nombres se presentan de forma compacta: primer apellido, inicial del segundo apellido, primer nombre e inicial del segundo nombre.
- Las actividades del periodo aparecen en orden de asignación y con sus encabezados escritos verticalmente.
- Después de las actividades se añaden automáticamente las columnas **Asistencia** y **Rockstars**, además de una columna final **Definitiva**.
- La nota de Asistencia se calcula con las sesiones en las que exista registro de asistencia durante el periodo:
  - asistencia completa: 100;
  - las inasistencias sin excusa reducen la nota;
  - las excusas no cuentan como inasistencia injustificada;
  - cuando todas las ausencias están justificadas, se aplica un mínimo de 60 sin convertir automáticamente la nota en 100.
- La nota Rockstar compara los puntos obtenidos con una meta configurable. Cuando el estudiante tiene al menos una asistencia registrada en el periodo, la nota Rockstar tiene un mínimo de 60.
- Al tocar el encabezado de una actividad, Asistencia o Rockstars se abre un modal para configurar código, color y peso porcentual.
- La columna Rockstar permite además establecer la meta de puntos del periodo; el valor inicial es 15.
- La ponderación inicial se distribuye de forma equitativa entre las columnas existentes y suma 100%. Las configuraciones posteriores se guardan por asignatura y periodo.
- La configuración de columnas se guarda dentro de `user_preferences.preferences`, por lo que no requiere una tabla nueva ni una migración SQL.
- `supabase-adapter.js` ahora incluye las calificaciones de actividades en la carga inicial para construir la hoja de notas sin abrir cada actividad.
