-- Cleanup and unify likes table to polymorphic model
-- - Backfill legacy post_id into target_type/target_id
-- - Ensure unique constraint on (user_id, target_type, target_id)
-- - Drop legacy post_id column if present
-- - Reassert RLS policies for consistency

DO $$
BEGIN
  -- Backfill target_type/target_id from legacy post_id if column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'likes' AND column_name = 'post_id'
  ) THEN
    -- Ensure target_type column exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'likes' AND column_name = 'target_type'
    ) THEN
      ALTER TABLE public.likes 
      ADD COLUMN target_type text NOT NULL DEFAULT 'post' 
      CHECK (target_type IN ('post', 'chapter', 'work'));
    END IF;

    -- Ensure target_id column exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'likes' AND column_name = 'target_id'
    ) THEN
      ALTER TABLE public.likes ADD COLUMN target_id uuid;
    END IF;

    -- Backfill values from post_id where target_id is NULL
    UPDATE public.likes 
    SET target_type = COALESCE(target_type, 'post'),
        target_id = CASE WHEN target_id IS NULL THEN post_id ELSE target_id END
    WHERE post_id IS NOT NULL;

    -- Drop legacy column
    ALTER TABLE public.likes DROP COLUMN post_id;
  END IF;
END $$;

-- Ensure unique constraint on (user_id, target_type, target_id)
DO $$
DECLARE
  constraint_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'likes' AND c.conname = 'likes_unique_user_target'
  ) INTO constraint_exists;

  IF NOT constraint_exists THEN
    ALTER TABLE public.likes
    ADD CONSTRAINT likes_unique_user_target UNIQUE (user_id, target_type, target_id);
  END IF;
END $$;

-- Recreate helpful indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_likes_target ON public.likes(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_likes_user ON public.likes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_created_at ON public.likes(created_at DESC);

-- Reassert RLS policies (drop if exist to avoid duplicates)
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read likes" ON public.likes;
DROP POLICY IF EXISTS "Authenticated users can create likes" ON public.likes;
DROP POLICY IF EXISTS "Users can delete own likes" ON public.likes;

CREATE POLICY "Anyone can read likes" ON public.likes
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create likes" ON public.likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own likes" ON public.likes
  FOR DELETE USING (auth.uid() = user_id);

-- Document
COMMENT ON TABLE public.likes IS 'Stores likes for posts, chapters, and works (polymorphic via target_type/target_id)';

-- Helper functions for likes
-- Drop existing overloaded functions to avoid RPC ambiguity (safe IF EXISTS)
DROP FUNCTION IF EXISTS public.get_like_count(text, uuid);
DROP FUNCTION IF EXISTS public.user_has_liked(text, uuid, uuid);
DROP FUNCTION IF EXISTS public.user_has_liked(uuid, text, uuid);

-- Recreate consistent functions (no overloads)
CREATE FUNCTION public.get_like_count(p_target_type text, p_target_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT COUNT(*)::int
  FROM public.likes l
  WHERE l.target_type = p_target_type
    AND l.target_id = p_target_id;
$$;

CREATE FUNCTION public.user_has_liked(p_target_type text, p_target_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.likes l
    WHERE l.target_type = p_target_type
      AND l.target_id = p_target_id
      AND l.user_id = p_user_id
  );
$$;

COMMENT ON FUNCTION public.get_like_count(text, uuid) IS 'Returns count of likes for given target';
COMMENT ON FUNCTION public.user_has_liked(text, uuid, uuid) IS 'Returns whether given user liked the target';

-- Ensure authenticated role can execute
GRANT EXECUTE ON FUNCTION public.get_like_count(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_liked(text, uuid, uuid) TO authenticated;