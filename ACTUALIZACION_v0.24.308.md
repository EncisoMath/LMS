# EncisoMath LMS v0.24.308

## Corrección de clases y quizzes antiguos

La aplicación ya no muestra los siete registros de clases demo ni el quiz demo, aunque todavía existan temporalmente en Supabase o en un navegador antiguo.

Se añadieron tres defensas:

1. Filtrado en `supabase-adapter.js` al leer los datos.
2. Filtrado adicional en `app.js` antes de incorporarlos al estado de la interfaz.
3. Limpieza automática de las relaciones y registros demo al iniciar una sesión docente.

También se limpia cualquier referencia antigua del quiz demo guardada en `localStorage`.

## Paso recomendado

Ejecutar `SUPABASE_MIGRATION_v0.24.308.sql` una sola vez en el SQL Editor. Esta migración elimina todo el contenido actual de `lessons` y `quizzes`, porque en esta etapa todavía no hay contenido real creado. No toca estudiantes, matrículas, asistencia, Rockstars, perfiles ni cargas académicas.
