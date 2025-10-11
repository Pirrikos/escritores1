'use client';

import { useEffect, useState, useCallback, use as unwrap } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import PostsCarousel from '@/components/ui/PostsCarousel';
import WorksCarousel from '@/components/ui/WorksCarousel';
import ChaptersCarousel from '@/components/ui/ChaptersCarousel';
import { AppHeader } from '@/components/ui';
import dynamic from 'next/dynamic';
import FollowButton from '@/components/ui/FollowButton';
import { ToastProvider } from '@/contexts/ToastContext';
import ToastContainer from '@/components/ui/ToastContainer';
import { generateSlug } from '@/lib/slugUtils';
import { logPdfView, normalizeBucketAndPath } from '@/lib/activityLogger';

interface Profile {
  id: string;
  display_name: string | null;
  avatar_url?: string | null;
}

interface Post {
  id: string;
  title: string;
  content?: string;
  author_id: string;
  created_at: string;
  published_at?: string;
  profiles?: { display_name: string; avatar_url?: string };
}

interface Work {
  id: string;
  title: string;
  synopsis?: string;
  author_id: string;
  created_at: string;
  cover_url?: string;
  profiles: { display_name: string };
}

interface Chapter {
  id: string;
  title: string;
  synopsis?: string;
  author_id: string;
  created_at: string;
  cover_url?: string;
  slug?: string;
  profiles: { display_name: string };
}

export default function UsuarioPublicacionesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: userId } = unwrap(params);
  const supabase = createClientComponentClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [works, setWorks] = useState<Work[]>([]);
  const [worksByChapters, setWorksByChapters] = useState<Work[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [chaptersByWork, setChaptersByWork] = useState<Record<string, Array<{ id: string; title: string; chapter_number: number; slug?: string; file_url?: string; file_type?: string }>>>({});
  const [isPDFViewerOpen, setIsPDFViewerOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [currentTitle, setCurrentTitle] = useState<string | null>(null);
  const PDFViewer = dynamic(() => import('@/components/ui/PDFViewer'), { ssr: false });

  const normalizeProfileName = (p: any): { display_name: string } => {
    const obj = Array.isArray(p) ? p[0] : p;
    return { display_name: obj?.display_name || 'Autor desconocido' };
  };

  const normalizeProfileWithAvatar = (p: any): { display_name: string; avatar_url?: string } => {
    const obj = Array.isArray(p) ? p[0] : p;
    return { display_name: obj?.display_name || 'Autor desconocido', avatar_url: obj?.avatar_url || undefined };
  };

  const loadProfile = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .eq('id', userId)
      .limit(1);
    setProfile((data || [])[0] || null);
  }, [supabase, userId]);

  const loadPosts = useCallback(async () => {
    const { data } = await supabase
      .from('posts')
      .select(`
        id,
        title,
        content,
        author_id,
        created_at,
        published_at,
        profiles:profiles!posts_author_id_fkey (
          display_name,
          avatar_url
        )
      `)
      .eq('status', 'published')
      .eq('author_id', userId)
      .order('published_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(30);
    const normalized = (data || []).map((row: any) => ({
      ...row,
      profiles: normalizeProfileWithAvatar(row.profiles),
    }));
    setPosts(normalized);
  }, [supabase, userId]);

  const loadWorks = useCallback(async () => {
    const { data } = await supabase
      .from('works')
      .select(`
        id,
        title,
        synopsis,
        author_id,
        created_at,
        cover_url,
        profiles:profiles!works_author_id_fkey (
          display_name
        )
      `)
      .eq('status', 'published')
      .eq('author_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    const normalized = (data || []).map((row: any) => ({
      ...row,
      profiles: normalizeProfileName(row.profiles),
    }));
    setWorks(normalized);
  }, [supabase, userId]);

  const loadChaptersIndependent = useCallback(async () => {
    const { data } = await supabase
      .from('chapters')
      .select(`
        id,
        title,
        synopsis,
        author_id,
        created_at,
        cover_url,
        slug,
        is_independent,
        profiles:profiles!chapters_author_id_fkey (
          display_name
        )
      `)
      .eq('status', 'published')
      .eq('is_independent', true)
      .eq('author_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    const normalized = (data || []).map((row: any) => ({
      ...row,
      profiles: normalizeProfileName(row.profiles),
    }));
    setChapters(normalized);
  }, [supabase, userId]);

  const loadWorksByChapters = useCallback(async () => {
    // Obtener IDs de obras con capítulos del autor
    const { data: ch } = await supabase
      .from('chapters')
      .select('work_id, author_id, is_independent')
      .eq('author_id', userId)
      .eq('is_independent', false)
      .not('work_id', 'is', null)
      .limit(500);
    const workIds = Array.from(new Set((ch || []).map((c: any) => c.work_id))).filter(Boolean);
    if (workIds.length === 0) {
      setWorksByChapters([]);
      setChaptersByWork({});
      return;
    }
    const { data } = await supabase
      .from('works')
      .select(`
        id,
        title,
        synopsis,
        author_id,
        created_at,
        cover_url,
        profiles:profiles!works_author_id_fkey (
          display_name
        )
      `)
      .eq('status', 'published')
      .in('id', workIds)
      .order('created_at', { ascending: false })
      .limit(100);
    const normalized = (data || []).map((row: any) => ({
      ...row,
      profiles: normalizeProfileName(row.profiles),
    }));
    setWorksByChapters(normalized);

    // Cargar capítulos anidados publicados para estas obras
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
        for (const row of chRows) {
          const wid = (row as any).work_id;
          if (!wid) continue;
          const slug = String((row as any).slug || '').toLowerCase();
          const num = String((row as any).chapter_number ?? '');
          const titleNorm = String((row as any).title || '').trim().toLowerCase();
          const key = [slug, num, titleNorm].filter(Boolean).join('|');
          const seenSet = seen[wid] || new Set<string>();
          if (key && seenSet.has(key)) continue;
          seenSet.add(key);
          seen[wid] = seenSet;
          const list = map[wid] || [];
          list.push({ id: (row as any).id, title: (row as any).title, chapter_number: (row as any).chapter_number, slug: (row as any).slug, file_url: (row as any).file_url, file_type: (row as any).file_type });
          map[wid] = list;
        }
        setChaptersByWork(map);
      }
    } catch {}
  }, [supabase, userId]);

  const openChapterFile = useCallback(async (filePath?: string, slug?: string, fileType?: string, title?: string) => {
    try {
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
      // Intentar resolver slug real desde la BD si falta pero tenemos la ruta
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
      if (!effectivePath) {
        window.location.href = `/chapters/${resolvedSlug || ''}?view=pdf`;
        return;
      }
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
          // Descargar PDF como blob y usar object URL
          let viewerUrl = urlToUse;
          if (signed) {
            try {
              const pdfResp = await fetch(signed, { cache: 'no-store' });
              const blob = await pdfResp.blob();
              viewerUrl = URL.createObjectURL(blob);
            } catch {}
          }
          setPdfUrl(viewerUrl);
          setCurrentTitle(effectiveTitle || 'Capítulo');
          // Registrar capítulo sólo si tenemos slug de capítulo resuelto
          await logPdfView({ contentType: 'chapter', contentSlug: resolvedSlug || null, urlOrPath: norm.path || effectivePath });
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
        await logPdfView({ contentType: 'chapter', contentSlug: resolvedSlug || null, urlOrPath: effectivePath });
        return;
      }
      window.open(effectivePath, '_blank');
    } catch {
      window.location.href = (filePath || `/chapters/${resolvedSlug || slug || ''}`);
    }
  }, [supabase]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      await Promise.all([
        loadProfile(),
        loadPosts(),
        loadWorks(),
        loadWorksByChapters(),
        loadChaptersIndependent(),
      ]);
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [loadProfile, loadPosts, loadWorks, loadWorksByChapters, loadChaptersIndependent]);

  const displayName = (() => {
    const raw = (profile?.display_name || '').trim();
    if (!raw) return 'Autor';
    const base = raw.includes('@') ? raw.split('@')[0] : raw;
    const cleaned = base.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim();
    return cleaned
      .split(' ')
      .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
      .join(' ') || 'Autor';
  })();

  const avatarSrc = profile?.avatar_url
    ? (profile.avatar_url!.includes('googleusercontent.com')
        ? `/api/avatar?u=${encodeURIComponent(profile.avatar_url!)}`
        : profile.avatar_url!)
    : null;

  return (
    <ToastProvider>
      <ToastContainer />
      <div>
        <AppHeader />
        <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Encabezado del perfil */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 relative">
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt={`Avatar de ${displayName}`}
                className="w-16 h-16 rounded-full object-cover border border-slate-200"
              />
            ) : (
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full items-center justify-center flex border border-slate-200">
                <span className="text-white text-lg font-semibold">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-start justify-between w-full">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{displayName}</h1>
              <p className="text-gray-600 dark:text-gray-400">Publicaciones del autor</p>
            </div>
            <FollowButton targetUserId={userId} />
          </div>
        </div>

        {/* Contenido */}
        {loading ? (
          <div className="text-gray-600 dark:text-gray-400">Cargando publicaciones...</div>
        ) : (
          <div className="space-y-10">
            <PostsCarousel 
              posts={posts} 
              title={`Posts de ${displayName}`} 
              description="Artículos y publicaciones"
              className=""
            />

            <WorksCarousel 
              works={works} 
              title={`Obras de ${displayName}`} 
              description="Libros y obras completas"
              className=""
            />

            <WorksCarousel 
              works={worksByChapters} 
              title={`Obras por capítulos de ${displayName}`} 
              description="Obras seriadas con capítulos publicados"
              className=""
            />

            <ChaptersCarousel 
              chapters={chapters} 
              title={`Capítulos independientes de ${displayName}`} 
              description="Relatos y capítulos sueltos"
              className=""
            />
          </div>
        )}
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
        </div>
      </div>
    </ToastProvider>
  );
}