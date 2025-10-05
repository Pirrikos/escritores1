import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Upsert reading progress: last page and num pages for a work/chapter
export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();

    let body: any = null;
    try {
      body = await req.json();
    } catch (parseErr) {
      console.error('reading-progress: invalid JSON body', parseErr);
      return NextResponse.json({ success: false, error: 'invalid_payload' }, { status: 400 });
    }

    const {
      contentType,
      contentSlug,
      bucket,
      filePath,
      lastPage,
      numPages,
    } = body || {};

    // Basic validation
    if (!contentType || !['work', 'chapter'].includes(contentType)) {
      return NextResponse.json({ success: false, error: 'invalid_content_type' }, { status: 400 });
    }
    if (!contentSlug || typeof contentSlug !== 'string') {
      return NextResponse.json({ success: false, error: 'invalid_slug' }, { status: 400 });
    }
    const lp = Number.isInteger(lastPage) ? lastPage : parseInt(String(lastPage), 10);
    const np = numPages == null ? null : (Number.isInteger(numPages) ? numPages : parseInt(String(numPages), 10));
    if (!Number.isFinite(lp) || lp < 1) {
      return NextResponse.json({ success: false, error: 'invalid_last_page' }, { status: 400 });
    }

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
        last_page: lp,
        num_pages: np,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,content_type,content_slug' });

    if (upsertError) {
      console.error('Error upserting reading_progress:', upsertError);
      return NextResponse.json({ success: false, error: 'upsert_failed', details: { code: upsertError.code, message: upsertError.message } }, { status: 200 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Error en reading-progress API:', msg);
    return NextResponse.json({ success: false, error: 'server_error' }, { status: 500 });
  }
}