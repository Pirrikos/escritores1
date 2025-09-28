-- Migration: Add slug column to works table
-- Created: 2025-01-27
-- Description: Adds slug column to public.works table for URL-friendly identifiers

-- Add slug column to works table
ALTER TABLE public.works 
ADD COLUMN IF NOT EXISTS slug text;

-- Add comment to document the column
COMMENT ON COLUMN public.works.slug IS 'URL-friendly identifier generated from the work title';

-- Create index for better performance on slug lookups
CREATE INDEX IF NOT EXISTS idx_works_slug ON public.works(slug);

-- Add unique constraint to ensure slug uniqueness (PostgreSQL doesn't support IF NOT EXISTS for constraints)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'unique_works_slug' 
        AND table_name = 'works' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.works ADD CONSTRAINT unique_works_slug UNIQUE (slug);
    END IF;
END $$;

-- Log migration
INSERT INTO public.migration_log (migration_name, applied_at, description)
VALUES ('20250127000004_add_slug_to_works', NOW(), 'Added slug column to works table with unique constraint and index')
ON CONFLICT (migration_name) DO NOTHING;