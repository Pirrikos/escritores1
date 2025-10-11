import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer.js';
import { getUserCache, setUserCache } from '@/lib/misLecturasCache';
import { generateSlug } from '@/lib/slugUtils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ProgressRow = {
  content_type: 'work' | 'chapter';
  content_slug: string | null;
  bucket: string | null;
  file_path: string | null;
  last_page: number | null;
  num_pages: number | null;
  updated_at: string;
};

type ViewRow = {
  content_type: 'work' | 'chapter';
  content_slug: string;
  bucket: string | null;
  file_path: string | null;
  created_at: string;
};

type Item = {
  type: 'work' | 'chapter';
  slug: string;
  title: string;
  bucket?: string | null;
  filePath?: string | null;
  lastPage?: number | null;
  numPages?: number | null;
  updatedAt: string; // ISO string
  coverUrl?: string | null;
  authorName?: string | null;
  progressRatio?: number | null;
  parentWorkSlug?: string | null;
  hasSerializedChapters?: boolean;
  hasPdf?: boolean; // solo relevante para capítulos
};

// Caché ligero compartido por usuario (10s TTL por defecto)

function normalizePathForMatch(raw?: string | null): string | null {
  const p = (raw || '').trim();
  if (!p) return null;
  const withoutLeadingSlash = p.replace(/^\/+/, '');
  const stripped = withoutLeadingSlash
    .replace(/^works\//, '')
    .replace(/^chapters\//, '')
    .replace(/^public\//, '');
  return stripped || null;
}

function normalizeProfileName(profiles: any): string | null {
  const p = Array.isArray(profiles) ? profiles[0] : profiles;
  const dn = p?.display_name;
  return typeof dn === 'string' && dn.trim() ? dn : null;
}

function isPdfPath(raw?: string | null): boolean {
  const p = (raw || '').toLowerCase();
  return !!p && p.endsWith('.pdf');
}

function pickBetter(a: Item | null, b: Item): Item | null {
  if (!a) return b;
  const ar = typeof a.progressRatio === 'number' ? a.progressRatio! : -1;
  const br = typeof b.progressRatio === 'number' ? b.progressRatio! : -1;
  if (ar !== br) return br > ar ? b : a;
  // tie-breaker: newer updatedAt
  const at = Date.parse(a.updatedAt);
  const bt = Date.parse(b.updatedAt);
  return bt > at ? b : a;
}

export async function GET(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      // Devolver vacío para UX consistente
      return NextResponse.json({ data: [] }, { status: 200, headers: { 'Cache-Control': 'private, max-age=10' } });
    }

    // Responder desde caché si está fresco
    const cached = getUserCache(user.id);
    if (cached) {
      const hasParentForChapters = (cached.data || []).every((it: any) => (
        it?.type !== 'chapter' || typeof it?.parentWorkSlug === 'string'
      ));
      if (hasParentForChapters) {
        return NextResponse.json({ data: cached.data }, { status: 200, headers: { 'Cache-Control': 'private, max-age=10' } });
      }
      // Si el caché es antiguo (sin parentWorkSlug), recalculamos y lo sobrescribimos abajo
    }

    // 1) Obtener entradas manuales guardadas (reading_list)
    const { data: readingListRows } = await supabase
      .from('reading_list')
      .select('work_slug, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    // 1b) Obtener capítulos guardados manualmente (reading_list_chapters)
    const { data: savedChapterRows } = await supabase
      .from('reading_list_chapters')
      .select('chapter_slug, parent_work_slug, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    // 2) Obtener últimas vistas (traemos hasta 50 para deduplicar)
    const { data: views, error: vErr } = await supabase
      .from('content_views')
      .select('content_type, content_slug, bucket, file_path, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    const viewsRows: ViewRow[] = [] as any;
    if (vErr) {
      // ignorado: la UI solo mostrará guardados manualmente
    }

    // 3) Obtener progresos (hasta 50)
    const { data: rps, error: rpErr } = await supabase
      .from('reading_progress')
      .select('content_type, content_slug, bucket, file_path, last_page, num_pages, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50);
    const progRows: ProgressRow[] = [] as any;

    // Filtrar entradas no-PDF que podrían reconstruirse desde portadas u otros archivos
    const filteredViews: ViewRow[] = [];
    const filteredProg: ProgressRow[] = [];

    // 4) Construir conjuntos para consultas en bloque
    const workSlugs = new Set<string>();
    const chapterSlugs = new Set<string>();
    const chapterPaths = new Set<string>();

    // Añadir slugs desde reading_list para asegurar aparición sin vistas/progreso
    for (const rl of (readingListRows || [])) {
      if (rl?.work_slug) workSlugs.add(rl.work_slug);
    }
    for (const sc of (savedChapterRows || [])) {
      const slug = (sc as any)?.chapter_slug || '';
      if (slug) chapterSlugs.add(slug);
      const pws = (sc as any)?.parent_work_slug || '';
      if (pws) workSlugs.add(pws);
    }

    for (const v of filteredViews) {
      if (v.content_type === 'work') workSlugs.add(v.content_slug);
      else {
        chapterSlugs.add(v.content_slug);
        const np = normalizePathForMatch(v.file_path);
        if (np) chapterPaths.add(np);
      }
    }
    for (const p of filteredProg) {
      if (p.content_type === 'work') {
        if (p.content_slug) workSlugs.add(p.content_slug);
      } else {
        if (p.content_slug) chapterSlugs.add(p.content_slug);
        const np = normalizePathForMatch(p.file_path);
        if (np) chapterPaths.add(np);
      }
    }

    // 5) Consultar metadatos en bloque
    const worksMap = new Map<string, any>();
    if (workSlugs.size > 0) {
      const { data: worksData } = await supabase
        .from('works')
        .select('slug, title, cover_url, file_url, profiles:profiles!works_author_id_fkey(display_name)')
        .in('slug', Array.from(workSlugs));
      for (const w of (worksData || [])) {
        worksMap.set((w as any).slug, w);
      }

      // Fallback: resolver obras también por slug generado desde el título
      // Esto cubre casos donde works.slug es NULL y el sistema usa generateSlug(title)
      const unresolved = Array.from(workSlugs).filter((s) => !worksMap.has(s));
      if (unresolved.length > 0) {
        try {
          const { data: publishedWorks } = await supabase
            .from('works')
            .select('slug, title, cover_url, file_url, profiles:profiles!works_author_id_fkey(display_name), status')
            .eq('status', 'published')
            .limit(2000);
          for (const w of (publishedWorks || [])) {
            const s = (w as any).slug || generateSlug((w as any).title || '');
            if (unresolved.includes(s)) {
              worksMap.set(s, w);
            }
          }
        } catch {}
      }
    }

    // Detectar si las obras tienen capítulos publicados (no independientes)
    // Incluye obras guardadas manualmente sin vistas/progreso
    const serializedWorkSlugs = new Set<string>();
    if (workSlugs.size > 0) {
      const candidateSlugs = Array.from(workSlugs);
      // 1) Resolver IDs de obras publicadas
      const { data: wRows } = await supabase
        .from('works')
        .select('id, slug')
        .in('slug', candidateSlugs)
        .eq('status', 'published');
      const idBySlug = new Map<string, string>();
      const slugById = new Map<string, string>();
      for (const w of (wRows || [])) {
        const id = String((w as any).id || '');
        const slug = String((w as any).slug || '');
        if (id && slug) {
          idBySlug.set(slug, id);
          slugById.set(id, slug);
        }
      }
      // 2) Marcar como serializadas las obras con capítulos publicados y no independientes (por ID)
      const ids = Array.from(slugById.keys());
      if (ids.length > 0) {
        const { data: chRows } = await supabase
          .from('chapters')
          .select('work_id, status, is_independent')
          .in('work_id', ids)
          .eq('status', 'published')
          .or('is_independent.eq.false,is_independent.is.null')
          .limit(1000);
        const withChIds = new Set<string>();
        for (const ch of (chRows || [])) {
          const wid = String((ch as any).work_id || '');
          if (wid) withChIds.add(wid);
        }
        for (const wid of withChIds) {
          const slug = slugById.get(wid);
          if (slug) serializedWorkSlugs.add(slug);
        }

        // Metadatos de obra (autor/portada) se obtendrán exclusivamente desde 'works'
      }
      // 3) Fallback: si no podemos leer la obra (RLS), probar por slug vía capítulos
      const resolvedSlugs = new Set<string>(Array.from(idBySlug.keys()));
      const missingSlugs = candidateSlugs.filter(s => !resolvedSlugs.has(s));
      for (const mslug of missingSlugs) {
        try {
          const { data: probe } = await supabase
            .from('chapters')
            .select('works:works!chapters_work_id_fkey(slug)')
            .eq('status', 'published')
            .or('is_independent.eq.false,is_independent.is.null')
            .eq('works.slug', mslug)
            .limit(1);
          if (Array.isArray(probe) && probe.length > 0) {
            serializedWorkSlugs.add(mslug);
          }
        } catch {}
      }
    }

    const chaptersSlugMap = new Map<string, any>();
    const chaptersPathMap = new Map<string, any>(); // key: file_url normalized
    if (chapterSlugs.size > 0) {
      const { data: chBySlug } = await supabase
        .from('chapters')
        .select('slug, title, cover_url, file_url, work_id, profiles:profiles!chapters_author_id_fkey(display_name), works:works!chapters_work_id_fkey(cover_url, slug, title)')
        .in('slug', Array.from(chapterSlugs));
      for (const c of (chBySlug || [])) {
        const slug = (c as any).slug;
        chaptersSlugMap.set(slug, c);
        const fileUrl = normalizePathForMatch((c as any).file_url);
        if (fileUrl) chaptersPathMap.set(fileUrl, c);
      }
    }
    if (chapterPaths.size > 0) {
      const { data: chByPath } = await supabase
        .from('chapters')
        .select('slug, title, cover_url, file_url, work_id, profiles:profiles!chapters_author_id_fkey(display_name), works:works!chapters_work_id_fkey(cover_url, slug, title)')
        .in('file_url', Array.from(chapterPaths));
      for (const c of (chByPath || [])) {
        const slug = (c as any).slug;
        chaptersSlugMap.set(slug, c);
        const fileUrl = normalizePathForMatch((c as any).file_url);
        if (fileUrl) chaptersPathMap.set(fileUrl, c);
      }
    }

    // Resolver slugs de obras padre por ID (fallback si el join no devuelve slug)
    const parentWorkIds = new Set<string>();
    for (const c of chaptersSlugMap.values()) {
      const wid = (c as any)?.work_id;
      if (typeof wid === 'string' && wid) parentWorkIds.add(wid);
    }
    for (const c of chaptersPathMap.values()) {
      const wid = (c as any)?.work_id;
      if (typeof wid === 'string' && wid) parentWorkIds.add(wid);
    }
    const worksById = new Map<string, { slug: string | null; title: string | null }>();
    if (parentWorkIds.size > 0) {
      const { data: wById } = await supabase
        .from('works')
        .select('id, slug, title')
        .in('id', Array.from(parentWorkIds));
      for (const w of (wById || [])) {
        const id = (w as any)?.id;
        const slug = (w as any)?.slug ?? null;
        const title = (w as any)?.title ?? null;
        if (typeof id === 'string' && id) {
          worksById.set(id, { slug, title });
        }
      }
    }

    // 6) Índices de progreso por slug y por path
    const workProgressBySlug = new Map<string, ProgressRow>();
    const chapterProgressBySlug = new Map<string, ProgressRow>();
    const chapterProgressByPath = new Map<string, ProgressRow>();

    for (const pr of filteredProg) {
      if (pr.content_type === 'work') {
        const slug = pr.content_slug || '';
        if (!slug) continue;
        const existing = workProgressBySlug.get(slug);
        if (!existing || Date.parse(pr.updated_at) > Date.parse(existing.updated_at)) {
          workProgressBySlug.set(slug, pr);
        }
      } else {
        if (pr.content_slug) {
          const existing = chapterProgressBySlug.get(pr.content_slug);
          if (!existing || Date.parse(pr.updated_at) > Date.parse(existing.updated_at)) {
            chapterProgressBySlug.set(pr.content_slug, pr);
          }
        }
        const np = normalizePathForMatch(pr.file_path);
        if (np) {
          const existing = chapterProgressByPath.get(np);
          if (!existing || Date.parse(pr.updated_at) > Date.parse(existing.updated_at)) {
            chapterProgressByPath.set(np, pr);
          }
        }
      }
    }

    const items: Item[] = [];

    // 7) Construir items desde views
    for (const v of filteredViews) {
      if (v.content_type === 'work') {
        const w = worksMap.get(v.content_slug);
        if (!w) continue;
        const pr = workProgressBySlug.get(v.content_slug) || null;
        const lastPage = pr?.last_page ?? null;
        const numPages = pr?.num_pages ?? null;
        const ratio = (typeof lastPage === 'number' && typeof numPages === 'number' && (numPages as number) > 0)
          ? Math.min(1, Math.max(0, (lastPage as number) / (numPages as number)))
          : (typeof lastPage === 'number' ? Math.max(0, lastPage as number) : null);
        {
          const isSerialized = serializedWorkSlugs.has(v.content_slug);
          items.push({
            type: 'work',
            slug: v.content_slug,
            title: (w as any).title,
            bucket: isSerialized ? null : v.bucket,
            filePath: isSerialized ? null : v.file_path,
            lastPage: isSerialized ? null : lastPage,
            numPages: isSerialized ? null : numPages,
            updatedAt: v.created_at,
            coverUrl: (w as any)?.cover_url ?? null,
            authorName: normalizeProfileName((w as any)?.profiles) ?? 'Autor Desconocido',
            progressRatio: isSerialized ? null : ratio,
            hasSerializedChapters: isSerialized,
          });
        }
      } else {
        let c = chaptersSlugMap.get(v.content_slug) || null;
        let resolvedSlug = v.content_slug;
        if (!c) {
          const np = normalizePathForMatch(v.file_path);
          if (np) {
            c = chaptersPathMap.get(np) || null;
          }
        }
        if (!c) continue;
        resolvedSlug = (c as any).slug || resolvedSlug;

        const np = normalizePathForMatch(v.file_path);
        const prBySlug = chapterProgressBySlug.get(resolvedSlug) || null;
        const prByPath = np ? (chapterProgressByPath.get(np) || null) : null;
        const pr = (() => {
          if (prBySlug && prByPath) {
            return Date.parse(prBySlug.updated_at) >= Date.parse(prByPath.updated_at) ? prBySlug : prByPath;
          }
          return prBySlug || prByPath || null;
        })();
        const lastPage = pr?.last_page ?? null;
        const numPages = pr?.num_pages ?? null;
        const ratio = (typeof lastPage === 'number' && typeof numPages === 'number' && (numPages as number) > 0)
          ? Math.min(1, Math.max(0, (lastPage as number) / (numPages as number)))
          : (typeof lastPage === 'number' ? Math.max(0, lastPage as number) : null);
        items.push({
          type: 'chapter',
          slug: resolvedSlug,
          title: (c as any).title,
          bucket: v.bucket,
          filePath: v.file_path,
          lastPage,
          numPages,
          updatedAt: v.created_at,
          coverUrl: (c as any)?.works?.cover_url || (c as any)?.cover_url || null,
          authorName: normalizeProfileName((c as any)?.profiles) || 'Autor Desconocido',
          progressRatio: ratio,
          parentWorkSlug: (c as any)?.works?.slug
            || (() => {
              const byId = worksById.get((c as any)?.work_id || '');
              if (!byId) return null;
              const s = byId.slug;
              if (typeof s === 'string' && s) return s;
              const t = byId.title;
              if (typeof t === 'string' && t) return generateSlug(t);
              return null;
            })()
            || null,
          hasPdf: !!((c as any)?.file_url || v.file_path),
        });
      }
    }

    // 8) Fallback desde reading_progress para entradas sin vistas
    for (const r of filteredProg) {
      if (r.content_type === 'work') {
        const slug = r.content_slug || '';
        if (!slug) continue;
        const w = worksMap.get(slug);
        if (!w) continue;
        const lastPage = r.last_page ?? null;
        const numPages = r.num_pages ?? null;
        const ratio = (typeof lastPage === 'number' && typeof numPages === 'number' && (numPages as number) > 0)
          ? Math.min(1, Math.max(0, (lastPage as number) / (numPages as number)))
          : (typeof lastPage === 'number' ? Math.max(0, lastPage as number) : null);
        {
          const isSerialized = serializedWorkSlugs.has(slug);
          items.push({
            type: 'work',
            slug,
            title: (w as any).title,
            bucket: isSerialized ? null : r.bucket,
            filePath: isSerialized ? null : r.file_path,
            lastPage: isSerialized ? null : lastPage,
            numPages: isSerialized ? null : numPages,
            updatedAt: r.updated_at,
            coverUrl: (w as any)?.cover_url ?? null,
            authorName: normalizeProfileName((w as any)?.profiles) ?? 'Autor Desconocido',
            progressRatio: isSerialized ? null : ratio,
            hasSerializedChapters: isSerialized,
          });
        }
      } else {
        // Capítulo: resolver por slug o por file_path
        let c = null as any;
        let slug = r.content_slug || '';
        if (slug) c = chaptersSlugMap.get(slug) || null;
        if (!c) {
          const np = normalizePathForMatch(r.file_path);
          if (np) c = chaptersPathMap.get(np) || null;
        }
        if (!c) continue;
        slug = (c as any).slug || slug;
        const lastPage = r.last_page ?? null;
        const numPages = r.num_pages ?? null;
        const ratio = (typeof lastPage === 'number' && typeof numPages === 'number' && (numPages as number) > 0)
          ? Math.min(1, Math.max(0, (lastPage as number) / (numPages as number)))
          : (typeof lastPage === 'number' ? Math.max(0, lastPage as number) : null);
        items.push({
          type: 'chapter',
          slug,
          title: (c as any).title,
          bucket: r.bucket,
          filePath: r.file_path,
          lastPage,
          numPages,
          updatedAt: r.updated_at,
          coverUrl: (c as any)?.works?.cover_url || (c as any)?.cover_url || null,
          authorName: normalizeProfileName((c as any)?.profiles) || 'Autor Desconocido',
          progressRatio: ratio,
          parentWorkSlug: (c as any)?.works?.slug
            || (() => {
              const byId = worksById.get((c as any)?.work_id || '');
              if (!byId) return null;
              const s = byId.slug;
              if (typeof s === 'string' && s) return s;
              const t = byId.title;
              if (typeof t === 'string' && t) return generateSlug(t);
              return null;
            })()
            || null,
          hasPdf: !!((c as any)?.file_url || r.file_path),
        });
      }
    }

    // 9) Añadir entradas guardadas manualmente (reading_list), aunque falte metadata
    //    Si el usuario no tiene permiso para ver la obra (RLS) o aún no existe,
    //    mostramos un fallback con el slug para que no desaparezca de Mis Lecturas.
    for (const rl of (readingListRows || [])) {
      const slug = rl?.work_slug || '';
      if (!slug) continue;
      const w = worksMap.get(slug) || null;
      {
        const isSerialized = serializedWorkSlugs.has(slug);
        const title = (w as any)?.title ?? slug;
        const author = normalizeProfileName((w as any)?.profiles) ?? 'Autor Desconocido';
        const rawCover = (w as any)?.cover_url;
        const effectiveCover = rawCover ?? `preview:template-1:marino:${encodeURIComponent(title)}:${encodeURIComponent(author)}`;
        items.push({
          type: 'work',
          slug,
          title,
          bucket: isSerialized ? null : 'works',
          filePath: isSerialized ? null : ((w as any)?.file_url ?? null),
          lastPage: null,
          numPages: null,
          updatedAt: rl.created_at,
          coverUrl: effectiveCover,
          authorName: author,
          progressRatio: null,
          hasSerializedChapters: isSerialized,
        });
      }
    }

    // 9b) Añadir capítulos guardados manualmente (reading_list_chapters)
    for (const sc of (savedChapterRows || [])) {
      const slug = (sc as any)?.chapter_slug || '';
      if (!slug) continue;
      const c = chaptersSlugMap.get(slug);
      const parentWorkSlug = ((c as any)?.works?.slug
        || (sc as any)?.parent_work_slug
        || null) as string | null;
      const workMeta = parentWorkSlug ? (worksMap.get(parentWorkSlug) || null) : null;
      items.push({
        type: 'chapter',
        slug,
        title: (c as any)?.title || slug,
        bucket: 'chapters',
        filePath: (c as any)?.file_url || null,
        lastPage: null,
        numPages: null,
        updatedAt: (sc as any)?.created_at,
        coverUrl: (c as any)?.works?.cover_url
          || (c as any)?.cover_url
          || (workMeta as any)?.cover_url
          || null,
        authorName: normalizeProfileName((c as any)?.profiles)
          || normalizeProfileName((workMeta as any)?.profiles)
          || 'Autor Desconocido',
        progressRatio: null,
        parentWorkSlug,
        hasPdf: !!((c as any)?.file_url),
      });
    }

    // 10) Deduplicar por tipo:slug, elegir mejor
    const bestByKey = new Map<string, Item>();
    for (const itm of items) {
      const key = `${itm.type}:${itm.slug}`;
      const chosen = pickBetter(bestByKey.get(key) || null, itm);
      if (chosen) bestByKey.set(key, chosen);
    }

    // 11) Ordenar por progreso y fecha
    const deduped = Array.from(bestByKey.values());
    deduped.sort((a, b) => {
      const ar = typeof a.progressRatio === 'number' ? (a.progressRatio as number) : -1;
      const br = typeof b.progressRatio === 'number' ? (b.progressRatio as number) : -1;
      if (ar !== br) return br - ar;
      return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
    });

    // Devolver hasta 50 items para que los guardados manualmente no desaparezcan
    const finalItems = deduped.slice(0, 50);

    // Guardar en caché (10s)
    setUserCache(user.id, finalItems, 10_000);
    return NextResponse.json({ data: finalItems }, { status: 200, headers: { 'Cache-Control': 'private, max-age=10' } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('mis-lecturas API error:', msg);
    return NextResponse.json({ data: [] }, { status: 200, headers: { 'Cache-Control': 'private, max-age=5' } });
  }
}