-- Safe backfill for legacy init schema and missing indexes
-- Ensures tables, policies, triggers, and indexes exist without Docker

SET lock_timeout = '5s';
SET statement_timeout = '30s';

-- Tables: create if not exists
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  avatar_url text,
  bio text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.works (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  synopsis text,
  cover_url text,
  status text CHECK (status IN ('draft','published')) DEFAULT 'published',
  isbn text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  work_id uuid REFERENCES works(id) ON DELETE SET NULL,
  type text CHECK (type IN ('poem','chapter')) NOT NULL,
  title text,
  content text NOT NULL,
  chapter_index int,
  status text CHECK (status IN ('draft','published')) DEFAULT 'published',
  published_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.follows (
  follower_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  following_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (follower_id, following_id)
);

CREATE TABLE IF NOT EXISTS public.likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, post_id)
);

-- Enable RLS where tables exist
DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
  END IF;
  IF to_regclass('public.works') IS NOT NULL THEN
    ALTER TABLE public.works ENABLE ROW LEVEL SECURITY;
  END IF;
  IF to_regclass('public.posts') IS NOT NULL THEN
    ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
  END IF;
  IF to_regclass('public.follows') IS NOT NULL THEN
    ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
  END IF;
  IF to_regclass('public.likes') IS NOT NULL THEN
    ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
  END IF;
END$$;

-- Policies: create if missing
DO $$
BEGIN
  -- profiles policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Public read profiles'
  ) THEN
    CREATE POLICY "Public read profiles" ON public.profiles FOR SELECT USING ( true );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Users update own profile'
  ) THEN
    CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING ( auth.uid() = id );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Users insert own profile'
  ) THEN
    CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK ( auth.uid() = id );
  END IF;

  -- works policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='works' AND policyname='Read published works or own'
  ) THEN
    CREATE POLICY "Read published works or own" ON public.works FOR SELECT USING ( status = 'published' OR author_id = auth.uid() );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='works' AND policyname='Insert own works'
  ) THEN
    CREATE POLICY "Insert own works" ON public.works FOR INSERT WITH CHECK ( author_id = auth.uid() );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='works' AND policyname='Update own works'
  ) THEN
    CREATE POLICY "Update own works" ON public.works FOR UPDATE USING ( author_id = auth.uid() ) WITH CHECK ( author_id = auth.uid() );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='works' AND policyname='Delete own works'
  ) THEN
    CREATE POLICY "Delete own works" ON public.works FOR DELETE USING ( author_id = auth.uid() );
  END IF;

  -- posts policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='posts' AND policyname='Read published posts or own'
  ) THEN
    CREATE POLICY "Read published posts or own" ON public.posts FOR SELECT USING ( status = 'published' OR author_id = auth.uid() );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='posts' AND policyname='Insert own posts'
  ) THEN
    CREATE POLICY "Insert own posts" ON public.posts FOR INSERT WITH CHECK ( author_id = auth.uid() );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='posts' AND policyname='Update own posts'
  ) THEN
    CREATE POLICY "Update own posts" ON public.posts FOR UPDATE USING ( author_id = auth.uid() ) WITH CHECK ( author_id = auth.uid() );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='posts' AND policyname='Delete own posts'
  ) THEN
    CREATE POLICY "Delete own posts" ON public.posts FOR DELETE USING ( author_id = auth.uid() );
  END IF;

  -- follows policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='follows' AND policyname='Public read follows'
  ) THEN
    CREATE POLICY "Public read follows" ON public.follows FOR SELECT USING ( true );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='follows' AND policyname='User can follow'
  ) THEN
    CREATE POLICY "User can follow" ON public.follows FOR INSERT WITH CHECK ( follower_id = auth.uid() );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='follows' AND policyname='User can unfollow'
  ) THEN
    CREATE POLICY "User can unfollow" ON public.follows FOR DELETE USING ( follower_id = auth.uid() );
  END IF;

  -- likes policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='likes' AND policyname='Public read likes'
  ) THEN
    CREATE POLICY "Public read likes" ON public.likes FOR SELECT USING ( true );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='likes' AND policyname='User can like'
  ) THEN
    CREATE POLICY "User can like" ON public.likes FOR INSERT WITH CHECK ( user_id = auth.uid() );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='likes' AND policyname='User can unlike'
  ) THEN
    CREATE POLICY "User can unlike" ON public.likes FOR DELETE USING ( user_id = auth.uid() );
  END IF;
END $$;

-- Function and trigger for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario'), NEW.raw_user_meta_data->>'avatar_url');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Indexes from init schema (guarded by column existence)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='posts' AND column_name='published_at') THEN
    CREATE INDEX IF NOT EXISTS idx_posts_published_at ON public.posts (published_at DESC);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='posts' AND column_name='author_id') THEN
    CREATE INDEX IF NOT EXISTS idx_posts_author ON public.posts (author_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='posts' AND column_name='status') THEN
    CREATE INDEX IF NOT EXISTS idx_posts_status ON public.posts (status);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='works' AND column_name='author_id') THEN
    CREATE INDEX IF NOT EXISTS idx_works_author ON public.works (author_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='works' AND column_name='status') THEN
    CREATE INDEX IF NOT EXISTS idx_works_status ON public.works (status);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='likes' AND column_name='post_id') THEN
    CREATE INDEX IF NOT EXISTS idx_likes_post ON public.likes (post_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='likes' AND column_name='user_id') THEN
    CREATE INDEX IF NOT EXISTS idx_likes_user ON public.likes (user_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='follows' AND column_name='follower_id') THEN
    CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows (follower_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='follows' AND column_name='following_id') THEN
    CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows (following_id);
  END IF;
END $$;

-- Extra indexes for Mis Lecturas (guarded by column existence)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='content_views' AND column_name='user_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='content_views' AND column_name='created_at') THEN
    CREATE INDEX IF NOT EXISTS idx_content_views_user_created_at ON public.content_views (user_id, created_at DESC);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='reading_progress' AND column_name='user_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='reading_progress' AND column_name='content_type')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='reading_progress' AND column_name='content_slug')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='reading_progress' AND column_name='updated_at') THEN
    CREATE INDEX IF NOT EXISTS idx_reading_progress_user_type_slug_updated ON public.reading_progress (user_id, content_type, content_slug, updated_at DESC);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='reading_progress' AND column_name='user_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='reading_progress' AND column_name='content_type')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='reading_progress' AND column_name='file_path')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='reading_progress' AND column_name='updated_at') THEN
    CREATE INDEX IF NOT EXISTS idx_reading_progress_user_type_path_updated ON public.reading_progress (user_id, content_type, file_path, updated_at DESC);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='chapters' AND column_name='slug') THEN
    CREATE INDEX IF NOT EXISTS idx_chapters_slug ON public.chapters (slug);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='chapters' AND column_name='file_url') THEN
    CREATE INDEX IF NOT EXISTS idx_chapters_file_url ON public.chapters (file_url);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='works' AND column_name='slug') THEN
    CREATE INDEX IF NOT EXISTS idx_works_slug ON public.works (slug);
  END IF;
END $$;

-- Backfill migration_log for legacy migrations
INSERT INTO public.migration_log (migration_name, applied_at, description)
SELECT '20250125000000_init_schema', now(), 'Legacy initial schema ensured via safe backfill'
WHERE EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename IN ('profiles','works','posts','follows','likes'))
ON CONFLICT (migration_name) DO NOTHING;

INSERT INTO public.migration_log (migration_name, applied_at, description)
SELECT '20250205000000_add_mis_lecturas_indexes', now(), 'Indexes for content_views, reading_progress, chapters, works'
WHERE EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname IN (
  'idx_content_views_user_created_at','idx_reading_progress_user_type_slug_updated','idx_reading_progress_user_type_path_updated','idx_chapters_slug','idx_chapters_file_url','idx_works_slug'
))
ON CONFLICT (migration_name) DO NOTHING;