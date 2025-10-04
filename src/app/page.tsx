'use client';

import Link from 'next/link';
import { useEffect, Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useCallback } from 'react';
import PostsCarousel from '@/components/ui/PostsCarousel';
import WorksCarousel from '@/components/ui/WorksCarousel';
import ChaptersCarousel from '@/components/ui/ChaptersCarousel';
import { AppHeader } from '@/components/ui';
import { isAdminUser } from '@/lib/adminAuth';

// Interfaces para los tipos de datos
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
  synopsis?: string;
  author_id: string;
  created_at: string;
  cover_url?: string;
  profiles: {
    display_name: string;
  };
}

function HomePageContent() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [session, setSession] = useState<any>(null);

  // Estados para los datos
  const [posts, setPosts] = useState<Post[]>([]);
  const [works, setWorks] = useState<Work[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);

  // Función para cargar posts desde la API
  const loadPosts = useCallback(async () => {
    try {
      const response = await fetch('/api/feed?limit=10&status=published');
      if (response.ok) {
        const result = await response.json();
        console.log('Posts response:', result); // Debug log
        setPosts(result.data || []);
      } else {
        console.error('Error response:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error cargando posts:', error);
    }
  }, []);

  // Función para cargar obras
  const loadWorks = useCallback(async () => {
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
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      // Normalizar profiles: Supabase puede devolver arrays en relaciones
      const normalizeProfile = (p: any) => {
        if (Array.isArray(p)) {
          return { display_name: p[0]?.display_name ?? 'Autor desconocido' };
        }
        if (p && typeof p === 'object' && 'display_name' in p) {
          return p as { display_name: string };
        }
        return { display_name: 'Autor desconocido' };
      };

      const normalized = (data || []).map((w: any) => ({
        ...w,
        profiles: normalizeProfile(w?.profiles),
      }));
      setWorks(normalized);
    } catch (error) {
      console.error('Error cargando obras:', error);
    }
  }, [supabase]);

  // Función para cargar capítulos
  const loadChapters = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('chapters')
        .select(`
          id,
          title,
          author_id,
          created_at,
          is_independent,
          slug,
          cover_url,
          profiles!chapters_author_id_fkey (
            display_name
          )
        `)
        .eq('status', 'published')
        .eq('is_independent', true)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      // Normalizar profiles igual que en obras
      const normalizeProfile = (p: any) => {
        if (Array.isArray(p)) {
          return { display_name: p[0]?.display_name ?? 'Autor desconocido' };
        }
        if (p && typeof p === 'object' && 'display_name' in p) {
          return p as { display_name: string };
        }
        return { display_name: 'Autor desconocido' };
      };

      const normalized = (data || []).map((c: any) => ({
        ...c,
        profiles: normalizeProfile(c?.profiles),
      }));
      setChapters(normalized);
    } catch (error) {
      console.error('Error cargando capítulos:', error);
    }
  }, [supabase]);

  useEffect(() => {
    // Obtener sesión y suscribirse a cambios de auth
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session || null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });

    const handleOAuthCallback = async () => {
      // Verificar si hay parámetros de OAuth en la URL
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const urlParams = new URLSearchParams(window.location.search);
      
      const code = urlParams.get('code') || hashParams.get('code');
      const error = urlParams.get('error') || hashParams.get('error');
      
      if (error) {
        console.error('Error OAuth recibido:', error);
        router.push('/auth/login?error=oauth_error');
        return;
      }
      
      if (code) {
        console.log('Código OAuth detectado en página principal, procesando...');
        
        try {
          // Usar getSession() que maneja automáticamente el intercambio PKCE
          const { error } = await supabase.auth.getSession();
          
          if (error) {
            console.error('Error al obtener sesión:', error);
            // Intentar manejar el callback manualmente
            const { error: authError } = await supabase.auth.getUser();
            if (authError) {
              console.error('Error al obtener usuario:', authError);
              router.push('/auth/login?error=auth_callback_error');
              return;
            }
          }
          
          // Verificar si tenemos una sesión válida
          const { data: sessionData } = await supabase.auth.getSession();
          
          if (sessionData.session && sessionData.session.user) {
            console.log('Sesión establecida exitosamente:', sessionData.session.user.email);
            
            // Limpiar la URL y redirigir al Home
            window.history.replaceState({}, document.title, '/');
            router.push('/home');
          } else {
            console.error('No se pudo establecer la sesión después del callback');
            router.push('/auth/login?error=session_error');
          }
        } catch (error) {
          console.error('Error en callback de autenticación:', error);
          router.push('/auth/login?error=callback_error');
        }
        return; // Salir temprano para evitar cargar datos durante OAuth
      }
    };

    const loadData = async () => {
      console.log('Iniciando carga de datos...');
      setLoading(true);
      try {
        await Promise.all([
          loadPosts(),
          loadWorks(),
          loadChapters()
        ]);
        console.log('Carga de datos completada');
      } catch (error) {
        console.error('Error en carga de datos:', error);
      } finally {
        setLoading(false);
      }
    };

    // Solo ejecutar si hay parámetros OAuth
    const hasOAuthParams = window.location.search.includes('code') || window.location.hash.includes('code');

    // Si no hay OAuth y estamos en '/', redirigir a /home como página principal
    if (!hasOAuthParams && typeof window !== 'undefined' && window.location.pathname === '/') {
      router.replace('/home');
      return;
    }

    if (hasOAuthParams) {
      handleOAuthCallback();
    } else {
      loadData();
    }
    return () => {
      try { sub?.subscription?.unsubscribe?.(); } catch {}
    };
  }, [router, supabase, loadPosts, loadWorks, loadChapters]);



  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header principal con avatar y menú */}
        <AppHeader className="mb-12" />

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando contenido...</p>
          </div>
        ) : (
          <div className="space-y-12">
            {/* Posts Section */}
            <PostsCarousel 
              posts={posts}
              title="Posts Recientes"
              description="Últimas publicaciones de nuestros escritores"
              className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200/60"
            />

            {/* Works Section */}
            <WorksCarousel 
              works={works}
              title="Obras Completas"
              description="Libros y obras completas de nuestros autores"
              className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200/60"
            />

            {/* Chapters Section */}
            <ChaptersCarousel 
              chapters={chapters}
              title="Capítulos Independientes"
              description="Historias cortas y capítulos únicos"
              className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200/60"
            />
          </div>
        )}
        
        <footer className="text-center mt-12 text-gray-600">
          <p className="text-lg">Explora, crea y comparte tu creatividad literaria</p>
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
        <p className="text-gray-600">Cargando página principal...</p>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <HomePageContent />
    </Suspense>
  );
}