import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Crea un registro de vista de PDF para obras/capítulos
export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();

    // Intentar parsear el JSON con manejo de errores explícito
    let body: any = null;
    try {
      body = await req.json();
    } catch (parseErr) {
      console.error('view-pdf: invalid JSON body', parseErr);
      return NextResponse.json({ success: false, error: 'invalid_payload' }, { status: 400 });
    }

    const {
      contentType,
      contentSlug,
      bucket,
      filePath,
    } = body || {};

    // Validaciones básicas
    if (!contentType || !['work', 'chapter'].includes(contentType)) {
      return NextResponse.json({ success: false, error: 'invalid_content_type' }, { status: 400 });
    }
    if (!contentSlug || typeof contentSlug !== 'string') {
      return NextResponse.json({ success: false, error: 'invalid_slug' }, { status: 400 });
    }

    // Normalización defensiva de bucket y filePath
    const safeBucket = typeof bucket === 'string' && bucket.trim() !== '' ? bucket.trim() : null;
    const safeFilePath = typeof filePath === 'string' && filePath.trim() !== '' ? filePath.trim() : null;

    // Obtener usuario autenticado
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
    }

    // Insertar evento en tabla content_views (si existe)
    const { error: insertError } = await supabase
      .from('content_views')
      .insert({
        user_id: user.id,
        content_type: contentType,
        content_slug: contentSlug,
        bucket: safeBucket,
        file_path: safeFilePath,
        created_at: new Date().toISOString(),
      });

    if (insertError) {
      // No romper flujo: devolver éxito false pero incluir detalles para diagnóstico
      console.error('Error insertando content_views:', insertError);
      return NextResponse.json({ success: false, error: 'insert_failed', details: { code: insertError.code, message: insertError.message } }, { status: 200 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Error en view-pdf API:', msg);
    return NextResponse.json({ success: false, error: 'server_error' }, { status: 500 });
  }
}