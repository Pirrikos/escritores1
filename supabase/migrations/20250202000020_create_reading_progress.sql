-- Create reading_progress table to store last read page per user and content
create table if not exists public.reading_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  content_type text not null check (content_type in ('work','chapter')),
  content_slug text not null,
  bucket text null,
  file_path text null,
  last_page int not null default 1,
  num_pages int null,
  updated_at timestamptz not null default now(),
  constraint uq_reading_progress unique (user_id, content_type, content_slug)
);

-- Indexes for performance
create index if not exists idx_reading_progress_updated_at on public.reading_progress (updated_at desc);
create index if not exists idx_reading_progress_user_content on public.reading_progress (user_id, content_type, content_slug);

-- Enable RLS and policies
alter table public.reading_progress enable row level security;

-- Allow authenticated users to read their own progress
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'reading_progress' and policyname = 'select_own_progress'
  ) then
    create policy select_own_progress on public.reading_progress for select using (auth.uid() = user_id);
  end if;
end $$;

-- Allow authenticated users to insert their own progress
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'reading_progress' and policyname = 'insert_own_progress'
  ) then
    create policy insert_own_progress on public.reading_progress for insert with check (auth.uid() = user_id);
  end if;
end $$;

-- Allow authenticated users to update their own progress
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'reading_progress' and policyname = 'update_own_progress'
  ) then
    create policy update_own_progress on public.reading_progress for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;