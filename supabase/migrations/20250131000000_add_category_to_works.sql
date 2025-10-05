-- Migration: Add category to works table
-- Created: 2025-01-31
-- Purpose: Introduce categorical classification for works

-- Create enum type for work categories if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'work_category') THEN
    CREATE TYPE public.work_category AS ENUM (
      'Misterio',
      'Filosofía',
      'Novela negra',
      'Poesía',
      'Ensayo',
      'Microficción',
      'No ficción',
      'Fantasía',
      'Ciencia ficción',
      'Romance'
    );
  END IF;
END$$;

-- Add category column to works
ALTER TABLE public.works 
ADD COLUMN IF NOT EXISTS category public.work_category;

COMMENT ON COLUMN public.works.category IS 'Categoría literaria de la obra';

-- Optional index to filter/group by category efficiently
CREATE INDEX IF NOT EXISTS idx_works_category ON public.works (category);

-- Log migration completion
INSERT INTO public.migration_log (migration_name, applied_at)
VALUES ('20250131000000_add_category_to_works', now())
ON CONFLICT (migration_name) DO NOTHING;