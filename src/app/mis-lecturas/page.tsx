"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { getSignedFileUrl } from "@/lib/fileUtils";
import { Icon, Icons } from "@/components/ui";
import CoverRenderer from "@/components/ui/CoverRenderer";
import { parsePreviewCover } from "@/lib/utils";
import { AppHeader } from "@/components/ui";

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
};

export default function MisLecturasPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [isPDFViewerOpen, setIsPDFViewerOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [initialPage, setInitialPage] = useState<number | undefined>(undefined);
  const [currentTitle, setCurrentTitle] = useState<string>("");

  const PDFViewer = useMemo(() => dynamic(() => import("@/components/ui/PDFViewer"), {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center p-8">Cargando visor PDF...</div>
    ),
  }), []);

  useEffect(() => {
    let mounted = true;
    async function loadRecent() {
      try {
        setLoading(true);
        setError(null);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (mounted) {
            setItems([]);
            setLoading(false);
          }
          return;
        }

        // 1) Obtener las últimas vistas registradas con el visor PDF (traer más para asegurar 10 únicas)
        const { data: views, error: vErr } = await supabase
          .from('content_views')
          .select('content_type, content_slug, bucket, file_path, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (vErr) {
          console.warn('Fallo consultando content_views:', vErr);
          setError('No se pudo cargar tus lecturas recientes');
          if (mounted) setLoading(false);
          return;
        }

        const result: Item[] = [];
        for (const v of (views || [])) {
          const type = (v as any).content_type as 'work' | 'chapter';
          const slug = (v as any).content_slug as string;
          const bucket = (v as any).bucket as string | null;
          const filePath = (v as any).file_path as string | null;
          const createdAt = new Date((v as any).created_at);

        	// 2) Buscar título por slug y datos de portada
          if (type === 'work') {
            const { data: works } = await supabase
              .from('works')
              .select('slug, title, cover_url, profiles:profiles!works_author_id_fkey(display_name)')
              .eq('slug', slug)
              .limit(1);
            const w = (works || [])[0];
            if (!w) continue;

            // 3) Buscar progreso de lectura más reciente
            let lastPage: number | undefined = undefined;
            let numPages: number | undefined = undefined;
            const { data: rp } = await supabase
              .from('reading_progress')
              .select('last_page, num_pages, updated_at')
              .eq('user_id', user.id)
              .eq('content_type', 'work')
              .eq('content_slug', slug)
              .order('updated_at', { ascending: false })
              .limit(1);
            const pr = (rp || [])[0];
            if (pr) {
              lastPage = pr.last_page;
              numPages = pr.num_pages;
            }

            const ratio = (typeof lastPage === 'number' && typeof numPages === 'number' && numPages > 0)
              ? Math.min(1, Math.max(0, lastPage / numPages))
              : (typeof lastPage === 'number' ? Math.max(0, lastPage) : null);

            result.push({
              type: 'work',
              slug,
              title: w.title,
              bucket,
              filePath,
              lastPage,
              numPages,
              updatedAt: createdAt,
              coverUrl: (w as any)?.cover_url || null,
              authorName: (w as any)?.profiles?.display_name || 'Autor Desconocido',
              progressRatio: ratio,
            });
          } else {
            const { data: chapters } = await supabase
              .from('chapters')
              .select('slug, title, cover_url, profiles:profiles!chapters_author_id_fkey(display_name)')
              .eq('slug', slug)
              .limit(1);
            const c = (chapters || [])[0];
            if (!c) continue;

            let lastPage: number | undefined = undefined;
            let numPages: number | undefined = undefined;
            const { data: rp } = await supabase
              .from('reading_progress')
              .select('last_page, num_pages, updated_at')
              .eq('user_id', user.id)
              .eq('content_type', 'chapter')
              .eq('content_slug', slug)
              .order('updated_at', { ascending: false })
              .limit(1);
            const pr = (rp || [])[0];
            if (pr) {
              lastPage = pr.last_page;
              numPages = pr.num_pages;
            }

            const ratio = (typeof lastPage === 'number' && typeof numPages === 'number' && numPages > 0)
              ? Math.min(1, Math.max(0, lastPage / numPages))
              : (typeof lastPage === 'number' ? Math.max(0, lastPage) : null);

            result.push({
              type: 'chapter',
              slug,
              title: c.title,
              bucket,
              filePath,
              lastPage,
              numPages,
              updatedAt: createdAt,
              coverUrl: (c as any)?.cover_url || null,
              authorName: (c as any)?.profiles?.display_name || 'Autor Desconocido',
              progressRatio: ratio,
            });
          }
        }

        // 4) Deduplicar por (type, slug) quedándose con el mayor avance de lectura
        const bestByKey = new Map<string, Item>();
        const pickBetter = (a?: Item | null, b?: Item | null): Item | null => {
          if (!a && b) return b;
          if (!b && a) return a;
          if (!a && !b) return null;
          const ar = typeof a!.progressRatio === 'number' ? a!.progressRatio! : -1;
          const br = typeof b!.progressRatio === 'number' ? b!.progressRatio! : -1;
          if (ar !== br) return ar > br ? a! : b!;
          // Si el ratio es igual o no disponible, usar la fecha más reciente
          return (a!.updatedAt > b!.updatedAt) ? a! : b!;
        };

        for (const itm of result) {
          const key = `${itm.type}:${itm.slug}`;
          const existing = bestByKey.get(key) || null;
          const chosen = pickBetter(existing, itm);
          if (chosen) bestByKey.set(key, chosen);
        }

        // 5) Ordenar por mayor avance y luego por fecha, limitar a 10
        const deduped = Array.from(bestByKey.values());
        deduped.sort((a, b) => {
          const ar = typeof a.progressRatio === 'number' ? a.progressRatio! : -1;
          const br = typeof b.progressRatio === 'number' ? b.progressRatio! : -1;
          if (ar !== br) return br - ar;
          return b.updatedAt.getTime() - a.updatedAt.getTime();
        });
        const finalItems = deduped.slice(0, 10);

        if (mounted) {
          setItems(finalItems);
          setLoading(false);
        }
      } catch (e) {
        // Silenciar errores de carga de Mis Lecturas en consola
        if (mounted) {
          setError('Error inesperado');
          setLoading(false);
        }
      }
    }

    loadRecent();
    return () => { mounted = false; };
  }, [supabase]);

  const openItem = async (itm: Item) => {
    try {
      const signed = await getSignedFileUrl(itm.filePath || '', 3600, itm.bucket || undefined);
      const urlToUse = signed || itm.filePath || '';
      if (!urlToUse) return;
      setPdfUrl(urlToUse);
      setInitialPage(typeof itm.lastPage === 'number' ? Math.max(1, itm.lastPage) : undefined);
      setCurrentTitle(itm.title);
      setIsPDFViewerOpen(true);
    } catch (e) {
      console.warn('No se pudo firmar la URL, se usará la ruta por defecto.', e);
      const urlToUse = itm.filePath || '';
      if (urlToUse) {
        setPdfUrl(urlToUse);
        setInitialPage(typeof itm.lastPage === 'number' ? Math.max(1, itm.lastPage) : undefined);
        setCurrentTitle(itm.title);
        setIsPDFViewerOpen(true);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <AppHeader className="mb-8" />
        <h1 className="text-xl font-semibold text-slate-800 mb-4">Mis lecturas</h1>

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((itm) => {
              const percent = (typeof itm.lastPage === 'number' && typeof itm.numPages === 'number' && itm.numPages! > 0)
                ? Math.round((itm.lastPage! / itm.numPages!) * 100)
                : null;
              return (
                <div key={`${itm.type}:${itm.slug}`} className="rounded-2xl border border-slate-200 bg-white/70 p-4">
                  {/* Portada igual que carruseles */}
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
                          const validTemplateIds = ['template-1','template-2','template-3','template-4','template-5','template-6','template-7','template-8'] as const;
                          const validPaletteIds = ['marino','rojo','negro','verde','purpura'] as const;
                          const safeTemplateId = (validTemplateIds as readonly string[]).includes(tpl.templateId) ? tpl.templateId : 'template-1';
                          const safePaletteId = (validPaletteIds as readonly string[]).includes(tpl.paletteId) ? tpl.paletteId : 'marino';
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
                          return (
                            <div className="w-[180px] h-[270px] bg-gray-200 rounded overflow-hidden shadow-md">
                              <Image
                                src={(meta as any).url}
                                alt={`Portada de ${itm.title}`}
                                width={180}
                                height={270}
                                className="w-full h-full object-cover"
                              />
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
                    <span className="text-xs text-slate-500">{itm.type === 'work' ? 'Obra' : 'Capítulo'}</span>
                    <span className="text-xs text-slate-400">{new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(itm.updatedAt)}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800 mb-1">{itm.title}</h3>
                  {percent != null && (
                    <div className="mb-3">
                      <p className="text-xs text-slate-600 mb-1">{percent}% leído</p>
                      <div
                        className="w-full h-2 rounded-full bg-slate-200 overflow-hidden"
                        role="progressbar"
                        aria-valuenow={percent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="Progreso de lectura"
                      >
                        <div
                          className="h-full bg-indigo-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button
                      className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-700 hover:bg-indigo-100"
                      onClick={() => openItem(itm)}
                    >
                      <Icon path={Icons.play} size="sm" />
                      Continuar
                    </button>
                    <Link
                      href={itm.type === 'work' ? `/works/${itm.slug}` : `/chapters/${itm.slug}`}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Ver ficha
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {isPDFViewerOpen && pdfUrl && (
          <PDFViewer
            fileUrl={pdfUrl}
            fileName={currentTitle}
            onClose={() => setIsPDFViewerOpen(false)}
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
                  return (items.find(i => i.title === currentTitle)?.filePath) || '';
                })();

                const current = items.find(i => i.title === currentTitle);
                await fetch('/api/activity/reading-progress', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({
                    contentType: current?.type,
                    contentSlug: current?.slug,
                    bucket: current?.bucket,
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