-- Create manual reading list table for works only
create table if not exists public.reading_list (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  work_slug text not null,
  created_at timestamptz not null default now(),
  constraint uq_reading_list unique (user_id, work_slug)
);

-- Indexes for performance
create index if not exists idx_reading_list_user_created_at on public.reading_list (user_id, created_at desc);
create index if not exists idx_reading_list_work_slug on public.reading_list (work_slug);

-- Enable RLS
alter table public.reading_list enable row level security;

-- Policies: users can read/insert/delete only their own entries
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'reading_list' and policyname = 'select_own_reading_list'
  ) then
    create policy select_own_reading_list on public.reading_list for select using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'reading_list' and policyname = 'insert_own_reading_list'
  ) then
    create policy insert_own_reading_list on public.reading_list for insert with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'reading_list' and policyname = 'delete_own_reading_list'
  ) then
    create policy delete_own_reading_list on public.reading_list for delete using (auth.uid() = user_id);
  end if;
end $$;

-- Optional comment
comment on table public.reading_list is 'Manual reading list: works saved by users';