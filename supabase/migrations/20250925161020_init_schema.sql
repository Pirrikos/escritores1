-- ==========================================
-- INIT SCHEMA: escritores (v1.0)
-- ==========================================

-- TABLAS
--------------------------------------------

-- Perfiles de usuario
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  bio text,
  created_at timestamptz default now()
);

-- Obras (libros)
create table works (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references profiles(id) on delete cascade,
  title text not null,
  synopsis text,
  cover_url text,
  status text check (status in ('draft','published')) default 'published',
  isbn text,
  created_at timestamptz default now()
);

-- Publicaciones (poemas/capítulos)
create table posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references profiles(id) on delete cascade,
  work_id uuid references works(id) on delete set null,
  type text check (type in ('poem','chapter')) not null,
  title text,
  content text not null,
  chapter_index int,
  status text check (status in ('draft','published')) default 'published',
  published_at timestamptz default now()
);

-- Seguimientos (follows)
create table follows (
  follower_id uuid references profiles(id) on delete cascade,
  following_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (follower_id, following_id)
);

-- Likes
create table likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  post_id uuid references posts(id) on delete cascade,
  created_at timestamptz default now(),
  unique (user_id, post_id)
);

-- ==========================================
-- RLS + POLÍTICAS DE SEGURIDAD
-- ==========================================

-- Habilitar RLS en todas las tablas
alter table profiles enable row level security;
alter table works    enable row level security;
alter table posts    enable row level security;
alter table follows  enable row level security;
alter table likes    enable row level security;

-- PERFIL
create policy "Public read profiles"
  on profiles for select using ( true );

create policy "Users update own profile"
  on profiles for update using ( auth.uid() = id );

create policy "Users insert own profile"
  on profiles for insert with check ( auth.uid() = id );

-- Crear perfil automáticamente al registrarse
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'Usuario'), new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- WORKS
create policy "Read published works or own"
  on works for select using ( status = 'published' or author_id = auth.uid() );

create policy "Insert own works"
  on works for insert with check ( author_id = auth.uid() );

create policy "Update own works"
  on works for update using ( author_id = auth.uid() ) with check ( author_id = auth.uid() );

create policy "Delete own works"
  on works for delete using ( author_id = auth.uid() );

-- POSTS
create policy "Read published posts or own"
  on posts for select using ( status = 'published' or author_id = auth.uid() );

create policy "Insert own posts"
  on posts for insert with check ( author_id = auth.uid() );

create policy "Update own posts"
  on posts for update using ( author_id = auth.uid() ) with check ( author_id = auth.uid() );

create policy "Delete own posts"
  on posts for delete using ( author_id = auth.uid() );

-- FOLLOWS
create policy "Public read follows"
  on follows for select using ( true );

create policy "User can follow"
  on follows for insert with check ( follower_id = auth.uid() );

create policy "User can unfollow"
  on follows for delete using ( follower_id = auth.uid() );

-- LIKES
create policy "Public read likes"
  on likes for select using ( true );

create policy "User can like"
  on likes for insert with check ( user_id = auth.uid() );

create policy "User can unlike"
  on likes for delete using ( user_id = auth.uid() );

-- ==========================================
-- ÍNDICES
-- ==========================================

create index if not exists idx_posts_published_at on posts (published_at desc);
create index if not exists idx_posts_author on posts (author_id);
create index if not exists idx_posts_status on posts (status);
create index if not exists idx_works_author on works (author_id);
create index if not exists idx_works_status on works (status);
create index if not exists idx_likes_post on likes (post_id);
create index if not exists idx_likes_user on likes (user_id);
create index if not exists idx_follows_follower on follows (follower_id);
create index if not exists idx_follows_following on follows (following_id);
