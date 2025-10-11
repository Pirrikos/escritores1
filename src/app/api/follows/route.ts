import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';

export async function GET(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { searchParams } = new URL(req.url);
    const targetId = searchParams.get('targetId');
    const countsOf = searchParams.get('countsOf');

    if (countsOf) {
      const userId = countsOf;
      try {
        const followersRes = await supabase.rpc('get_followers_count', { user_uuid: userId });
        const followingRes = await supabase.rpc('get_following_count', { user_uuid: userId });
        const followers = typeof followersRes.data === 'number' ? followersRes.data : 0;
        const following = typeof followingRes.data === 'number' ? followingRes.data : 0;
        return NextResponse.json({ followers, following }, { status: 200 });
      } catch {
        return NextResponse.json({ followers: 0, following: 0 }, { status: 200 });
      }
    }

    if (targetId) {
      // Check follow status for current user
      const me = user?.id || null;
      if (!me || me === targetId) {
        return NextResponse.json({ following: false }, { status: 200 });
      }
      // Prefer RPC if available for robust check
      try {
        const rpc = await supabase.rpc('user_is_following', { follower_uuid: me, following_uuid: targetId });
        if (typeof rpc.data === 'boolean') {
          return NextResponse.json({ following: rpc.data }, { status: 200 });
        }
      } catch {}
      // Try modern schema
      const { data: rows, error } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', me)
        .eq('following_id', targetId)
        .limit(1);
      if (!error) {
        return NextResponse.json({ following: Array.isArray(rows) && rows.length > 0 }, { status: 200 });
      }
      // On any error, attempt legacy fallback as well
      const { data: legacyRows, error: err2 } = await supabase
        .from('follows')
        .select('created_at')
        .eq('follower', me)
        .eq('following', targetId)
        .limit(1);
      if (err2) return NextResponse.json({ following: false }, { status: 200 });
      return NextResponse.json({ following: Array.isArray(legacyRows) && legacyRows.length > 0 }, { status: 200 });
    }

    // List followed user ids for current user
    if (!user?.id) {
      return NextResponse.json({ ids: [] }, { status: 200 });
    }
    const me = user.id;
    let rows: any[] | null = null;
    let err: any = null;
    try {
      const resA = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', me)
        .limit(100);
      rows = resA.data || null;
      err = resA.error || null;
    } catch (e) {
      err = e;
    }
    if (err) {
      const msg = String(err?.message || '').toLowerCase();
      if (msg.includes('follower_id') || msg.includes('following_id') || msg.includes('schema cache') || msg.includes('column')) {
        const { data: resB, error: errB } = await supabase
          .from('follows')
          .select('following')
          .eq('follower', me)
          .limit(100);
        if (!errB) rows = resB || [];
      }
    }
    const ids = Array.from(new Set(((rows || []).map((r: any) => r.following_id ?? r.following).filter(Boolean))));
    return NextResponse.json({ ids }, { status: 200 });
  } catch {
    return NextResponse.json({ ids: [] }, { status: 200 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return NextResponse.json({ ok: false, message: 'unauthorized' }, { status: 401 });
    const body = await req.json();
    const targetUserId: string = body?.targetId;
    if (!targetUserId) return NextResponse.json({ ok: false, message: 'invalid_target' }, { status: 400 });
    if (user.id === targetUserId) return NextResponse.json({ ok: false, message: 'self_follow_forbidden' }, { status: 400 });
    // Try modern schema
    const { error } = await supabase
      .from('follows')
      .insert({ follower_id: user.id, following_id: targetUserId });
    if (!error) return NextResponse.json({ ok: true }, { status: 200 });
    const msg = String(error?.message || '').toLowerCase();
    if (!(msg.includes('follower_id') || msg.includes('following_id') || msg.includes('schema cache') || msg.includes('column'))) {
      const code = (error as any)?.code;
      const isDup = code === '23505' || msg.includes('duplicate key value') || msg.includes('already exists') || msg.includes('unique constraint');
      if (isDup) return NextResponse.json({ ok: true }, { status: 200 });
      return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
    }
    const { error: err2 } = await supabase
      .from('follows')
      .insert({ follower: user.id, following: targetUserId });
    if (err2) {
      const msg2 = String(err2?.message || '').toLowerCase();
      const code2 = (err2 as any)?.code;
      const dup2 = code2 === '23505' || msg2.includes('duplicate key value') || msg2.includes('already exists') || msg2.includes('unique constraint');
      if (dup2) return NextResponse.json({ ok: true }, { status: 200 });
      return NextResponse.json({ ok: false, message: err2.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ ok: false, message: 'internal_error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return NextResponse.json({ ok: false, message: 'unauthorized' }, { status: 401 });
    const body = await req.json();
    const targetUserId: string = body?.targetId;
    if (!targetUserId) return NextResponse.json({ ok: false, message: 'invalid_target' }, { status: 400 });
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', user.id)
      .eq('following_id', targetUserId);
    if (!error) return NextResponse.json({ ok: true }, { status: 200 });
    const msg = String(error?.message || '').toLowerCase();
    if (!(msg.includes('follower_id') || msg.includes('following_id') || msg.includes('schema cache') || msg.includes('column'))) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
    }
    const { error: err2 } = await supabase
      .from('follows')
      .delete()
      .eq('follower', user.id)
      .eq('following', targetUserId);
    if (err2) return NextResponse.json({ ok: false, message: err2.message }, { status: 400 });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ ok: false, message: 'internal_error' }, { status: 500 });
  }
}