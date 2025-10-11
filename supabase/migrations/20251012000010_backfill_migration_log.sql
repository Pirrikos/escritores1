-- Backfill migration_log entries for previously applied migrations
-- Docker-free safe operation: uses existence checks, no roles/extensions changes

SET lock_timeout = '5s';
SET statement_timeout = '30s';

-- 20250202000010_create_content_views.sql
INSERT INTO public.migration_log (migration_name, applied_at, description)
SELECT '20250202000010_create_content_views', now(), 'Create content_views table with RLS and policies'
WHERE to_regclass('public.content_views') IS NOT NULL
ON CONFLICT (migration_name) DO NOTHING;

-- 20250202000020_create_reading_progress.sql
INSERT INTO public.migration_log (migration_name, applied_at, description)
SELECT '20250202000020_create_reading_progress', now(), 'Create reading_progress table with RLS and policies'
WHERE to_regclass('public.reading_progress') IS NOT NULL
ON CONFLICT (migration_name) DO NOTHING;

-- 20250206000000_create_reading_list.sql
INSERT INTO public.migration_log (migration_name, applied_at, description)
SELECT '20250206000000_create_reading_list', now(), 'Create reading_list table with RLS and policies'
WHERE to_regclass('public.reading_list') IS NOT NULL
ON CONFLICT (migration_name) DO NOTHING;

-- 20250206000001_update_reading_list_policies.sql
INSERT INTO public.migration_log (migration_name, applied_at, description)
SELECT '20250206000001_update_reading_list_policies', now(), 'Update reading_list RLS policies'
WHERE EXISTS (
  SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reading_list'
)
ON CONFLICT (migration_name) DO NOTHING;

-- 20250211000000_create_reading_list_chapters.sql
INSERT INTO public.migration_log (migration_name, applied_at, description)
SELECT '20250211000000_create_reading_list_chapters', now(), 'Create reading_list_chapters table'
WHERE to_regclass('public.reading_list_chapters') IS NOT NULL
ON CONFLICT (migration_name) DO NOTHING;

-- 20250213000010_update_likes_polymorphic_cleanup.sql
INSERT INTO public.migration_log (migration_name, applied_at, description)
SELECT '20250213000010_update_likes_polymorphic_cleanup', now(), 'Cleanup polymorphic likes relationships'
WHERE to_regclass('public.likes') IS NOT NULL
ON CONFLICT (migration_name) DO NOTHING;

-- 20250213000020_create_posts_by_likes_function.sql
INSERT INTO public.migration_log (migration_name, applied_at, description)
SELECT '20250213000020_create_posts_by_likes_function', now(), 'Create RPC get_posts_by_likes'
WHERE EXISTS (
  SELECT 1 FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_posts_by_likes'
)
ON CONFLICT (migration_name) DO NOTHING;

-- 20250213000030_create_works_and_chapters_by_likes_functions.sql
INSERT INTO public.migration_log (migration_name, applied_at, description)
SELECT '20250213000030_create_works_and_chapters_by_likes_functions', now(), 'Create RPC get_works_by_likes and get_chapters_by_likes'
WHERE EXISTS (
  SELECT 1 FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname IN ('get_works_by_likes','get_chapters_by_likes')
)
ON CONFLICT (migration_name) DO NOTHING;

-- 20250128000000_allow_independent_chapters.sql
INSERT INTO public.migration_log (migration_name, applied_at, description)
SELECT '20250128000000_allow_independent_chapters', now(), 'Allow independent chapters (schema updates)'
WHERE to_regclass('public.chapters') IS NOT NULL
ON CONFLICT (migration_name) DO NOTHING;

-- 20250131000001_add_others_category.sql
INSERT INTO public.migration_log (migration_name, applied_at, description)
SELECT '20250131000001_add_others_category', now(), 'Add Others category to works'
WHERE to_regclass('public.works') IS NOT NULL
ON CONFLICT (migration_name) DO NOTHING;