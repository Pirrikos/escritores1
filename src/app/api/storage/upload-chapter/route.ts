import { NextResponse } from 'next/server';
import { createServerSupabaseClient, getSupabaseServiceClient } from '@/lib/supabaseServer.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch (e) {
      return NextResponse.json({ success: false, error: 'invalid_form' }, { status: 400 });
    }

    const fileField = form.get('file');
    const path = form.get('path');

    if (!(fileField instanceof File)) {
      return NextResponse.json({ success: false, error: 'missing_file' }, { status: 400 });
    }
    if (typeof path !== 'string' || !path || !path.startsWith(`${user.id}/`)) {
      return NextResponse.json({ success: false, error: 'invalid_path' }, { status: 400 });
    }

    const admin = getSupabaseServiceClient();
    if (!admin) {
      return NextResponse.json({ success: false, error: 'service_key_missing' }, { status: 500 });
    }

    const arrayBuffer = await fileField.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = fileField.type || 'application/octet-stream';

    const { error } = await admin.storage
      .from('chapters')
      .upload(path, buffer, { contentType, upsert: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, path }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}