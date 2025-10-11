import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer.js';
import { clearUserCache } from '@/lib/misLecturasCache';
import getSupabaseAdmin from '@/lib/supabaseAdmin.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET: return saved works for the current user, enriched with metadata
export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ data: [] }, { status: 200 });
  }

  // Optional: check if a chapter is saved
  try {
    const { searchParams } = new URL(req.url);
    const chapterSlug = (searchParams.get('chapterSlug') || '').trim();
    if (chapterSlug) {
      const { data: chRows } = await supabase
        .from('reading_list_chapters')
        .select('id')
        .eq('user_id', user.id)
        .eq('chapter_slug', chapterSlug)
        .limit(1);
      return NextResponse.json({ saved: Array.isArray(chRows) && chRows.length > 0 }, { status: 200 });
    }
  } catch {}

  const { data: list, error: rlErr } = await supabase
    .from('reading_list')
    .select('work_slug, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (rlErr) {
    return NextResponse.json({ data: [] }, { status: 200 });
  }

  const slugs = (list || []).map(r => r.work_slug);
  let worksMeta: any[] = [];
  if (slugs.length > 0) {
    const { data } = await supabase
      .from('works')
      .select('slug, title, cover_url, file_url, profiles:profiles!works_author_id_fkey(display_name)')
      .in('slug', slugs);
    worksMeta = data || [];
  }

  const metaBySlug = new Map<string, any>();
  for (const w of worksMeta) metaBySlug.set((w as any).slug, w);

  const items = (list || []).map((r) => {
    const w = metaBySlug.get(r.work_slug) || null;
    return {
      type: 'work',
      slug: r.work_slug,
      title: w ? (w as any).title : r.work_slug,
      bucket: 'works',
      filePath: w ? (w as any).file_url || null : null,
      updatedAt: r.created_at,
      coverUrl: w ? ((w as any).cover_url || null) : null,
      authorName: w ? ((w as any).profiles?.display_name || 'Autor Desconocido') : 'Autor Desconocido',
    };
  });

  return NextResponse.json({ data: items }, { status: 200 });
}

// POST: add a work slug to the user's reading list
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const workSlug = (body?.workSlug || '').trim();
  const chapterSlug = (body?.chapterSlug || '').trim();
  if (!workSlug && !chapterSlug) {
    return NextResponse.json({ error: 'invalid slug' }, { status: 400 });
  }

  if (chapterSlug) {
    // Check existence first
    const { data: existsList } = await supabase
      .from('reading_list_chapters')
      .select('chapter_slug')
      .eq('user_id', user.id)
      .eq('chapter_slug', chapterSlug)
      .limit(1);
    if (Array.isArray(existsList) && existsList.length > 0) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }
    // Resolve parent work slug for better display (optional)
    let parentWorkSlug: string | null = null;
    try {
      const { data: chRow } = await supabase
        .from('chapters')
        .select('works:works!chapters_work_id_fkey(slug)')
        .eq('slug', chapterSlug)
        .limit(1)
        .maybeSingle();
      parentWorkSlug = ((chRow as any)?.works?.slug as string) || null;
    } catch {}
    const { error } = await supabase
      .from('reading_list_chapters')
      .insert({ user_id: user.id, chapter_slug: chapterSlug, parent_work_slug: parentWorkSlug });
    if (error) {
      const code = (error as any)?.code;
      const message = (error as any)?.message || '';
      if (code === '23505' || /duplicate key value/i.test(message)) {
        try { clearUserCache(user.id); } catch {}
        return NextResponse.json({ ok: true, already: true }, { status: 200 });
      }
      if (/row-level security/i.test(message) || /violates row-level security/i.test(message)) {
        return NextResponse.json({ error: 'forbidden', details: message }, { status: 403 });
      }
      console.error('[reading-list] insert chapter error:', { code, message });
      return NextResponse.json({ error: 'db_error', details: message || 'unknown' }, { status: 500 });
    }
    try { clearUserCache(user.id); } catch {}
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // Avoid requiring UPDATE RLS by checking existence first, then inserting
  const { data: existsList } = await supabase
    .from('reading_list')
    .select('work_slug')
    .eq('user_id', user.id)
    .eq('work_slug', workSlug)
    .limit(1);

  if (Array.isArray(existsList) && existsList.length > 0) {
    try { clearUserCache(user.id); } catch {}
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const { error } = await supabase
    .from('reading_list')
    .insert({ user_id: user.id, work_slug: workSlug });

  if (error) {
    const code = (error as any)?.code;
    const message = (error as any)?.message || '';
    // If unique constraint was hit, treat as success (already saved)
    if (code === '23505' || /duplicate key value/i.test(message)) {
      try { clearUserCache(user.id); } catch {}
      return NextResponse.json({ ok: true, already: true }, { status: 200 });
    }
    // If RLS policy blocked the insert, map to 403 for clarity
    if (/row-level security/i.test(message) || /violates row-level security/i.test(message)) {
      return NextResponse.json({ error: 'forbidden', details: message }, { status: 403 });
    }
    console.error('[reading-list] insert error:', { code, message });
    return NextResponse.json({ error: 'db_error', details: message || 'unknown' }, { status: 500 });
  }
  try { clearUserCache(user.id); } catch {}
  return NextResponse.json({ ok: true }, { status: 200 });
}

// DELETE: remove a work from the user's reading list
export async function DELETE(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const workSlug = (searchParams.get('workSlug') || '').trim();
  const chapterSlug = (searchParams.get('chapterSlug') || '').trim();
  if (!workSlug && !chapterSlug) {
    return NextResponse.json({ error: 'invalid slug' }, { status: 400 });
  }

  if (chapterSlug) {
    const { error } = await supabase
      .from('reading_list_chapters')
      .delete()
      .eq('user_id', user.id)
      .eq('chapter_slug', chapterSlug);
    if (error) {
      return NextResponse.json({ error: 'db_error' }, { status: 500 });
    }
    const admin = getSupabaseAdmin();
    // limpiar actividad del capítulo
    try {
      await admin
        .from('content_views')
        .delete()
        .eq('user_id', user.id)
        .eq('content_type', 'chapter')
        .eq('content_slug', chapterSlug);
    } catch {}
    try {
      await admin
        .from('reading_progress')
        .delete()
        .eq('user_id', user.id)
        .eq('content_type', 'chapter')
        .eq('content_slug', chapterSlug);
    } catch {}
    // limpiar por file_path variantes
    try {
      const { data: chRow } = await admin
        .from('chapters')
        .select('file_url, cover_url')
        .eq('slug', chapterSlug)
        .limit(1)
        .maybeSingle();
      const normalizePathForMatch = (raw?: string | null): string | null => {
        const p = (raw || '').trim();
        if (!p) return null;
        const withoutLeadingSlash = p.replace(/^\/+/, '');
        const stripped = withoutLeadingSlash
          .replace(/^works\//, '')
          .replace(/^chapters\//, '')
          .replace(/^public\//, '');
        return stripped || null;
      };
      const likePaths: string[] = [];
      const f1 = (chRow as any)?.file_url || null;
      const f2 = (chRow as any)?.cover_url || null;
      for (const p of [f1, f2]) {
        if (typeof p === 'string' && p) {
          const n = normalizePathForMatch(p);
          if (n) {
            likePaths.push(n);
            likePaths.push(`chapters/${n}`);
            likePaths.push(`public/${n}`);
          }
          likePaths.push(p);
        }
      }
      if (likePaths.length > 0) {
        const ors = Array.from(new Set(likePaths)).map((p) => `file_path.ilike.%${p}%`).join(',');
        if (ors) {
          try {
            await admin
              .from('content_views')
              .delete()
              .eq('user_id', user.id)
              .eq('content_type', 'chapter')
              .or(ors);
          } catch {}
          try {
            await admin
              .from('reading_progress')
              .delete()
              .eq('user_id', user.id)
              .eq('content_type', 'chapter')
              .or(ors);
          } catch {}
        }
      }
    } catch {}
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const { error } = await supabase
    .from('reading_list')
    .delete()
    .eq('user_id', user.id)
    .eq('work_slug', workSlug);

  if (error) {
    return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }
  // Limpieza adicional con cliente Admin (bypass RLS): eliminar actividad para que no reaparezca en Mis Lecturas
  const admin = getSupabaseAdmin();
  try {
    await admin
      .from('content_views')
      .delete()
      .eq('user_id', user.id)
      .eq('content_type', 'work')
      .eq('content_slug', workSlug);
  } catch {}

  try {
    await admin
      .from('reading_progress')
      .delete()
      .eq('user_id', user.id)
      .eq('content_type', 'work')
      .eq('content_slug', workSlug);
  } catch {}

  // Algunos registros de capítulos pueden usar el slug de la obra por error en clientes
  try {
    await admin
      .from('content_views')
      .delete()
      .eq('user_id', user.id)
      .eq('content_type', 'chapter')
      .eq('content_slug', workSlug);
  } catch {}

  try {
    await admin
      .from('reading_progress')
      .delete()
      .eq('user_id', user.id)
      .eq('content_type', 'chapter')
      .eq('content_slug', workSlug);
  } catch {}

  // Resolver la obra por slug para limpieza profunda (obra y sus capítulos)
  try {
    const { data: workRow } = await admin
      .from('works')
      .select('id, slug, file_url, cover_url')
      .eq('slug', workSlug)
      .limit(1)
      .maybeSingle();

    const workId = (workRow as any)?.id || null;
    const workFileUrl = (workRow as any)?.file_url || null;
    const workCoverUrl = (workRow as any)?.cover_url || null;

    const normalizePathForMatch = (raw?: string | null): string | null => {
      const p = (raw || '').trim();
      if (!p) return null;
      const withoutLeadingSlash = p.replace(/^\/+/, '');
      const stripped = withoutLeadingSlash
        .replace(/^works\//, '')
        .replace(/^chapters\//, '')
        .replace(/^public\//, '');
      return stripped || null;
    };

    // Borrar actividad de la obra por file_path y portada si existen (variantes normalizadas)
    const workLikePaths: string[] = [];
    if (typeof workFileUrl === 'string' && workFileUrl) {
      const n = normalizePathForMatch(workFileUrl);
      if (n) {
        workLikePaths.push(n);
        workLikePaths.push(`works/${n}`);
        workLikePaths.push(`public/${n}`);
      }
      workLikePaths.push(workFileUrl);
    }
    if (typeof workCoverUrl === 'string' && workCoverUrl) {
      const n = normalizePathForMatch(workCoverUrl);
      if (n) {
        workLikePaths.push(n);
        workLikePaths.push(`works/${n}`);
        workLikePaths.push(`public/${n}`);
      }
      workLikePaths.push(workCoverUrl);
    }
    if (workLikePaths.length > 0) {
      const ors = Array.from(new Set(workLikePaths)).map((p) => `file_path.ilike.%${p}%`).join(',');
      if (ors) {
        try {
          await admin
            .from('content_views')
            .delete()
            .eq('user_id', user.id)
            .eq('content_type', 'work')
            .or(ors);
        } catch {}
        try {
          await admin
            .from('reading_progress')
            .delete()
            .eq('user_id', user.id)
            .eq('content_type', 'work')
            .or(ors);
        } catch {}
      }
    }

    // Si tenemos el id de la obra, borrar actividad de sus capítulos
    if (typeof workId === 'string' && workId) {
      const { data: chRows } = await admin
        .from('chapters')
        .select('slug, file_url, cover_url')
        .eq('work_id', workId)
        .limit(1000);

      const chapterSlugs = (chRows || []).map((c: any) => c.slug).filter((s: any) => typeof s === 'string' && s);
      const chapterFileUrls = (chRows || []).map((c: any) => c.file_url).filter((p: any) => typeof p === 'string' && p);
      const chapterCoverUrls = (chRows || []).map((c: any) => c.cover_url).filter((p: any) => typeof p === 'string' && p);

      if (chapterSlugs.length > 0) {
        try {
          await admin
            .from('content_views')
            .delete()
            .eq('user_id', user.id)
            .eq('content_type', 'chapter')
            .in('content_slug', chapterSlugs);
        } catch {}
        try {
          await admin
            .from('reading_progress')
            .delete()
            .eq('user_id', user.id)
            .eq('content_type', 'chapter')
            .in('content_slug', chapterSlugs);
        } catch {}
      }

      const chapterLikePaths: string[] = [];
      for (const p of chapterFileUrls) {
        const n = normalizePathForMatch(p);
        if (n) {
          chapterLikePaths.push(n);
          chapterLikePaths.push(`chapters/${n}`);
          chapterLikePaths.push(`public/${n}`);
        }
        chapterLikePaths.push(p);
      }
      for (const p of chapterCoverUrls) {
        const n = normalizePathForMatch(p);
        if (n) {
          chapterLikePaths.push(n);
          chapterLikePaths.push(`chapters/${n}`);
          chapterLikePaths.push(`public/${n}`);
        }
        chapterLikePaths.push(p);
      }
      if (chapterLikePaths.length > 0) {
        const ors = Array.from(new Set(chapterLikePaths)).map((p) => `file_path.ilike.%${p}%`).join(',');
        if (ors) {
          try {
            await admin
              .from('content_views')
              .delete()
              .eq('user_id', user.id)
              .eq('content_type', 'chapter')
              .or(ors);
          } catch {}
          try {
            await admin
              .from('reading_progress')
              .delete()
              .eq('user_id', user.id)
              .eq('content_type', 'chapter')
              .or(ors);
          } catch {}
        }
      }
    }
  } catch {}

  // Invalida caché de Mis Lecturas
  try { clearUserCache(user.id); } catch {}

  return NextResponse.json({ ok: true }, { status: 200 });
}