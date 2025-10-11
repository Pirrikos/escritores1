-- Create manual reading list table for chapters
create table if not exists public.reading_list_chapters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  chapter_slug text not null,
  parent_work_slug text,
  created_at timestamptz not null default now(),
  constraint uq_reading_list_chapters unique (user_id, chapter_slug)
);

-- Indexes for performance
create index if not exists idx_reading_list_chapters_user_created_at on public.reading_list_chapters (user_id, created_at desc);
create index if not exists idx_reading_list_chapters_chapter_slug on public.reading_list_chapters (chapter_slug);

-- Enable RLS
alter table public.reading_list_chapters enable row level security;

-- Policies: users can read/insert/delete only their own entries
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'reading_list_chapters' and policyname = 'select_own_reading_list_chapters'
  ) then
    create policy select_own_reading_list_chapters on public.reading_list_chapters for select using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'reading_list_chapters' and policyname = 'insert_own_reading_list_chapters'
  ) then
    create policy insert_own_reading_list_chapters on public.reading_list_chapters for insert with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'reading_list_chapters' and policyname = 'delete_own_reading_list_chapters'
  ) then
    create policy delete_own_reading_list_chapters on public.reading_list_chapters for delete using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'reading_list_chapters' and policyname = 'update_own_reading_list_chapters'
  ) then
    create policy update_own_reading_list_chapters on public.reading_list_chapters for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

comment on table public.reading_list_chapters is 'Manual reading list: chapters saved by users';