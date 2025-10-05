import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/posts/by-likes?limit=24&status=published
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get('limit');
    const statusParam = searchParams.get('status') || 'published';
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 24, 1), 100) : 24;

    const supabase = await createServerSupabaseClient();

    // 1) Obtener todos los posts publicados (hasta 200 para ordenar por likes)
    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select(`
        id,
        title,
        content,
        author_id,
        created_at,
        published_at,
        status,
        profiles:posts_author_id_fkey (
          display_name,
          avatar_url
        )
      `)
      .eq('status', statusParam)
      .limit(200);

    if (postsError) {
      console.error('by-likes: error fetching posts', postsError);
      return NextResponse.json({ data: [] }, { status: 200 });
    }

    const allPosts = posts || [];
    if (allPosts.length === 0) {
      return NextResponse.json({ data: [] }, { status: 200 });
    }

    // 2) Obtener todos los likes para posts y agregarlos en el servidor
    const { data: likesRows, error: likesError } = await supabase
      .from('likes')
      .select('target_id')
      .eq('target_type', 'post');

    if (likesError) {
      console.error('by-likes: error fetching likes', likesError);
    }

    const likeCounts = new Map<string, number>();
    for (const row of likesRows || []) {
      const id = row.target_id as string;
      likeCounts.set(id, (likeCounts.get(id) || 0) + 1);
    }

    // 3) Ordenar posts por número de likes desc, y como desempate por fecha
    const sorted = allPosts
      .map(p => ({
        ...p,
        likes_count: likeCounts.get(p.id as string) || 0,
      }))
      .sort((a, b) => {
        const diff = (b.likes_count || 0) - (a.likes_count || 0);
        if (diff !== 0) return diff;
        const ad = new Date(a.published_at || a.created_at).getTime();
        const bd = new Date(b.published_at || b.created_at).getTime();
        return bd - ad;
      })
      .slice(0, limit);

    return NextResponse.json({ data: sorted }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('by-likes: unexpected error', msg);
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
}