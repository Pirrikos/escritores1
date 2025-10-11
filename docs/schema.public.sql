-- =====================================================
-- Synthetic DDL: public schema (generated from migrations)
-- NOTE: This file is for documentation/reference only.
-- It compiles the final intended schema as reflected by migrations.
-- No execution is performed as per request.
-- =====================================================

-- =========================
-- Types
-- =========================
-- Final enum values after 2025-02-01 update
CREATE TYPE IF NOT EXISTS public.work_category AS ENUM (
  'otras',
  'Novela',
  'Cuento',
  'Poesía',
  'Teatro',
  'Ensayo',
  'Fantasía',
  'Ciencia ficción',
  'Romance',
  'Misterio',
  'Terror'
);

-- =========================
-- Tables
-- =========================

-- profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  avatar_url text,
  bio text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- profiles constraints (robustness)
ALTER TABLE public.profiles 
  ADD CONSTRAINT IF NOT EXISTS profiles_display_name_length CHECK (char_length(display_name) BETWEEN 1 AND 100),
  ADD CONSTRAINT IF NOT EXISTS profiles_bio_length CHECK (bio IS NULL OR char_length(bio) <= 500),
  ADD CONSTRAINT IF NOT EXISTS profiles_display_name_not_empty CHECK (trim(display_name) != '');

-- profiles RLS & policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Public read profiles'
  ) THEN
    CREATE POLICY "Public read profiles" ON public.profiles FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Users update own profile'
  ) THEN
    CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Users insert own profile'
  ) THEN
    CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- profiles functions/triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.validate_profile_data()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.display_name !~ '[a-zA-Z0-9]' THEN
    RAISE EXCEPTION 'Display name must contain at least one alphanumeric character';
  END IF;
  IF NEW.avatar_url IS NOT NULL AND NEW.avatar_url !~ '^https?://' THEN
    RAISE EXCEPTION 'Avatar URL must be a valid HTTP/HTTPS URL';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_profile_data_trigger ON public.profiles;
CREATE TRIGGER validate_profile_data_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_profile_data();

-- Auto-create profile on auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
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

COMMENT ON TABLE public.profiles IS 'User profiles with enhanced validation constraints';

-- works
CREATE TABLE IF NOT EXISTS public.works (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  synopsis text,
  cover_url text,
  status text CHECK (status IN ('draft','published')) DEFAULT 'published',
  isbn text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  -- additions
  slug text,
  file_type text,
  file_url text,
  file_size bigint,
  category public.work_category DEFAULT 'otras'
);

-- works constraints
ALTER TABLE public.works 
  ADD CONSTRAINT IF NOT EXISTS works_title_length CHECK (char_length(title) BETWEEN 1 AND 200),
  ADD CONSTRAINT IF NOT EXISTS works_synopsis_length CHECK (synopsis IS NULL OR char_length(synopsis) <= 2000),
  ADD CONSTRAINT IF NOT EXISTS works_title_not_empty CHECK (trim(title) != ''),
  ADD CONSTRAINT IF NOT EXISTS works_isbn_format CHECK (isbn IS NULL OR isbn ~ '^[0-9\-X]{10,17}$'),
  ADD CONSTRAINT IF NOT EXISTS works_author_exists CHECK (author_id IS NOT NULL);

-- works RLS & policies
ALTER TABLE public.works ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'works' AND policyname = 'Read published works or own'
  ) THEN
    CREATE POLICY "Read published works or own" ON public.works FOR SELECT USING (status = 'published' OR author_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'works' AND policyname = 'Insert own works'
  ) THEN
    CREATE POLICY "Insert own works" ON public.works FOR INSERT WITH CHECK (author_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'works' AND policyname = 'Update own works'
  ) THEN
    CREATE POLICY "Update own works" ON public.works FOR UPDATE USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'works' AND policyname = 'Delete own works'
  ) THEN
    CREATE POLICY "Delete own works" ON public.works FOR DELETE USING (author_id = auth.uid());
  END IF;
END $$;

-- works indexes & comments
CREATE INDEX IF NOT EXISTS idx_works_author ON public.works(author_id);
CREATE INDEX IF NOT EXISTS idx_works_status ON public.works(status);
CREATE INDEX IF NOT EXISTS idx_works_title_search ON public.works USING gin(to_tsvector('spanish', title));
CREATE INDEX IF NOT EXISTS idx_works_category ON public.works(category);
CREATE INDEX IF NOT EXISTS idx_works_slug ON public.works(slug);
ALTER TABLE public.works ADD CONSTRAINT unique_works_slug UNIQUE (slug);
COMMENT ON COLUMN public.works.file_type IS 'MIME type of the uploaded work file (e.g., application/pdf, application/epub+zip)';
COMMENT ON COLUMN public.works.file_url IS 'URL or path to the uploaded work file in storage';
COMMENT ON COLUMN public.works.file_size IS 'Size of the uploaded work file in bytes';
COMMENT ON COLUMN public.works.slug IS 'URL-friendly identifier generated from the work title';
COMMENT ON COLUMN public.works.category IS 'Categoría literaria de la obra';
COMMENT ON TABLE public.works IS 'Literary works with title and content validation';

-- posts
CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  work_id uuid REFERENCES public.works(id) ON DELETE SET NULL,
  type text CHECK (type IN ('poem','chapter')) NOT NULL,
  title text,
  content text NOT NULL,
  chapter_index int,
  status text CHECK (status IN ('draft','published')) DEFAULT 'published',
  published_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- posts constraints (robustness)
ALTER TABLE public.posts 
  ADD CONSTRAINT IF NOT EXISTS posts_title_length CHECK (title IS NULL OR char_length(title) BETWEEN 1 AND 300),
  ADD CONSTRAINT IF NOT EXISTS posts_content_length CHECK (char_length(content) BETWEEN 1 AND 100000),
  ADD CONSTRAINT IF NOT EXISTS posts_content_not_empty CHECK (trim(content) != ''),
  ADD CONSTRAINT IF NOT EXISTS posts_chapter_index_positive CHECK (chapter_index IS NULL OR chapter_index > 0),
  ADD CONSTRAINT IF NOT EXISTS posts_title_required_for_chapters CHECK ((type = 'chapter' AND title IS NOT NULL) OR type != 'chapter'),
  ADD CONSTRAINT IF NOT EXISTS posts_work_id_required_for_chapters CHECK ((type = 'chapter' AND work_id IS NOT NULL) OR type != 'chapter'),
  ADD CONSTRAINT IF NOT EXISTS posts_published_at_required CHECK ((status = 'published' AND published_at IS NOT NULL) OR status != 'published'),
  ADD CONSTRAINT IF NOT EXISTS posts_author_exists CHECK (author_id IS NOT NULL);

-- posts RLS & policies
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'posts' AND policyname = 'Read published posts or own'
  ) THEN
    CREATE POLICY "Read published posts or own" ON public.posts FOR SELECT USING (status = 'published' OR author_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'posts' AND policyname = 'Insert own posts'
  ) THEN
    CREATE POLICY "Insert own posts" ON public.posts FOR INSERT WITH CHECK (author_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'posts' AND policyname = 'Update own posts'
  ) THEN
    CREATE POLICY "Update own posts" ON public.posts FOR UPDATE USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'posts' AND policyname = 'Delete own posts'
  ) THEN
    CREATE POLICY "Delete own posts" ON public.posts FOR DELETE USING (author_id = auth.uid());
  END IF;
END $$;

-- posts functions/triggers
DROP TRIGGER IF EXISTS update_posts_updated_at ON public.posts;
CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.validate_post_content()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.content ~* '<script|javascript:|data:|vbscript:|onload|onerror|onclick' THEN
    RAISE EXCEPTION 'Content contains potentially malicious code';
  END IF;
  IF (char_length(NEW.content) - char_length(regexp_replace(NEW.content, '<[^>]*>', '', 'g'))) > (char_length(NEW.content) * 0.3) THEN
    RAISE EXCEPTION 'Content contains excessive HTML markup';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_post_content_trigger ON public.posts;
CREATE TRIGGER validate_post_content_trigger
  BEFORE INSERT OR UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.validate_post_content();

CREATE OR REPLACE FUNCTION public.check_post_rate_limit()
RETURNS TRIGGER AS $$
DECLARE recent_posts_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO recent_posts_count FROM public.posts WHERE author_id = NEW.author_id AND created_at > (now() - interval '5 minutes');
  IF recent_posts_count >= 5 THEN
    RAISE EXCEPTION 'Rate limit exceeded: too many posts in a short time';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_post_rate_limit_trigger ON public.posts;
CREATE TRIGGER check_post_rate_limit_trigger
  BEFORE INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.check_post_rate_limit();

-- posts indexes/comments
CREATE INDEX IF NOT EXISTS idx_posts_published_at ON public.posts (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_author ON public.posts (author_id);
CREATE INDEX IF NOT EXISTS idx_posts_status ON public.posts (status);
CREATE INDEX IF NOT EXISTS idx_posts_content_search ON public.posts USING gin(to_tsvector('spanish', content));
CREATE INDEX IF NOT EXISTS idx_posts_title_search ON public.posts USING gin(to_tsvector('spanish', title));
CREATE INDEX IF NOT EXISTS idx_posts_published_recent ON public.posts (published_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_posts_draft_by_author ON public.posts (author_id, updated_at DESC) WHERE status = 'draft';
COMMENT ON TABLE public.posts IS 'Posts/chapters with content validation and rate limiting';

-- chapters
CREATE TABLE IF NOT EXISTS public.chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id uuid REFERENCES public.works(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(trim(title)) > 0 AND length(title) <= 200),
  content text NOT NULL CHECK (length(trim(content)) > 0 AND length(content) <= 100000),
  chapter_number integer NOT NULL CHECK (chapter_number > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  published_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  -- additions
  is_independent boolean DEFAULT false,
  file_url text,
  file_name text,
  file_size bigint,
  file_type text,
  cover_url text,
  slug text
);

-- chapters constraints
ALTER TABLE public.chapters ADD CONSTRAINT IF NOT EXISTS chapters_work_chapter_unique UNIQUE (work_id, chapter_number) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public.chapters ADD CONSTRAINT IF NOT EXISTS chapters_work_id_check 
  CHECK ((work_id IS NOT NULL AND chapter_number IS NOT NULL AND is_independent = false) OR (work_id IS NULL AND is_independent = true));
ALTER TABLE public.chapters ADD CONSTRAINT IF NOT EXISTS chapters_published_at_check 
  CHECK (((status = 'published') AND published_at IS NOT NULL) OR (status = 'draft'));
ALTER TABLE public.chapters ADD CONSTRAINT unique_chapters_slug UNIQUE (slug);

-- chapters RLS & policies
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chapters' AND policyname = 'Users can read published chapters and own chapters'
  ) THEN
    CREATE POLICY "Users can read published chapters and own chapters" ON public.chapters FOR SELECT USING (status = 'published' OR author_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chapters' AND policyname = 'Users can insert own chapters'
  ) THEN
    CREATE POLICY "Users can insert own chapters" ON public.chapters FOR INSERT WITH CHECK (author_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chapters' AND policyname = 'Users can update own chapters'
  ) THEN
    CREATE POLICY "Users can update own chapters" ON public.chapters FOR UPDATE USING (author_id = auth.uid());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'chapters' AND policyname = 'Users can delete own chapters'
  ) THEN
    CREATE POLICY "Users can delete own chapters" ON public.chapters FOR DELETE USING (author_id = auth.uid());
  END IF;
END $$;

-- chapters triggers
CREATE OR REPLACE FUNCTION public.update_chapters_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_chapters_updated_at_trigger ON public.chapters;
CREATE TRIGGER update_chapters_updated_at_trigger
  BEFORE UPDATE ON public.chapters
  FOR EACH ROW EXECUTE FUNCTION public.update_chapters_updated_at();

CREATE OR REPLACE FUNCTION public.validate_chapter_content()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.content ~* '<script|javascript:|data:|vbscript:|onload|onerror|onclick' THEN
    RAISE EXCEPTION 'Chapter content contains potentially malicious patterns';
  END IF;
  IF (length(NEW.content) - length(replace(NEW.content, '<', ''))) > 100 THEN
    RAISE EXCEPTION 'Chapter content contains excessive HTML markup';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_chapter_content_trigger ON public.chapters;
CREATE TRIGGER validate_chapter_content_trigger
  BEFORE INSERT OR UPDATE ON public.chapters
  FOR EACH ROW EXECUTE FUNCTION public.validate_chapter_content();

-- chapters indexes/comments
CREATE INDEX IF NOT EXISTS idx_chapters_work_id ON public.chapters(work_id);
CREATE INDEX IF NOT EXISTS idx_chapters_author_id ON public.chapters(author_id);
CREATE INDEX IF NOT EXISTS idx_chapters_published_at ON public.chapters(published_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_chapters_status ON public.chapters(status);
CREATE INDEX IF NOT EXISTS idx_chapters_work_chapter ON public.chapters(work_id, chapter_number);
CREATE INDEX IF NOT EXISTS idx_chapters_independent ON public.chapters(is_independent) WHERE is_independent = true;
CREATE INDEX IF NOT EXISTS idx_chapters_file_type ON public.chapters(file_type) WHERE file_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chapters_slug ON public.chapters(slug);
CREATE INDEX IF NOT EXISTS idx_chapters_file_url ON public.chapters(file_url);
COMMENT ON TABLE public.chapters IS 'Stores book chapters with content, metadata, and publication status';
COMMENT ON COLUMN public.chapters.work_id IS 'Reference to parent work (optional for independent chapters)';
COMMENT ON COLUMN public.chapters.author_id IS 'Reference to the chapter author (must match work author)';
COMMENT ON COLUMN public.chapters.title IS 'Chapter title (1-200 characters)';
COMMENT ON COLUMN public.chapters.content IS 'Chapter content (1-100,000 characters)';
COMMENT ON COLUMN public.chapters.chapter_number IS 'Sequential chapter number within the work';
COMMENT ON COLUMN public.chapters.status IS 'Publication status: draft or published';
COMMENT ON COLUMN public.chapters.published_at IS 'Timestamp when chapter was published';
COMMENT ON COLUMN public.chapters.slug IS 'URL-friendly identifier generated from the chapter title';

-- likes (final normalized form)
CREATE TABLE IF NOT EXISTS public.likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('post','chapter','work')),
  target_id uuid NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, target_type, target_id)
);

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'likes' AND policyname = 'Anyone can read likes'
  ) THEN
    CREATE POLICY "Anyone can read likes" ON public.likes FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'likes' AND policyname = 'Authenticated users can create likes'
  ) THEN
    CREATE POLICY "Authenticated users can create likes" ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'likes' AND policyname = 'Users can delete own likes'
  ) THEN
    CREATE POLICY "Users can delete own likes" ON public.likes FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_likes_target ON public.likes(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_likes_user ON public.likes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_created_at ON public.likes(created_at DESC);

CREATE OR REPLACE FUNCTION public.get_like_count(content_type text, content_id uuid)
RETURNS integer AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::integer FROM public.likes WHERE target_type = content_type AND target_id = content_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.user_has_liked(content_type text, content_id uuid, user_uuid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.likes WHERE target_type = content_type AND target_id = content_id AND user_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_like_count(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_liked(text, uuid, uuid) TO authenticated;
COMMENT ON TABLE public.likes IS 'Stores likes for posts, chapters, and works';
COMMENT ON COLUMN public.likes.target_type IS 'Type of content being liked: post, chapter, or work';
COMMENT ON COLUMN public.likes.target_id IS 'ID of the content being liked';
COMMENT ON COLUMN public.likes.user_id IS 'ID of the user who liked the content';

-- follows (id-based form)
CREATE TABLE IF NOT EXISTS public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'follows' AND policyname = 'Anyone can read follows'
  ) THEN
    CREATE POLICY "Anyone can read follows" ON public.follows FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'follows' AND policyname = 'Authenticated users can follow'
  ) THEN
    CREATE POLICY "Authenticated users can follow" ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id AND follower_id <> following_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'follows' AND policyname = 'Users can unfollow their own follows'
  ) THEN
    CREATE POLICY "Users can unfollow their own follows" ON public.follows FOR DELETE USING (auth.uid() = follower_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows(following_id);
CREATE INDEX IF NOT EXISTS idx_follows_created_at ON public.follows(created_at DESC);

CREATE OR REPLACE FUNCTION public.get_followers_count(user_uuid uuid)
RETURNS integer AS $$
BEGIN
  RETURN (SELECT COUNT(*)::integer FROM public.follows WHERE following_id = user_uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_following_count(user_uuid uuid)
RETURNS integer AS $$
BEGIN
  RETURN (SELECT COUNT(*)::integer FROM public.follows WHERE follower_id = user_uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.user_is_following(follower_uuid uuid, following_uuid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.follows WHERE follower_id = follower_uuid AND following_id = following_uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_followers_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_following_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_following(uuid, uuid) TO authenticated;
COMMENT ON TABLE public.follows IS 'User-to-user follow relationships';
COMMENT ON COLUMN public.follows.follower_id IS 'User who follows';
COMMENT ON COLUMN public.follows.following_id IS 'User being followed';

-- content_views
CREATE TABLE IF NOT EXISTS public.content_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('work','chapter')),
  content_slug text NOT NULL,
  bucket text,
  file_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.content_views ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'content_views' AND policyname = 'read_all_views'
  ) THEN
    CREATE POLICY read_all_views ON public.content_views FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'content_views' AND policyname = 'insert_own_views'
  ) THEN
    CREATE POLICY insert_own_views ON public.content_views FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_content_views_created_at ON public.content_views (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_views_type_slug ON public.content_views (content_type, content_slug);
CREATE INDEX IF NOT EXISTS idx_content_views_user_created_at ON public.content_views (user_id, created_at DESC);

-- reading_progress
CREATE TABLE IF NOT EXISTS public.reading_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('work','chapter')),
  content_slug text NOT NULL,
  bucket text,
  file_path text,
  last_page int NOT NULL DEFAULT 1,
  num_pages int,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_reading_progress UNIQUE (user_id, content_type, content_slug)
);

ALTER TABLE public.reading_progress ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reading_progress' AND policyname = 'select_own_progress'
  ) THEN
    CREATE POLICY select_own_progress ON public.reading_progress FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reading_progress' AND policyname = 'insert_own_progress'
  ) THEN
    CREATE POLICY insert_own_progress ON public.reading_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reading_progress' AND policyname = 'update_own_progress'
  ) THEN
    CREATE POLICY update_own_progress ON public.reading_progress FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_reading_progress_updated_at ON public.reading_progress (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_reading_progress_user_content ON public.reading_progress (user_id, content_type, content_slug);
CREATE INDEX IF NOT EXISTS idx_reading_progress_user_type_slug_updated ON public.reading_progress (user_id, content_type, content_slug, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_reading_progress_user_type_path_updated ON public.reading_progress (user_id, content_type, file_path, updated_at DESC);

-- reading_list
CREATE TABLE IF NOT EXISTS public.reading_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  work_slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_reading_list UNIQUE (user_id, work_slug)
);

ALTER TABLE public.reading_list ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reading_list' AND policyname = 'select_own_reading_list'
  ) THEN
    CREATE POLICY select_own_reading_list ON public.reading_list FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reading_list' AND policyname = 'insert_own_reading_list'
  ) THEN
    CREATE POLICY insert_own_reading_list ON public.reading_list FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reading_list' AND policyname = 'delete_own_reading_list'
  ) THEN
    CREATE POLICY delete_own_reading_list ON public.reading_list FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_reading_list_user_created_at ON public.reading_list (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reading_list_work_slug ON public.reading_list (work_slug);
COMMENT ON TABLE public.reading_list IS 'Manual reading list: works saved by users';

-- =========================
-- Views
-- =========================
CREATE OR REPLACE VIEW public.post_statistics AS
SELECT 
  author_id,
  COUNT(*) AS total_posts,
  COUNT(*) FILTER (WHERE status = 'published') AS published_posts,
  COUNT(*) FILTER (WHERE status = 'draft') AS draft_posts,
  COUNT(*) FILTER (WHERE published_at > now() - interval '24 hours') AS posts_last_24h,
  MAX(published_at) AS last_post_date
FROM public.posts
GROUP BY author_id;

GRANT SELECT ON public.post_statistics TO authenticated;
COMMENT ON VIEW public.post_statistics IS 'Aggregated statistics for user posts';

CREATE OR REPLACE VIEW public.independent_chapters AS
SELECT 
  id,
  author_id,
  title,
  content,
  file_url,
  file_name,
  file_size,
  file_type,
  cover_url,
  status,
  published_at,
  created_at,
  updated_at
FROM public.chapters
WHERE is_independent = true;

GRANT SELECT ON public.independent_chapters TO authenticated;

CREATE OR REPLACE VIEW public.chapter_statistics AS
SELECT
  author_id,
  COUNT(*) AS total_chapters,
  COUNT(*) FILTER (WHERE status = 'published') AS published_chapters,
  COUNT(*) FILTER (WHERE status = 'draft') AS draft_chapters,
  COUNT(*) FILTER (WHERE is_independent = true) AS independent_chapters,
  COUNT(*) FILTER (WHERE is_independent = false) AS work_chapters,
  COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours') AS chapters_last_24h,
  MAX(created_at) AS last_chapter_date
FROM public.chapters
GROUP BY author_id;

GRANT SELECT ON public.chapter_statistics TO authenticated;

-- =========================
-- Misc
-- =========================
CREATE TABLE IF NOT EXISTS public.migration_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_name text UNIQUE NOT NULL,
  applied_at timestamptz DEFAULT now() NOT NULL,
  description text
);

-- Schema-level grants (as per chapters migration)
GRANT USAGE ON SCHEMA public TO authenticated;

-- Optional direct grants (only those explicitly present in migrations)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chapters TO authenticated;

-- End of synthetic DDL