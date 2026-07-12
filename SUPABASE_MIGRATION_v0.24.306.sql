-- EncisoMath LMS v0.24.306
-- Limpieza segura del contenido de demostracion conocido.
-- Puede ejecutarse mas de una vez: solo apunta a los IDs demo originales.

begin;

-- Al borrar una clase, PostgreSQL elimina por cascada sus asignaciones y vistas.
delete from public.lessons
where id in (
  'bar-charts',
  'frequency-tables',
  'central-tendency',
  'probability-intro',
  'final-project',
  'boxplot',
  'dispersion-measures'
);

-- Al borrar el quiz, PostgreSQL elimina por cascada sus asignaciones,
-- intentos, respuestas y eventos de seguridad asociados.
delete from public.quizzes
where id = 'quiz-demo-estadistica-p1';

commit;

-- Verificacion: las cuatro cantidades deben quedar en cero si no se ha
-- creado contenido real nuevo con otros IDs.
select 'lessons' as item, count(*)::bigint as total from public.lessons
union all
select 'assignment_lessons', count(*)::bigint from public.assignment_lessons
union all
select 'quizzes', count(*)::bigint from public.quizzes
union all
select 'quiz_assignments', count(*)::bigint from public.quiz_assignments
order by item;
