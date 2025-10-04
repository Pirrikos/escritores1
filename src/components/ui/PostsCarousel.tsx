'use client';

import React, { useRef } from 'react';
import { Icon, Icons } from '@/components/ui';
import LikeButton from '@/components/ui/LikeButton';

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
  };
}

interface PostsCarouselProps {
  posts: Post[];
  title?: string;
  description?: string;
  showStats?: boolean;
  className?: string;
}

export default function PostsCarousel({ 
  posts, 
  title = "Posts Recientes", 
  description = "Últimas publicaciones de nuestros escritores",
  showStats = false,
  className = ""
}: PostsCarouselProps) {
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
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getAuthorName = (post: Post) => {
    return post.display_name || post.profiles?.display_name || 'Autor Desconocido';
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
        {posts.map((post) => (
          <article 
            key={post.id} 
            className="flex-shrink-0 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 p-6 group cursor-pointer"
          >
            {/* Post Content */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {post.title}
              </h3>
              
              {post.content && (
                <p className="text-gray-700 dark:text-gray-300 text-sm line-clamp-4 leading-relaxed">
                  {post.content.length > 150 ? post.content.substring(0, 150) + '...' : post.content}
                </p>
              )}

              {/* Post Meta */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-semibold">
                      {getAuthorName(post).charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      {getAuthorName(post)}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  {/* Like Button */}
                  <LikeButton 
                    targetType="post"
                    targetId={post.id}
                    className="text-sm"
                  />
                  
                  <div className="text-right">
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {formatDate(getPostDate(post))}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </article>
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