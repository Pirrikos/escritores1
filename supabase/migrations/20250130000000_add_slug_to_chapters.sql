-- Migration: Add slug column to chapters table
-- This migration adds a slug column to the chapters table for URL-friendly identifiers

-- Add slug column to chapters table
ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS slug text;

-- Add comment to the slug column
COMMENT ON COLUMN public.chapters.slug IS 'URL-friendly identifier generated from the chapter title';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_chapters_slug ON public.chapters(slug);

-- Add unique constraint to ensure slug uniqueness
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'unique_chapters_slug' 
        AND table_name = 'chapters' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.chapters ADD CONSTRAINT unique_chapters_slug UNIQUE (slug);
    END IF;
END $$;

-- Log migration
INSERT INTO public.migration_log (migration_name, applied_at) 
VALUES ('20250130000000_add_slug_to_chapters', now());