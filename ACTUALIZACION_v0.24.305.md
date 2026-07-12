# EncisoMath LMS v0.24.305

## Antes de publicar el ZIP

En Supabase abre **SQL Editor**, crea una consulta nueva y ejecuta completo:

`SUPABASE_MIGRATION_v0.24.305.sql`

El resultado final debe mostrar una fila con:

- `id`: `mat-est-8-4`
- `grade`: `8`
- `course`: `4`
- `active_students`: `31`

Luego publica los archivos del proyecto en GitHub Pages.

## Cambios incluidos

- Se agrega la carga de Estadística 8-4.
- La papelera de ESTUDIANTES pasa la matrícula a estado `withdrawn` en Supabase.
- Antes de retirar se muestra una ventana de confirmación.
- El estudiante deja de aparecer, pero se conserva su historial.
- Se agrega la pestaña ACTIVIDADES.
- ACTIVIDADES tiene héroe animado del mismo tamaño que los demás.
- ACTIVIDADES conserva la barra horizontal de periodos 1 a 4.
- Por ahora muestra un espacio vacío preparado para contenido futuro.
