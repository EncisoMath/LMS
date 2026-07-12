# EncisoMath LMS v0.24.307 + Supabase

Esta versión conecta el LMS estático de GitHub Pages con el proyecto:

- Project URL: `https://jjllrciujqauqpjffsud.supabase.co`
- Aplicación: `https://encisomath.github.io/LMS/`
- Autenticación: correo y contraseña con Supabase Auth
- Base inicial: `ENCISOMATH_SUPABASE_SETUP_v1.sql`

## Archivos de integración

- `supabase-config.js`: URL, Publishable Key y nombre del bucket público.
- `supabase-adapter.js`: toda la comunicación con Auth, Database y Storage.
- `app.js`: conecta la interfaz existente con el adaptador.
- `index.html`: carga `supabase-js`, configuración, adaptador y aplicación.
- `sw.js`: versión de actualización `0.24.307`.

## Privacidad del repositorio público

- `data/students.json` y `data/users.json` se entregan vacíos.
- Los nombres, códigos y perfiles reales se descargan únicamente después de autenticar una sesión autorizada.
- El SQL inicial con los 285 estudiantes **no se incluye en este ZIP de GitHub**, porque contiene datos personales y debe conservarse fuera del repositorio público.

## Qué se guarda ahora en Supabase

- Inicio y restauración de sesión.
- Perfil y rol del usuario.
- Cargas académicas y grupos.
- Estudiantes y matrículas.
- Asistencia diaria.
- Eventos `+1/-1` de Rockstars.
- Quizzes creados y replicados desde Quiz Studio.
- Intentos, respuestas, puntaje y eventos de seguridad de quizzes.
- Aperturas de clases.
- Preferencias principales de apariencia.
- Portadas e iconos de asignaturas mediante Storage.

## Qué continúa local

Se mantienen en `localStorage` únicamente estados de interfaz y herramientas de ajuste visual, por ejemplo:

- pestaña o periodo seleccionado;
- vista de clases en lista o cuadrícula;
- paneles técnicos de afinación visual del quiz;
- último correo utilizado;
- ajustes de sesión del navegador.

Los registros académicos principales ya no dependen de esos datos locales cuando existe una sesión Supabase válida.

## Publicar en GitHub Pages

1. Sustituya en el repositorio los archivos entregados.
2. Confirme que estos nuevos archivos estén en la raíz:
   - `supabase-config.js`
   - `supabase-adapter.js`
3. Haga commit y push a la rama que publica GitHub Pages.
4. Abra `https://encisomath.github.io/LMS/`.
5. Si aparece una versión antigua, cierre la PWA o pestaña, vuelva a abrir y recargue una vez.

## Primera prueba

Inicie sesión con:

- correo: `enciso.math@gmail.com`
- contraseña: la creada en Supabase

No comparta esa contraseña.

Después compruebe:

1. Deben aparecer las once cargas de Estadística de 8-4 a 11-3.
2. Abra 9-1 y verifique que aparezca el listado real del grupo.
3. Marque una asistencia.
4. En Supabase abra `Table Editor > attendance_records` y compruebe la fila.
5. Marque al estudiante como presente y agregue un punto Rockstar.
6. Compruebe `rockstar_events`.
7. En CLASES, ACTIVIDADES y QUIZZES debe aparecer el estado vacío del periodo seleccionado.
8. Cuando cree un quiz real, compruebe `quiz_attempts` y `quiz_answers`.

## Cuentas de estudiantes

Los 285 estudiantes ya existen en `public.students` y están matriculados, pero eso no crea automáticamente 285 cuentas de Auth.

Para que un estudiante pueda iniciar sesión se debe crear además un usuario en Supabase Auth y vincular su perfil con el registro correspondiente. La aplicación ya reconoce el rol `student`, aunque la pantalla estudiantil completa sigue reservada para la siguiente fase.

## Seguridad

- El navegador utiliza únicamente la Publishable Key.
- Nunca coloque `service_role`, `sb_secret_...`, contraseña de base de datos ni contraseñas de usuarios en estos archivos.
- Los permisos dependen de las políticas RLS instaladas por el SQL.
- Mantenga desactivado el registro público de usuarios mientras las cuentas se creen de forma controlada.

## Recuperación ante error de red

Las operaciones visuales son optimistas para mantener la aplicación ágil. Si Supabase rechaza una escritura, la aplicación muestra un aviso y registra el error en consola. Para registros importantes, confirme la conexión antes de cerrar la aplicación.


## Calendario académico v0.24.307

Las fechas de inicio de los cuatro periodos se guardan dentro del JSON `preferences` de la tabla `user_preferences`. No requiere migración SQL ni tablas nuevas. El selector superior usa un único periodo global para Clases, Actividades, Rockstars y Quizzes.


## v0.24.310 - Clases PDF

Antes de publicar esta versión, ejecuta `SUPABASE_MIGRATION_v0.24.310.sql`. La migración añade metadatos de portada y PDF a `lessons`, y permite `application/pdf` en el bucket `lms-public`.

Las clases nuevas se guardan así:

- El PDF y la portada quedan en `lms-public/<auth.uid>/lessons/<lesson-id>/`.
- `lessons` conserva título, periodo, URL, rutas de Storage, nombre original y cantidad de páginas.
- `assignment_lessons` determina si la clase pertenece solo al curso actual o a todos los cursos del mismo grado y asignatura.
- La interfaz utiliza PDF.js 6.1.200 incluido localmente en `vendor/pdfjs/`; no depende de un CDN externo.
