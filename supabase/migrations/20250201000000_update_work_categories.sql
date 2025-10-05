-- Migration: Update work_category enum with new categories
-- Created: 2025-02-01

-- 1) Create a new enum type with the desired categories
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'work_category_new') THEN
    CREATE TYPE public.work_category_new AS ENUM (
      'otras',
      'Novela',
      'Cuento',
      'Poesía',
      'Teatro',
      'Ensayo',
      'Fantasía',
      'Ciencia ficción',
      'Romance',
      'Misterio',
      'Terror'
    );
  END IF;
END$$;

-- 2) Migrate existing values from old enum to the new one using a mapping
ALTER TABLE public.works 
  ALTER COLUMN category TYPE public.work_category_new
  USING (
    CASE category::text
      WHEN 'Misterio' THEN 'Misterio'
      WHEN 'Filosofía' THEN 'Ensayo'
      WHEN 'Novela negra' THEN 'Novela'
      WHEN 'Poesía' THEN 'Poesía'
      WHEN 'Ensayo' THEN 'Ensayo'
      WHEN 'Microficción' THEN 'Cuento'
      WHEN 'No ficción' THEN 'Ensayo'
      WHEN 'Fantasía' THEN 'Fantasía'
      WHEN 'Ciencia ficción' THEN 'Ciencia ficción'
      WHEN 'Romance' THEN 'Romance'
      WHEN 'otras' THEN 'otras'
      ELSE 'otras'
    END
  )::public.work_category_new;

-- 3) Ensure default and null backfill stay consistent
ALTER TABLE public.works ALTER COLUMN category SET DEFAULT 'otras';
UPDATE public.works SET category = 'otras' WHERE category IS NULL;

-- 4) Replace old enum type name
DO $$
BEGIN
  -- Drop old type if exists
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'work_category') THEN
    DROP TYPE public.work_category;
  END IF;

  -- Rename new type to the canonical name
  ALTER TYPE public.work_category_new RENAME TO work_category;
END$$;

-- 5) Log migration completion
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'migration_log' AND table_schema = 'public') THEN
    INSERT INTO public.migration_log (migration_name, applied_at)
    VALUES ('20250201000000_update_work_categories', now())
    ON CONFLICT (migration_name) DO NOTHING;
  END IF;
END$$;