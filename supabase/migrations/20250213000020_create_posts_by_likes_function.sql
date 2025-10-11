-- Create RPC to fetch posts ordered by like counts, including author profile
-- Ensures consistent ordering logic in DB and reduces app-side aggregation

CREATE OR REPLACE FUNCTION public.get_posts_by_likes(p_status text DEFAULT 'published', p_limit int DEFAULT 24)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  author_id uuid,
  created_at timestamptz,
  published_at timestamptz,
  status text,
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
    WHERE target_type = 'post'
    GROUP BY target_id
  )
  SELECT 
    p.id,
    p.title,
    p.content,
    p.author_id,
    p.created_at,
    p.published_at,
    p.status,
    json_build_object(
      'display_name', pr.display_name,
      'avatar_url', pr.avatar_url
    ) AS profiles,
    COALESCE(lc.cnt, 0) AS likes_count
  FROM public.posts p
  LEFT JOIN like_counts lc ON lc.target_id = p.id
  LEFT JOIN public.profiles pr ON pr.id = p.author_id
  WHERE p.status = p_status
  ORDER BY COALESCE(lc.cnt, 0) DESC, COALESCE(p.published_at, p.created_at) DESC
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION public.get_posts_by_likes(text, int) IS 'Returns posts ordered by likes with embedded author profile JSON';
GRANT EXECUTE ON FUNCTION public.get_posts_by_likes(text, int) TO authenticated;