'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import CoverRenderer from '@/components/ui/CoverRenderer';
import { Icon, Icons } from '@/components/ui/Icon';
import { generateSlug } from '@/lib/slugUtils';

interface Chapter {
  id: string;
  title: string;
  author_id: string;
  created_at: string;
  status: string;
  is_independent: boolean;
  slug?: string;
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

  useEffect(() => {
    loadPublishedChapters();
  }, []);

  const loadPublishedChapters = async () => {
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

      setChapters(data || []);
    } catch (err) {
      console.error('Error:', err);
      setError('Error al cargar los capítulos');
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

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
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
                      <CoverRenderer
                        title={chapter.title}
                        author={chapter.profiles?.display_name || 'Autor Desconocido'}
                        width={200}
                        height={280}
                        className="mx-auto mb-4 rounded-lg shadow-sm"
                      />
                      
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