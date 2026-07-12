# EncisoMath LMS v0.24.324

Aplicación PWA educativa desplegada en GitHub Pages y conectada a Supabase para autenticación, datos académicos, clases PDF, asistencia, Rockstars y quizzes.

## Estado actual

- Inicio de sesión mediante Supabase Auth.
- Cargas académicas y estudiantes obtenidos desde Supabase.
- Asistencia y puntos Rockstar almacenados en la nube.
- Selector global y automático de periodo.
- Módulos de Estudiantes, Clases, Actividades, Rockstars y Quizzes.
- Creación de clases PDF por curso o por grado.
- Portada personalizada o generada desde la primera página del PDF.
- Visor PDF de una página a pantalla completa, sin barras reservadas, con controles flotantes siempre visibles, transición horizontal, navegación táctil, teclado, zoom y pellizco.
- Vistas Cuadrícula y Lista en Clases, Actividades y Quizzes.
- PWA preparada para GitHub Pages.
- Carga de Supabase fijada a una versión estable, con CDN alternativo de respaldo.
- El service worker no intercepta recursos externos de Supabase ni otros CDNs.

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

Para publicar una actualización, reemplaza el contenido del repositorio con esta carpeta, conserva `.git`, y realiza el commit y push.

## Supabase

La base de datos y sus políticas ya deben estar configuradas en el proyecto Supabase asociado. Este repositorio no contiene instaladores ni migraciones SQL.

`supabase-config.js` contiene únicamente la URL pública del proyecto y la Publishable Key requerida por el navegador. Nunca deben subirse aquí:

- `service_role`
- claves `sb_secret_...`
- contraseña de la base de datos
- contraseñas de usuarios
- exportaciones con datos personales
- hojas de cálculo de estudiantes

La seguridad de acceso depende de Supabase Auth y de las políticas RLS configuradas en la base de datos.


## Visor PDF

La apertura de clases usa una transición suave, un cargador geométrico con barra de progreso y una entrada con fade/zoom al mostrar la primera página.


## Actividades v0.24.324

- Navegación vertical por Estudiantes, Clases, Actividades, Rockstars y Quizzes.
- Creación de actividades relacionada con una clase del curso.
- Periodo automático, fecha de inicio y fecha máxima de entrega.
- Contenido exclusivo por actividad: PDF, imágenes, texto enriquecido o HTML + CSS.
- Solución/revisión en los mismos cuatro formatos.
- Rúbrica dinámica con validación obligatoria de 100%.
- Persistencia de actividades y archivos en Supabase.
