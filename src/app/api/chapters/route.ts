import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get('limit');
    const statusParam = searchParams.get('status') || 'published';
    const independentParam = searchParams.get('independent');
    const independent = independentParam ? independentParam === 'true' : true;
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 10, 1), 50) : 10;

    if (process.env.NODE_ENV === 'development') {
      const now = new Date().toISOString();
      const data = Array.from({ length: limit }).map((_, i) => ({
        id: `dev-chapter-${i + 1}`,
        title: `Capítulo de desarrollo #${i + 1}`,
        synopsis: 'Sinopsis de ejemplo para desarrollo.',
        author_id: `dev-author-${(i % 3) + 1}`,
        created_at: now,
        slug: `capitulo-desarrollo-${i + 1}`,
        is_independent: independent,
        cover_url: `preview:template-1:marino:${encodeURIComponent(`Capítulo #${i + 1}`)}:${encodeURIComponent(`Autor ${(i % 3) + 1}`)}`,
        profiles: { display_name: `Autor Dev ${(i % 3) + 1}` },
        status: statusParam,
      }));
      return NextResponse.json({ data }, { status: 200 });
    }

    try {
      const supabase = await createServerSupabaseClient();
      let query = supabase
        .from('chapters')
        .select(`
          id,
          title,
          synopsis,
          author_id,
          created_at,
          slug,
          is_independent,
          cover_url,
          profiles!chapters_author_id_fkey (
            display_name
          )
        `)
        .eq('status', statusParam)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (independent) {
        query = query.eq('is_independent', true);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error en chapters API (Supabase):', error.message);
        return NextResponse.json({ data: [] }, { status: 200 });
      }

      return NextResponse.json({ data: data || [] }, { status: 200 });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('Excepción en chapters API (producción):', msg);
      return NextResponse.json({ data: [] }, { status: 200 });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Error procesando solicitud de chapters:', msg);
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
}