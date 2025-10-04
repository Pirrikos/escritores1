import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get('limit');
    const statusParam = searchParams.get('status') || 'published';
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 10, 1), 50) : 10;

    // Desarrollo: devolver stub claro y controlado
    if (process.env.NODE_ENV === 'development') {
      const now = new Date().toISOString();
      const data = Array.from({ length: limit }).map((_, i) => ({
        id: `dev-post-${i + 1}`,
        title: `Post de desarrollo #${i + 1}`,
        content: 'Contenido de ejemplo para desarrollo. Ajusta en el backend real.',
        author_id: `dev-author-${(i % 3) + 1}`,
        created_at: now,
        published_at: now,
        profiles: { display_name: `Autor Dev ${(i % 3) + 1}` },
        status: statusParam,
      }));
      return NextResponse.json({ data }, { status: 200 });
    }

    // Producción: delegar al backend real (Supabase). Si falla, devolver vacío.
    try {
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase
        .from('posts')
        .select(`
          id,
          title,
          content,
          author_id,
          created_at,
          published_at,
          profiles!posts_author_id_fkey (
            display_name
          )
        `)
        .eq('status', statusParam)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        // Registrar y degradar a vacío
        console.error('Error en feed API (Supabase):', error.message);
        return NextResponse.json({ data: [] }, { status: 200 });
      }

      return NextResponse.json({ data: data || [] }, { status: 200 });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('Excepción en feed API (producción):', msg);
      return NextResponse.json({ data: [] }, { status: 200 });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Error procesando solicitud de feed:', msg);
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
}