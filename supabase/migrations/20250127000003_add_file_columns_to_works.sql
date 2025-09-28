-- Migration: Add file_type and file_url columns to works table
-- Created: 2025-01-27
-- Purpose: Add missing file_type and file_url columns to store uploaded work file information

-- Add file_type column to works table
ALTER TABLE public.works 
ADD COLUMN IF NOT EXISTS file_type text;

-- Add file_url column to works table  
ALTER TABLE public.works 
ADD COLUMN IF NOT EXISTS file_url text;

-- Add comments for documentation
COMMENT ON COLUMN public.works.file_type IS 'MIME type of the uploaded work file (e.g., application/pdf, application/epub+zip)';
COMMENT ON COLUMN public.works.file_url IS 'URL or path to the uploaded work file in storage';

-- Log migration completion
INSERT INTO public.migration_log (migration_name, applied_at) 
VALUES ('20250127000003_add_file_columns_to_works', now())
ON CONFLICT (migration_name) DO NOTHING;