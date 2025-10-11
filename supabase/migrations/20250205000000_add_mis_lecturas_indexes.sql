-- Índices para acelerar Mis Lecturas (content_views, reading_progress, chapters)

-- content_views: filtrar por user_id y ordenar por created_at
CREATE INDEX IF NOT EXISTS idx_content_views_user_created_at
  ON public.content_views (user_id, created_at DESC);

-- reading_progress: consultas por user_id + content_type + content_slug, ordenadas por updated_at
CREATE INDEX IF NOT EXISTS idx_reading_progress_user_type_slug_updated
  ON public.reading_progress (user_id, content_type, content_slug, updated_at DESC);

-- reading_progress: consultas por user_id + content_type + file_path, ordenadas por updated_at
CREATE INDEX IF NOT EXISTS idx_reading_progress_user_type_path_updated
  ON public.reading_progress (user_id, content_type, file_path, updated_at DESC);

-- chapters: resolución por slug
CREATE INDEX IF NOT EXISTS idx_chapters_slug
  ON public.chapters (slug);

-- chapters: resolución por file_url (normalizado en app)
CREATE INDEX IF NOT EXISTS idx_chapters_file_url
  ON public.chapters (file_url);

-- works: resolución por slug (por si falta, normalmente ya existe)
CREATE INDEX IF NOT EXISTS idx_works_slug
  ON public.works (slug);