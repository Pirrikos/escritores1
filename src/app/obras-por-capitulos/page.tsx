'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { logPdfView, normalizeBucketAndPath } from '@/lib/activityLogger';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import WorksCarousel from '@/components/ui/WorksCarousel';
import { AppHeader } from '@/components/ui';
import CommentsButton from '@/components/ui/CommentsButton';
import CommentsPreview from '@/components/ui/CommentsPreview';
import LikeButton from '@/components/ui/LikeButton';
import { generateSlug } from '@/lib/slugUtils';
import dynamic from 'next/dynamic';
const PDFViewer = dynamic(() => import('@/components/ui/PDFViewer'), { ssr: false });

interface Work {
  id: string;
  title: string;
  synopsis?: string;
  author_id: string;
  created_at: string;
  cover_url?: string;
  category?: string;
  profiles: {
    display_name: string;
  };
}

export default function WorksByChaptersCatalogPage() {
  const supabase = createClientComponentClient();
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chaptersByWork, setChaptersByWork] = useState<Record<string, Array<{ id: string; title: string; chapter_number: number; slug?: string; file_url?: string; file_type?: string }>>>({});

  // Estado para visor PDF interno
  const [isPDFViewerOpen, setIsPDFViewerOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [currentTitle, setCurrentTitle] = useState<string | null>(null);
  const [currentSlug, setCurrentSlug] = useState<string | null>(null);

  const openChapterFile = useCallback(async (filePath?: string, slug?: string, fileType?: string, title?: string) => {
    try {
      // Resolver filePath desde el slug si no viene en el item
      let effectivePath = filePath;
      let effectiveType = fileType;
      let effectiveTitle = title;
      let resolvedSlug = slug;
      if (!effectivePath && slug) {
        try {
          const { data: ch, error } = await supabase
            .from('chapters')
            .select('file_url, file_type, title, status')
            .eq('slug', slug)
            .eq('status', 'published')
            .limit(1)
            .single();
          if (!error && ch?.file_url) {
            effectivePath = ch.file_url;
            effectiveType = ch.file_type || effectiveType;
            effectiveTitle = ch.title || effectiveTitle;
          }
        } catch (e) {
          console.warn('No se pudo resolver file_url por slug', e);
        }
      }
      // Si no tenemos slug pero sí ruta de archivo, intentar resolver el slug real desde BD
      if (!resolvedSlug && effectivePath) {
        try {
          const { data: ch2 } = await supabase
            .from('chapters')
            .select('slug')
            .eq('file_url', effectivePath)
            .eq('status', 'published')
            .limit(1)
            .single();
          if (ch2?.slug) {
            resolvedSlug = ch2.slug as string;
          }
        } catch {}
      }
      // Si aún no hay archivo, navegar al capítulo pasando ?view=pdf para abrir visor automático
      if (!effectivePath) {
        window.location.href = `/chapters/${resolvedSlug || ''}?view=pdf`;
        return;
      }

      // Si es PDF, abrir dentro de la app con visor integrado
      const isPdf = (effectiveType && effectiveType.toLowerCase().includes('pdf')) || (effectivePath && effectivePath.toLowerCase().endsWith('.pdf'));
      if (isPdf) {
        try {
          const res = await fetch('/api/storage/signed-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath: effectivePath, expiresIn: 3600 })
          });
          const signed = res.ok ? (await res.json())?.signedUrl : null;
          const urlToUse = signed || effectivePath;
          const norm = normalizeBucketAndPath(urlToUse, { bucket: 'chapters', path: effectivePath || urlToUse });
          if (!resolvedSlug && norm.path) {
            try {
              const { data: ch3 } = await supabase
                .from('chapters')
                .select('slug')
                .eq('file_url', norm.path)
                .eq('status', 'published')
                .limit(1)
                .single();
              if (ch3?.slug) {
                resolvedSlug = ch3.slug as string;
              }
            } catch {}
          }
          // Descargar como blob y usar object URL para evitar net::ERR_ABORTED en visor
          let viewerUrl = urlToUse;
          if (signed) {
            try {
              const pdfResp = await fetch(signed, { cache: 'no-store' });
              const blob = await pdfResp.blob();
              viewerUrl = URL.createObjectURL(blob);
            } catch (blobErr) {
              // Si falla la descarga como blob, usar la URL firmada directamente
              viewerUrl = urlToUse;
            }
          }
          setPdfUrl(viewerUrl);
          setCurrentTitle(effectiveTitle || 'Capítulo');
          setCurrentSlug(resolvedSlug || slug || null);
          if (resolvedSlug || slug) {
            await logPdfView({ contentType: 'chapter', contentSlug: resolvedSlug || (slug as string), urlOrPath: norm.path || effectivePath });
          }
          setIsPDFViewerOpen(true);
          return;
        } catch (e) {
          console.warn('No se pudo firmar la URL, se usará la ruta por defecto.', e);
          const norm = normalizeBucketAndPath(effectivePath || '', { bucket: 'chapters', path: effectivePath || '' });
          if (!resolvedSlug && norm.path) {
            try {
              const { data: ch3 } = await supabase
                .from('chapters')
                .select('slug')
                .eq('file_url', norm.path)
                .eq('status', 'published')
                .limit(1)
                .single();
              if (ch3?.slug) {
                resolvedSlug = ch3.slug as string;
              }
            } catch {}
          }
          // Sin URL firmada, no abrir visor para evitar errores de carga
          // Mantener comportamiento previo sólo si se desea ruta directa
          // Aquí preferimos no abrir si no hay URL firmada
          // setPdfUrl(effectivePath);
          setCurrentTitle(effectiveTitle || 'Capítulo');
          setCurrentSlug(resolvedSlug || slug || null);
          if (resolvedSlug || slug) {
            await logPdfView({ contentType: 'chapter', contentSlug: resolvedSlug || (slug as string), urlOrPath: effectivePath });
          }
          return;
        }
      }

      // Otros tipos: abrir en nueva pestaña
      window.open(effectivePath, '_blank');
    } catch (e) {
      console.error('Error abriendo capítulo:', e);
      window.location.href = (filePath || `/chapters/${slug || ''}`);
    }
  }, [supabase]);

  const loadWorksByChapters = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 1) Obtener IDs de obras que tienen capítulos (no independientes)
      const { data: chapters, error: chaptersError } = await supabase
        .from('chapters')
        .select('work_id')
        .eq('is_independent', false)
        .not('work_id', 'is', null)
        .limit(500);
      if (chaptersError) throw chaptersError;

      const workIds = Array.from(new Set((chapters || []).map((c: any) => c.work_id))).filter(Boolean);

      if (workIds.length === 0) {
        setWorks([]);
        setLoading(false);
        return;
      }

      // 2) Cargar obras publicadas cuyos IDs están en la lista
      const { data, error: worksError } = await supabase
        .from('works')
        .select(`
          id,
          title,
          synopsis,
          author_id,
          created_at,
          cover_url,
          category,
          profiles!works_author_id_fkey (
            display_name
          )
        `)
        .eq('status', 'published')
        .in('id', workIds)
        .order('created_at', { ascending: false })
        .limit(100);
      if (worksError) throw worksError;

      const normalizeProfile = (p: any): { display_name: string } => {
        if (Array.isArray(p)) {
          return { display_name: p[0]?.display_name ?? 'Autor desconocido' };
        }
        if (p && typeof p === 'object' && 'display_name' in p) {
          return p as { display_name: string };
        }
        return { display_name: 'Autor desconocido' };
      };

      const normalized = (data || []).map((w: any) => ({
        ...w,
        profiles: normalizeProfile(w?.profiles),
      }));
      setWorks(normalized as Work[]);

      // 3) Cargar capítulos publicados de esas obras y agrupar
      try {
        const { data: chRows, error: chErr } = await supabase
          .from('chapters')
          .select('id, title, chapter_number, work_id, slug, status, file_url, file_type')
          .eq('is_independent', false)
          .in('work_id', workIds)
          .eq('status', 'published')
          .order('chapter_number', { ascending: true })
          .limit(1000);
        if (!chErr && Array.isArray(chRows)) {
          const map: Record<string, Array<{ id: string; title: string; chapter_number: number; slug?: string; file_url?: string; file_type?: string }>> = {};
          const seen: Record<string, Set<string>> = {};
          for (const ch of chRows) {
            const wid = (ch as any).work_id;
            if (!wid) continue;
            const slug = String((ch as any).slug || '').toLowerCase();
            const num = String((ch as any).chapter_number ?? '');
            const titleNorm = String((ch as any).title || '').trim().toLowerCase();
            const key = [slug, num, titleNorm].filter(Boolean).join('|');
            const seenSet = seen[wid] || new Set<string>();
            if (key && seenSet.has(key)) continue;
            seenSet.add(key);
            seen[wid] = seenSet;
            const list = map[wid] || [];
            list.push({ id: (ch as any).id, title: (ch as any).title, chapter_number: (ch as any).chapter_number, slug: (ch as any).slug, file_url: (ch as any).file_url, file_type: (ch as any).file_type });
            map[wid] = list;
          }
          setChaptersByWork(map);
        }
      } catch (chEx) {
        console.warn('No se pudieron cargar capítulos anidados:', chEx);
      }
    } catch (e) {
      console.error('Error cargando obras por capítulos:', e);
      setError('Error al cargar el catálogo de obras por capítulos');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadWorksByChapters();
  }, [loadWorksByChapters]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando catálogo de obras por capítulos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <AppHeader className="mb-12" />

        {/* Encabezado */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200/60 mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Biblioteca de Obras por Capítulos</h1>
          <p className="text-lg text-gray-600">Explora obras serializadas por capítulos, ordenadas por categorías literarias</p>
        </div>

        {/* Contenido: mostrar todas las categorías; si no hay obras, mensaje */}
        <div className="space-y-10">
          {[
            'otras',
            'Novela',
            'Cuento',
            'Poesía',
            'Teatro',
            'Ensayo',
            'Fantasía',
            'Ciencia ficción',
            'Romance',
            'Misterio',
            'Terror',
          ].map((cat) => {
            const items = works.filter((w) => w.category === cat);
            return items.length > 0 ? (
              <WorksCarousel
                key={cat}
                works={items}
                title={cat}
                description=""
                showStats={false}
                className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200/60"
                renderItemFooter={(w) => (
                  <div className="space-y-2">
                    <div className="flex items-center justify-start">
                      <CommentsButton targetType="work" targetId={w.id} />
                      <LikeButton targetType="work" targetId={w.id} className="ml-2" />
                    </div>
                    <CommentsPreview targetType="work" targetId={w.id} />
                  </div>
                )}
              />
            ) : (
              <div key={cat} className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200/60">
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">{cat}</h2>
                <p className="text-gray-600">no hay obras publicadas aun</p>
              </div>
            );
          })}
        </div>

        {/* Visor PDF integrado */}
        {isPDFViewerOpen && pdfUrl && (
          <PDFViewer
            fileUrl={pdfUrl}
            fileName={currentTitle || 'Documento PDF'}
            onClose={() => {
              try {
                if (pdfUrl && pdfUrl.startsWith('blob:')) {
                  URL.revokeObjectURL(pdfUrl);
                }
              } catch {}
              setPdfUrl(null);
              setIsPDFViewerOpen(false);
            }}
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
                  return src;
                })();

                await fetch('/api/activity/reading-progress', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({
                    contentType: 'chapter',
                    contentSlug: currentSlug || '',
                    bucket: 'chapters',
                    filePath: normalizedPath,
                    lastPage: page,
                    numPages: totalPages,
                  }),
                });

                // Guardar también en localStorage como respaldo
                try {
                  const type = 'chapter';
                  const slug = currentSlug || '';
                  const key = `reading-progress:${type}:${slug}`;
                  const payload = { last_page: page, num_pages: totalPages, updated_at: new Date().toISOString() };
                  if (typeof window !== 'undefined') {
                    window.localStorage.setItem(key, JSON.stringify(payload));
                  }
                } catch {}
              } catch {}
            }}
          />
        )}

        <footer className="text-center mt-12 text-gray-600">
          <p className="text-lg">Catálogo de obras por capítulos</p>
        </footer>
      </div>
    </div>
  );
}