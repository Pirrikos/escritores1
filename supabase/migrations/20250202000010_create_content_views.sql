-- Create content_views table to track PDF view events
create table if not exists public.content_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  content_type text not null check (content_type in ('work','chapter')),
  content_slug text not null,
  bucket text null,
  file_path text null,
  created_at timestamptz not null default now()
);

-- Indexes for performance
create index if not exists idx_content_views_created_at on public.content_views (created_at desc);
create index if not exists idx_content_views_type_slug on public.content_views (content_type, content_slug);

-- Enable RLS and basic policies
alter table public.content_views enable row level security;

-- Allow anyone to read recent views (for social feed)
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'content_views' and policyname = 'read_all_views'
  ) then
    create policy read_all_views on public.content_views for select using (true);
  end if;
end $$;

-- Allow authenticated users to insert their own view events
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'content_views' and policyname = 'insert_own_views'
  ) then
    create policy insert_own_views on public.content_views for insert with check (auth.uid() = user_id);
  end if;
end $$;