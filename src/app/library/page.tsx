'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import PostsCarousel from '@/components/ui/PostsCarousel';
import WorksCarousel from '@/components/ui/WorksCarousel';
import ChaptersCarousel from '@/components/ui/ChaptersCarousel';
import { AppHeader } from '@/components/ui';

interface Post {
  id: string;
  title: string;
  content?: string;
  author_id: string;
  created_at: string;
  published_at?: string;
  profiles?: {
    display_name: string;
  };
}

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

interface Chapter {
  id: string;
  title: string;
  author_id: string;
  created_at: string;
  cover_url?: string;
  slug?: string;
  profiles: {
    display_name: string;
  };
}

function LibraryContent() {
  const supabase = createClientComponentClient();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [posts, setPosts] = useState<Post[]>([]);
  const [works, setWorks] = useState<Work[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);

  const loadPosts = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          id,
          title,
          content,
          author_id,
          created_at,
          published_at,
          profiles!posts_author_id_fkey (
            display_name
          )
        `)
        .eq('status', 'published')
        .eq('author_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const normalizeProfile = (profiles: any): { display_name: string } => {
        const p = Array.isArray(profiles) ? profiles[0] : profiles;
        return { display_name: p?.display_name || 'Autor desconocido' };
      };
      const normalized = (data || []).map((row: any) => ({
        ...row,
        profiles: normalizeProfile(row.profiles)
      }));
      setPosts(normalized);
    } catch (err) {
      console.error('Error cargando posts del usuario:', err);
      setPosts([]);
    }
  }, [supabase]);

  const loadWorks = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('works')
        .select(`
          id,
          title,
          synopsis,
          author_id,
          created_at,
          cover_url,
          profiles!works_author_id_fkey (
            display_name
          )
        `)
        .eq('status', 'published')
        .eq('author_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const normalizeProfile = (profiles: any): { display_name: string } => {
        const p = Array.isArray(profiles) ? profiles[0] : profiles;
        return { display_name: p?.display_name || 'Autor desconocido' };
      };
      const normalized = (data || []).map((row: any) => ({
        ...row,
        profiles: normalizeProfile(row.profiles)
      }));
      setWorks(normalized);
    } catch (err) {
      console.error('Error cargando obras del usuario:', err);
      setWorks([]);
    }
  }, [supabase]);

  const loadChapters = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('chapters')
        .select(`
          id,
          title,
          author_id,
          created_at,
          slug,
          cover_url,
          profiles!chapters_author_id_fkey (
            display_name
          )
        `)
        .eq('status', 'published')
        .eq('author_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const normalizeProfile = (profiles: any): { display_name: string } => {
        const p = Array.isArray(profiles) ? profiles[0] : profiles;
        return { display_name: p?.display_name || 'Autor desconocido' };
      };
      const normalized = (data || []).map((row: any) => ({
        ...row,
        profiles: normalizeProfile(row.profiles)
      }));
      setChapters(normalized);
    } catch (err) {
      console.error('Error cargando capítulos del usuario:', err);
      setChapters([]);
    }
  }, [supabase]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const s = data.session || null;
      setSession(s);
      if (s?.user?.id) {
        setLoading(true);
        Promise.all([
          loadPosts(s.user.id),
          loadWorks(s.user.id),
          loadChapters(s.user.id),
        ])
          .catch((e) => console.error('Error en carga de biblioteca:', e))
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      const userId = s?.user?.id;
      if (userId) {
        setLoading(true);
        Promise.all([
          loadPosts(userId),
          loadWorks(userId),
          loadChapters(userId),
        ])
          .catch((e) => console.error('Error en carga de biblioteca (auth change):', e))
          .finally(() => setLoading(false));
      } else {
        setPosts([]);
        setWorks([]);
        setChapters([]);
      }
    });

    return () => {
      mounted = false;
      try { sub.subscription.unsubscribe(); } catch {}
    };
  }, [supabase, loadPosts, loadWorks, loadChapters]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <AppHeader className="mb-12" />

        {!session ? (
          <div className="text-center py-16 bg-white rounded-2xl shadow-xl border border-slate-200/60">
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Inicia sesión para ver tus publicaciones</h2>
            <p className="text-gray-600 mb-6">Accede con tu cuenta para ver tus posts, obras y capítulos publicados.</p>
            <a href="/auth/login" className="inline-flex items-center px-5 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700">Ir a iniciar sesión</a>
          </div>
        ) : loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando tus publicaciones...</p>
          </div>
        ) : (
          <div className="space-y-12">
            <PostsCarousel 
              posts={posts}
              title="Mis posts"
              description="Tus publicaciones recientes"
              className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200/60"
            />

            <WorksCarousel 
              works={works}
              title="Mis obras"
              description="Tus libros y obras completas"
              className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200/60"
            />

            <ChaptersCarousel 
              chapters={chapters}
              title="Mis capítulos"
              description="Tus historias cortas y capítulos publicados"
              className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200/60"
            />
          </div>
        )}

        <footer className="text-center mt-12 text-gray-600">
          <p className="text-lg">Tu biblioteca personal de publicaciones</p>
        </footer>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Cargando biblioteca...</p>
      </div>
    </div>
  );
}

export default function LibraryPage() {
  return (
    <Suspense fallback={<LoadingFallback />}> 
      <LibraryContent />
    </Suspense>
  );
}