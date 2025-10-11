"use client";

import { useMemo, Suspense } from "react";
import dynamic from "next/dynamic";
// imports limpiados tras extraer lógica al hook
import { AppHeader } from "@/components/ui";
import { ChapterRow } from "@/components/ui/ChapterRow";
import WorkCard from "@/components/ui/WorkCard";
import { ToastProvider } from "@/contexts/ToastContext";
import ToastContainer from "@/components/ui/ToastContainer";
import useMisLecturasData from "@/hooks/useMisLecturasData";
import type { MisLecturasItem } from "@/types/misLecturas";


export default function MisLecturasPage() {
  return (
    <ToastProvider>
      <ToastContainer />
      <Suspense fallback={<div className="p-6 text-center">Cargando Mis lecturas…</div>}>
        <MisLecturasPageContent />
      </Suspense>
    </ToastProvider>
  );
}

function MisLecturasPageContent() {
  const {
    items,
    loading,
    error,
    activeTab,
    setActiveTab,
    serializedBySlug,
    publishedChaptersByWorkSlug,
    chapterProgressBySlug,
    deletedWorksBySlug,
    deletedChaptersBySlug,
    openItem,
    removeWork,
    isPDFViewerOpen,
    setIsPDFViewerOpen,
    setPdfUrl,
    setCurrentItem,
    pdfUrl,
    initialPage,
    currentTitle,
    currentItem,
  } = useMisLecturasData();

  const PDFViewer = useMemo(() => dynamic(() => import("@/components/ui/PDFViewer"), {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center p-8">Cargando visor PDF...</div>
    ),
  }), []);


  

  

  /* removed published-chapters effect
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
  */

  

  

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


            const renderChapterRow = (c: MisLecturasItem) => {
              const isDeleted = !!deletedChaptersBySlug[c.slug];
              return (
                <ChapterRow
                  title={c.title}
                  slug={c.slug}
                  hasPdf={!!c.hasPdf}
                  progressRatio={typeof c.progressRatio === 'number' ? c.progressRatio : undefined}
                  isDeleted={isDeleted}
                  onOpen={() => openItem(c)}
                />
              );
            };

            // removed: renderPublishedChapterRow helper (replaced by WorkCard + PublishedChapterRow component)

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
                        <WorkCard
                          item={group.work as any}
                          isDeleted={!!deletedWorksBySlug[group.work.slug]}
                          chapters={publishedChaps as any}
                          fallback={{
                            firstSlug: fallback.firstSlug,
                            firstTitle: fallback.firstTitle,
                            firstHasPdf: fallback.firstHasPdf,
                            firstProgressRatio: typeof fallback.firstProgressRatio === 'number' ? fallback.firstProgressRatio : null,
                          }}
                          isSerializedWork={!!group.work.hasSerializedChapters || !!serializedBySlug[group.work.slug]}
                          chapterProgressBySlug={chapterProgressBySlug as any}
                          onOpenItem={(itm) => openItem(itm)}
                          onRemove={() => removeWork(group.work.slug)}
                        />
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
                  {independentWorks.map(itm => (
                    <WorkCard
                      key={`work:${itm.slug}`}
                      item={itm as any}
                      isDeleted={!!deletedWorksBySlug[itm.slug]}
                      chapters={[]}
                      isSerializedWork={!!itm.hasSerializedChapters || !!serializedBySlug[itm.slug]}
                      chapterProgressBySlug={chapterProgressBySlug as any}
                      onOpenItem={(x) => openItem(x)}
                      onRemove={() => removeWork(itm.slug)}
                    />
                  ))}
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
          authorName={currentItem?.author}
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

// SignedWorkCover fue movido a '@/components/ui/SignedWorkCover'