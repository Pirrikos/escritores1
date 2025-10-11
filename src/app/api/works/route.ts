import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { randomUUID } from 'crypto';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get('limit');
    const statusParam = searchParams.get('status') || 'published';
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 10, 1), 50) : 10;

    if (process.env.NODE_ENV === 'development') {
      const now = new Date().toISOString();
      const data = Array.from({ length: limit }).map((_, i) => ({
        id: randomUUID(),
        title: `Obra de desarrollo #${i + 1}`,
        synopsis: 'Sinopsis de ejemplo para desarrollo.',
        author_id: `dev-author-${(i % 3) + 1}`,
        created_at: now,
        // Añadimos slug para facilitar navegación en desarrollo
        slug: `obra-desarrollo-${i + 1}`,
        cover_url: `preview:template-1:marino:${encodeURIComponent(`Obra #${i + 1}`)}:${encodeURIComponent(`Autor ${(i % 3) + 1}`)}`,
        profiles: {
          display_name: `Autor Dev ${(i % 3) + 1}`,
          avatar_url: 'https://lh3.googleusercontent.com/a-/AOh14GiDevAvatar'
        },
        status: statusParam,
      }));
      return NextResponse.json({ data }, { status: 200 });
    }

    try {
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase
        .from('works')
        .select(`
          id,
          title,
          synopsis,
          author_id,
          created_at,
          cover_url,
          profiles!works_author_id_fkey (
            display_name,
            avatar_url
          )
        `)
        .eq('status', statusParam)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error en works API (Supabase):', error.message);
        return NextResponse.json({ data: [] }, { status: 200 });
      }

      return NextResponse.json({ data: data || [] }, { status: 200 });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('Excepción en works API (producción):', msg);
      return NextResponse.json({ data: [] }, { status: 200 });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Error procesando solicitud de works:', msg);
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
}