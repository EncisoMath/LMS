-- EncisoMath LMS v0.24.305
-- Agrega la carga docente de Estadistica para el grupo 8-4.
-- Es idempotente: puede ejecutarse mas de una vez sin duplicar registros.

begin;

insert into public.teaching_assignments (
  id,
  teacher_id,
  subject_id,
  group_id,
  icon_url,
  active
)
select
  'mat-est-8-4',
  teacher.id,
  subject.id,
  academic_group.id,
  './assets/subject-statistics.svg',
  true
from public.profiles teacher
join public.subjects subject
  on subject.area = 'Matemáticas'
 and subject.name = 'Estadística'
join public.academic_groups academic_group
  on academic_group.academic_year = 2026
 and academic_group.campus = 'Municipal'
 and academic_group.grade = 8
 and academic_group.course = 4
where teacher.email = 'enciso.math@gmail.com'
  and teacher.role = 'teacher'
on conflict (id) do update set
  teacher_id = excluded.teacher_id,
  subject_id = excluded.subject_id,
  group_id = excluded.group_id,
  icon_url = excluded.icon_url,
  active = true,
  updated_at = now();

-- Deja disponibles en 8-4 las mismas clases existentes de Estadistica.
insert into public.assignment_lessons (
  assignment_id,
  lesson_id,
  sort_order,
  visible
)
select
  'mat-est-8-4',
  lesson.id,
  row_number() over (order by lesson.period, lesson.title)::integer,
  true
from public.lessons lesson
where lesson.area = 'Matemáticas'
  and lesson.subject_name = 'Estadística'
on conflict (assignment_id, lesson_id) do update set
  visible = true,
  sort_order = excluded.sort_order;

-- Asigna tambien el quiz demo publicado, si existe.
insert into public.quiz_assignments (
  quiz_id,
  assignment_id,
  status,
  settings
)
select
  quiz.id,
  'mat-est-8-4',
  'published'::public.content_status,
  '{}'::jsonb
from public.quizzes quiz
where quiz.id = 'quiz-demo-estadistica-p1'
on conflict (quiz_id, assignment_id) do update set
  status = excluded.status,
  updated_at = now();

commit;

-- Verificacion final: debe devolver una fila para 8-4.
select
  assignment.id,
  profile.email as teacher_email,
  subject.name as subject,
  academic_group.grade,
  academic_group.course,
  academic_group.campus,
  assignment.active,
  (
    select count(*)
    from public.group_enrollments enrollment
    where enrollment.group_id = assignment.group_id
      and enrollment.status = 'active'
  ) as active_students
from public.teaching_assignments assignment
join public.profiles profile on profile.id = assignment.teacher_id
join public.subjects subject on subject.id = assignment.subject_id
join public.academic_groups academic_group on academic_group.id = assignment.group_id
where assignment.id = 'mat-est-8-4';
