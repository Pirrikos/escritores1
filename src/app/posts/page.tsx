'use client';

import { useEffect, useState } from 'react';
import { AppHeader } from '@/components/ui';
import PostsCarousel from '@/components/ui/PostsCarousel';

type Post = {
  id: string;
  title: string;
  content?: string;
  author_id: string;
  created_at: string;
  published_at?: string;
  profiles?: {
    display_name: string;
    avatar_url?: string;
  };
  likes_count?: number;
};

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ac = new AbortController();
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/posts/by-likes?limit=50&status=published`, {
          signal: ac.signal,
          headers: {
            'Accept': 'application/json',
          },
        });
        if (!res.ok) {
          return;
        }
        const json = await res.json();
        const list = json?.data || [];
        setPosts(list);
      } catch (e: any) {
        if (e?.name === 'AbortError') {
          // silencio abortos en desarrollo
        }
      } finally {
        setLoading(false);
      }
    };
    // Pequeño defer para evitar competir con navegación/HMR
    const id = setTimeout(load, 50);
    return () => {
      clearTimeout(id);
      ac.abort();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <div className="max-w-6xl mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando posts...</p>
          </div>
        ) : (
          <PostsCarousel
            posts={posts}
            title="Todos los posts"
            description="Publicaciones ordenadas por likes"
            className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200/60"
          />
        )}
      </div>
    </div>
  );
}