# EncisoMath LMS v0.24.306

## Antes de publicar

En **Supabase → SQL Editor**, ejecuta una sola vez:

`SUPABASE_MIGRATION_v0.24.306.sql`

La migración elimina únicamente el contenido demo conocido:

- 7 clases demo.
- 1 quiz demo.
- Sus asignaciones, vistas e intentos asociados mediante las relaciones con borrado en cascada.

No elimina estudiantes, matrículas, asistencia, Rockstars, perfiles ni cargas académicas.

Al finalizar, la verificación debe mostrar:

- `lessons = 0`
- `assignment_lessons = 0`
- `quizzes = 0`
- `quiz_assignments = 0`

## Cambios visuales

- El héroe de ACTIVIDADES tiene movimiento visible en figuras, hojas, casillas, líneas, lápiz y título.
- CLASES muestra: `PERIODO N / Aún no hay clases`.
- ACTIVIDADES muestra: `PERIODO N / Aún no hay actividades`.
- QUIZZES muestra: `PERIODO N / Aún no hay quizzes`.

Los motores para crear contenido permanecen disponibles; se retiró solamente el contenido de demostración.
