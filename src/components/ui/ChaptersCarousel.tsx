'use client';

import React, { useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import CoverRenderer from '@/components/ui/CoverRenderer';
import { parsePreviewCover } from '@/lib/utils';
import { Icon, Icons } from '@/components/ui';
import { generateSlug } from '@/lib/slugUtils';

interface Chapter {
  id: string;
  title: string;
  synopsis?: string;
  author_id: string;
  created_at: string;
  cover_url?: string;
  slug?: string;
  profiles: {
    display_name: string;
  };
}

interface ChaptersCarouselProps {
  chapters: Chapter[];
  title?: string;
  description?: string;
  showStats?: boolean;
  className?: string;
}

export default function ChaptersCarousel({ 
  chapters, 
  title = "Capítulos Independientes", 
  description = "Historias cortas y capítulos independientes",
  showStats = false,
  className = ""
}: ChaptersCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (chapters.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <p className="text-gray-500 dark:text-gray-400 text-lg">
          No hay capítulos disponibles en este momento.
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header */}
      {(title || description) && (
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{title}</h2>
            {description && (
              <p className="text-gray-600 dark:text-gray-400">{description}</p>
            )}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={scrollLeft}
              className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              aria-label="Scroll izquierda"
            >
              <Icon path={Icons.chevronLeft} size="lg" className="text-gray-600 dark:text-gray-300" />
            </button>
            <button
              onClick={scrollRight}
              className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              aria-label="Scroll derecha"
            >
              <Icon path={Icons.chevronRight} size="lg" className="text-gray-600 dark:text-gray-300" />
            </button>
          </div>
        </div>
      )}

      {/* Carousel Container */}
      <div
        ref={scrollContainerRef}
        className="flex gap-6 overflow-x-auto scrollbar-hide pb-4"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {chapters.map((chapter) => (
          <Link
            key={chapter.id}
            href={`/chapters/${chapter.slug || generateSlug(chapter.title)}`}
            className="flex-shrink-0 group cursor-pointer"
          >
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 p-4 w-64">
              {/* Cover */}
              <div className="mb-4 flex justify-center">
                <div className="transform group-hover:scale-105 transition-transform duration-300">
                  {(() => {
                    const meta = parsePreviewCover(
                      chapter.cover_url,
                      chapter.title,
                      chapter.profiles?.display_name || 'Autor Desconocido'
                    );
                    if (meta.mode === 'template') {
                      const validTemplateIds = ['template-1','template-2','template-3','template-4','template-5','template-6','template-7','template-8'] as const;
                      const validPaletteIds = ['marino','rojo','negro','verde','purpura'] as const;
                      const safeTemplateId = (validTemplateIds as readonly string[]).includes(meta.templateId) ? (meta.templateId as typeof validTemplateIds[number]) : 'template-1';
                      const safePaletteId = (validPaletteIds as readonly string[]).includes(meta.paletteId) ? (meta.paletteId as typeof validPaletteIds[number]) : 'marino';
                      return (
                        <CoverRenderer
                          mode="template"
                          templateId={safeTemplateId}
                          title={meta.title}
                          author={meta.author}
                          paletteId={safePaletteId}
                          width={180}
                          height={270}
                          className="shadow-md rounded-sm"
                        />
                      );
                    }
                    if (meta.mode === 'image') {
                      return (
                        <div className="w-[180px] h-[270px] bg-gray-200 rounded overflow-hidden shadow-md">
                          <Image
                            src={meta.url}
                            alt={`Portada de ${chapter.title}`}
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
                        title={chapter.title}
                        author={chapter.profiles?.display_name || 'Autor Desconocido'}
                        paletteId="marino"
                        width={180}
                        height={270}
                        className="shadow-md rounded-sm"
                      />
                    );
                  })()}
                </div>
              </div>

              {/* Chapter Info */}
              <div className="text-center">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {chapter.title}
                </h3>
                
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  por {chapter.profiles?.display_name || 'Autor Desconocido'}
                </p>

                {chapter.synopsis && (
                  <p className="text-xs text-gray-500 dark:text-gray-500 line-clamp-3 mb-2">
                    {chapter.synopsis}
                  </p>
                )}

                <div className="text-xs text-gray-400 dark:text-gray-500">
                  {formatDate(chapter.created_at)}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Stats Section */}
      {showStats && (
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
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
      )}
    </div>
  );
}