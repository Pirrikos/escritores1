# Inventario de esquema (public)

Conexión usando `SUPABASE_SERVICE_ROLE_KEY` (sin Docker). No se realizan operaciones de roles/extensiones. Este inventario se deriva de las migraciones en `supabase/migrations` y se valida con lecturas de tablas vía PostgREST.

## Resumen de tablas y conteos

- `profiles` — count≈3
- `works` — count≈1
- `posts` — count≈5
- `chapters` — count≈0
- `likes` — count≈7
- `follows` — count≈2
- `content_views` — count≈58
- `reading_progress` — count≈8
- `reading_list` — count≈1

## profiles

- Columnas: `id (uuid, PK, FK auth.users)`, `display_name (text, not null)`, `avatar_url (text)`, `bio (text)`, `created_at (timestamptz default now())`, `updated_at (timestamptz)`, `role (text)`
- Constraints: `profiles_display_name_length`, `profiles_bio_length`, `profiles_display_name_not_empty`
- Índices: —
- RLS: habilitado; políticas: `Public read profiles`, `Users update own profile`, `Users insert own profile`
- Triggers/funciones: `handle_new_user()` en `auth.users` (crea perfil automáticamente)

## works

- Columnas: `id (uuid, PK)`, `author_id (uuid, FK profiles)`, `title (text, not null)`, `synopsis (text)`, `cover_url (text)`, `status (text, default 'published', check in ('draft','published'))`, `isbn (text)`, `created_at (timestamptz default now())`, `updated_at (timestamptz)`, `file_size (bigint)`, `file_type (text)`, `file_url (text)`, `slug (text)`, `category (public.work_category)`
- Constraints: `works_title_length`, `works_synopsis_length`, `works_title_not_empty`, `works_isbn_format`
- Índices: `idx_works_author`, `idx_works_status`, `idx_works_category`, `idx_works_slug`
- RLS: habilitado; políticas: `Read published works or own`, `Insert own works`, `Update own works`, `Delete own works`

## posts

- Columnas: `id (uuid, PK)`, `author_id (uuid, FK profiles)`, `work_id (uuid, FK works, on delete set null)`, `type (text, check in ('poem','chapter'))`, `title (text)`, `content (text not null)`, `chapter_index (int)`, `status (text, default 'published', check in ('draft','published'))`, `published_at (timestamptz default now())`, `created_at (timestamptz default now(), not null)`
- Constraints: `posts_title_length`, `posts_content_length`, `posts_content_not_empty`, `posts_chapter_index_positive`, `posts_title_required_for_chapters`
- Índices: `idx_posts_published_at`, `idx_posts_author`, `idx_posts_status`
- RLS: habilitado; políticas: `Read published posts or own`, `Insert own posts`, `Update own posts`, `Delete own posts`

## likes

- Columnas: `id (uuid, PK)`, `user_id (uuid, FK profiles)`, `post_id (uuid, FK posts)`, `created_at (timestamptz default now())`, `target_type (text)`, `target_id (uuid)`
- Constraints: `unique (user_id, post_id)`; comentarios y funciones soportan likes sobre `post/chapter/work`
- Índices: `idx_likes_post`, `idx_likes_user`, `idx_likes_created_at`, `idx_likes_target`
- RLS: habilitado; políticas: `Public read likes`, `User can like`, `User can unlike`
- Funciones: `get_like_count(text, uuid)`, `user_has_liked(text, uuid, uuid)` (SECURITY DEFINER)

## follows

- Columnas: `follower_id (uuid, FK profiles)`, `following_id (uuid, FK profiles)`, `created_at (timestamptz default now())`
- Constraints: `PK (follower_id, following_id)`
- Índices: `idx_follows_follower`, `idx_follows_following`, `idx_follows_created_at`
- RLS: habilitado; políticas: `Public read follows`, `User can follow`, `User can unfollow`
- Funciones: `get_followers_count(uuid)`, `get_following_count(uuid)`, `user_is_following(uuid, uuid)` (SECURITY DEFINER)

## chapters

- Columnas: `id (uuid, PK)`, `work_id (uuid, FK works, on delete cascade)`, `author_id (uuid, FK profiles, on delete cascade)`, `title (text, not null)`, `content (text, not null)`, `chapter_number (int, not null)`, `status (text, default 'draft', check in ('draft','published'))`, `published_at (timestamptz)`, `created_at (timestamptz default now())`, `updated_at (timestamptz default now())`, `is_independent (boolean default false)`, `file_url (text)`, `file_name (text)`, `file_size (bigint)`, `file_type (text)`, `cover_url (text)`, `slug (text)`
- Constraints: `UNIQUE(work_id, chapter_number)` (deferrable), `chapters_work_id_check` (permite `work_id` null si `is_independent=true`), `chapters_published_at_check`
- Índices: `idx_chapters_work_id`, `idx_chapters_author_id`, `idx_chapters_published_at (partial WHERE status='published')`, `idx_chapters_status`, `idx_chapters_work_chapter`, `idx_chapters_slug`, `idx_chapters_file_url`
- RLS: habilitado; políticas: leer publicados o propios, insertar/actualizar/eliminar propios
- Triggers/funciones: `update_chapters_updated_at_trigger` (actualiza `updated_at`), `validate_chapter_content_trigger`
- Vistas: `chapter_statistics`, `independent_chapters`

## content_views

- Columnas: `id (uuid, PK)`, `user_id (uuid)`, `content_type (text, check in ('work','chapter'))`, `content_slug (text)`, `bucket (text)`, `file_path (text)`, `created_at (timestamptz default now())`
- Índices: `idx_content_views_created_at`, `idx_content_views_type_slug`, `idx_content_views_user_created_at`
- RLS: habilitado; políticas: `read_all_views` (SELECT using true), `insert_own_views` (INSERT check user_id=auth.uid())

## reading_progress

- Columnas: `id (uuid, PK)`, `user_id (uuid)`, `content_type (text, check in ('work','chapter'))`, `content_slug (text)`, `bucket (text)`, `file_path (text)`, `last_page (int default 1, not null)`, `num_pages (int)`, `updated_at (timestamptz default now())`
- Constraints: `uq_reading_progress (user_id, content_type, content_slug)`
- Índices: `idx_reading_progress_updated_at`, `idx_reading_progress_user_content`, `idx_reading_progress_user_type_slug_updated`, `idx_reading_progress_user_type_path_updated`
- RLS: habilitado; políticas: `select_own_progress`, `insert_own_progress` (y actualizaciones análogas si existen)

## reading_list

- Columnas: `id (uuid, PK)`, `user_id (uuid)`, `work_slug (text)`, `created_at (timestamptz default now())`
- Constraints: `uq_reading_list (user_id, work_slug)`
- Índices: `idx_reading_list_user_created_at`, `idx_reading_list_work_slug`
- RLS: habilitado; políticas: `select_own_reading_list`, `insert_own_reading_list`, `delete_own_reading_list`

## Tipos y extensiones

- Tipo enum: `public.work_category` (migración 20250131000000; actualización 20250201000000)
- Extensiones: no se crean/modifican aquí (se omiten intencionalmente)

## Notas de verificación

- Este inventario se sincroniza con las migraciones presentes y lecturas puntuales de tablas (limit=1) para descubrir columnas reales expuestas por PostgREST.
- Si aparece divergencia entre remoto y local (p. ej. migraciones `.disabled`), revisar y reparar historial con herramientas específicas, evitando operaciones de roles.