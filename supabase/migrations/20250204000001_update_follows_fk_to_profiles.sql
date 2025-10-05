-- Update follows FKs to reference public.profiles(id) instead of auth.users(id)
-- This aligns with other tables (works, posts, chapters) and avoids FK violations
-- when following users represented in profiles.

ALTER TABLE public.follows DROP CONSTRAINT IF EXISTS follows_follower_id_fkey;
ALTER TABLE public.follows DROP CONSTRAINT IF EXISTS follows_following_id_fkey;

ALTER TABLE public.follows
  ADD CONSTRAINT follows_follower_id_fkey
  FOREIGN KEY (follower_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

ALTER TABLE public.follows
  ADD CONSTRAINT follows_following_id_fkey
  FOREIGN KEY (following_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;

COMMENT ON CONSTRAINT follows_follower_id_fkey ON public.follows IS 'Follower references profiles.id';
COMMENT ON CONSTRAINT follows_following_id_fkey ON public.follows IS 'Following references profiles.id';

-- Log migration completion
INSERT INTO public.migration_log (migration_name, applied_at)
VALUES ('20250204000001_update_follows_fk_to_profiles', now())
ON CONFLICT (migration_name) DO NOTHING;