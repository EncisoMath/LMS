## v0.24.302 - Ajuste ABCD y Verdadero/Falso en player

Base: v0.24.301-editar-quizzes.

Cambios limitados a la pantalla de juego del quiz:
- Se integra el ajuste que evita que las opciones ABCD se corten abajo.
- Verdadero/Falso vuelve a flujo normal, sin `position: fixed`, para que no se salga hacia la izquierda.
- Verdadero/Falso usa ancho completo de respuestas, dos columnas y altura calculada con colchón inferior.
- El texto de la pregunta en Verdadero/Falso queda centrado verticalmente dentro de su zona, pero alineado a la izquierda.
- Se conserva el centrado estable de `quiz-question-content` de v0.24.299 y las opciones lógicas de v0.24.300.

No se tocaron datos base, Quiz Studio visual, tarjetas, navegación, resultados, ranking/podio, música ni countdown.

Validación:
- `node --check app.js`
- `node --check sw.js`
- JSON/manifest válidos
- CSS braces balanceado
- `unzip -t` sin errores

Versión/cache busting actualizado a 0.24.302.

---

## v0.24.304 - Restauración de animaciones de héroes

- Restauradas las animaciones originales de los héroes de **CLASES**, **ROCKSTARS** y **QUIZZES**.
- Las preferencias cargadas desde Supabase ya no pueden congelar esos tres héroes.
- No se modificó la integración de autenticación, datos, asistencia, Rockstars ni quizzes.

## v0.24.303 - Integración inicial con Supabase

Base: v0.24.302.

Cambios:
- Login real por correo y contraseña con Supabase Auth.
- Carga de perfiles, asignaturas, 285 estudiantes, matrículas, clases y quizzes desde PostgreSQL.
- Asistencia y Rockstars guardados en Supabase.
- Quiz Studio guarda y replica quizzes en Supabase.
- Intentos, respuestas, resultados y eventos de seguridad se registran en la nube.
- Portadas e iconos se almacenan en el bucket `lms-public`.
- Preferencias principales y aperturas de clases se sincronizan.
- Se conserva `localStorage` únicamente para interfaz, caché y ajustes visuales no académicos.

Nuevos archivos:
- `supabase-config.js`
- `supabase-adapter.js`
- `SUPABASE_INTEGRACION.md`
- `supabase/ENCISOMATH_SUPABASE_SETUP_v1.sql`

Validación:
- `node --check app.js`
- `node --check supabase-config.js`
- `node --check supabase-adapter.js`
- prueba automatizada del adaptador con respuestas simuladas de Supabase
- JSON y manifiesto válidos
- rutas locales verificadas
- ZIP probado con `unzip -t`
### Privacidad v0.24.303

- Los archivos locales `data/students.json` y `data/users.json` ya no contienen registros reales.
- El instalador SQL con nombres y códigos se conserva fuera del repositorio público.
- Los datos académicos se cargan únicamente desde Supabase tras autenticar al usuario.


## v0.24.305

- Nueva carga docente para Estadística 8-4 mediante migración Supabase.
- La papelera de ESTUDIANTES ahora retira/inactiva la matrícula con confirmación.
- Nueva pestaña ACTIVIDADES con héroe animado y selector horizontal por periodos.
- Esta actualización queda incorporada y reemplazada por v0.24.306.

## v0.24.306

- El héroe de **ACTIVIDADES** ahora reinicia y fuerza sus animaciones al abrir la pestaña.
- Se eliminaron del proyecto los siete archivos de clases demo y la ilustración del quiz demo.
- `data/classes.json` y `data/quizzes.json` quedan vacíos.
- CLASES, ACTIVIDADES y QUIZZES muestran un estado vacío completo por periodo.
- Incluye `SUPABASE_MIGRATION_v0.24.306.sql` para retirar de Supabase únicamente los registros demo conocidos.
- No se eliminan estudiantes, matrículas, asistencia, Rockstars, asignaciones ni configuración de Supabase.


## v0.24.307

- El selector de periodo se trasladó a la barra superior de cada asignatura y reemplaza el icono de inicio.
- Se eliminaron los navegadores horizontales de periodos de Clases, Actividades, Rockstars y Quizzes.
- El periodo seleccionado es global para las cuatro pestañas.
- Se añadió una tuerca junto a `Cerrar sesión` para configurar las fechas de inicio de los cuatro periodos.
- Al iniciar sesión, EncisoMath calcula automáticamente el periodo vigente usando la fecha del dispositivo.
- Las fechas se guardan en `user_preferences` de Supabase y también en el respaldo local del navegador.

## v0.24.308

- Corregida la reaparición de clases y quizzes antiguos desde Supabase.
- La aplicación filtra los IDs demo antes de mostrarlos.
- Se intenta retirar automáticamente el contenido demo al iniciar sesión docente.
- Se limpian referencias antiguas del quiz demo en `localStorage`.
- Incluye `SUPABASE_MIGRATION_v0.24.308.sql` para vaciar por completo el contenido actual de clases y quizzes sin tocar datos académicos.


## v0.24.309

- Entrada escalonada `fade + subida + zoom` en todos los bloques de CLASES, ACTIVIDADES, ROCKSTARS y QUIZZES.
- La animación cubre héroes, botones, modos cuadrícula/lista, tarjetas, estados vacíos y acciones internas.
- Quiz Studio anima cabecera, pestañas, campos, preguntas, opciones y botones.
- La pantalla de una clase anima barra superior, encabezado e iframe de contenido.
- El héroe de ACTIVIDADES recibe la misma entrada visible de CLASES, ROCKSTARS y QUIZZES.


## v0.24.310 - Biblioteca de clases PDF

- ACTIVIDADES y QUIZZES incorporan selector Cuadrícula / Lista igual que CLASES.
- CLASES incorpora `Añadir clase` con nombre, periodo, PDF, portada opcional y alcance por curso o por grado.
- Si no se carga portada, PDF.js genera una imagen desde la primera página.
- La vista de cuadrícula muestra la clase como un cuaderno sin el nombre; la vista de lista añade nombre, periodo y páginas.
- El lector abre una sola página y permite avanzar o retroceder con botones, flechas del teclado o deslizamiento, usando transición de hoja.
- Requiere ejecutar `SUPABASE_MIGRATION_v0.24.310.sql` una vez antes de crear la primera clase.


## v0.24.311 - Visor PDF y gestión de clases

- Selector Cuadrícula/Lista compacto y alineado a la derecha en Clases, Actividades y Quizzes.
- El cambio de vista actualiza únicamente el contenedor de contenido.
- Visor PDF adaptativo: ancho completo en móvil y altura útil máxima en escritorio.
- Cambio de hoja con doble canvas, zoom por botones, rueda y gesto de pellizco.
- Eliminación de clases con confirmación y soporte para retirar de un curso o eliminar de todos.
