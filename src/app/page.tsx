'use client';

import Link from 'next/link';
import { useEffect, Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabaseClient';
import { useCallback } from 'react';
import PostsCarousel from '@/components/ui/PostsCarousel';
import WorksCarousel from '@/components/ui/WorksCarousel';
import ChaptersCarousel from '@/components/ui/ChaptersCarousel';
import UsersCarousel from '@/components/ui/UsersCarousel';
import { AppHeader } from '@/components/ui';
import { ToastProvider } from '@/contexts/ToastContext';
import ToastContainer from '@/components/ui/ToastContainer';
import DailyQuoteBanner from '@/components/ui/DailyQuoteBanner';
import { isAdminUser } from '@/lib/adminAuth';
import dynamic from 'next/dynamic';
import { generateSlug } from '@/lib/slugUtils';
import { logPdfView, normalizeBucketAndPath } from '@/lib/activityLogger';
// import eliminado: ContinueReading

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

interface UserProfile {
  id: string;
  display_name: string | null;
  avatar_url?: string | null;
  username?: string | null;
}

function HomePageContent() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const [session, setSession] = useState<any>(null);

  // Estados para los datos
  const [posts, setPosts] = useState<Post[]>([]);
  const [works, setWorks] = useState<Work[]>([]);
  const [worksByChapters, setWorksByChapters] = useState<Work[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [followedUsers, setFollowedUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Capítulos anidados por obra y visor PDF
  const [chaptersByWork, setChaptersByWork] = useState<Record<string, Array<{ id: string; title: string; chapter_number: number; slug?: string; file_url?: string; file_type?: string }>>>({});
  const [isPDFViewerOpen, setIsPDFViewerOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [currentTitle, setCurrentTitle] = useState<string | null>(null);
  const PDFViewer = dynamic(() => import('@/components/ui/PDFViewer'), { ssr: false });

  // Función para cargar posts desde la API
  const loadPosts = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/feed?limit=10&status=published', { signal });
      if (response.ok) {
        const result = await response.json();
        console.log('Posts response:', result); // Debug log
        setPosts(result.data || []);
      } else {
        // Silenciar errores de respuesta en consola
      }
    } catch (error: any) {
      // Silenciar abortos de navegación/HMR en desarrollo
      const isAbort = error?.name === 'AbortError' || /Failed to fetch/i.test(error?.message || '');
      if (!isAbort) {
        // Silenciar errores de carga en consola
      }
    }
  }, []);

  // Función para cargar obras
  const loadWorks = useCallback(async () => {
    try {
      // Primero: obtener IDs de obras que tienen capítulos (obras serializadas)
      let serializedWorkIds = new Set<string>();
      try {
        const { data: chRows, error: chErr } = await supabase
          .from('chapters')
          .select('work_id')
          .eq('is_independent', false)
          .not('work_id', 'is', null)
          .limit(1000);
        if (!chErr && Array.isArray(chRows)) {
          serializedWorkIds = new Set<string>(
            (chRows.map((c: any) => c.work_id).filter(Boolean) as string[])
          );
        }
      } catch (e) {
        // Silenciar errores de carga de capítulos para filtro
      }

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
      // Excluir obras que tienen capítulos
      const filtered = (normalized as Work[]).filter((w) => !serializedWorkIds.has(w.id));
      setWorks(filtered);
    } catch (error) {
      // Silenciar errores de carga de obras en consola
    }
  }, [supabase]);

  // Cargar autores seguidos por el usuario (requiere sesión)
  const loadFollowedUsers = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        setFollowedUsers([]);
        return;
      }
      // Paso 1: obtener IDs seguidos desde API de servidor
      const idsRes = await fetch('/api/follows', { method: 'GET' });
      if (!idsRes.ok) {
        setFollowedUsers([]);
        return;
      }
      const idsJson = await idsRes.json();
      const ids: string[] = Array.isArray(idsJson?.ids) ? idsJson.ids : [];
      if (!ids.length) {
        setFollowedUsers([]);
        return;
      }
      // Paso 2: cargar perfiles de esos IDs vía API
      const profilesRes = await fetch(`/api/users?ids=${encodeURIComponent(ids.join(','))}`);
      if (!profilesRes.ok) {
        setFollowedUsers([]);
        return;
      }
      const profJson = await profilesRes.json();
      const rows = Array.isArray(profJson?.data) ? profJson.data : [];
      const normalized: UserProfile[] = rows.map((p: any) => ({
        id: p.id,
        display_name: p.display_name || null,
        avatar_url: p.avatar_url || null,
        username: p.username || null,
      }));
      setFollowedUsers(normalized);
    } catch (error) {
      // Silenciar errores de carga de autores seguidos
      setFollowedUsers([]);
    }
  }, [supabase]);

  // Cargar perfiles (usuarios) para carrusel de avatares
  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users?limit=30', { method: 'GET' });
      if (!res.ok) {
        setUsers([]);
        return;
      }
      const json = await res.json();
      const rows = Array.isArray(json?.data) ? json.data : [];
      setUsers(rows);
    } catch (error) {
      // Silenciar errores de carga de perfiles en consola
      setUsers([]);
    }
  }, []);

  // Función para cargar obras que tienen capítulos (no independientes)
  const loadWorksByChapters = useCallback(async () => {
    try {
      const { data: chaptersData, error: chaptersError } = await supabase
        .from('chapters')
        .select('work_id')
        .eq('is_independent', false)
        .not('work_id', 'is', null)
        .limit(500);
      if (chaptersError) throw chaptersError;

      const workIds = Array.from(new Set((chaptersData || []).map((c: any) => c.work_id))).filter(Boolean);
      if (workIds.length === 0) {
        setWorksByChapters([]);
        setChaptersByWork({});
        return;
      }

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
        .in('id', workIds)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;

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
      setWorksByChapters(normalized);

      // Cargar capítulos publicados anidados de estas obras
      try {
        const { data: chRows, error: chErr } = await supabase
          .from('chapters')
          .select('id, title, chapter_number, work_id, slug, status, file_url, file_type')
          .eq('is_independent', false)
          .in('work_id', workIds)
          .eq('status', 'published')
          .order('chapter_number', { ascending: true })
          .limit(1000);
        if (!chErr && Array.isArray(chRows)) {
          const map: Record<string, Array<{ id: string; title: string; chapter_number: number; slug?: string; file_url?: string; file_type?: string }>> = {};
          const seen: Record<string, Set<string>> = {};
          for (const ch of chRows) {
            const wid = (ch as any).work_id;
            if (!wid) continue;
            const slug = String((ch as any).slug || '').toLowerCase();
            const num = String((ch as any).chapter_number ?? '');
            const titleNorm = String((ch as any).title || '').trim().toLowerCase();
            const key = [slug, num, titleNorm].filter(Boolean).join('|');
            const seenSet = seen[wid] || new Set<string>();
            if (key && seenSet.has(key)) continue;
            seenSet.add(key);
            seen[wid] = seenSet;
            const list = map[wid] || [];
            list.push({ id: (ch as any).id, title: (ch as any).title, chapter_number: (ch as any).chapter_number, slug: (ch as any).slug, file_url: (ch as any).file_url, file_type: (ch as any).file_type });
            map[wid] = list;
          }
          setChaptersByWork(map);
        }
      } catch (chEx) {
        // Silenciar errores de carga de capítulos anidados
      }
    } catch (error) {
      // Silenciar errores de carga de obras por capítulos en consola
    }
  }, [supabase]);

  const openChapterFile = useCallback(async (filePath?: string, slug?: string, fileType?: string, title?: string) => {
    try {
      // Resolver filePath desde el slug si no viene en el item
      let effectivePath = filePath;
      let effectiveType = fileType;
      let effectiveTitle = title;
      let resolvedSlug = slug;
      if (!effectivePath && slug) {
        try {
          const { data: ch, error } = await supabase
            .from('chapters')
            .select('file_url, file_type, title, status')
            .eq('slug', slug)
            .eq('status', 'published')
            .limit(1)
            .single();
          if (!error && ch?.file_url) {
            effectivePath = ch.file_url;
            effectiveType = ch.file_type || effectiveType;
            effectiveTitle = ch.title || effectiveTitle;
          }
        } catch {}
      }
      // Si no tenemos slug pero sí ruta de archivo, intentar resolver el slug real desde BD
      if (!resolvedSlug && effectivePath) {
        try {
          const { data: ch2 } = await supabase
            .from('chapters')
            .select('slug')
            .eq('file_url', effectivePath)
            .eq('status', 'published')
            .limit(1)
            .single();
          if (ch2?.slug) {
            resolvedSlug = ch2.slug as string;
          }
        } catch {}
      }
      // Si aún no hay archivo, navegar al capítulo con visor
      if (!effectivePath) {
        window.location.href = `/chapters/${resolvedSlug || ''}?view=pdf`;
        return;
      }

      // Abrir PDF en visor integrado
      const isPdf = (effectiveType && effectiveType.toLowerCase().includes('pdf')) || (effectivePath && effectivePath.toLowerCase().endsWith('.pdf'));
      if (isPdf) {
        try {
          const res = await fetch('/api/storage/signed-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath: effectivePath, expiresIn: 3600 })
          });
          const signed = res.ok ? (await res.json())?.signedUrl : null;
          const urlToUse = signed || effectivePath;
          const norm = normalizeBucketAndPath(urlToUse, { bucket: 'chapters', path: effectivePath || urlToUse });
          if (!resolvedSlug && norm.path) {
            try {
              const { data: ch3 } = await supabase
                .from('chapters')
                .select('slug')
                .eq('file_url', norm.path)
                .eq('status', 'published')
                .limit(1)
                .single();
              if (ch3?.slug) {
                resolvedSlug = ch3.slug as string;
              }
            } catch {}
          }
          // Descargar como blob para evitar net::ERR_ABORTED y usar object URL
          let viewerUrl = urlToUse;
          if (signed) {
            try {
              const pdfResp = await fetch(signed, { cache: 'no-store' });
              const blob = await pdfResp.blob();
              viewerUrl = URL.createObjectURL(blob);
            } catch {
              viewerUrl = urlToUse;
            }
          }
          setPdfUrl(viewerUrl);
          setCurrentTitle(effectiveTitle || 'Capítulo');
          if (resolvedSlug || slug) {
            await logPdfView({ contentType: 'chapter', contentSlug: resolvedSlug || (slug as string), urlOrPath: norm.path || effectivePath });
          }
          setIsPDFViewerOpen(true);
          return;
        } catch {}
        const norm = normalizeBucketAndPath(effectivePath || '', { bucket: 'chapters', path: effectivePath || '' });
        if (!resolvedSlug && norm.path) {
          try {
            const { data: ch3 } = await supabase
              .from('chapters')
              .select('slug')
              .eq('file_url', norm.path)
              .eq('status', 'published')
              .limit(1)
              .single();
            if (ch3?.slug) {
              resolvedSlug = ch3.slug as string;
            }
          } catch {}
        }
        // Sin URL firmada, no abrir visor para evitar errores de carga
        setCurrentTitle(effectiveTitle || 'Capítulo');
        // Registrar vista de PDF sólo con slug de capítulo resuelto, evitando usar slug ambiguo
        await logPdfView({ contentType: 'chapter', contentSlug: resolvedSlug || null, urlOrPath: effectivePath });
        return;
      }

      // Otros tipos
      window.open(effectivePath, '_blank');
    } catch {
      window.location.href = (filePath || `/chapters/${slug || ''}`);
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
      // Silenciar errores de carga de capítulos en consola
    }
  }, [supabase]);

  useEffect(() => {
    // Controlar abort de carga de posts para evitar errores de navegación
    let postsAbortController: AbortController | null = null;
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
        // Silenciar errores OAuth en consola
        router.push('/auth/login?error=oauth_error');
        return;
      }
      
      if (code) {
        console.log('Código OAuth detectado en página principal, procesando...');
        
        try {
          // Usar getSession() que maneja automáticamente el intercambio PKCE
          const { error } = await supabase.auth.getSession();
          
          if (error) {
            // Silenciar errores al obtener sesión
            // Intentar manejar el callback manualmente
            const { error: authError } = await supabase.auth.getUser();
            if (authError) {
              // Silenciar errores al obtener usuario
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
            // Silenciar error de sesión no establecida
            router.push('/auth/login?error=session_error');
          }
        } catch (error) {
          // Silenciar errores en callback de autenticación
          router.push('/auth/login?error=callback_error');
        }
        return; // Salir temprano para evitar cargar datos durante OAuth
      }
    };

    const loadData = async () => {
      console.log('Iniciando carga de datos...');
      setLoading(true);
      try {
        postsAbortController = new AbortController();
        await Promise.all([
          loadPosts(postsAbortController.signal),
          loadWorks(),
          loadChapters(),
          loadWorksByChapters(),
          loadUsers(),
          loadFollowedUsers()
        ]);
        console.log('Carga de datos completada');
      } catch (error) {
        // Silenciar errores en carga de datos
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
      if (postsAbortController && !postsAbortController.signal.aborted) {
        postsAbortController.abort();
      }
    };
  }, [router, supabase, loadPosts, loadWorks, loadChapters, loadUsers, loadFollowedUsers]);



  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header principal con avatar y menú */}
        <AppHeader className="mb-12" />
        {/* Frase literaria del día (después del encabezado) */}
        <DailyQuoteBanner />

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando contenido...</p>
          </div>
        ) : (
          <div className="space-y-12">
            {/* Followed Authors Section (solo si hay sesión y autores seguidos) */}
            {followedUsers.length > 0 && (
              <UsersCarousel
                users={followedUsers}
                title="Autores que sigues"
                description="Tu selección personal"
                className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200/60"
              />
            )}

            {/* Users Section */}
            <UsersCarousel
              users={users.filter(u => !followedUsers.some(f => f.id === u.id))}
              title="Autores"
              description="Miembros de la comunidad"
              className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200/60"
            />

            {/* Posts Section */}
            <PostsCarousel 
              posts={posts}
              title="Posts Recientes"
              description="Últimas publicaciones de nuestros escritores"
              seeMoreHref="/posts"
              className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200/60"
            />

            {/* Lecturas en curso eliminado: usar página Mis lecturas */}

            {/* Rincón social temporalmente desactivado */}

            {/* Works Section */}
            <WorksCarousel 
              works={works}
              title="Obras Completas"
              description="Libros y obras completas de nuestros autores"
              seeMoreHref="/works"
              className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200/60"
            />

            {/* Works by Chapters Section */}
            <WorksCarousel 
              works={worksByChapters}
              title="Obras por Capítulos"
              description="Obras serializadas por capítulos"
              seeMoreHref="/obras-por-capitulos"
              className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200/60"
            />

            {/* Chapters Section */}
            <ChaptersCarousel 
              chapters={chapters}
              title="Capítulos Independientes"
              description="Historias cortas y capítulos únicos"
              seeMoreHref="/chapters"
              className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200/60"
            />
          </div>
        )}

        {/* Visor PDF integrado */}
        {isPDFViewerOpen && pdfUrl && (
          <PDFViewer
            fileUrl={pdfUrl}
            fileName={currentTitle || 'Documento PDF'}
            onClose={() => {
              try {
                if (pdfUrl && pdfUrl.startsWith('blob:')) {
                  URL.revokeObjectURL(pdfUrl);
                }
              } catch {}
              setPdfUrl(null);
              setIsPDFViewerOpen(false);
            }}
          />
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
    <ToastProvider>
      <ToastContainer />
      <Suspense fallback={<LoadingFallback />}>
        <HomePageContent />
      </Suspense>
    </ToastProvider>
  );
}