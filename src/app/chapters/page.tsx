'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import CoverRenderer from '@/components/ui/CoverRenderer';
import { parsePreviewCover } from '@/lib/utils';
import { Icon, Icons } from '@/components/ui/Icon';
import { generateSlug } from '@/lib/slugUtils';
import Image from 'next/image';
import CommentsButton from '@/components/ui/CommentsButton';
import CommentsPreview from '@/components/ui/CommentsPreview';

interface Chapter {
  id: string;
  title: string;
  author_id: string;
  created_at: string;
  status: string;
  is_independent: boolean;
  slug?: string;
  cover_url?: string;
  profiles: {
    display_name: string;
  };
}

export default function ChaptersPage() {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const supabase = createClientComponentClient();

  const loadPublishedChapters = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('chapters')
        .select(`
          id,
          title,
          author_id,
          created_at,
          status,
          is_independent,
          slug,
          cover_url,
          profiles!author_id (
            display_name
          )
        `)
        .eq('status', 'published')
        .eq('is_independent', true)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error loading chapters:', error);
        setError('Error al cargar los capítulos');
        return;
      }

      const normalized = (data || []).map((ch: any) => ({
        ...ch,
        profiles: Array.isArray(ch.profiles)
          ? (ch.profiles[0] || { display_name: 'Autor Desconocido' })
          : ch.profiles
      }));
      setChapters(normalized as Chapter[]);
    } catch (err) {
      console.error('Error:', err);
      setError('Error al cargar los capítulos');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadPublishedChapters();
  }, [loadPublishedChapters]);



  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({
        left: -300,
        behavior: 'smooth'
      });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({
        left: 300,
        behavior: 'smooth'
      });
    }
  };

  // Validación de plantillas y paletas para evitar tipos any
  const ALLOWED_TEMPLATES = ['template-1', 'template-2', 'template-3'] as const;
  const ALLOWED_PALETTES = ['marino', 'rojo', 'negro', 'verde', 'purpura'] as const;
  type TemplateId = typeof ALLOWED_TEMPLATES[number];
  type PaletteId = typeof ALLOWED_PALETTES[number];
  const isAllowed = <T extends readonly string[]>(arr: T, val: string): val is T[number] =>
    (arr as ReadonlyArray<string>).includes(val);
  const normalizePalette = (id: string): PaletteId => {
    const synonyms: Record<string, PaletteId> = { violeta: 'purpura', morado: 'purpura' };
    const candidate = synonyms[id] || id;
    return isAllowed(ALLOWED_PALETTES, candidate) ? (candidate as PaletteId) : 'marino';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Cargando capítulos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <Icon path={Icons.warning} size="xl" />
          </div>
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Botón Inicio */}
          <div className="mb-4">
            <Link
              href="/home"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white/80 backdrop-blur px-3 py-2 text-sm text-gray-700 hover:bg-white transition-colors"
              aria-label="Volver a inicio"
              title="Inicio"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                <path d="M8 5a2 2 0 012-2h4a2 2 0 012 2v6H8V5z" />
              </svg>
              <span>Inicio</span>
            </Link>
          </div>
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Biblioteca de Capítulos
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Descubre capítulos independientes de nuestros autores
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {chapters.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <Icon path={Icons.book} size="xl" />
            </div>
            <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
              No hay capítulos disponibles
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Aún no se han publicado capítulos independientes.
            </p>
          </div>
        ) : (
          <div className="relative">
            {/* Navigation Buttons */}
            <button
              onClick={scrollLeft}
              className="absolute left-0 top-1/2 transform -translate-y-1/2 z-10 bg-white dark:bg-gray-800 shadow-lg rounded-full p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              style={{ marginLeft: '-20px' }}
            >
              <Icon path={Icons.chevronLeft} size="lg" className="text-gray-600 dark:text-gray-400" />
            </button>
            
            <button
              onClick={scrollRight}
              className="absolute right-0 top-1/2 transform -translate-y-1/2 z-10 bg-white dark:bg-gray-800 shadow-lg rounded-full p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              style={{ marginRight: '-20px' }}
            >
              <Icon path={Icons.chevronRight} size="lg" className="text-gray-600 dark:text-gray-400" />
            </button>

            {/* Chapters Carousel */}
            <div
              ref={scrollContainerRef}
              className="flex overflow-x-auto scrollbar-hide space-x-6 pb-4"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {chapters.map((chapter) => (
                <Link
                  key={chapter.id}
                  href={`/chapters/${chapter.slug || generateSlug(chapter.title)}`}
                  className="flex-shrink-0 group"
                >
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden w-64">
                    <div className="p-6">
                      <div className="transform group-hover:scale-105 transition-transform duration-300">
                        {(() => {
                          const meta = parsePreviewCover(
                            chapter.cover_url,
                            chapter.title,
                            chapter.profiles?.display_name || 'Autor Desconocido'
                          );
                          if (meta.mode === 'template') {
                            const tId = isAllowed(ALLOWED_TEMPLATES, meta.templateId)
                              ? meta.templateId
                              : 'template-1';
                            const pId = normalizePalette(meta.paletteId);
                            return (
                              <CoverRenderer
                                mode="template"
                                templateId={tId as TemplateId}
                                title={meta.title}
                                author={meta.author}
                                paletteId={pId as PaletteId}
                                width={200}
                                height={280}
                                className="mx-auto mb-4 rounded-lg shadow-sm"
                              />
                            );
                          }
                          if (meta.mode === 'image') {
                            return (
                              <div className="w-[200px] h-[280px] bg-gray-200 rounded overflow-hidden shadow-sm mx-auto mb-4">
                                <Image
                                  src={meta.url}
                                  alt={`Portada de ${chapter.title}`}
                                  width={200}
                                  height={280}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            );
                          }
                          return (
                            <CoverRenderer
                              mode="auto"
                              title={chapter.title}
                              author={chapter.profiles?.display_name || 'Autor Desconocido'}
                              paletteId="marino"
                              width={200}
                              height={280}
                              className="mx-auto mb-4 rounded-lg shadow-sm"
                            />
                          );
                        })()}
                      </div>
                      
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {chapter.title}
                      </h3>
                      
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        por {chapter.profiles?.display_name || 'Autor Desconocido'}
                      </p>
                      
                      <div className="text-xs text-gray-500 dark:text-gray-500">
                        {new Date(chapter.created_at).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </div>

                      <div className="mt-3 space-y-2">
                        <CommentsButton targetType="chapter" targetId={chapter.id} />
                        <CommentsPreview targetType="chapter" targetId={chapter.id} />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Stats Section */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {chapters.length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Capítulos Publicados
                </div>
              </div>
              
              <div>
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {new Set(chapters.map(c => c.author_id)).size}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Autores Activos
                </div>
              </div>
              
              <div>
                <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                  {chapters.filter(c => {
                    const createdDate = new Date(c.created_at);
                    const thirtyDaysAgo = new Date();
                    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                    return createdDate > thirtyDaysAgo;
                  }).length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Nuevos este Mes
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}