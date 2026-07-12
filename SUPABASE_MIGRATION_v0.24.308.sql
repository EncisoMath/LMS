-- EncisoMath LMS v0.24.308
-- LIMPIEZA TOTAL DEL CONTENIDO ACTUAL DE CLASES Y QUIZZES.
-- Usar ahora porque el proyecto todavía no contiene clases ni quizzes reales.
-- No elimina estudiantes, matrículas, asistencia, Rockstars, asignaciones ni perfiles.

begin;

-- Las relaciones, intentos, respuestas, vistas y eventos relacionados se eliminan
-- por las reglas ON DELETE CASCADE del esquema.
delete from public.assignment_lessons;
delete from public.lessons;

delete from public.quiz_assignments;
delete from public.quizzes;

commit;

select 'assignment_lessons' as item, count(*)::bigint as total from public.assignment_lessons
union all
select 'lessons', count(*)::bigint from public.lessons
union all
select 'quiz_assignments', count(*)::bigint from public.quiz_assignments
union all
select 'quizzes', count(*)::bigint from public.quizzes
order by item;
