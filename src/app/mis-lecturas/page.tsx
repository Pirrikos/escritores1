"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { getSignedFileUrl } from "@/lib/fileUtils";
import { Icon, Icons } from "@/components/ui";
import CoverRenderer from "@/components/ui/CoverRenderer";
import { parsePreviewCover } from "@/lib/utils";
import { AppHeader } from "@/components/ui";
import { logPdfView } from "@/lib/activityLogger";
import { ToastProvider, useToast } from "@/contexts/ToastContext";
import ToastContainer from "@/components/ui/ToastContainer";
import { generateSlug } from "@/lib/slugUtils";

type ProgressRow = {
  content_type: "work" | "chapter";
  content_slug: string;
  bucket: string | null;
  file_path: string | null;
  last_page: number;
  num_pages: number | null;
  updated_at: string;
};

type Item = {
  type: "work" | "chapter";
  slug: string;
  title: string;
  bucket?: string | null;
  filePath?: string | null;
  lastPage?: number;
  numPages?: number | null;
  updatedAt: Date;
  coverUrl?: string | null;
  authorName?: string;
  progressRatio?: number | null; // valor entre 0 y 1 cuando hay numPages
  parentWorkSlug?: string | null;
  hasSerializedChapters?: boolean;
  hasPdf?: boolean;
};

export default function MisLecturasPage() {
  return (
    <ToastProvider>
      <ToastContainer />
      <MisLecturasPageContent />
    </ToastProvider>
  );
}

function MisLecturasPageContent() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();

  const [isPDFViewerOpen, setIsPDFViewerOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [initialPage, setInitialPage] = useState<number | undefined>(undefined);
  const [currentTitle, setCurrentTitle] = useState<string>("");
  const [currentItem, setCurrentItem] = useState<Item | null>(null);
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'obras' | 'capitulos' | 'obrasCapitulos'>('obrasCapitulos');
  const [serializedBySlug, setSerializedBySlug] = useState<Record<string, { firstSlug?: string; firstTitle?: string; firstHasPdf?: boolean; firstProgressRatio?: number }>>({});
  const [publishedChaptersByWorkSlug, setPublishedChaptersByWorkSlug] = useState<Record<string, { slug: string; title: string; hasPdf: boolean; chapter_number: number | null; file_type?: string | null }[]>>({});
  const [chapterProgressBySlug, setChapterProgressBySlug] = useState<Record<string, number | undefined>>({});
  const [deletedWorksBySlug, setDeletedWorksBySlug] = useState<Record<string, boolean>>({});
  const [deletedChaptersBySlug, setDeletedChaptersBySlug] = useState<Record<string, boolean>>({});

  const PDFViewer = useMemo(() => dynamic(() => import("@/components/ui/PDFViewer"), {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center p-8">Cargando visor PDF...</div>
    ),
  }), []);

  // Normaliza un file_path para compararlo con chapters.file_url (sin prefijos de bucket/public)
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

  useEffect(() => {
    let mounted = true;
    async function loadRecent() {
      try {
        setLoading(true);
        setError(null);

        const resp = await fetch('/api/mis-lecturas', { credentials: 'include', cache: 'no-store' });
        if (!resp.ok) throw new Error('Fallo cargando lecturas');
        const json = await resp.json();
        const data = Array.isArray(json?.data) ? json.data : [];

        const mapped: Item[] = (data as any[]).map((it: any) => ({
          type: it.type,
          slug: it.slug,
          title: it.title,
          bucket: it.bucket ?? null,
          filePath: it.filePath ?? null,
          lastPage: typeof it.lastPage === 'number' ? it.lastPage : undefined,
          numPages: typeof it.numPages === 'number' ? it.numPages : undefined,
          updatedAt: new Date(it.updatedAt),
          coverUrl: it.coverUrl ?? null,
          authorName: it.authorName ?? 'Autor Desconocido',
          progressRatio: typeof it.progressRatio === 'number' ? it.progressRatio : undefined,
          parentWorkSlug: it.parentWorkSlug ?? null,
          hasSerializedChapters: !!it.hasSerializedChapters,
          hasPdf: !!it.hasPdf,
        }));

        // Añadir obras faltantes derivadas de capítulos (cuando solo hay capítulos guardados/vistos)
        try {
          const chapterParentSlugs = Array.from(new Set(
            mapped
              .filter(i => i.type === 'chapter' && typeof i.parentWorkSlug === 'string' && (i.parentWorkSlug as string))
              .map(i => i.parentWorkSlug as string)
          ));
          const existingWorkSlugs = new Set(mapped.filter(i => i.type === 'work').map(i => i.slug));
          const missingWorkSlugs = chapterParentSlugs.filter(s => !existingWorkSlugs.has(s));
          if (missingWorkSlugs.length > 0) {
            const { data: wRows } = await supabase
              .from('works')
              .select(`slug, title, cover_url, profiles:works_author_id_fkey(display_name)`)
              .in('slug', missingWorkSlugs)
              .limit(100);
            const bySlug: Record<string, any> = {};
            for (const w of (wRows || [])) {
              const slug = (w as any)?.slug as string;
              if (slug) bySlug[slug] = w;
            }
            const augmentedWorks: Item[] = missingWorkSlugs.map(slug => {
              const meta = bySlug[slug] || {};
              const relatedChapters = mapped.filter(i => i.type === 'chapter' && (i.parentWorkSlug || '') === slug);
              const latestUpdatedAt = relatedChapters.length > 0
                ? new Date(Math.max(...relatedChapters.map(c => c.updatedAt.getTime())))
                : new Date();
              const title = (meta as any)?.title || slug;
              const author = ((meta as any)?.profiles && ((Array.isArray((meta as any).profiles) ? (meta as any).profiles[0] : (meta as any).profiles)?.display_name)) || 'Autor Desconocido';
              const coverUrl = (meta as any)?.cover_url || null;
              return {
                type: 'work',
                slug,
                title,
                bucket: null,
                filePath: null,
                lastPage: undefined,
                numPages: undefined,
                updatedAt: latestUpdatedAt,
                coverUrl,
                authorName: author,
                progressRatio: undefined,
                parentWorkSlug: null,
                hasSerializedChapters: true,
                hasPdf: undefined,
              } as Item;
            });
            mapped.push(...augmentedWorks);
          }
        } catch {}

        if (mounted) {
          setItems(mapped);
          setLoading(false);
        }
      } catch (e) {
        if (mounted) {
          setError('No se pudo cargar tus lecturas recientes');
          setLoading(false);
        }
      }
    }

    loadRecent();
    return () => { mounted = false; };
  }, []);

  // Detectar items borrados con tolerancia a slugs generados desde el título
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const workItems = items.filter(i => i.type === 'work');
        const chapterItems = items.filter(i => i.type === 'chapter');
        const workSlugs = Array.from(new Set(workItems.map(i => i.slug)));
        const workTitles = Array.from(new Set(workItems.map(i => i.title).filter(Boolean)));
        const chapterSlugs = Array.from(new Set(chapterItems.map(i => i.slug)));

        const deletedWorks: Record<string, boolean> = {};
        const deletedChapters: Record<string, boolean> = {};

        // Resolver obras existentes por slug y por título (con slug generado)
        const knownWorkSlugs = new Set<string>();
        if (workSlugs.length > 0) {
          const { data: wBySlug } = await supabase
            .from('works')
            .select('slug, title')
            .in('slug', workSlugs)
            .limit(workSlugs.length);
          for (const row of (wBySlug || [])) {
            const s = String((row as any).slug || '');
            const t = String((row as any).title || '');
            if (s) knownWorkSlugs.add(s);
            if (t) knownWorkSlugs.add(generateSlug(t));
          }
        }
        if (workTitles.length > 0) {
          const { data: wByTitle } = await supabase
            .from('works')
            .select('slug, title')
            .in('title', workTitles)
            .limit(workTitles.length);
          for (const row of (wByTitle || [])) {
            const s = String((row as any).slug || '');
            const t = String((row as any).title || '');
            if (s) knownWorkSlugs.add(s);
            if (t) knownWorkSlugs.add(generateSlug(t));
          }
        }
        for (const s of workSlugs) {
          deletedWorks[s] = !knownWorkSlugs.has(s);
        }

        // Resolver capítulos existentes por slug directamente
        if (chapterSlugs.length > 0) {
          const { data: cRows } = await supabase
            .from('chapters')
            .select('slug')
            .in('slug', chapterSlugs)
            .limit(chapterSlugs.length);
          const foundChSlugs = new Set((cRows || []).map((c: any) => String(c.slug || '')));
          for (const s of chapterSlugs) {
            deletedChapters[s] = !foundChSlugs.has(s);
          }
        }

        if (!cancelled) {
          setDeletedWorksBySlug(deletedWorks);
          setDeletedChaptersBySlug(deletedChapters);
        }
      } catch {
        // no-op
      }
    };
    run();
    return () => { cancelled = true; };
  }, [items, supabase]);

  // Detectar qué obras tienen capítulos publicados (no independientes) para ubicarlas en la pestaña "Obra por capítulos"
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        // Considerar obras presentes y obras derivadas de capítulos (parentWorkSlug)
        const workSlugs = Array.from(new Set([
          ...items.filter(i => i.type === 'work').map(i => i.slug),
          ...items
            .filter(i => i.type === 'chapter' && typeof i.parentWorkSlug === 'string' && (i.parentWorkSlug as string))
            .map(i => i.parentWorkSlug as string),
        ]));
        if (workSlugs.length === 0) {
          if (!cancelled) setSerializedBySlug({});
          if (!cancelled) setPublishedChaptersByWorkSlug({});
          if (!cancelled) setChapterProgressBySlug({});
          return;
        }
        // Obtener ids de obras por slug
        const { data: workRows, error: workErr } = await supabase
          .from('works')
          .select('id, slug')
          .in('slug', workSlugs)
          .limit(200);
        if (workErr) throw workErr;
        const idBySlug: Record<string, string> = {};
        const slugById: Record<string, string> = {};
        for (const w of (workRows || [])) {
          const id = String((w as any).id || '');
          const slug = String((w as any).slug || '');
          if (id && slug) {
            idBySlug[slug] = id;
            slugById[id] = slug;
          }
        }
        // Fallback: resolver IDs por slug generado desde el título (cuando works.slug es NULL o distinto)
        const missingForIds = workSlugs.filter(s => !idBySlug[s]);
        if (missingForIds.length > 0) {
          try {
            const { data: publishedWorks } = await supabase
              .from('works')
              .select('id, slug, title, status')
              .eq('status', 'published')
              .limit(2000);
            for (const w of (publishedWorks || [])) {
              const id = String((w as any).id || '');
              const rawSlug = (w as any)?.slug as string | undefined;
              const title = (w as any)?.title as string | undefined;
              const candidate = (typeof rawSlug === 'string' && rawSlug) ? rawSlug : (typeof title === 'string' && title ? (await import('@/lib/slugUtils')).generateSlug(title) : '');
              if (id && candidate && missingForIds.includes(candidate) && !idBySlug[candidate]) {
                idBySlug[candidate] = id;
                slugById[id] = candidate;
              }
            }
          } catch {}
        }
        const ids = Object.values(idBySlug).filter(Boolean);
        // Buscar capítulos publicados y NO independientes por ID de obra
        const { data: chRows } = ids.length > 0 ? await supabase
          .from('chapters')
          .select('work_id, slug, title, chapter_number, status, is_independent, file_url, file_type')
          .in('work_id', ids)
          .eq('status', 'published')
          .or('is_independent.eq.false,is_independent.is.null')
          .order('chapter_number', { ascending: true })
          .limit(1000) : { data: [] } as any;
        const firstByWorkId: Record<string, { firstSlug?: string; firstTitle?: string; firstHasPdf?: boolean; firstProgressRatio?: number }> = {};
        const chaptersByWorkId: Record<string, { slug: string; title: string; hasPdf: boolean; chapter_number: number | null; file_type?: string | null }[]> = {};
        const allChapterSlugs: string[] = [];
        for (const ch of (chRows || [])) {
          const wid = String((ch as any).work_id || '');
          if (!wid) continue;
          const rawSlug = (ch as any).slug as string | undefined;
          const title = (ch as any).title as string | undefined;
          const safeSlug = (typeof rawSlug === 'string' && rawSlug.trim() !== '')
            ? rawSlug
            : (typeof title === 'string' && title ? generateSlug(title) : '');
          if (!firstByWorkId[wid]) {
            firstByWorkId[wid] = {
              firstSlug: (safeSlug || undefined),
              firstTitle: (ch as any).title || undefined,
              firstHasPdf: !!((ch as any).file_url),
              firstProgressRatio: undefined,
            };
          }
          if (!chaptersByWorkId[wid]) chaptersByWorkId[wid] = [];
          chaptersByWorkId[wid].push({
            slug: safeSlug,
            title: (ch as any).title,
            hasPdf: !!((ch as any).file_url),
            chapter_number: typeof (ch as any).chapter_number === 'number' ? (ch as any).chapter_number : null,
            file_type: (ch as any).file_type || null,
          });
          if (typeof safeSlug === 'string' && safeSlug) allChapterSlugs.push(safeSlug);
        }

        // Fallback: obtener capítulos por join usando works.slug cuando no se pudo resolver ID
        // o cuando la consulta por ID no devolvió capítulos (posible RLS en chapters)
        const unresolvedSlugs = workSlugs.filter(s => !idBySlug[s]);
        const slugsWithEmptyById = workSlugs.filter(s => {
          const wid = idBySlug[s];
          if (!wid) return false; // ya cubierto por unresolvedSlugs
          const arr = chaptersByWorkId[wid];
          return !Array.isArray(arr) || arr.length === 0;
        });
        const needsJoinSlugs = Array.from(new Set([...unresolvedSlugs, ...slugsWithEmptyById]));
        const publishedByWorkSlugFallback: Record<string, { slug: string; title: string; hasPdf: boolean; chapter_number: number | null; file_type?: string | null }[]> = {};
        const firstByWorkSlugFallback: Record<string, { firstSlug?: string; firstTitle?: string; firstHasPdf?: boolean; firstProgressRatio?: number }> = {};
        if (needsJoinSlugs.length > 0) {
          const { data: chJoinRows } = await supabase
            .from('chapters')
            .select('slug, title, chapter_number, status, is_independent, file_url, file_type, works:works!chapters_work_id_fkey(slug)')
            .eq('status', 'published')
            .or('is_independent.eq.false,is_independent.is.null')
            .in('works.slug', needsJoinSlugs)
            .order('chapter_number', { ascending: true })
            .limit(1000);
          for (const ch of (chJoinRows || [])) {
            const wslug = (ch as any)?.works?.slug as string | undefined;
            if (!wslug) continue;
            const rawSlug = (ch as any).slug as string | undefined;
            const title = (ch as any).title as string | undefined;
            const safeSlug = (typeof rawSlug === 'string' && rawSlug.trim() !== '')
              ? rawSlug
              : (typeof title === 'string' && title ? generateSlug(title) : '');
            if (!publishedByWorkSlugFallback[wslug]) publishedByWorkSlugFallback[wslug] = [];
            publishedByWorkSlugFallback[wslug].push({
              slug: safeSlug,
              title: (ch as any).title,
              hasPdf: !!((ch as any).file_url),
              chapter_number: typeof (ch as any).chapter_number === 'number' ? (ch as any).chapter_number : null,
              file_type: (ch as any).file_type || null,
            });
            if (!firstByWorkSlugFallback[wslug]) {
              firstByWorkSlugFallback[wslug] = {
                firstSlug: (safeSlug || undefined),
                firstTitle: (ch as any).title || undefined,
                firstHasPdf: !!((ch as any).file_url),
                firstProgressRatio: undefined,
              };
            }
            if (typeof safeSlug === 'string' && safeSlug) allChapterSlugs.push(safeSlug);
          }
        }
        // Obtener progreso del primer capítulo para mostrar "Empezar/Continuar"
        try {
          const slugs = Object.values(firstByWorkId).map(v => v.firstSlug).filter(Boolean) as string[];
          const progressBySlug: Record<string, number | undefined> = {};
          const targetSlugs = Array.from(new Set([...(slugs || []), ...allChapterSlugs]));
          if (targetSlugs.length > 0) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const { data: rpRows } = await supabase
                .from('reading_progress')
                .select('content_slug, last_page, num_pages, updated_at')
                .eq('user_id', user.id)
                .eq('content_type', 'chapter')
                .in('content_slug', targetSlugs)
                .limit(1000);
              for (const rp of (rpRows || [])) {
                const slug = (rp as any).content_slug as string;
                const lastPage = (rp as any).last_page as number | null;
                const numPages = (rp as any).num_pages as number | null;
                const ratio = (typeof lastPage === 'number' && typeof numPages === 'number' && (numPages as number) > 0)
                  ? Math.min(1, Math.max(0, (lastPage as number) / (numPages as number)))
                  : (typeof lastPage === 'number' ? Math.max(0, lastPage as number) : undefined);
                const entry = Object.values(firstByWorkId).find(v => v.firstSlug === slug);
                if (entry) entry.firstProgressRatio = ratio;
                progressBySlug[slug] = ratio;
              }
              if (!cancelled) setChapterProgressBySlug(progressBySlug);
            }
          }
        } catch {}
        const next: Record<string, { firstSlug?: string; firstTitle?: string; firstHasPdf?: boolean; firstProgressRatio?: number }> = {};
        const publishedByWorkSlug: Record<string, { slug: string; title: string; hasPdf: boolean; chapter_number: number | null; file_type?: string | null }[]> = {};
        for (const wid of Object.keys(firstByWorkId)) {
          const slug = slugById[wid];
          if (slug) next[slug] = firstByWorkId[wid];
        }
        for (const wid of Object.keys(chaptersByWorkId)) {
          const slug = slugById[wid];
          if (slug) publishedByWorkSlug[slug] = chaptersByWorkId[wid];
        }
        // Merge fallbacks por slug
        for (const wslug of Object.keys(firstByWorkSlugFallback)) {
          next[wslug] = firstByWorkSlugFallback[wslug];
        }
        for (const wslug of Object.keys(publishedByWorkSlugFallback)) {
          publishedByWorkSlug[wslug] = (publishedByWorkSlug[wslug] || []).concat(publishedByWorkSlugFallback[wslug]);
        }
        if (!cancelled) setSerializedBySlug(next);
        if (!cancelled) setPublishedChaptersByWorkSlug(publishedByWorkSlug);
      } catch (e) {
        if (!cancelled) setSerializedBySlug({});
        if (!cancelled) setPublishedChaptersByWorkSlug({});
        if (!cancelled) setChapterProgressBySlug({});
      }
    };
    run();
    return () => { cancelled = true; };
  }, [items, supabase]);

  // Abrir automáticamente el item indicado por ?continue=work:slug o chapter:slug
  useEffect(() => {
    try {
      const cont = searchParams?.get('continue') || '';
      if (!cont || loading || items.length === 0) return;
      const [type, slug] = cont.includes(':') ? cont.split(':') : ['', ''];
      const t = type === 'work' || type === 'chapter' ? type : null;
      const s = slug || '';
      if (!t || !s) return;
      const target = items.find(i => i.type === t && i.slug === s);
      if (target) {
        // Abrir visor automáticamente desde progreso
        void openItem(target);
      }
    } catch {}
  }, [searchParams, loading, items]);

  const openItem = async (itm: Item) => {
    try {
      // Resolver última página con prioridad: DB -> localStorage -> item.lastPage
      let ip: number | undefined = undefined;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: rp } = await supabase
            .from('reading_progress')
            .select('last_page, updated_at')
            .eq('user_id', user.id)
            .eq('content_type', itm.type)
            .eq('content_slug', itm.slug)
            .order('updated_at', { ascending: false })
            .limit(1);
          const pr = (rp || [])[0];
          if (pr && typeof pr.last_page === 'number') {
            ip = Math.max(1, pr.last_page);
          }
          // Fallback adicional: buscar por file_path normalizado si aún no se encontró
          if (typeof ip !== 'number') {
            const matchPath = normalizePathForMatch(itm.filePath || null);
            if (matchPath) {
              const { data: rpByPath } = await supabase
                .from('reading_progress')
                .select('last_page, updated_at')
                .eq('user_id', user.id)
                .eq('content_type', itm.type)
                .eq('file_path', matchPath)
                .order('updated_at', { ascending: false })
                .limit(1);
              const pr2 = (rpByPath || [])[0];
              if (pr2 && typeof pr2.last_page === 'number') {
                ip = Math.max(1, pr2.last_page);
              }
            }
          }
        }
      } catch {}

      if (typeof ip !== 'number') {
        try {
          const key = `reading-progress:${itm.type}:${itm.slug}`;
          const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
          if (raw) {
            const obj = JSON.parse(raw);
            if (typeof obj?.last_page === 'number') {
              ip = Math.max(1, obj.last_page);
            }
          }
        } catch {}
      }

      if (typeof ip !== 'number' && typeof itm.lastPage === 'number') {
        ip = Math.max(1, itm.lastPage);
      }

      // Normalizar bucket por tipo si no viene en el registro
      const bucket = (itm.bucket && itm.bucket.trim() !== '')
        ? itm.bucket!
        : (itm.type === 'work' ? 'works' : 'chapters');

      // Normalizar filePath antes de firmar para evitar 404 en rutas con prefijos
      const rawPath = (itm.filePath || '').trim();
      const normalizedPath = (() => {
        if (!rawPath) return '';
        // Si viene una URL completa firmada, extraer <bucket>/<path>
        if (rawPath.startsWith('http://') || rawPath.startsWith('https://')) {
          try {
            const u = new URL(rawPath);
            const parts = u.pathname.split('/');
            const signIdx = parts.findIndex(p => p === 'sign');
            if (signIdx >= 0 && parts.length > signIdx + 2) {
              const bkt = parts[signIdx + 1];
              const rest = parts.slice(signIdx + 2).join('/');
              return rest.startsWith('public/') ? rest.replace(/^public\//, '') : rest;
            }
          } catch {}
        }
        // Si el path incluye el bucket como prefijo, quitarlo para la firma
        const withoutLeadingSlash = rawPath.replace(/^\/+/, '');
        const stripped = withoutLeadingSlash
          .replace(/^works\//, '')
          .replace(/^chapters\//, '')
          .replace(/^public\//, '');
        return stripped;
      })();

      // Si no hay path disponible, intentar resolverlo por slug en el servidor
      let effectivePath = normalizedPath;
      let effectiveBucket = bucket;
      if (!effectivePath) {
        try {
          const res = await fetch('/api/files/resolve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ type: itm.type, slug: itm.slug }),
          });
          if (res.ok) {
            const data = await res.json();
            const srvBucket = (data?.bucket || '').trim();
            const srvPath = (data?.filePath || '').trim();
            if (srvPath) {
              effectiveBucket = srvBucket || effectiveBucket;
              const withoutLeadingSlash = srvPath.replace(/^\/+/, '');
              const stripped = withoutLeadingSlash
                .replace(/^works\//, '')
                .replace(/^chapters\//, '')
                .replace(/^public\//, '');
              effectivePath = stripped;
            }
          }
        } catch {}
      }

      // Si continúa sin path, abrir ficha como fallback
      if (!effectivePath) {
        addToast({ type: 'info', message: 'Archivo no disponible aún. Abriendo ficha…' });
        try {
          const to = itm.type === 'work'
            ? `/works/${itm.slug}`
            : `/chapters/${itm.slug}${itm.hasPdf ? '?view=pdf' : ''}`;
          router.push(to);
        } catch {}
        return;
      }

      const signed = await getSignedFileUrl(effectivePath, 3600, effectiveBucket);
      const urlToUse = signed;
      if (!urlToUse) return;
      // Descargar como blob y usar object URL para evitar net::ERR_ABORTED
      let viewerUrl = urlToUse;
      try {
        const pdfResp = await fetch(urlToUse, { cache: 'no-store' });
        const blob = await pdfResp.blob();
        viewerUrl = URL.createObjectURL(blob);
      } catch {}
      setPdfUrl(viewerUrl);
      setInitialPage(ip);
      setCurrentTitle(itm.title);
      setCurrentItem(itm);
      await logPdfView({ contentType: itm.type, contentSlug: itm.slug, urlOrPath: urlToUse, bucketOverride: bucket });
      setIsPDFViewerOpen(true);
    } catch (e) {
      console.warn('No se pudo firmar la URL.', e);
      const msg = (e instanceof Error ? e.message : 'Error generando URL firmada');
      const low = msg.toLowerCase();
      if (low.includes('no encontrado') || low.includes('404')) {
        addToast({ type: 'error', message: 'Archivo no encontrado en almacenamiento.' });
      } else {
        addToast({ type: 'error', message: 'No se pudo firmar el PDF.' });
      }
      // No abrir con ruta directa: evitar 404/ERR_ABORTED por rutas no servidas por Next
      return;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <AppHeader className="mb-8" />
        <h1 className="text-xl font-semibold text-slate-800 mb-4">Mis lecturas</h1>

        {/* Pestañas: Obra por capítulos / Obra / Capítulo independiente */}
        <div className="mb-6 flex gap-2">
          {[
            { key: 'obrasCapitulos', label: 'Obra por capítulos' },
            { key: 'obras', label: 'Obra' },
            { key: 'capitulos', label: 'Capítulo independiente' },
          ].map((tab: any) => (
            <button
              key={tab.key}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${activeTab === tab.key
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando tus lecturas…</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600">{error}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Aún no hay lecturas registradas.</p>
          </div>
        ) : (
          (() => {
            // Agrupación en cliente para mostrar obra con capítulos anidados
            const works = items.filter(i => i.type === 'work');
            const chapters = items.filter(i => i.type === 'chapter');
            const serializedSet = new Set([
              ...Object.keys(serializedBySlug),
              ...works.filter(w => !!w.hasSerializedChapters).map(w => w.slug),
              ...Object.keys(publishedChaptersByWorkSlug),
            ]);
            const groupedWorks = works
              .map(w => ({
                work: w,
                chapters: chapters.filter(c => (c.parentWorkSlug || '') === w.slug),
              }))
              .filter(group => serializedSet.has(group.work.slug) || group.chapters.length > 0);
            const independentWorks = works.filter(w => {
              const hasChild = chapters.some(c => (c.parentWorkSlug || '') === w.slug);
              return !serializedSet.has(w.slug) && !hasChild;
            });
            const independentChapters = chapters.filter(c => !(c.parentWorkSlug));

            const renderWorkCard = (
              itm: Item,
              chapters: { slug: string; title: string; hasPdf: boolean; chapter_number: number | null; file_type?: string | null }[] = [],
              fallback?: { firstSlug?: string; firstTitle?: string; firstHasPdf?: boolean; firstProgressRatio?: number | null }
            ) => {
              const percent = (typeof itm.lastPage === 'number' && typeof itm.numPages === 'number' && itm.numPages! > 0)
                ? Math.round((itm.lastPage! / itm.numPages!) * 100)
                : null;
              const isDeleted = !!deletedWorksBySlug[itm.slug];
              return (
                <div key={`work:${itm.slug}`} className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                  <div className="mb-4 flex justify-center">
                    <div className="transform transition-transform duration-300">
                      {(() => {
                        const meta = parsePreviewCover(
                          itm.coverUrl || undefined,
                          itm.title,
                          itm.authorName || 'Autor Desconocido'
                        );
                        if ((meta as any).mode === 'template') {
                          const tpl = (meta as any);
                          const validTemplateIds = ['template-1','template-2','template-3'] as const;
                          const validPaletteIds = ['marino','rojo','negro','verde','purpura'] as const;
                          const safeTemplateId = (validTemplateIds as readonly string[]).includes(tpl.templateId) ? tpl.templateId : 'template-1';
                          const normalizePalette = (p?: string) => {
                            const synonyms: Record<string, string> = { morado: 'purpura' };
                            const candidate = synonyms[p || ''] || p;
                            return (validPaletteIds as readonly string[]).includes(candidate as string)
                              ? (candidate as typeof validPaletteIds[number])
                              : 'marino';
                          };
                          const safePaletteId = normalizePalette(tpl.paletteId);
                          return (
                            <CoverRenderer
                              mode="template"
                              templateId={safeTemplateId as any}
                              title={tpl.title}
                              author={tpl.author}
                              paletteId={safePaletteId as any}
                              width={180}
                              height={270}
                              className="shadow-md rounded-sm"
                            />
                          );
                        }
                        if ((meta as any).mode === 'image') {
                          const url = (meta as any).url as string;
                          const isHttp = /^https?:\/\//.test(url);
                          return (
                            <div className="w-[180px] h-[270px] bg-gray-200 rounded overflow-hidden shadow-md">
                              {isHttp ? (
                                <Image
                                  src={url}
                                  alt={`Portada de ${itm.title}`}
                                  width={180}
                                  height={270}
                                  className="w-full h-full object-cover"
                                  unoptimized
                                />
                              ) : (
                                <SignedWorkCover coverPath={url} title={itm.title} />
                              )}
                            </div>
                          );
                        }
                        return (
                          <CoverRenderer
                            mode="auto"
                            title={itm.title}
                            author={itm.authorName || 'Autor Desconocido'}
                            paletteId="marino"
                            width={180}
                            height={270}
                            className="shadow-md rounded-sm"
                          />
                        );
                      })()}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-500">Obra</span>
                    <span className="text-xs text-slate-400">{new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(itm.updatedAt)}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800 mb-1">{itm.title}</h3>
                  {isDeleted ? (
                    <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-3">
                      <p className="text-sm text-red-700">Esta obra ha sido borrada por su autor y ya no está disponible.</p>
                    </div>
                  ) : null}
                  {percent != null && (
                    <div className="mb-3">
                      <p className="text-xs text-slate-600 mb-1">{percent}% leído</p>
                      <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Progreso de lectura">
                        <div className="h-full bg-indigo-500" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  )}
                  <div className="flex gap-3">
                    {!isDeleted ? (
                      <Link href={`/works/${itm.slug}`} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                        Ver ficha
                      </Link>
                    ) : null}
                    {!isDeleted && (
                      // Mostrar "Ver" para obras independientes (obra completa)
                      itm.type === 'work' && !itm.hasSerializedChapters
                    ) ? (
                      <button
                        className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-700 hover:bg-indigo-100"
                        onClick={() => openItem(itm)}
                      >
                        <Icon path={Icons.play} size="sm" />
                        Ver
                      </button>
                    ) : null}
                    <button
                      className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100"
                      onClick={async () => {
                        try {
                          const res = await fetch(`/api/reading-list?workSlug=${encodeURIComponent(itm.slug)}`, {
                            method: 'DELETE',
                            credentials: 'include',
                          });
                          if (res.ok) {
                            setItems(prev => prev.filter(x => {
                              if (x.type === 'work' && x.slug === itm.slug) return false;
                              if (x.type === 'chapter' && x.parentWorkSlug === itm.slug) return false;
                              return true;
                            }));
                            addToast({ type: 'success', message: 'Se eliminó de Mis lecturas.' });
                          } else {
                            addToast({ type: 'error', message: 'No se pudo eliminar.' });
                          }
                        } catch {
                          addToast({ type: 'error', message: 'Error de conexión al eliminar.' });
                        }
                      }}
                    >
                      <Icon path={Icons.trash} size="sm" />
                      Dejar de leer
                    </button>
                  </div>

                  {/* Capítulos anidados dentro de la tarjeta */}
                  {!isDeleted && chapters.length > 0 && (
                    <div className="mt-3">
                      {chapters.map(ch => renderPublishedChapterRow(ch, itm.title))}
                    </div>
                  )}
                  {!isDeleted && fallback?.firstSlug && chapters.length === 0 && (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-white/60 p-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-slate-800">{fallback?.firstTitle || 'Capítulo'}</h4>
                        {fallback?.firstHasPdf ? (
                          <button
                            className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-700 hover:bg-indigo-100"
                            onClick={() => openItem({
                              type: 'chapter',
                              slug: fallback!.firstSlug!,
                              title: fallback?.firstTitle || 'Capítulo',
                              bucket: 'chapters',
                              filePath: '',
                              lastPage: null,
                              numPages: null,
                              updatedAt: new Date().toISOString() as any,
                              coverUrl: null,
                              authorName: 'Autor Desconocido',
                              progressRatio: typeof fallback?.firstProgressRatio === 'number' ? fallback?.firstProgressRatio : null,
                              hasPdf: true,
                            } as any)}
                          >
                            <Icon path={Icons.play} size="sm" />
                            {typeof fallback?.firstProgressRatio === 'number' && (fallback?.firstProgressRatio as number) > 0 ? 'Continuar' : 'Empezar'}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )}
                  {!isDeleted && chapters.length === 0 && !fallback?.firstSlug && (itm.hasSerializedChapters || serializedBySlug[itm.slug]) && (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-white/60 p-3">
                      <p className="text-sm text-slate-700">Esta obra no tiene capítulos publicados todavía.</p>
                    </div>
                  )}
                </div>
              );
            };

            const renderChapterRow = (c: Item) => {
              const isDeleted = !!deletedChaptersBySlug[c.slug];
              return (
                <div key={`chapter:${c.slug}`} className="mt-3 rounded-xl border border-slate-200 bg-white/60 p-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-slate-800">{c.title}</h4>
                    {isDeleted ? (
                      <span className="text-xs rounded-md border border-red-200 bg-red-50 text-red-700 px-2 py-1">Este capítulo ha sido borrado por su autor y ya no está disponible.</span>
                    ) : c.hasPdf ? (
                      <button
                        className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-700 hover:bg-indigo-100"
                        onClick={() => openItem(c)}
                      >
                        <Icon path={Icons.play} size="sm" />
                        {typeof c.progressRatio === 'number' && c.progressRatio > 0 ? 'Continuar' : 'Empezar'}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            };

            const renderPublishedChapterRow = (
              ch: { slug: string; title: string; hasPdf: boolean; chapter_number: number | null; file_type?: string | null },
              workTitle: string
            ) => {
              const pr = chapterProgressBySlug[ch.slug];
              return (
                <div key={`chapter-pub:${ch.slug}`} className="mt-3 rounded-xl border border-slate-200 bg-white/60 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {typeof ch.chapter_number === 'number' ? (
                        <span className="text-xs font-medium text-slate-700">Capítulo {ch.chapter_number}</span>
                      ) : null}
                      <h4 className="text-sm font-medium text-slate-800">{ch.title}</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      {ch.hasPdf ? (
                        <button
                          className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm"
                          onClick={() => openItem({
                            type: 'chapter',
                            slug: ch.slug,
                            title: ch.title,
                            bucket: 'chapters',
                            filePath: '',
                            lastPage: typeof pr === 'number' && pr > 0 ? Math.round((pr || 0) * (1000)) : null,
                            numPages: null,
                            updatedAt: new Date().toISOString() as any,
                            coverUrl: null,
                            authorName: 'Autor Desconocido',
                            progressRatio: typeof pr === 'number' ? pr : null,
                            hasPdf: true,
                          } as any)}
                        >
                          Ver
                        </button>
                      ) : null}
                      <Link
                        className="px-3 py-1 rounded bg-gray-100 text-gray-800 hover:bg-gray-200 text-sm"
                        href={`/chapters/${ch.slug}`}
                      >
                        Ir al capítulo
                      </Link>
                    </div>
                  </div>
                </div>
              );
            };

            if (activeTab === 'obrasCapitulos') {
              if (groupedWorks.length === 0) {
                return (
                  <div className="text-center py-12">
                    <p className="text-gray-600">No hay obras con capítulos guardados.</p>
                  </div>
                );
              }
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {groupedWorks.map(group => {
                    const fallback = serializedBySlug[group.work.slug] || {};
                    const publishedChaps = publishedChaptersByWorkSlug[group.work.slug] || [];
                    return (
                      <div key={`group:${group.work.slug}`}>
                        {renderWorkCard(group.work, publishedChaps, {
                          firstSlug: fallback.firstSlug,
                          firstTitle: fallback.firstTitle,
                          firstHasPdf: fallback.firstHasPdf,
                          firstProgressRatio: typeof fallback.firstProgressRatio === 'number' ? fallback.firstProgressRatio : null,
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            }

            if (activeTab === 'obras') {
              if (independentWorks.length === 0) {
                return (
                  <div className="text-center py-12">
                    <p className="text-gray-600">No hay obras independientes guardadas.</p>
                  </div>
                );
              }
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {independentWorks.map(itm => renderWorkCard(itm))}
                </div>
              );
            }

            // Capítulos independientes
            if (independentChapters.length === 0) {
              return (
                <div className="text-center py-12">
                  <p className="text-gray-600">No hay capítulos independientes guardados.</p>
                </div>
              );
            }
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {independentChapters.map(ch => (
                  <div key={`chapter-card:${ch.slug}`} className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                    {renderChapterRow(ch)}
                  </div>
                ))}
              </div>
            );
          })()
        )}

        {isPDFViewerOpen && pdfUrl && (
        <PDFViewer
          fileUrl={pdfUrl}
          fileName={currentTitle}
          onClose={() => {
            try {
              if (pdfUrl && pdfUrl.startsWith('blob:')) {
                URL.revokeObjectURL(pdfUrl);
              }
            } catch {}
            setPdfUrl(null);
            setIsPDFViewerOpen(false);
            setCurrentItem(null);
          }}
          initialPage={initialPage}
          onProgress={async (page, totalPages) => {
            try {
              // Normalizar filePath para registro estable
              const normalizedPath = (() => {
                const src = pdfUrl || '';
                if (src && (src.startsWith('http://') || src.startsWith('https://'))) {
                  try {
                    const u = new URL(src);
                    const parts = u.pathname.split('/');
                    const signIdx = parts.findIndex(p => p === 'sign');
                    if (signIdx >= 0 && parts.length > signIdx + 2) {
                      const bkt = parts[signIdx + 1];
                      const rest = parts.slice(signIdx + 2).join('/');
                      return `${bkt}/${rest}`;
                    }
                  } catch {}
                }
                return (currentItem?.filePath) || '';
              })();
                const current = currentItem || items.find(i => i.title === currentTitle);
              await fetch('/api/activity/reading-progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  contentType: current?.type,
                  contentSlug: current?.slug,
                  bucket: current?.bucket || (current?.type === 'work' ? 'works' : 'chapters'),
                  filePath: normalizedPath,
                  lastPage: page,
                  numPages: totalPages,
                }),
              });

              // Guardar también en localStorage
              try {
                const type = current?.type || 'work';
                const slug = current?.slug || '';
                const key = `reading-progress:${type}:${slug}`;
                const payload = { last_page: page, num_pages: totalPages, updated_at: new Date().toISOString() };
                if (typeof window !== 'undefined') {
                  window.localStorage.setItem(key, JSON.stringify(payload));
                }
              } catch {}
            } catch (e) {
              // no-op
            }
          }}
        />
        )}
      </div>
    </div>
  );
}

function SignedWorkCover({ coverPath, title }: { coverPath: string; title: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        if (!coverPath) {
          if (!cancelled) setSrc(null);
          return;
        }
        if (/^https?:\/\//.test(coverPath)) {
          if (!cancelled) setSrc(coverPath);
          return;
        }
        // Usa el helper para firmar rutas privadas del bucket de obras
        try {
          const signed = await getSignedFileUrl(coverPath, 3600, 'works');
          if (!cancelled) setSrc(signed || null);
        } catch (e) {
          console.warn('Firma de portada fallida en Mis Lecturas:', e);
          if (!cancelled) setSrc(null);
        }
      } catch (e) {
        console.warn('Error inesperado firmando portada:', e);
        if (!cancelled) setSrc(null);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [coverPath]);
  if (!src) {
    return (
      <div className="w-full h-full bg-gray-200 rounded overflow-hidden" />
    );
  }
  // Usa img para evitar restricciones de dominios en next/image
  return (
    <img
      src={src}
      alt={`Portada de ${title}`}
      width={180}
      height={270}
      className="w-full h-full object-cover"
    />
  );
}