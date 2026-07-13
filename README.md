# EncisoMath LMS v0.24.334

Aplicación PWA educativa desplegada en GitHub Pages y conectada a Supabase para autenticación, datos académicos, clases PDF, actividades, asistencia, Rockstars y quizzes.

## Estado actual

- Inicio de sesión mediante Supabase Auth.
- Cargas académicas y estudiantes obtenidos desde Supabase.
- Asistencia y puntos Rockstar almacenados en la nube.
- Selector global y automático de periodo.
- Selector desplegable para Estudiantes, Clases, Actividades, Rockstars y Quizzes.
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
