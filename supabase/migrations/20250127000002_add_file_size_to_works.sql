-- Migration: Add file_size column to works table
-- Created: 2025-01-27
-- Purpose: Add missing file_size column to store the size of uploaded work files

-- Add file_size column to works table
ALTER TABLE public.works 
ADD COLUMN IF NOT EXISTS file_size bigint;

-- Add comment for documentation
COMMENT ON COLUMN public.works.file_size IS 'Size of the uploaded work file in bytes';

-- Log migration completion
INSERT INTO public.migration_log (migration_name, applied_at) 
VALUES ('20250127000002_add_file_size_to_works', now())
ON CONFLICT (migration_name) DO NOTHING;