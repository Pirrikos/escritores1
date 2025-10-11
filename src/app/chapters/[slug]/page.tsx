'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import CoverRenderer from '@/components/ui/CoverRenderer';
import { ViewDownloadButton } from '@/components/ui/ViewDownloadButton';
import { detectFileType, canViewInBrowser } from '@/lib/fileUtils';
import dynamic from 'next/dynamic';
const PDFViewer = dynamic(() => import('@/components/ui/PDFViewer'), { ssr: false });
import { ToastProvider, useToast } from '@/contexts/ToastContext';
import ToastContainer from '@/components/ui/ToastContainer';
import { WorkDetailSkeleton } from '@/components/ui/WorkDetailSkeleton';
import { generateSlug } from '@/lib/slugUtils';
import Image from 'next/image';
import { logPdfView } from '@/lib/activityLogger';

interface Chapter {
  id: string;
  title: string;
  content?: string;
  author_id: string;
  created_at: string;
  updated_at: string;
  cover_url?: string;
  file_url?: string;
  chapter_number?: number;
  is_independent: boolean;
  work_id?: string;
  slug?: string;
  profiles: {
    display_name: string;
  };
  parent_work_slug?: string | null;
  parent_work_title?: string | null;
  parent_work_cover_url?: string | null;
}

export default function ChapterDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClientComponentClient();

  return (
    <ToastProvider>
      <ToastContainer />
      <ChapterDetailPageContent 
        slug={slug}
        chapter={chapter}
        setChapter={setChapter}
        loading={loading}
        setLoading={setLoading}
        error={error}
        setError={setError}
        supabase={supabase}
      />
    </ToastProvider>
  );
}

function ChapterDetailPageContent({ 
  slug, 
  chapter, 
  setChapter, 
  loading, 
  setLoading, 
  error, 
  setError, 
  supabase 
}: {
  slug: string;
  chapter: Chapter | null;
  setChapter: (chapter: Chapter | null) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
  supabase: SupabaseClient;
}) {
  const { addToast } = useToast();
  const searchParams = useSearchParams();

  // Estado para visor PDF
  const [isPDFViewerOpen, setIsPDFViewerOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [currentTitle, setCurrentTitle] = useState<string>('');
  const [initialPage, setInitialPage] = useState<number | undefined>(undefined);
  const [isSaved, setIsSaved] = useState(false);
  const [checkingSaved, setCheckingSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadChapterBySlug = useCallback(async (chapterSlug: string) => {
    try {
      setLoading(true);
      setError(null);

      // Cargar todos los capítulos publicados y buscar por slug generado
      const { data, error } = await supabase
        .from('chapters')
        .select(`
          id,
          title,
          content,
          author_id,
          created_at,
          updated_at,
          cover_url,
          file_url,
          chapter_number,
          is_independent,
          work_id,
          slug,
          profiles!chapters_author_id_fkey (
            display_name
          ),
          works:works!chapters_work_id_fkey (
            slug,
            title,
            cover_url
          )
        `)
        .eq('status', 'published');

      if (error) {
        console.error('Error loading chapters:', error);
        setError('Error al cargar el capítulo');
        addToast({
          type: 'error',
          message: 'Error al cargar el capítulo. Por favor, intenta de nuevo.'
        });
        return;
      }

      // Normalizar tipo de profiles (algunas respuestas lo devuelven como array)
      const normalizedChapters: Chapter[] = (data || []).map((d: any) => {
        const profilesNorm = Array.isArray(d.profiles)
          ? (d.profiles[0] ?? { display_name: '' })
          : d.profiles;
        const worksRaw = d.works;
        const workObj = Array.isArray(worksRaw) ? (worksRaw[0] || null) : worksRaw || null;
        return {
          ...d,
          profiles: profilesNorm,
          parent_work_slug: workObj?.slug || null,
          parent_work_title: workObj?.title || null,
          parent_work_cover_url: workObj?.cover_url || null,
        } as Chapter;
      });

      // Buscar el capítulo que coincida con el slug
      const foundChapter = normalizedChapters.find((c) => {
        // Si el capítulo tiene slug guardado, usarlo; si no, generar uno
        const generatedSlug = c.slug || generateSlug(c.title);
        return generatedSlug === chapterSlug;
      });

      if (!foundChapter) {
        setError('Capítulo no encontrado');
        addToast({
          type: 'error',
          message: 'El capítulo que buscas no existe o no está disponible.'
        });
        return;
      }

      setChapter(foundChapter);
    } catch (err) {
      console.error('Error:', err);
      setError('Error al cargar el capítulo');
      addToast({
        type: 'error',
        message: 'Error inesperado al cargar el capítulo. Por favor, intenta de nuevo.'
      });
    } finally {
      setLoading(false);
    }
  }, [addToast, supabase, setChapter, setError, setLoading]);

  useEffect(() => {
    if (slug) {
      loadChapterBySlug(slug);
    }
  }, [slug, loadChapterBySlug]);

  // Abrir automáticamente el visor PDF si llega ?view=pdf
  useEffect(() => {
    const tryOpenPdf = async () => {
      if (!chapter) return;
      const view = searchParams.get('view');
      const filePath = chapter.file_url || '';
      const fileType = filePath ? detectFileType(filePath) : 'other';
      if (view === 'pdf' && filePath && fileType === 'pdf') {
        try {
          // Calcular initialPage a partir de BD (si hay usuario) y localStorage
          let ip: number | undefined = undefined;
          try {
            const { data: auth } = await supabase.auth.getUser();
            if (auth?.user) {
              const { data: rp } = await supabase
                .from('reading_progress')
                .select('last_page, updated_at')
                .eq('content_type', 'chapter')
                .eq('content_slug', slug)
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              const lpDb = rp?.last_page;
              if (typeof lpDb === 'number' && lpDb >= 1) {
                ip = lpDb;
              }
            }
          } catch {}

          if (!ip) {
            try {
              const key = `reading-progress:chapter:${slug}`;
              if (typeof window !== 'undefined') {
                const raw = window.localStorage.getItem(key);
                if (raw) {
                  const parsed = JSON.parse(raw);
                  const lpLs = parsed?.last_page;
                  if (typeof lpLs === 'number' && lpLs >= 1) {
                    ip = lpLs;
                  }
                }
              }
            } catch {}
          }

          if (ip && ip >= 1) {
            setInitialPage(ip);
          } else {
            setInitialPage(undefined);
          }

          const { data, error } = await supabase.storage
            .from('chapters')
            .createSignedUrl(filePath, 3600);
          const signedUrl = error ? null : data?.signedUrl;
          // Descargar como blob para evitar net::ERR_ABORTED y usar object URL
          let viewerUrl = signedUrl || filePath;
          if (signedUrl) {
            try {
              const pdfResp = await fetch(signedUrl, { cache: 'no-store' });
              const blob = await pdfResp.blob();
              viewerUrl = URL.createObjectURL(blob);
            } catch {}
          }
          setPdfUrl(viewerUrl);
          setCurrentTitle(chapter.title);
          await logPdfView({ contentType: 'chapter', contentSlug: slug, urlOrPath: signedUrl || filePath, bucketOverride: 'chapters' });
          setIsPDFViewerOpen(true);
        } catch (e) {
          addToast({ type: 'error', message: 'No se pudo abrir el PDF del capítulo.' });
        }
      }
    };
    tryOpenPdf();
  }, [chapter, searchParams, supabase, addToast]);

  // Comprobar si el capítulo ya está guardado en Mis Lecturas
  useEffect(() => {
    const checkSaved = async () => {
      try {
        if (!chapter || !slug) {
          setIsSaved(false);
          return;
        }
        setCheckingSaved(true);
        const res = await fetch(`/api/reading-list?chapterSlug=${encodeURIComponent(slug)}`, { method: 'GET', credentials: 'include' });
        if (!res.ok) {
          setIsSaved(false);
          return;
        }
        const json = await res.json();
        const saved = !!(json && typeof json.saved !== 'undefined' ? json.saved : false);
        setIsSaved(saved);
      } catch (e) {
        setIsSaved(false);
      } finally {
        setCheckingSaved(false);
      }
    };
    void checkSaved();
  }, [slug, chapter]);

  if (loading) {
    return <WorkDetailSkeleton />;
  }

  if (error || !chapter) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">📖</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {error || 'Capítulo no encontrado'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            El capítulo que buscas no existe o no está disponible públicamente.
          </p>
          <Link
            href="/chapters"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Volver a los capítulos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Aviso cuando se solicita ver PDF y no hay archivo o no es compatible */}
      {(() => {
        const wantsPdf = searchParams.get('view') === 'pdf';
        const fp = chapter?.file_url || '';
        const ft = fp ? detectFileType(fp) : 'other';
        const isPdf = ft === 'pdf';
        if (wantsPdf && (!fp || !isPdf)) {
          return (
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
              <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200 p-3 text-sm">
                {(!fp) ? (
                  <span>Este capítulo no tiene un archivo disponible para ver en el visor PDF.</span>
                ) : (
                  <span>El archivo de este capítulo no es PDF, por eso se muestra la ficha.</span>
                )}
              </div>
            </div>
          );
        }
        return null;
      })()}
      {isPDFViewerOpen && pdfUrl && (
        <PDFViewer
          fileUrl={pdfUrl}
          fileName={currentTitle || 'Capítulo'}
          initialPage={initialPage}
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
                // Fallback al file_url real del capítulo
                return chapter?.file_url || '';
              })();

              await fetch('/api/activity/reading-progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  contentType: 'chapter',
                  contentSlug: slug,
                  bucket: 'chapters',
                  filePath: normalizedPath,
                  lastPage: page,
                  numPages: totalPages,
                }),
              });

              // Guardar también en localStorage (fallback para usuarios sin sesión)
              try {
                const key = `reading-progress:chapter:${slug}`;
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
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <nav className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
            <Link href="/home" className="hover:text-blue-600 dark:hover:text-blue-400">
              Inicio
            </Link>
            <span>/</span>
            <Link href="/chapters" className="hover:text-blue-600 dark:hover:text-blue-400">
              Capítulos
            </Link>
            <span>/</span>
            <span className="text-gray-900 dark:text-white">{chapter.title}</span>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Cover */}
              <div className="lg:col-span-1">
                <div className="aspect-[3/4] w-full max-w-sm mx-auto">
                  {chapter.cover_url ? (
                    chapter.cover_url.startsWith('preview:') ? (
                      (() => {
                        const parts = chapter.cover_url.split(':');
                        const templateId = parts[1];
                        const paletteId = parts[2];
                        const encodedTitle = parts[3];
                        const encodedAuthor = parts[4];
                        const ALLOWED_TEMPLATES = ['template-1', 'template-2', 'template-3'] as const;
                        const ALLOWED_PALETTES = ['marino', 'rojo', 'negro', 'verde', 'purpura'] as const;
                        type TemplateId = typeof ALLOWED_TEMPLATES[number];
                        type PaletteId = typeof ALLOWED_PALETTES[number];
                        const isAllowed = <T extends readonly string[]>(arr: T, val: string): val is T[number] =>
                          (arr as ReadonlyArray<string>).includes(val);
                        const tId = isAllowed(ALLOWED_TEMPLATES, templateId) ? templateId : 'template-1';
                        const normalizePalette = (id: string): PaletteId => {
                          const synonyms: Record<string, PaletteId> = { violeta: 'purpura', morado: 'purpura' };
                          const candidate = synonyms[id] || id;
                          return isAllowed(ALLOWED_PALETTES, candidate) ? candidate : 'marino';
                        };
                        const pId = normalizePalette(paletteId);
                        
                        return (
                          <CoverRenderer
                            mode="template"
                            templateId={tId as TemplateId}
                            title={decodeURIComponent(encodedTitle || chapter.title)}
                            author={decodeURIComponent(encodedAuthor || chapter.profiles.display_name)}
                            paletteId={pId as PaletteId}
                            className="w-full h-full rounded-lg shadow-lg"
                          />
                        );
                      })()
                    ) : (
                      // Portada personalizada subida
                      <div className="w-full h-full bg-gray-200 rounded-lg overflow-hidden shadow-lg">
                        <Image 
                          src={chapter.cover_url} 
                          alt={`Portada de ${chapter.title}`}
                          width={600}
                          height={800}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )
                  ) : (
                    <CoverRenderer
                      mode="auto"
                      title={chapter.title}
                      author={chapter.profiles.display_name}
                      paletteId="marino"
                      className="w-full h-full rounded-lg shadow-lg"
                    />
                  )}
                </div>
              </div>

              {/* Details */}
              <div className="lg:col-span-2 space-y-6">
                {/* Title and Author */}
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    {chapter.title}
                  </h1>
                  <p className="text-lg text-gray-600 dark:text-gray-400">
                    por <span className="font-medium text-blue-600 dark:text-blue-400">
                      {chapter.profiles.display_name}
                    </span>
                  </p>
                  {chapter.is_independent && (
                    <span className="inline-block mt-2 px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-sm font-medium rounded-full">
                      Capítulo Independiente
                    </span>
                  )}
                </div>

                {/* Content Preview */}
                {chapter.content && (
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                      Descripción
                    </h2>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      {chapter.content}
                    </p>
                  </div>
                )}

                {/* Metadata */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                      Fecha de Publicación
                    </h3>
                    <p className="text-gray-900 dark:text-white">
                      {new Date(chapter.created_at).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>

                  {chapter.updated_at !== chapter.created_at && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                        Última Actualización
                      </h3>
                      <p className="text-gray-900 dark:text-white">
                        {new Date(chapter.updated_at).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  )}

                  {!chapter.is_independent && chapter.chapter_number && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                        Número de Capítulo
                      </h3>
                      <p className="text-gray-900 dark:text-white">
                        Capítulo {chapter.chapter_number}
                      </p>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex flex-col sm:flex-row gap-4">
                    {/* Mostrar botón de portada solo si es un archivo real en storage */}
                    {chapter.cover_url && !chapter.cover_url.startsWith('preview:') && (
                      <ViewDownloadButton
                        filePath={chapter.cover_url}
                        fileName={`${chapter.title} - Portada`}
                        fileType="image"
                        bucket="chapters"
                        viewOnly={true}
                        size="lg"
                        className="flex-1"
                      />
                    )}
                    
                    {/* Botones para ver y descargar el capítulo completo */}
                    <ViewDownloadButton
                      filePath={chapter.file_url}
                      fileName={`${chapter.title} - ${chapter.profiles.display_name}`}
                      bucket="chapters"
                      contentType="chapter"
                      contentSlug={slug}
                      size="lg"
                      className="flex-1"
                    />

                    {/* Guardar capítulo en Mis Lecturas */}
                    {checkingSaved ? (
                      <div className="flex-1 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-200">
                        Comprobando estado de Mis Lecturas…
                      </div>
                    ) : isSaved ? (
                      <div className="flex-1 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800 flex items-center justify-between">
                        <span className="text-sm text-indigo-700 dark:text-indigo-300">
                          Este capítulo ya está en Mis Lecturas.
                        </span>
                        <Link
                          href="/mis-lecturas"
                          className="inline-flex items-center px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm"
                        >
                          Ir a Mis Lecturas
                        </Link>
                      </div>
                    ) : (
                      <button
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700 hover:bg-green-100 disabled:opacity-50"
                        disabled={saving}
                        onClick={async () => {
                          try {
                            setSaving(true);
                            const resp = await fetch('/api/reading-list', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ chapterSlug: slug }),
                              credentials: 'include'
                            });
                            if (resp.status === 401) {
                              addToast({ type: 'error', message: 'Inicia sesión para guardar en Mis Lecturas.' });
                              return;
                            }
                            if (!resp.ok) {
                              addToast({ type: 'error', message: 'No se pudo guardar en Mis Lecturas.' });
                              return;
                            }
                            setIsSaved(true);
                            addToast({ type: 'success', message: 'Capítulo guardado en Mis Lecturas.' });
                          } catch (e) {
                            addToast({ type: 'error', message: 'Error al guardar en Mis Lecturas.' });
                          } finally {
                            setSaving(false);
                          }
                        }}
                      >
                        Guardar a Mis Lecturas
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Information */}
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Sobre este capítulo
          </h2>
          <div className="prose prose-gray dark:prose-invert max-w-none">
            <p>
              {chapter.is_independent 
                ? 'Este es un capítulo independiente que forma parte de la colección de escritores disponible en nuestra plataforma.'
                : 'Este capítulo forma parte de una obra más amplia disponible en nuestra biblioteca.'
              } Puedes explorar más capítulos de este autor y otros escritores en nuestra{' '}
              <Link href="/chapters" className="text-blue-600 dark:text-blue-400 hover:underline">
                biblioteca de capítulos
              </Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}