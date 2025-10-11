import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Simple diagnostic endpoint to verify if 'comments' table exists in Supabase
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error, count } = await supabase
      .from('comments')
      .select('id', { head: true, count: 'exact' })
      .limit(1);

    if (error) {
      const msg = error.message || 'unknown_error';
      const exists = !/relation .*comments.* does not exist/i.test(msg) && !/undefined table/i.test(msg);
      return NextResponse.json({ exists, error: msg }, { status: 200 });
    }

    return NextResponse.json({ exists: true, count: count ?? 0 }, { status: 200 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ exists: false, error: msg }, { status: 200 });
  }
}