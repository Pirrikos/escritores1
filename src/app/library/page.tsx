'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import CoverRenderer from '@/components/ui/CoverRenderer';
import { Icon, Icons } from '@/components/ui';
import Link from 'next/link';
import { generateSlug } from '@/lib/slugUtils';

interface Work {
  id: string;
  title: string;
  synopsis?: string;
  author_id: string;
  created_at: string;
  profiles: {
    display_name: string;
  };
}

export default function LibraryPage() {
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const supabase = createClientComponentClient();

  useEffect(() => {
    loadPublishedWorks();
  }, []);

  const loadPublishedWorks = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('works')
        .select(`
          id,
          title,
          synopsis,
          author_id,
          created_at,
          cover_url,
          profiles!author_id (
            display_name
          )
        `)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error loading works:', error);
        setError('Error al cargar las obras');
        return;
      }

      setWorks(data || []);
    } catch (err) {
      console.error('Error:', err);
      setError('Error al cargar las obras');
    } finally {
      setLoading(false);
    }
  };

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Cargando biblioteca...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <button
            onClick={loadPublishedWorks}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Biblioteca de Obras
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Descubre las obras publicadas por nuestra comunidad de escritores. 
              Explora historias, poemas y capítulos de autores talentosos.
            </p>
          </div>
        </div>
      </div>

      {/* Works Carousel */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {works.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              No hay obras publicadas disponibles en este momento.
            </p>
          </div>
        ) : (
          <div className="relative">
            {/* Navigation Buttons */}
            <button
              onClick={scrollLeft}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white dark:bg-gray-800 shadow-lg rounded-full p-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              aria-label="Scroll left"
            >
              <Icon path={Icons.chevronLeft} size="lg" className="text-gray-600 dark:text-gray-300" />
            </button>

            <button
              onClick={scrollRight}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white dark:bg-gray-800 shadow-lg rounded-full p-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              aria-label="Scroll right"
            >
              <Icon path={Icons.chevronRight} size="lg" className="text-gray-600 dark:text-gray-300" />
            </button>

            {/* Carousel Container */}
            <div
              ref={scrollContainerRef}
              className="flex gap-6 overflow-x-auto scrollbar-hide px-12 py-4"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {works.map((work) => (
                <Link
                  key={work.id}
                  href={`/works/${generateSlug(work.title)}`}
                  className="flex-shrink-0 group cursor-pointer"
                >
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 p-4 w-64">
                    {/* Cover */}
              <div className="mb-4 flex justify-center">
                <div className="transform group-hover:scale-105 transition-transform duration-300">
                  {work.cover_url ? (
                    work.cover_url.startsWith('preview:') ? (
                      // Renderizar portada desde configuración de preview
                      (() => {
                        const parts = work.cover_url.split(':');
                        const templateId = parts[1];
                        const paletteId = parts[2];
                        const encodedTitle = parts[3];
                        const encodedAuthor = parts[4];
                        
                        return (
                          <CoverRenderer
                            mode="template"
                            templateId={templateId as any}
                            title={decodeURIComponent(encodedTitle || work.title)}
                            author={decodeURIComponent(encodedAuthor || 'Autor')}
                            paletteId={paletteId as any}
                            width={180}
                            height={270}
                            className="shadow-md rounded-sm"
                          />
                        );
                      })()
                    ) : (
                      // Portada personalizada subida
                      <div className="w-[180px] h-[270px] bg-gray-200 rounded overflow-hidden shadow-md">
                        <img 
                          src={supabase.storage.from('works').getPublicUrl(work.cover_url).data.publicUrl} 
                          alt={`Portada de ${work.title}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )
                  ) : (
                    <CoverRenderer
                      mode="auto"
                      title={work.title}
                      author={work.profiles?.display_name || 'Autor Desconocido'}
                      paletteId="marino"
                      width={180}
                      height={270}
                      className="shadow-md rounded-sm"
                    />
                  )}
                </div>
              </div>

                    {/* Work Info */}
                    <div className="text-center">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {work.title}
                      </h3>
                      
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        por {work.profiles?.display_name || 'Autor Desconocido'}
                      </p>

                      {work.synopsis && (
                        <p className="text-xs text-gray-500 dark:text-gray-500 line-clamp-3">
                          {work.synopsis}
                        </p>
                      )}

                      <div className="mt-3 text-xs text-gray-400 dark:text-gray-500">
                        {new Date(work.created_at).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
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
                  {works.length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Obras Publicadas
                </div>
              </div>
              
              <div>
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {new Set(works.map(w => w.author_id)).size}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Autores Activos
                </div>
              </div>
              
              <div>
                <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                  {works.filter(w => {
                    const createdDate = new Date(w.created_at);
                    const thirtyDaysAgo = new Date();
                    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                    return createdDate > thirtyDaysAgo;
                  }).length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Nuevas este Mes
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// CSS personalizado para ocultar scrollbar
const styles = `
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .line-clamp-3 {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
`;

// Inyectar estilos
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}