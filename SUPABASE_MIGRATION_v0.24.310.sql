-- EncisoMath LMS v0.24.310
-- Ejecutar una sola vez en Supabase > SQL Editor antes de crear clases PDF.

begin;

alter table public.lessons
  add column if not exists thumbnail_url text,
  add column if not exists storage_pdf_path text,
  add column if not exists storage_thumbnail_path text,
  add column if not exists source_file_name text,
  add column if not exists page_count integer not null default 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lessons_page_count_check'
      and conrelid = 'public.lessons'::regclass
  ) then
    alter table public.lessons
      add constraint lessons_page_count_check check (page_count >= 1);
  end if;
end $$;

update storage.buckets
set
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/svg+xml',
    'audio/mpeg'
  ]::text[]
where id = 'lms-public';

commit;

select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'lessons'
  and column_name in (
    'thumbnail_url',
    'storage_pdf_path',
    'storage_thumbnail_path',
    'source_file_name',
    'page_count'
  )
order by column_name;
