'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import CoverRenderer from '@/components/ui/CoverRenderer';
import { ViewDownloadButton } from '@/components/ui/ViewDownloadButton';
import { ToastProvider, useToast } from '@/contexts/ToastContext';
import { WorkDetailSkeleton } from '@/components/ui/WorkDetailSkeleton';
import { generateSlug } from '@/lib/slugUtils';
import Image from 'next/image';

interface Work {
  id: string;
  title: string;
  synopsis: string;
  author_id: string;
  created_at: string;
  updated_at: string;
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

      // Buscar la obra que coincida con el slug
      const foundWork = data?.find((w: Work) => generateSlug(w.title) === workSlug);

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
            href="/library"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Volver a la biblioteca
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <nav className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
            <Link href="/library" className="hover:text-blue-600 dark:hover:text-blue-400">
              Biblioteca
            </Link>
            <span>/</span>
            <span className="text-gray-900 dark:text-white">{work.title}</span>
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
                  {work.cover_url ? (
                    work.cover_url.startsWith('preview:') ? (
                      (() => {
                        const parts = work.cover_url.split(':');
                        const templateIdRaw = parts[1];
                        const paletteIdRaw = parts[2];
                        const encodedTitle = parts[3];
                        const encodedAuthor = parts[4];
                        const validTemplateIds = ['template-1','template-2','template-3'] as const;
                        const validPaletteIds = ['marino','rojo','verde','morado'] as const;
                        const templateId = (validTemplateIds as readonly string[]).includes(templateIdRaw)
                          ? (templateIdRaw as typeof validTemplateIds[number])
                          : 'template-1';
                        const paletteId = (validPaletteIds as readonly string[]).includes(paletteIdRaw)
                          ? (paletteIdRaw as typeof validPaletteIds[number])
                          : 'marino';
                        
                        return (
                          <CoverRenderer
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
                      <div className="w-full h-full bg-gray-200 rounded-lg overflow-hidden shadow-lg">
                        <Image 
                          src={work.cover_url}
                          alt={`Portada de ${work.title}`}
                          fill
                          sizes="(max-width: 640px) 100vw, 400px"
                          className="object-cover"
                        />
                      </div>
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
                    <ViewDownloadButton
                      filePath={work.cover_url || ''}
                      fileName={`${work.title} - Portada`}
                      fileType="image"
                      bucket="works"
                      viewOnly={true}
                      size="lg"
                      className="flex-1"
                    />
                    
                    {/* Botón para ver y descargar la obra completa */}
                    <ViewDownloadButton
                      filePath={work.file_url}
                      fileName={`${work.title} - ${work.profiles.display_name}`}
                      bucket="works"
                      size="lg"
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Information */}
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Sobre esta obra
          </h2>
          <div className="prose prose-gray dark:prose-invert max-w-none">
            <p>
              Esta obra forma parte de la colección de escritores disponible en nuestra plataforma.
              Puedes explorar más obras de este autor y otros escritores en nuestra{' '}
              <Link href="/library" className="text-blue-600 dark:text-blue-400 hover:underline">
                biblioteca digital
              </Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}