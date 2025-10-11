import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withRateLimit } from '@/lib/rateLimiter.js';
import { createServerSupabaseClient } from '@/lib/supabaseServer.js';
import { ReadingProgressSchema } from '@/app/api/activity/schemas';
import { clearUserCache } from '@/lib/misLecturasCache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Upsert reading progress: last page and num pages for a work/chapter
async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();

    let rawBody: unknown = null;
    try {
      rawBody = await req.json();
    } catch (parseErr) {
      console.error('reading-progress: invalid JSON body', parseErr);
      return NextResponse.json({ success: false, error: 'invalid_payload' }, { status: 400 });
    }
    // Validación estricta con zod (acepta numPages como null u omitido)
    const parsed = ReadingProgressSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'invalid_payload', details: parsed.error.flatten() }, { status: 400 });
    }
    const { contentType, contentSlug, bucket, filePath, lastPage, numPages } = parsed.data;

    const safeBucket = typeof bucket === 'string' && bucket.trim() !== '' ? bucket.trim() : null;
    const safeFilePath = typeof filePath === 'string' && filePath.trim() !== '' ? filePath.trim() : null;

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
    }

    // Upsert reading progress for (user_id, content_type, content_slug)
    const { error: upsertError } = await supabase
      .from('reading_progress')
      .upsert({
        user_id: user.id,
        content_type: contentType,
        content_slug: contentSlug,
        bucket: safeBucket,
        file_path: safeFilePath,
        last_page: lastPage,
        num_pages: (typeof numPages === 'number' ? numPages : null),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,content_type,content_slug' });

    if (upsertError) {
      console.error('Error upserting reading_progress:', upsertError);
      return NextResponse.json({ success: false, error: 'upsert_failed', details: { code: upsertError.code, message: upsertError.message } }, { status: 200 });
    }

    // Invalidar caché de Mis Lecturas para este usuario
    try { clearUserCache(user.id); } catch {}

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Error en reading-progress API:', msg);
    return NextResponse.json({ success: false, error: 'server_error' }, { status: 500 });
  }
}

// Aplicar rate limiting a este endpoint
const rateLimitedPOST = withRateLimit('API_GENERAL')(POST);
export { rateLimitedPOST as POST };