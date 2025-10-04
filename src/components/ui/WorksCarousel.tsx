'use client';

import React, { useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import CoverRenderer from '@/components/ui/CoverRenderer';
import { Icon, Icons } from '@/components/ui';
import { generateSlug } from '@/lib/slugUtils';

interface Work {
  id: string;
  title: string;
  synopsis?: string;
  author_id: string;
  created_at: string;
  cover_url?: string;
  profiles: {
    display_name: string;
  };
}

interface WorksCarouselProps {
  works: Work[];
  title?: string;
  description?: string;
  showStats?: boolean;
  className?: string;
}

export default function WorksCarousel({ 
  works, 
  title = "Obras Completas", 
  description = "Libros y obras completas de nuestros autores",
  showStats = false,
  className = ""
}: WorksCarouselProps) {
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

  if (works.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <p className="text-gray-500 dark:text-gray-400 text-lg">
          No hay obras disponibles en este momento.
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
                        const validTemplateIds = ['template-1','template-2','template-3','template-4','template-5','template-6','template-7','template-8'] as const;
                        const validPaletteIds = ['marino','rojo','negro','verde','purpura'] as const;
                        const safeTemplateId = (validTemplateIds as readonly string[]).includes(templateId) ? (templateId as typeof validTemplateIds[number]) : 'template-1';
                        const safePaletteId = (validPaletteIds as readonly string[]).includes(paletteId) ? (paletteId as typeof validPaletteIds[number]) : 'marino';
                        
                        return (
                          <CoverRenderer
                            mode="template"
                            templateId={safeTemplateId}
                            title={decodeURIComponent(encodedTitle || work.title)}
                            author={decodeURIComponent(encodedAuthor || work.profiles?.display_name || 'Autor')}
                            paletteId={safePaletteId}
                            width={180}
                            height={270}
                            className="shadow-md rounded-sm"
                          />
                        );
                      })()
                    ) : (
                      // Portada personalizada subida
                      <div className="w-[180px] h-[270px] bg-gray-200 rounded overflow-hidden shadow-md">
                        <Image
                          src={work.cover_url}
                          alt={`Portada de ${work.title}`}
                          width={180}
                          height={270}
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
                  <p className="text-xs text-gray-500 dark:text-gray-500 line-clamp-3 mb-2">
                    {work.synopsis}
                  </p>
                )}

                <div className="text-xs text-gray-400 dark:text-gray-500">
                  {formatDate(work.created_at)}
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
      )}
    </div>
  );
}