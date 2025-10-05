-- Create follows table for user-to-user following
CREATE TABLE IF NOT EXISTS public.follows (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    follower_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    following_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,

    -- Ensure one follow record per follower/following pair and no self-follow
    UNIQUE (follower_id, following_id),
    CHECK (follower_id <> following_id)
);

-- Enable RLS
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Anyone can read follows" ON public.follows;
DROP POLICY IF EXISTS "Authenticated users can follow" ON public.follows;
DROP POLICY IF EXISTS "Users can unfollow their own follows" ON public.follows;

-- Anyone can read follows (for public follower/following counts and lists)
CREATE POLICY "Anyone can read follows" ON public.follows
    FOR SELECT USING (true);

-- Authenticated users can follow others (insert)
CREATE POLICY "Authenticated users can follow" ON public.follows
    FOR INSERT WITH CHECK (auth.uid() = follower_id AND follower_id <> following_id);

-- Users can unfollow their own follows (delete)
CREATE POLICY "Users can unfollow their own follows" ON public.follows
    FOR DELETE USING (auth.uid() = follower_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows(following_id);
CREATE INDEX IF NOT EXISTS idx_follows_created_at ON public.follows(created_at DESC);

-- Helper functions for counts and status
CREATE OR REPLACE FUNCTION get_followers_count(user_uuid uuid)
RETURNS integer AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::integer FROM public.follows WHERE following_id = user_uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_following_count(user_uuid uuid)
RETURNS integer AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::integer FROM public.follows WHERE follower_id = user_uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION user_is_following(follower_uuid uuid, following_uuid uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.follows WHERE follower_id = follower_uuid AND following_id = following_uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_followers_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_following_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION user_is_following(uuid, uuid) TO authenticated;

COMMENT ON TABLE public.follows IS 'User-to-user follow relationships';
COMMENT ON COLUMN public.follows.follower_id IS 'User who follows';
COMMENT ON COLUMN public.follows.following_id IS 'User being followed';

-- Log migration completion
INSERT INTO public.migration_log (migration_name, applied_at)
VALUES ('20250204000000_create_follows_table', now())
ON CONFLICT (migration_name) DO NOTHING;