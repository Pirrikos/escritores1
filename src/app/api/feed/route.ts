import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';

// Aseguramos comportamiento consistente de runtime y caché dinámica
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get('limit');
    const statusParam = searchParams.get('status') || 'published';
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 10, 1), 50) : 10;

    // En todos los entornos, consultar Supabase para obtener datos reales

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
            display_name,
            avatar_url
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