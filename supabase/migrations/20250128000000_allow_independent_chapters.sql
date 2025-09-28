-- Migration: Allow independent chapters (work_id optional)
-- Created: 2025-01-28
-- Purpose: Allow chapters to exist without being associated to a specific work

-- Make work_id optional in chapters table
ALTER TABLE public.chapters ALTER COLUMN work_id DROP NOT NULL;

-- Add a new field to distinguish between independent chapters and work chapters
ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS is_independent boolean DEFAULT false;

-- Add fields for file storage (similar to works table)
ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS file_name text;
ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS file_size bigint;
ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS file_type text;
ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS cover_url text;

-- Update the unique constraint to handle independent chapters
-- Independent chapters don't need unique chapter numbers since they're not part of a work
ALTER TABLE public.chapters DROP CONSTRAINT IF EXISTS chapters_work_id_chapter_number_key;

-- Add a new constraint that only applies to chapters that belong to a work
ALTER TABLE public.chapters ADD CONSTRAINT chapters_work_chapter_unique 
    UNIQUE (work_id, chapter_number) DEFERRABLE INITIALLY DEFERRED;

-- Update the constraint to allow NULL work_id for independent chapters
ALTER TABLE public.chapters ADD CONSTRAINT chapters_work_id_check 
    CHECK (
        (work_id IS NOT NULL AND chapter_number IS NOT NULL AND is_independent = false) OR
        (work_id IS NULL AND is_independent = true)
    );

-- Update RLS policies to handle independent chapters
-- Drop existing policies
DROP POLICY IF EXISTS "Users can read published chapters and own chapters" ON public.chapters;
DROP POLICY IF EXISTS "Users can insert own chapters" ON public.chapters;
DROP POLICY IF EXISTS "Users can update own chapters" ON public.chapters;
DROP POLICY IF EXISTS "Users can delete own chapters" ON public.chapters;

-- Recreate policies with support for independent chapters
CREATE POLICY "Users can read published chapters and own chapters" ON public.chapters
    FOR SELECT USING (
        status = 'published' OR 
        author_id = auth.uid()
    );

CREATE POLICY "Users can insert own chapters" ON public.chapters
    FOR INSERT WITH CHECK (author_id = auth.uid());

CREATE POLICY "Users can update own chapters" ON public.chapters
    FOR UPDATE USING (author_id = auth.uid());

CREATE POLICY "Users can delete own chapters" ON public.chapters
    FOR DELETE USING (author_id = auth.uid());

-- Add indexes for independent chapters
CREATE INDEX IF NOT EXISTS idx_chapters_independent ON public.chapters(is_independent) WHERE is_independent = true;
CREATE INDEX IF NOT EXISTS idx_chapters_file_type ON public.chapters(file_type) WHERE file_type IS NOT NULL;

-- Update comments
COMMENT ON COLUMN public.chapters.work_id IS 'Reference to parent work (optional for independent chapters)';
COMMENT ON COLUMN public.chapters.is_independent IS 'True if chapter is independent, false if part of a work';
COMMENT ON COLUMN public.chapters.file_url IS 'URL to the chapter file in storage';
COMMENT ON COLUMN public.chapters.file_name IS 'Original filename of the uploaded chapter';
COMMENT ON COLUMN public.chapters.file_size IS 'Size of the chapter file in bytes';
COMMENT ON COLUMN public.chapters.file_type IS 'MIME type of the chapter file';
COMMENT ON COLUMN public.chapters.cover_url IS 'URL to the chapter cover image';

-- Create a view for independent chapters
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

-- Grant permissions on the view
GRANT SELECT ON public.independent_chapters TO authenticated;

-- Update the chapter statistics view to include independent chapters
CREATE OR REPLACE VIEW public.chapter_statistics AS
SELECT 
    author_id,
    COUNT(*) as total_chapters,
    COUNT(*) FILTER (WHERE status = 'published') as published_chapters,
    COUNT(*) FILTER (WHERE status = 'draft') as draft_chapters,
    COUNT(*) FILTER (WHERE is_independent = true) as independent_chapters,
    COUNT(*) FILTER (WHERE is_independent = false) as work_chapters,
    COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours') as chapters_last_24h,
    MAX(created_at) as last_chapter_date
FROM public.chapters
GROUP BY author_id;