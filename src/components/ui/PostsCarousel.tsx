'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon, Icons } from '@/components/ui';
import LikeButton from '@/components/ui/LikeButton';
import { getSupabaseBrowserClient } from '@/lib/supabaseClient';
import { generateSlug } from '@/lib/slugUtils';

interface Post {
  id: string;
  title: string;
  content?: string;
  author_id: string;
  created_at: string;
  published_at?: string;
  display_name?: string;
  profiles?: {
    display_name: string;
    avatar_url?: string;
  };
}

interface PostsCarouselProps {
  posts: Post[];
  title?: string;
  description?: string;
  showStats?: boolean;
  className?: string;
  seeMoreHref?: string;
  seeMoreLabel?: string;
  renderItemFooter?: (post: Post) => React.ReactNode;
}

export default function PostsCarousel({ 
  posts, 
  title = "Posts Recientes", 
  description = "Últimas publicaciones de nuestros escritores",
  showStats = false,
  className = "",
  seeMoreHref,
  seeMoreLabel = "Ver más...",
  renderItemFooter
}: PostsCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const supabase = getSupabaseBrowserClient();
  const [validWorkSlugs, setValidWorkSlugs] = useState<Set<string>>(new Set());

  // Resolver qué títulos de posts corresponden a obras publicadas
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const titles = Array.from(new Set(posts.map(p => (p.title || '').trim()).filter(Boolean)));
        if (titles.length === 0) {
          if (!cancelled) setValidWorkSlugs(new Set());
          return;
        }
        const slugs = titles.map(t => generateSlug(t));
        const slugSet = new Set<string>();

        // Intento principal: por slug almacenado
        try {
          const { data: bySlug } = await supabase
            .from('works')
            .select('slug, title, status')
            .eq('status', 'published')
            .in('slug', slugs)
            .limit(500);
          for (const w of (bySlug || [])) {
            const rawSlug = (w as any)?.slug as string | undefined;
            const title = (w as any)?.title as string | undefined;
            const candidate = (typeof rawSlug === 'string' && rawSlug) ? rawSlug : (title ? generateSlug(title) : '');
            if (candidate) slugSet.add(candidate);
          }
        } catch {}

        // Fallback: por coincidencia exacta de título
        const unresolvedTitles = titles.filter(t => !slugSet.has(generateSlug(t)));
        if (unresolvedTitles.length > 0) {
          try {
            const { data: byTitle } = await supabase
              .from('works')
              .select('slug, title, status')
              .eq('status', 'published')
              .in('title', unresolvedTitles)
              .limit(500);
            for (const w of (byTitle || [])) {
              const rawSlug = (w as any)?.slug as string | undefined;
              const title = (w as any)?.title as string | undefined;
              const candidate = (typeof rawSlug === 'string' && rawSlug) ? rawSlug : (title ? generateSlug(title) : '');
              if (candidate) slugSet.add(candidate);
            }
          } catch {}
        }

        if (!cancelled) setValidWorkSlugs(slugSet);
      } catch {
        if (!cancelled) setValidWorkSlugs(new Set());
      }
    };
    run();
    return () => { cancelled = true; };
  }, [posts, supabase]);

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
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getAuthorName = (post: Post) => {
    const raw = post.display_name || post.profiles?.display_name || 'Autor Desconocido';
    // Si parece un email, quedarnos con lo previo a '@'
    const base = raw.includes('@') ? raw.split('@')[0] : raw;
    // Quitar separadores comunes y normalizar espacios
    const cleaned = base
      .replace(/[._-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    // Capitalizar palabras (simple)
    const pretty = cleaned
      .split(' ')
      .map(w => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
      .join(' ');
    return pretty || 'Autor Desconocido';
  };

  const getPostDate = (post: Post) => {
    return post.published_at || post.created_at;
  };

  if (posts.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <p className="text-gray-500 dark:text-gray-400 text-lg">
          No hay posts disponibles en este momento.
        </p>
        <p className="text-xs text-gray-400 mt-2">
          ¿Eres escritor? <a href="/write" className="text-blue-600 hover:text-blue-800 underline">Publica tu primer post</a>
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
          <div className="flex items-center space-x-3">
            {seeMoreHref && (
              <Link
                href={seeMoreHref}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                {seeMoreLabel}
              </Link>
            )}
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
        {posts.map((post) => (
          <div key={post.id} className="flex-shrink-0 w-80">
            <article 
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 p-6 group cursor-pointer"
            >
              {/* Post Content */}
              <div className="space-y-3">
                {(() => {
                  const candidateSlug = generateSlug(post.title || '');
                  const isWorkTitle = candidateSlug && validWorkSlugs.has(candidateSlug);
                  const titleEl = (
                    <span className="text-lg font-semibold text-gray-900 dark:text-white line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {post.title}
                    </span>
                  );
                  return (
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white line-clamp-2">
                      {isWorkTitle ? (
                        <Link href={`/works/${candidateSlug}`} className="group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          <span className="inline-flex items-center gap-1">
                            <Icon path={Icons.book} size="xs" className="text-indigo-600" />
                            {titleEl}
                          </span>
                        </Link>
                      ) : (
                        titleEl
                      )}
                    </h3>
                  );
                })()}
                
                {post.content && (
                  <p className="text-gray-700 dark:text-gray-300 text-sm line-clamp-4 leading-relaxed">
                    {post.content.length > 150 ? post.content.substring(0, 150) + '...' : post.content}
                  </p>
                )}

                {/* Post Meta */}
                <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                  {/* Izquierda: columna de avatar + corazón, y a la derecha el nombre (sin saltos) */}
                  <div className="flex items-start space-x-3 min-w-0">
                    <div className="flex flex-col items-center gap-2">
                      {post.profiles?.avatar_url ? (
                        <img
                          src={post.profiles.avatar_url.includes('googleusercontent.com')
                            ? `/api/avatar?u=${encodeURIComponent(post.profiles.avatar_url)}`
                            : post.profiles.avatar_url}
                          alt={getAuthorName(post)}
                          className="w-8 h-8 rounded-full object-cover"
                          onError={(e) => {
                            const el = e.currentTarget as HTMLImageElement;
                            el.style.display = 'none';
                            const next = el.nextElementSibling as HTMLElement | null;
                            if (next) next.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div
                        style={{ display: post.profiles?.avatar_url ? 'none' as const : 'flex' as const }}
                        className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full items-center justify-center"
                      >
                        <span className="text-white text-xs font-semibold">
                          {getAuthorName(post).charAt(0).toUpperCase()}
                        </span>
                      </div>
                      {/* Corazón debajo del avatar */}
                      <LikeButton 
                        targetType="post"
                        targetId={post.id}
                        className="text-sm"
                      />
                    </div>
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {getAuthorName(post)}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {formatDate(getPostDate(post))}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </article>

            {renderItemFooter && (
              <div className="mt-2">
                {renderItemFooter(post)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Stats Section */}
      {showStats && (
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {posts.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Posts Publicados
              </div>
            </div>
            
            <div>
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                {new Set(posts.map(p => p.author_id)).size}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Autores Activos
              </div>
            </div>
            
            <div>
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                {posts.filter(p => {
                  const createdDate = new Date(getPostDate(p));
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