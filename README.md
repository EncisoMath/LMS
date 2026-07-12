# EncisoMath LMS v0.24.328

Aplicación PWA educativa desplegada en GitHub Pages y conectada a Supabase para autenticación, datos académicos, clases PDF, actividades, calificaciones, asistencia, Rockstars y quizzes.

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


## Actividades v0.24.328

- Selector desplegable para navegar entre Estudiantes, Clases, Actividades, Rockstars y Quizzes.
- Creación y edición de actividades relacionadas con una clase del curso.
- Publicación para un solo curso o para todos los cursos del mismo grado y asignatura.
- Periodo automático, fecha de inicio y fecha máxima de entrega.
- Contenido en PDF, secuencia de imágenes, texto enriquecido o HTML + CSS.
- Solución/revisión en los mismos cuatro formatos.
- Rúbrica dinámica con validación obligatoria de 100%.
- Vista de detalle con el contenido completo de la actividad.
- Calificación automática inicial de 40 para cada estudiante asignado.
- Lista por apellido, nombre, calificación y semáforo académico.
- Calificación individual o grupal, con nota diferente para cada integrante cuando sea necesario.
- Observaciones, archivo de entrega e historial de solicitudes/estados de entrega.
- Eliminación en cascada de las calificaciones vinculadas únicamente a la actividad eliminada.
- Persistencia de actividades, archivos, calificaciones y seguimientos en Supabase.
