-- Migration: Create comments, comment_likes, and comment_reports with RLS
-- Created: 2025-10-11

-- Enable required extension for UUID (safe if already enabled)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Create comments table
CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL CHECK (target_type IN ('post','chapter','work')),
  target_id uuid NOT NULL,
  parent_id uuid NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  is_edited boolean NOT NULL DEFAULT false,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Constraints for content quality
ALTER TABLE public.comments
  ADD CONSTRAINT comments_body_not_empty CHECK (trim(body) <> ''),
  ADD CONSTRAINT comments_body_length CHECK (char_length(body) BETWEEN 1 AND 5000);

-- Parent FK (self-reference) separate to avoid early failure if table is empty
ALTER TABLE public.comments
  ADD CONSTRAINT comments_parent_id_fkey FOREIGN KEY (parent_id)
  REFERENCES public.comments(id) ON DELETE CASCADE;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_comments_target ON public.comments(target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON public.comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON public.comments(user_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_comments_updated_at_trigger ON public.comments;
CREATE TRIGGER update_comments_updated_at_trigger
  BEFORE UPDATE ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_comments_updated_at();

-- 2) Create comment_likes table
CREATE TABLE IF NOT EXISTS public.comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_likes_comment ON public.comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_user ON public.comment_likes(user_id);

-- 3) Create comment_reports table
CREATE TABLE IF NOT EXISTS public.comment_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.comment_reports
  ADD CONSTRAINT comment_reports_reason_length CHECK (reason IS NULL OR char_length(reason) BETWEEN 1 AND 500);

CREATE INDEX IF NOT EXISTS idx_comment_reports_comment ON public.comment_reports(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_reports_user ON public.comment_reports(user_id);

-- 4) Row Level Security policies
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_reports ENABLE ROW LEVEL SECURITY;

-- Comments: read for all authenticated; write/update/delete by owner
DROP POLICY IF EXISTS comments_select_policy ON public.comments;
DROP POLICY IF EXISTS comments_insert_policy ON public.comments;
DROP POLICY IF EXISTS comments_update_policy ON public.comments;
DROP POLICY IF EXISTS comments_delete_policy ON public.comments;

CREATE POLICY comments_select_policy
  ON public.comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY comments_insert_policy
  ON public.comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY comments_update_policy
  ON public.comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY comments_delete_policy
  ON public.comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Comment likes: read all; write/delete by owner
DROP POLICY IF EXISTS comment_likes_select_policy ON public.comment_likes;
DROP POLICY IF EXISTS comment_likes_insert_policy ON public.comment_likes;
DROP POLICY IF EXISTS comment_likes_delete_policy ON public.comment_likes;

CREATE POLICY comment_likes_select_policy
  ON public.comment_likes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY comment_likes_insert_policy
  ON public.comment_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY comment_likes_delete_policy
  ON public.comment_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Comment reports: allow authenticated users to report; list reports for authenticated
DROP POLICY IF EXISTS comment_reports_select_policy ON public.comment_reports;
DROP POLICY IF EXISTS comment_reports_insert_policy ON public.comment_reports;

CREATE POLICY comment_reports_select_policy
  ON public.comment_reports FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY comment_reports_insert_policy
  ON public.comment_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 5) Optional helpers: comments soft-delete helper via update
-- No DB function needed; handled at API layer by setting is_deleted = true and body = '[deleted]'.

-- 6) Documentation comments
COMMENT ON TABLE public.comments IS 'User comments attached to posts/chapters/works with threading via parent_id';
COMMENT ON COLUMN public.comments.target_type IS 'Target type: post, chapter, or work';
COMMENT ON COLUMN public.comments.target_id IS 'ID of the target entity';
COMMENT ON COLUMN public.comments.parent_id IS 'Optional parent comment for threading';
COMMENT ON TABLE public.comment_likes IS 'Likes for comments';
COMMENT ON TABLE public.comment_reports IS 'Reports (flags) for comments';

-- 7) Log migration completion
INSERT INTO public.migration_log (migration_name, applied_at, description)
VALUES ('20251011000000_create_comments', now(), 'Create comments, comment_likes, and comment_reports with RLS policies')
ON CONFLICT (migration_name) DO NOTHING;