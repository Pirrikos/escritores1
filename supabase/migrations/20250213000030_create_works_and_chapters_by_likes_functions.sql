-- Create RPCs to fetch works and chapters ordered by like counts
-- Mirrors posts-by-likes pattern with embedded author profile JSON

-- Works by likes
CREATE OR REPLACE FUNCTION public.get_works_by_likes(p_status text DEFAULT 'published', p_limit int DEFAULT 24)
RETURNS TABLE (
  id uuid,
  title text,
  synopsis text,
  author_id uuid,
  created_at timestamptz,
  status text,
  cover_url text,
  profiles jsonb,
  likes_count integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  WITH like_counts AS (
    SELECT target_id, COUNT(*)::int AS cnt
    FROM public.likes
    WHERE target_type = 'work'
    GROUP BY target_id
  )
  SELECT 
    w.id,
    w.title,
    w.synopsis,
    w.author_id,
    w.created_at,
    w.status,
    w.cover_url,
    json_build_object(
      'display_name', pr.display_name,
      'avatar_url', pr.avatar_url
    ) AS profiles,
    COALESCE(lc.cnt, 0) AS likes_count
  FROM public.works w
  LEFT JOIN like_counts lc ON lc.target_id = w.id
  LEFT JOIN public.profiles pr ON pr.id = w.author_id
  WHERE w.status = p_status
  ORDER BY COALESCE(lc.cnt, 0) DESC, w.created_at DESC
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION public.get_works_by_likes(text, int) IS 'Returns works ordered by likes with embedded author profile JSON';
GRANT EXECUTE ON FUNCTION public.get_works_by_likes(text, int) TO authenticated;

-- Chapters by likes
CREATE OR REPLACE FUNCTION public.get_chapters_by_likes(p_status text DEFAULT 'published', p_limit int DEFAULT 24)
RETURNS TABLE (
  id uuid,
  work_id uuid,
  title text,
  author_id uuid,
  chapter_number integer,
  created_at timestamptz,
  published_at timestamptz,
  status text,
  cover_url text,
  profiles jsonb,
  likes_count integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  WITH like_counts AS (
    SELECT target_id, COUNT(*)::int AS cnt
    FROM public.likes
    WHERE target_type = 'chapter'
    GROUP BY target_id
  )
  SELECT 
    c.id,
    c.work_id,
    c.title,
    c.author_id,
    c.chapter_number,
    c.created_at,
    c.published_at,
    c.status,
    c.cover_url,
    json_build_object(
      'display_name', pr.display_name,
      'avatar_url', pr.avatar_url
    ) AS profiles,
    COALESCE(lc.cnt, 0) AS likes_count
  FROM public.chapters c
  LEFT JOIN like_counts lc ON lc.target_id = c.id
  LEFT JOIN public.profiles pr ON pr.id = c.author_id
  WHERE c.status = p_status
  ORDER BY COALESCE(lc.cnt, 0) DESC, COALESCE(c.published_at, c.created_at) DESC
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION public.get_chapters_by_likes(text, int) IS 'Returns chapters ordered by likes with embedded author profile JSON';
GRANT EXECUTE ON FUNCTION public.get_chapters_by_likes(text, int) TO authenticated;