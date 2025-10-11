import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withRateLimit } from '@/lib/rateLimiter.js';
import { createServerSupabaseClient } from '@/lib/supabaseServer.js';
import { ViewPdfSchema } from '@/app/api/activity/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Crea un registro de vista de PDF para obras/capítulos
async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();

    // Intentar parsear el JSON con manejo de errores explícito
    let rawBody: unknown = null;
    try {
      rawBody = await req.json();
    } catch (parseErr) {
      console.error('view-pdf: invalid JSON body', parseErr);
      return NextResponse.json({ success: false, error: 'invalid_payload' }, { status: 400 });
    }

    // Validación estricta con zod
    const parsed = ViewPdfSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'invalid_payload', details: parsed.error.flatten() }, { status: 400 });
    }
    const { contentType, contentSlug, bucket, filePath } = parsed.data;

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

// Aplicar rate limiting a este endpoint
const rateLimitedPOST = withRateLimit('API_GENERAL')(POST);
export { rateLimitedPOST as POST };