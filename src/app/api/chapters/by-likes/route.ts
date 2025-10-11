import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get('limit');
    const statusParam = searchParams.get('status') || 'published';
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 24, 1), 100) : 24;

    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc('get_chapters_by_likes', { p_status: statusParam, p_limit: limit });
    if (error) {
      console.error('get_chapters_by_likes RPC error:', error.message);
      return NextResponse.json({ data: [] }, { status: 200 });
    }
    return NextResponse.json({ data: data || [] }, { status: 200 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('chapters/by-likes error:', msg);
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
}