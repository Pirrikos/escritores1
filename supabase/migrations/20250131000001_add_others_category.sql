-- Migration: Add 'otras' value to work_category and set default
-- Created: 2025-01-31

-- Add 'otras' to enum type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'work_category' AND e.enumlabel = 'otras'
  ) THEN
    ALTER TYPE public.work_category ADD VALUE 'otras';
  END IF;
END$$;

-- Set default to 'otras' for works.category
ALTER TABLE public.works ALTER COLUMN category SET DEFAULT 'otras';

-- Backfill null categories to 'otras'
UPDATE public.works SET category = 'otras' WHERE category IS NULL;