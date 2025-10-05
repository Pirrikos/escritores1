'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import WorksCarousel from '@/components/ui/WorksCarousel';
import { AppHeader } from '@/components/ui';
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

  const openChapterFile = useCallback(async (filePath?: string, slug?: string, fileType?: string, title?: string) => {
    try {
      // Resolver filePath desde el slug si no viene en el item
      let effectivePath = filePath;
      let effectiveType = fileType;
      let effectiveTitle = title;
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
      // Si aún no hay archivo, navegar al capítulo pasando ?view=pdf para abrir visor automático
      if (!effectivePath) {
        window.location.href = `/chapters/${slug || ''}?view=pdf`;
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
          setPdfUrl(urlToUse);
          setCurrentTitle(effectiveTitle || 'Capítulo');
          setIsPDFViewerOpen(true);
          return;
        } catch (e) {
          console.warn('No se pudo firmar la URL, se usará la ruta por defecto.', e);
          setPdfUrl(effectivePath);
          setCurrentTitle(effectiveTitle || 'Capítulo');
          setIsPDFViewerOpen(true);
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
          for (const ch of chRows) {
            const wid = (ch as any).work_id;
            if (!wid) continue;
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
                renderItemFooter={(work) => {
                  const chapters = chaptersByWork[work.id] || [];
                  return (
                    <div className="mt-2 bg-slate-50 border border-slate-200 rounded-md p-2">
                      <div className="text-xs font-semibold text-slate-700 mb-1">Capítulos</div>
                      {chapters.length === 0 ? (
                        <div className="text-xs text-slate-500">No hay capítulos publicados</div>
                      ) : (
                        <ul className="space-y-1">
                          {chapters.map((ch) => (
                            <li key={ch.id} className="flex items-center justify-between">
                              <span className="text-xs text-slate-700">#{ch.chapter_number} — {ch.title}</span>
                              <button
                                type="button"
                                onClick={() => openChapterFile(ch.file_url, ch.slug || generateSlug(ch.title), ch.file_type, ch.title)}
                                className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline disabled:text-slate-400"
                                title={ch.file_url ? (ch.file_type === 'application/pdf' ? 'Abrir PDF' : 'Abrir archivo del capítulo') : 'Abrir capítulo'}
                                disabled={false}
                              >
                                Ver
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                }}
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
            onClose={() => setIsPDFViewerOpen(false)}
          />
        )}

        <footer className="text-center mt-12 text-gray-600">
          <p className="text-lg">Catálogo de obras por capítulos</p>
        </footer>
      </div>
    </div>
  );
}