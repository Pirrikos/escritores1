'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import CoverRenderer from '@/components/ui/CoverRenderer';
import { ViewDownloadButton } from '@/components/ui/ViewDownloadButton';
import { ToastProvider, useToast } from '@/contexts/ToastContext';
import ToastContainer from '@/components/ui/ToastContainer';
import { WorkDetailSkeleton } from '@/components/ui/WorkDetailSkeleton';
import { generateSlug } from '@/lib/slugUtils';
import Image from 'next/image';
import dynamic from 'next/dynamic';
const PDFViewer = dynamic(() => import('@/components/ui/PDFViewer'), { ssr: false });
import { logPdfView } from '@/lib/activityLogger';

interface Work {
  id: string;
  title: string;
  synopsis: string;
  author_id: string;
  created_at: string;
  updated_at: string;
  slug?: string;
  cover_url?: string;
  isbn?: string;
  file_url?: string;
  profiles: {
    display_name: string;
  };
}

export default function WorkDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [work, setWork] = useState<Work | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClientComponentClient();

  return (
    <ToastProvider>
      <ToastContainer />
      <WorkDetailPageContent 
        slug={slug}
        work={work}
        setWork={setWork}
        loading={loading}
        setLoading={setLoading}
        error={error}
        setError={setError}
        supabase={supabase}
      />
    </ToastProvider>
  );
}

function WorkDetailPageContent({ 
  slug, 
  work, 
  setWork, 
  loading, 
  setLoading, 
  error, 
  setError, 
  supabase 
}: {
  slug: string;
  work: Work | null;
  setWork: (work: Work | null) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
  supabase: SupabaseClient;
}) {
  const { addToast } = useToast();
  // Estado local para capítulos y visor PDF
  const [chapters, setChapters] = useState<Array<{ id: string; title: string; chapter_number: number; slug?: string; file_url?: string; file_type?: string }>>([]);
  const [isPDFViewerOpen, setIsPDFViewerOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [currentTitle, setCurrentTitle] = useState<string | null>(null);
  // Aviso de lectura activa eliminado (se usa sólo lista manual)
  // Estado para lista de lectura manual
  const [isSaved, setIsSaved] = useState(false);
  const [checkingSaved, setCheckingSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  // Declarar la función antes del useEffect para evitar TDZ
  const loadWorkBySlug = useCallback(async (workSlug: string) => {
    try {
      setLoading(true);
      setError(null);

      // Cargar todas las obras publicadas y buscar por slug generado
      const { data, error } = await supabase
        .from('works')
        .select(`
          id,
          title,
          synopsis,
          author_id,
          created_at,
          updated_at,
          slug,
          cover_url,
          isbn,
          file_url,
          profiles!works_author_id_fkey (
            display_name
          )
        `)
        .eq('status', 'published');

      if (error) {
        console.error('Error loading works:', error);
        setError('Error al cargar la obra');
        addToast({
          type: 'error',
          message: 'Error al cargar la obra. Por favor, intenta de nuevo.'
        });
        return;
      }

      // Normalizar perfiles y buscar la obra que coincida con el slug
      const normalizeProfile = (profiles: any): { display_name: string } => {
        const p = Array.isArray(profiles) ? profiles[0] : profiles;
        return { display_name: p?.display_name || 'Autor desconocido' };
      };

      const normalizedWorks: Work[] = (data || []).map((row: any) => ({
        ...row,
        profiles: normalizeProfile(row.profiles)
      }));

      const foundWork = normalizedWorks.find((w) => {
        const candidate = (typeof w.slug === 'string' && w.slug) ? w.slug : generateSlug(w.title);
        return candidate === workSlug;
      });

      if (!foundWork) {
        setError('Obra no encontrada');
        addToast({
          type: 'error',
          message: 'La obra que buscas no existe o no está disponible.'
        });
        return;
      }

      setWork(foundWork);
    } catch (err) {
      console.error('Error:', err);
      setError('Error al cargar la obra');
      addToast({
        type: 'error',
        message: 'Error inesperado al cargar la obra. Por favor, intenta de nuevo.'
      });
    } finally {
      setLoading(false);
    }
  }, [supabase, addToast, setLoading, setError, setWork]);

  useEffect(() => {
    if (slug) {
      loadWorkBySlug(slug);
    }
  }, [slug, loadWorkBySlug]);

  // Cargar capítulos publicados de la obra actual
  const loadPublishedChaptersForWork = useCallback(async (workId: string) => {
    try {
      const { data, error } = await supabase
        .from('chapters')
        .select('id, title, chapter_number, work_id, slug, status, file_url, file_type, is_independent')
        .eq('is_independent', false)
        .eq('work_id', workId)
        .eq('status', 'published')
        .order('chapter_number', { ascending: true })
        .limit(1000);
      if (error) throw error;
      const list = Array.isArray(data) ? data.map((row: any) => ({
        id: row.id,
        title: row.title,
        chapter_number: row.chapter_number,
        slug: row.slug,
        file_url: row.file_url,
        file_type: row.file_type,
      })) : [];
      setChapters(list);
    } catch (e) {
      console.warn('No se pudieron cargar los capítulos de la obra', e);
      setChapters([]);
    }
  }, [supabase]);

  useEffect(() => {
    if (work?.id) {
      loadPublishedChaptersForWork(work.id);
    }
  }, [work?.id, loadPublishedChaptersForWork]);

  // Comprobar si la obra ya está guardada en Mis Lecturas (lista manual)
  useEffect(() => {
    const checkSaved = async () => {
      try {
        if (!slug) return;
        setCheckingSaved(true);
        const res = await fetch('/api/reading-list', { method: 'GET', credentials: 'include' });
        if (!res.ok) {
          setIsSaved(false);
          return;
        }
        const json = await res.json();
        const items = Array.isArray(json?.data) ? json.data : [];
        const exists = items.some((it: any) => it?.type === 'work' && it?.slug === slug);
        setIsSaved(!!exists);
      } catch (e) {
        setIsSaved(false);
      } finally {
        setCheckingSaved(false);
      }
    };
    void checkSaved();
  }, [slug]);

  // Lógica antigua de aviso eliminada

  // Abrir archivo de capítulo con visor PDF integrado
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
          // Descargar como blob y usar object URL para evitar net::ERR_ABORTED
          let viewerUrl = urlToUse;
          if (signed) {
            try {
              const pdfResp = await fetch(signed, { cache: 'no-store' });
              const blob = await pdfResp.blob();
              viewerUrl = URL.createObjectURL(blob);
            } catch {}
          }
          setPdfUrl(viewerUrl);
          setCurrentTitle(effectiveTitle || 'Capítulo');
          await logPdfView({ contentType: 'chapter', contentSlug: slug, urlOrPath: effectivePath });
          setIsPDFViewerOpen(true);
          return;
        } catch (e) {
          console.warn('No se pudo firmar la URL, se usará la ruta por defecto.', e);
          // Sin URL firmada, no abrir visor para evitar errores de carga
          setCurrentTitle(effectiveTitle || 'Capítulo');
          await logPdfView({ contentType: 'chapter', contentSlug: slug, urlOrPath: effectivePath });
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

  if (loading) {
    return <WorkDetailSkeleton />;
  }

  if (error || !work) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">📚</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {error || 'Obra no encontrada'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            La obra que buscas no existe o no está disponible públicamente.
          </p>
          <Link
            href="/works"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Volver a obras
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Visor PDF para capítulos (se muestra cuando isPDFViewerOpen = true) */}
      {isPDFViewerOpen && pdfUrl && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <PDFViewer
            fileUrl={pdfUrl}
            fileName={currentTitle || work.title}
            onClose={() => {
              try {
                if (pdfUrl && pdfUrl.startsWith('blob:')) {
                  URL.revokeObjectURL(pdfUrl);
                }
              } catch {}
              setPdfUrl(null);
              setIsPDFViewerOpen(false);
            }}
          />
        </div>
      )}
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <nav className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
            <Link href="/home" className="hover:text-blue-600 dark:hover:text-blue-400">
              Inicio
            </Link>
            <span>/</span>
            <Link href="/works" className="hover:text-blue-600 dark:hover:text-blue-400">
              Obras
            </Link>
            <span>/</span>
            <span className="text-gray-900 dark:text-white">{work.title}</span>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Aviso de lectura activa eliminado */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Cover */}
              <div className="lg:col-span-1">
                <div className="aspect-[3/4] w-full max-w-sm mx-auto">
                  {work.cover_url ? (
                    work.cover_url.startsWith('preview:') ? (
                      (() => {
                        const parts = work.cover_url.split(':');
                        const templateIdRaw = parts[1];
                        const paletteIdRaw = parts[2];
                        const encodedTitle = parts[3];
                        const encodedAuthor = parts[4];
                        const validTemplateIds = ['template-1','template-2','template-3'] as const;
                        const validPaletteIds = ['marino','rojo','verde','negro','purpura'] as const;
                        const templateId = (validTemplateIds as readonly string[]).includes(templateIdRaw)
                          ? (templateIdRaw as typeof validTemplateIds[number])
                          : 'template-1';
                        const normalizePalette = (p?: string) => {
                          const synonyms: Record<string, string> = { morado: 'purpura' };
                          const candidate = synonyms[p || ''] || p;
                          return (validPaletteIds as readonly string[]).includes(candidate as string)
                            ? (candidate as typeof validPaletteIds[number])
                            : 'marino';
                        };
                        const paletteId = normalizePalette(paletteIdRaw);
                        
                        return (
                          <CoverRenderer
                            mode="template"
                            templateId={templateId}
                            title={decodeURIComponent(encodedTitle || work.title)}
                            author={decodeURIComponent(encodedAuthor || work.profiles.display_name)}
                            paletteId={paletteId}
                            className="w-full h-full rounded-lg shadow-lg"
                          />
                        );
                      })()
                    ) : (
                      // Portada personalizada subida
                      <SignedCoverImage coverPath={work.cover_url} title={work.title} />
                    )
                  ) : (
                    <CoverRenderer
                      mode="auto"
                      title={work.title}
                      author={work.profiles.display_name}
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
                    {work.title}
                  </h1>
                  <p className="text-lg text-gray-600 dark:text-gray-400">
                    por <span className="font-medium text-blue-600 dark:text-blue-400">
                      {work.profiles.display_name}
                    </span>
                  </p>
                </div>

                {/* Synopsis */}
                {work.synopsis && (
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                      Sinopsis
                    </h2>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      {work.synopsis}
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
                      {new Date(work.created_at).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>

                  {work.updated_at !== work.created_at && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                        Última Actualización
                      </h3>
                      <p className="text-gray-900 dark:text-white">
                        {new Date(work.updated_at).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  )}

                  {work.isbn && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                        ISBN
                      </h3>
                      <p className="text-gray-900 dark:text-white font-mono">
                        {work.isbn}
                      </p>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex flex-col sm:flex-row gap-4">
                    {/* Mostrar botón de portada solo si es un archivo real en storage */}
                    {work.cover_url && !work.cover_url.startsWith('preview:') && (
                      <ViewDownloadButton
                        filePath={work.cover_url}
                        fileName={`${work.title} - Portada`}
                        fileType="image"
                        bucket="works"
                        viewOnly={true}
                        size="lg"
                        className="flex-1"
                      />
                    )}
                    
                    {/* Botón para ver y descargar la obra completa (solo si existe archivo válido); oculto si hay capítulos */}
                    {chapters.length === 0 && (() => {
                      const fp = (work.file_url || '').trim();
                      const hasValidFile = fp !== '' && fp.toLowerCase() !== 'null';
                      if (!hasValidFile) {
                        return (
                          <div className="flex-1 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                            <p className="text-sm text-orange-700 dark:text-orange-300">
                              Archivo de la obra completa no disponible.
                            </p>
                          </div>
                        );
                      }
                      return (
                        <ViewDownloadButton
                          filePath={work.file_url}
                          fileName={`${work.title} - ${work.profiles.display_name}`}
                          bucket="works"
                          contentType="work"
                          contentSlug={slug}
                          size="lg"
                          className="flex-1"
                        />
                      );
                    })()}

                    {/* Guardar a Mis Lecturas (lista manual) */}
                    {checkingSaved ? (
                      <div className="flex-1 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-200">
                        Comprobando estado de Mis Lecturas…
                      </div>
                    ) : isSaved ? (
                      <div className="flex-1 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800 flex items-center justify-between gap-3">
                        <span className="text-sm text-indigo-700 dark:text-indigo-300">
                          Ya estás leyendo esta obra.
                        </span>
                        <div className="flex items-center gap-2">
                          <Link
                            href="/mis-lecturas"
                            className="inline-flex items-center px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm"
                          >
                            Ir a Mis Lecturas
                          </Link>
                          <button
                            className="inline-flex items-center px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 text-sm"
                            onClick={async () => {
                              try {
                                const res = await fetch(`/api/reading-list?workSlug=${encodeURIComponent(slug)}`, {
                                  method: 'DELETE',
                                  credentials: 'include',
                                });
                                if (res.ok) {
                                  setIsSaved(false);
                                  addToast({ type: 'success', message: 'Se quitó de Mis Lecturas.' });
                                } else {
                                  addToast({ type: 'error', message: 'No se pudo quitar de Mis Lecturas.' });
                                }
                              } catch {
                                addToast({ type: 'error', message: 'Error de conexión al quitar.' });
                              }
                            }}
                          >
                            Quitar
                          </button>
                        </div>
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
                              body: JSON.stringify({ workSlug: slug }),
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
                            addToast({ type: 'success', message: 'Guardado en Mis Lecturas.' });
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

        {/* Sección de capítulos: visible solo si la obra se publica por capítulos */}
        {chapters.length > 0 && (
          <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Capítulos
            </h2>
            <div className="space-y-3">
              {chapters.map((ch) => (
                <div key={ch.id} className="flex items-center justify-between p-3 rounded border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      Capítulo {ch.chapter_number}
                    </span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {ch.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                      onClick={() => openChapterFile(ch.file_url, ch.slug, ch.file_type, ch.title)}
                    >
                      Ver
                    </button>
                    {ch.slug && (
                      <Link
                        className="px-3 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600"
                        href={`/chapters/${ch.slug}`}
                      >
                        Ir al capítulo
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Additional Information */}
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Sobre esta obra
          </h2>
          <div className="prose prose-gray dark:prose-invert max-w-none">
            <p>
              Esta obra forma parte de la colección de escritores disponible en nuestra plataforma.
              Puedes explorar más obras de este autor y otros escritores en nuestra{' '}
              <Link href="/works" className="text-blue-600 dark:text-blue-400 hover:underline">
                biblioteca de obras
              </Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SignedCoverImage({ coverPath, title }: { coverPath: string; title: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        if (!coverPath || /^https?:\/\//.test(coverPath)) {
          if (!cancelled) setSrc(coverPath || null);
          return;
        }
        const res = await fetch('/api/storage/signed-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: coverPath, bucket: 'works', expiresIn: 3600 }),
        });
        if (res.ok) {
          const json = await res.json();
          const url = json?.signedUrl as string | undefined;
          if (!cancelled) setSrc(url || null);
        }
      } catch {
        if (!cancelled) setSrc(null);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [coverPath]);
  if (!src) {
    return (
      <div className="w-full h-full bg-gray-200 rounded-lg overflow-hidden shadow-lg" />
    );
  }
  return (
    <div className="w-full h-full bg-gray-200 rounded-lg overflow-hidden shadow-lg">
      <Image
        src={src}
        alt={`Portada de ${title}`}
        fill
        sizes="(max-width: 640px) 100vw, 400px"
        className="object-cover"
        unoptimized
      />
    </div>
  );
}