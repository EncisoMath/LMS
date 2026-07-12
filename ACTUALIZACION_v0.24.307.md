# EncisoMath v0.24.307

## Cambios

1. Se eliminó el navegador horizontal de periodos dentro de Clases, Actividades, Rockstars y Quizzes.
2. El icono de casa de la barra superior fue reemplazado por una lista `Periodo 1` a `Periodo 4`.
3. El periodo seleccionado es compartido por todas las pestañas de la asignatura.
4. Se añadió una tuerca junto a `Cerrar sesión` para establecer la fecha de inicio de cada periodo.
5. Al iniciar sesión, el periodo se calcula automáticamente con la fecha actual.
6. Las fechas se sincronizan en `user_preferences` de Supabase; no se necesita ejecutar SQL.

## Uso

- En el panel principal, pulsa la tuerca junto a `Cerrar sesión`.
- Define las cuatro fechas en orden cronológico y pulsa `Guardar fechas`.
- EncisoMath seleccionará automáticamente el periodo vigente.
- Dentro de una asignatura puedes cambiar temporalmente de periodo mediante la lista de la barra superior.
- Al cerrar y volver a iniciar sesión, se vuelve a calcular el periodo automático.
