-- Fix posts table by adding missing created_at column
-- Migration: 20250130000001_fix_posts_table.sql

-- Add the missing created_at column to posts table
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update existing records to have a created_at value if they don't have one
UPDATE posts 
SET created_at = NOW() 
WHERE created_at IS NULL;

-- Make created_at NOT NULL after setting default values
ALTER TABLE posts 
ALTER COLUMN created_at SET NOT NULL;

-- Add a comment to document the fix
COMMENT ON COLUMN posts.created_at IS 'Timestamp when the post was created - added in fix migration';

-- Log this migration
INSERT INTO migration_log (migration_name, applied_at, description)
VALUES ('20250130000001_fix_posts_table', NOW(), 'Added missing created_at column to posts table');

-- Verify the fix
DO $$
BEGIN
    -- Check if created_at column exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'posts' 
        AND column_name = 'created_at'
        AND table_schema = 'public'
    ) THEN
        RAISE NOTICE 'SUCCESS: created_at column added to posts table';
    ELSE
        RAISE EXCEPTION 'FAILED: created_at column was not added to posts table';
    END IF;
END $$;