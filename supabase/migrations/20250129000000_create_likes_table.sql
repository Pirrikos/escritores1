-- Create likes table
CREATE TABLE IF NOT EXISTS public.likes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    target_type text NOT NULL CHECK (target_type IN ('post', 'chapter', 'work')),
    target_id uuid NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    
    -- Ensure one like per user per content
    UNIQUE(user_id, target_type, target_id)
);

-- Add missing columns if table already exists
DO $$ 
BEGIN
    -- Add target_type column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'likes' 
        AND column_name = 'target_type' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.likes ADD COLUMN target_type text NOT NULL DEFAULT 'post' CHECK (target_type IN ('post', 'chapter', 'work'));
    END IF;
    
    -- Add target_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'likes' 
        AND column_name = 'target_id' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.likes ADD COLUMN target_id uuid NOT NULL DEFAULT gen_random_uuid();
    END IF;
END $$;

-- Enable RLS
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

-- Create policies (drop existing ones first to avoid conflicts)
DROP POLICY IF EXISTS "Anyone can read likes" ON public.likes;
DROP POLICY IF EXISTS "Authenticated users can create likes" ON public.likes;
DROP POLICY IF EXISTS "Users can delete own likes" ON public.likes;

-- Anyone can read likes (for counting)
CREATE POLICY "Anyone can read likes" ON public.likes
    FOR SELECT USING (true);

-- Authenticated users can create likes
CREATE POLICY "Authenticated users can create likes" ON public.likes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own likes (unlike)
CREATE POLICY "Users can delete own likes" ON public.likes
    FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_likes_target ON public.likes(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_likes_user ON public.likes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_created_at ON public.likes(created_at DESC);

-- Create a function to get like counts
CREATE OR REPLACE FUNCTION get_like_count(content_type text, content_id uuid)
RETURNS integer AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::integer
        FROM public.likes
        WHERE target_type = content_type AND target_id = content_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to check if user liked content
CREATE OR REPLACE FUNCTION user_has_liked(content_type text, content_id uuid, user_uuid uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.likes
        WHERE target_type = content_type 
        AND target_id = content_id 
        AND user_id = user_uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_like_count(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_liked(text, uuid, uuid) TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE public.likes IS 'Stores likes for posts, chapters, and works';
COMMENT ON COLUMN public.likes.target_type IS 'Type of content being liked: post, chapter, or work';
COMMENT ON COLUMN public.likes.target_id IS 'ID of the content being liked';
COMMENT ON COLUMN public.likes.user_id IS 'ID of the user who liked the content';

-- Log migration completion
INSERT INTO public.migration_log (migration_name, applied_at) 
VALUES ('20250129000000_create_likes_table', now())
ON CONFLICT (migration_name) DO NOTHING;