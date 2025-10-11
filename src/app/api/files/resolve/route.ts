export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServerSupabaseClient, getSupabaseServiceClient } from '@/lib/supabaseServer.js';
import { generateSlug } from '@/lib/slugUtils';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const type = body?.type as 'work' | 'chapter' | undefined;
    const slug = (body?.slug || '').trim();
    if (!type || !slug || (type !== 'work' && type !== 'chapter')) {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }

    const routeClient = await createServerSupabaseClient();
    const { data: { user } } = await routeClient.auth.getUser();

    const svc = getSupabaseServiceClient();
    if (!svc) {
      return NextResponse.json({ error: 'Service role no disponible' }, { status: 500 });
    }

    if (type === 'work') {
      const { data, error } = await svc
        .from('works')
        .select('file_url, status')
        .eq('slug', slug)
        .limit(1);
      const row = (data || [])[0] as { file_url?: string | null; status?: string } | undefined;
      if (error || !row) {
        return NextResponse.json({ error: 'Obra no encontrada' }, { status: 404 });
      }
      if (!user && row.status !== 'published') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
      }
      const filePath = (row.file_url || '').trim();
      if (!filePath) {
        return NextResponse.json({ error: 'Sin archivo' }, { status: 404 });
      }
      return NextResponse.json({ bucket: 'works', filePath });
    } else {
      const { data, error } = await svc
        .from('chapters')
        .select('file_url, status')
        .eq('slug', slug)
        .limit(1);
      let row = (data || [])[0] as { file_url?: string | null; status?: string } | undefined;
      if (error) {
        return NextResponse.json({ error: 'Error de lectura' }, { status: 500 });
      }
      // Fallback: si no hay slug en DB, buscar por slug generado desde el título en publicados
      if (!row) {
        const { data: published } = await svc
          .from('chapters')
          .select('file_url, status, title')
          .eq('status', 'published')
          .limit(2000);
        const match = (published || []).find((r: any) => {
          const t = (r?.title || '') as string;
          const gen = t ? generateSlug(t) : '';
          return gen === slug;
        }) as { file_url?: string | null; status?: string } | undefined;
        row = match;
      }
      if (!row) {
        return NextResponse.json({ error: 'Capítulo no encontrado' }, { status: 404 });
      }
      if (!user && row.status !== 'published') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
      }
      const filePath = (row.file_url || '').trim();
      if (!filePath) {
        return NextResponse.json({ error: 'Sin archivo' }, { status: 404 });
      }
      return NextResponse.json({ bucket: 'chapters', filePath });
    }
  } catch (e) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}