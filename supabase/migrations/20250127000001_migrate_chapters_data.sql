-- Migration: Migrate existing chapter data from posts to chapters table
-- Created: 2025-01-27

-- First, let's check if there are any existing chapters in the posts table
DO $$
DECLARE
    chapter_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO chapter_count 
    FROM posts 
    WHERE type = 'chapter';
    
    RAISE NOTICE 'Found % chapters in posts table to migrate', chapter_count;
    
    -- Only proceed with migration if there are chapters to migrate
    IF chapter_count > 0 THEN
        -- Insert existing chapters from posts table into chapters table
        INSERT INTO chapters (
            work_id,
            author_id,
            title,
            content,
            chapter_number,
            status,
            published_at,
            created_at,
            updated_at
        )
        SELECT 
            p.work_id,
            p.author_id,
            p.title,
            p.content,
            COALESCE(p.chapter_index, 1) as chapter_number,
            CASE 
                WHEN p.published_at IS NOT NULL THEN 'published'
                ELSE 'draft'
            END as status,
            p.published_at,
            p.created_at,
            p.updated_at
        FROM posts p
        WHERE p.type = 'chapter'
        AND p.work_id IS NOT NULL  -- Only migrate chapters that have a work_id
        ORDER BY p.work_id, COALESCE(p.chapter_index, 1);
        
        RAISE NOTICE 'Successfully migrated % chapters to chapters table', ROW_COUNT;
        
        -- Optional: Remove migrated chapters from posts table
        -- Uncomment the following lines if you want to clean up the posts table
        /*
        DELETE FROM posts 
        WHERE type = 'chapter' 
        AND work_id IS NOT NULL;
        
        RAISE NOTICE 'Removed migrated chapters from posts table';
        */
        
    ELSE
        RAISE NOTICE 'No chapters found in posts table to migrate';
    END IF;
END $$;

-- Add a record to the migration log
INSERT INTO migration_log (migration_name, executed_at, description)
VALUES (
    '20250127000001_migrate_chapters_data',
    NOW(),
    'Migrated existing chapter data from posts table to new chapters table'
);

-- Add comment for documentation
COMMENT ON TABLE chapters IS 'Chapters table - migrated from posts table on 2025-01-27. Contains all chapter content with proper relationships to works and authors.';