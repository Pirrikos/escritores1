import { NextResponse } from 'next/server';
import { createServerSupabaseClient, getSupabaseServiceClient } from '@/lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_TYPES = new Set(['post', 'chapter', 'work']);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const targetType = searchParams.get('target_type');
    const targetId = searchParams.get('target_id');
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 30, 1), 100) : 30;
    const countOnly = searchParams.get('count') === '1';

    if (!targetType || !VALID_TYPES.has(targetType)) {
      return NextResponse.json({ error: 'invalid_target_type' }, { status: 400 });
    }
    if (!targetId) {
      return NextResponse.json({ error: 'missing_target_id' }, { status: 400 });
    }

    // Use service role client when available to allow public viewing of comments
    const serviceClient = getSupabaseServiceClient();
    const supabase = serviceClient || (await createServerSupabaseClient());

    if (countOnly) {
      const { count, error } = await supabase
        .from('comments')
        .select('id', { count: 'exact', head: true })
        .eq('target_type', targetType)
        .eq('target_id', targetId)
        .eq('is_deleted', false);
      if (error) {
        console.error('comments GET count error:', error.message);
        return NextResponse.json({ count: 0 }, { status: 200 });
      }
      return NextResponse.json({ count: count ?? 0 }, { status: 200 });
    }

    // Primer intento: incluir username (si existe en el esquema)
    const { data, error } = await supabase
      .from('comments')
      .select(`
        id,
        target_type,
        target_id,
        parent_id,
        user_id,
        body,
        is_edited,
        is_deleted,
        created_at,
        updated_at,
        profiles!comments_user_id_fkey (
          id,
          display_name,
          avatar_url,
          username
        )
      `)
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      // Fallback: algunos proyectos aún no tienen columna username en profiles
      console.warn('comments GET error with username, retrying without username:', error.message);
      const { data: alt, error: err2 } = await supabase
        .from('comments')
        .select(`
          id,
          target_type,
          target_id,
          parent_id,
          user_id,
          body,
          is_edited,
          is_deleted,
          created_at,
          updated_at,
          profiles!comments_user_id_fkey (
            id,
            display_name,
            avatar_url
          )
        `)
        .eq('target_type', targetType)
        .eq('target_id', targetId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (err2) {
        console.error('comments GET fallback error:', err2.message);
        return NextResponse.json({ data: [] }, { status: 200 });
      }
      return NextResponse.json({ data: alt || [] }, { status: 200 });
    }
    return NextResponse.json({ data: data || [] }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('comments GET exception:', msg);
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return NextResponse.json({ ok: false, message: 'unauthorized' }, { status: 401 });

    const bodyJson = await req.json();
    const targetType: string | null = bodyJson?.targetType ?? null;
    const targetId: string | null = bodyJson?.targetId ?? null;
    const parentId: string | null = bodyJson?.parentId ?? null;
    const bodyText: string | null = bodyJson?.body ?? null;

    if (!targetType || !VALID_TYPES.has(targetType)) {
      return NextResponse.json({ ok: false, message: 'invalid_target_type' }, { status: 400 });
    }
    if (!targetId || typeof targetId !== 'string') {
      return NextResponse.json({ ok: false, message: 'invalid_target_id' }, { status: 400 });
    }
    if (!bodyText || typeof bodyText !== 'string' || bodyText.trim().length === 0) {
      return NextResponse.json({ ok: false, message: 'empty_body' }, { status: 400 });
    }
    if (bodyText.length > 5000) {
      return NextResponse.json({ ok: false, message: 'body_too_long' }, { status: 400 });
    }

    const insertPayload: any = {
      target_type: targetType,
      target_id: targetId,
      user_id: user.id,
      body: bodyText,
    };
    if (parentId) insertPayload.parent_id = parentId;

    const { data, error } = await supabase
      .from('comments')
      .insert(insertPayload)
      .select('id')
      .single();

    if (error) {
      console.error('comments POST error:', error.message);
      return NextResponse.json({ ok: false, message: 'insert_failed' }, { status: 400 });
    }
    return NextResponse.json({ ok: true, id: data?.id }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('comments POST exception:', msg);
    return NextResponse.json({ ok: false, message: 'invalid_request' }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return NextResponse.json({ ok: false, message: 'unauthorized' }, { status: 401 });

    const bodyJson = await req.json();
    const id: string | null = bodyJson?.id ?? null;
    const bodyText: string | null = bodyJson?.body ?? null;
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ ok: false, message: 'invalid_id' }, { status: 400 });
    }
    if (!bodyText || typeof bodyText !== 'string' || bodyText.trim().length === 0) {
      return NextResponse.json({ ok: false, message: 'empty_body' }, { status: 400 });
    }
    if (bodyText.length > 5000) {
      return NextResponse.json({ ok: false, message: 'body_too_long' }, { status: 400 });
    }

    const { error } = await supabase
      .from('comments')
      .update({ body: bodyText, is_edited: true })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('comments PATCH error:', error.message);
      return NextResponse.json({ ok: false, message: 'update_failed' }, { status: 400 });
    }
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('comments PATCH exception:', msg);
    return NextResponse.json({ ok: false, message: 'invalid_request' }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return NextResponse.json({ ok: false, message: 'unauthorized' }, { status: 401 });

    const bodyJson = await req.json();
    const id: string | null = bodyJson?.id ?? null;
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ ok: false, message: 'invalid_id' }, { status: 400 });
    }

    // Soft-delete: mark as deleted and replace body with placeholder
    const { error } = await supabase
      .from('comments')
      .update({ is_deleted: true, body: '[deleted]' })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('comments DELETE error:', error.message);
      return NextResponse.json({ ok: false, message: 'delete_failed' }, { status: 400 });
    }
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('comments DELETE exception:', msg);
    return NextResponse.json({ ok: false, message: 'invalid_request' }, { status: 400 });
  }
}