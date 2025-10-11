import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/comment-likes?comment_id=...&user_id=...
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const commentId = searchParams.get('comment_id');
    const userId = searchParams.get('user_id');
    if (!commentId) {
      return NextResponse.json({ error: 'missing_comment_id' }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();

    // Count likes for this comment
    const { count: likeCount, error: countError } = await supabase
      .from('comment_likes')
      .select('id', { count: 'exact', head: true })
      .eq('comment_id', commentId);

    if (countError) {
      console.error('comment-likes GET count error:', countError.message);
      return NextResponse.json({ count: 0, liked: false }, { status: 200 });
    }

    let liked = false;
    if (userId) {
      const { count: userCount, error: userErr } = await supabase
        .from('comment_likes')
        .select('id', { count: 'exact', head: true })
        .eq('comment_id', commentId)
        .eq('user_id', userId);
      liked = !userErr && typeof userCount === 'number' && userCount > 0;
    }

    const countVal = typeof likeCount === 'number' ? likeCount : 0;
    return NextResponse.json({ count: countVal, liked }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('comment-likes GET exception:', msg);
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
}

// POST /api/comment-likes - toggle like on a comment
export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return NextResponse.json({ ok: false, message: 'unauthorized' }, { status: 401 });

    const payload = await req.json();
    const commentId: string | null = payload?.commentId ?? null;
    if (!commentId || typeof commentId !== 'string') {
      return NextResponse.json({ ok: false, message: 'invalid_comment_id' }, { status: 400 });
    }

    // Check if like exists
    const { data: existing, error: checkErr } = await supabase
      .from('comment_likes')
      .select('id')
      .eq('comment_id', commentId)
      .eq('user_id', user.id)
      .maybeSingle();

    let action: 'liked' | 'unliked' = 'liked';
    if (checkErr && checkErr.code && checkErr.code !== 'PGRST116') {
      console.error('comment-likes check error:', checkErr.message);
    }

    if (existing?.id) {
      // Unlike
      const { error: delErr } = await supabase
        .from('comment_likes')
        .delete()
        .eq('id', existing.id);
      if (delErr) {
        console.error('comment-likes delete error:', delErr.message);
        return NextResponse.json({ ok: false, message: 'delete_failed' }, { status: 400 });
      }
      action = 'unliked';
    } else {
      // Like
      const { error: insErr } = await supabase
        .from('comment_likes')
        .insert({ comment_id: commentId, user_id: user.id });
      if (insErr) {
        console.error('comment-likes insert error:', insErr.message);
        return NextResponse.json({ ok: false, message: 'insert_failed' }, { status: 400 });
      }
      action = 'liked';
    }

    // Return updated count
    const { count: likeCount, error: countErr } = await supabase
      .from('comment_likes')
      .select('id', { count: 'exact', head: true })
      .eq('comment_id', commentId);
    const countVal = countErr || typeof likeCount !== 'number' ? 0 : likeCount;

    return NextResponse.json({ ok: true, action, count: countVal }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('comment-likes POST exception:', msg);
    return NextResponse.json({ ok: false, message: 'invalid_request' }, { status: 400 });
  }
}