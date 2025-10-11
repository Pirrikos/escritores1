'use client';

import { useEffect, useState, useCallback, use as unwrap } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabaseClient';
import PostsCarousel from '@/components/ui/PostsCarousel';
import WorksCarousel from '@/components/ui/WorksCarousel';
import ChaptersCarousel from '@/components/ui/ChaptersCarousel';
import { AppHeader } from '@/components/ui';
import dynamic from 'next/dynamic';
// Botón seguir eliminado en la página de perfil
import { ToastProvider } from '@/contexts/ToastContext';
import ToastContainer from '@/components/ui/ToastContainer';
import { generateSlug } from '@/lib/slugUtils';
import { logPdfView, normalizeBucketAndPath } from '@/lib/activityLogger';

interface Profile {
  id: string;
  display_name: string | null;
  avatar_url?: string | null;
  username?: string | null;
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
  const supabase = getSupabaseBrowserClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [resolvedUserId, setResolvedUserId] = useState<string>('');
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
    let p: Profile | null = null;
    const param = String(userId || '').trim();
    const lower = param.toLowerCase();
    const looksLikeUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(param);
    const isSlugLike = !looksLikeUUID && /[-_]/g.test(param);
    const altUnderscore = lower.replace(/-/g, '_');
    const altHyphen = lower.replace(/_/g, '-');
    const collapseRepeats = (s: string) => s.replace(/([a-z0-9])\1+/g, '$1');

    // 1) Intentar por username exacto (muchos usernames son slugs con guiones)
    if (!p && lower) {
      try {
        const res = await fetch(`/api/users?username=${encodeURIComponent(param)}`, { credentials: 'include' });
        if (res.ok) {
          const json = await res.json();
          p = ((json?.data || []) as any[])[0] || p;
        }
      } catch {}
    }

    // 1b) Intento alternativo: username con guiones bajos ↔ guiones
    if (!p && lower && altUnderscore !== lower) {
      try {
        const res = await fetch(`/api/users?username=${encodeURIComponent(altUnderscore)}`, { credentials: 'include' });
        if (res.ok) {
          const json = await res.json();
          p = ((json?.data || []) as any[])[0] || p;
        }
      } catch {}
    }
    if (!p && lower && altHyphen !== lower) {
      try {
        const res = await fetch(`/api/users?username=${encodeURIComponent(altHyphen)}`, { credentials: 'include' });
        if (res.ok) {
          const json = await res.json();
          p = ((json?.data || []) as any[])[0] || p;
        }
      } catch {}
    }

    // 2) Intentar por username case-insensitive
    if (!p && lower) {
      try {
        const res = await fetch(`/api/users?username_ilike=${encodeURIComponent(lower)}`, { credentials: 'include' });
        if (res.ok) {
          const json = await res.json();
          p = ((json?.data || []) as any[])[0] || p;
        }
      } catch {}
    }

    // 2b) Intento alternativo: ilike con variantes
    if (!p && lower && altUnderscore !== lower) {
      try {
        const res = await fetch(`/api/users?username_ilike=${encodeURIComponent(altUnderscore)}`, { credentials: 'include' });
        if (res.ok) {
          const json = await res.json();
          p = ((json?.data || []) as any[])[0] || p;
        }
      } catch {}
    }
    if (!p && lower && altHyphen !== lower) {
      try {
        const res = await fetch(`/api/users?username_ilike=${encodeURIComponent(altHyphen)}`, { credentials: 'include' });
        if (res.ok) {
          const json = await res.json();
          p = ((json?.data || []) as any[])[0] || p;
        }
      } catch {}
    }

    // 3) Si el parámetro parece UUID, intentar resolver por id
    if (!p && looksLikeUUID) {
      try {
        const res = await fetch(`/api/users?ids=${encodeURIComponent(param)}`, { credentials: 'include' });
        if (res.ok) {
          const json = await res.json();
          p = ((json?.data || []) as any[])[0] || p;
        }
      } catch {}
    }

    // 4) Intento por slug derivado de display_name
    if (!p && lower) {
      try {
        const nameLike = lower.replace(/[-_]+/g, ' ');
        const { data: rows2 } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .ilike('display_name', `%${nameLike}%`)
          .limit(50);
        const targetSlug = altHyphen;
        const targetCollapsed = collapseRepeats(targetSlug);
        const match = (rows2 || []).find((row: any) => {
          const s = generateSlug(row?.display_name || '');
          return s === targetSlug || collapseRepeats(s) === targetCollapsed;
        });
        p = (match as Profile) || null;
      } catch {}
    }

    setProfile(p);
    setResolvedUserId(p?.id || '');
  }, [supabase, userId]);

  const isUUID = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

  const loadPosts = useCallback(async () => {
    if (!resolvedUserId || !isUUID(resolvedUserId)) return;
    try {
      const { data } = await supabase
        .from('posts')
        .select(`
          id,
          title,
          content,
          author_id,
          created_at,
          published_at
        `)
        .eq('status', 'published')
        .eq('author_id', resolvedUserId)
        .order('published_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(30);
      const normalized = (data || []).map((row: any) => ({
        ...row,
        profiles: normalizeProfileWithAvatar(profile),
      }));
      setPosts(normalized);
    } catch (e: any) {
      // ignorar abortos/failed to fetch en dev
    }
  }, [supabase, resolvedUserId, profile]);

  const loadWorks = useCallback(async () => {
    if (!resolvedUserId || !isUUID(resolvedUserId)) return;
    try {
      const { data } = await supabase
        .from('works')
        .select(`
          id,
          title,
          synopsis,
          author_id,
          created_at,
          cover_url
        `)
        .eq('status', 'published')
        .eq('author_id', resolvedUserId)
        .order('created_at', { ascending: false })
        .limit(50);
      const normalized = (data || []).map((row: any) => ({
        ...row,
        profiles: normalizeProfileName(profile),
      }));
      setWorks(normalized);
    } catch (e: any) {
      // ignorar abortos/failed to fetch en dev
    }
  }, [supabase, resolvedUserId, profile]);

  const loadChaptersIndependent = useCallback(async () => {
    if (!resolvedUserId || !isUUID(resolvedUserId)) return;
    try {
      // Consulta directa mínima a chapters (independientes y publicados), sin joins
      const { data, error } = await supabase
        .from('chapters')
        .select('id, title, author_id, created_at, cover_url, slug')
        .eq('author_id', resolvedUserId)
        .eq('status', 'published')
        .eq('is_independent', true)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) {
        return; // Silenciar errores de cliente
      }

      const normalized = (data || []).map((row: any) => ({
        ...row,
        profiles: normalizeProfileName(profile),
      }));
      setChapters(normalized);
    } catch (e: any) {
      // ignorar abortos/failed to fetch en dev
    }
  }, [supabase, resolvedUserId, profile]);

  const loadWorksByChapters = useCallback(async () => {
    if (!resolvedUserId || !isUUID(resolvedUserId)) {
      setWorksByChapters([]);
      setChaptersByWork({});
      return;
    }
    // Obtener IDs de obras con capítulos del autor
    try {
      const { data: ch } = await supabase
        .from('chapters')
        .select('work_id, author_id, is_independent')
        .eq('author_id', resolvedUserId)
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
          cover_url
        `)
        .eq('status', 'published')
        .in('id', workIds)
        .order('created_at', { ascending: false })
        .limit(100);
      const normalized = (data || []).map((row: any) => ({
        ...row,
        profiles: normalizeProfileName(profile),
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
    } catch (e: any) {
      // ignorar abortos/failed to fetch en dev
    }
  }, [supabase, resolvedUserId]);

  const openChapterFile = useCallback(async (filePath?: string, slug?: string, fileType?: string, title?: string) => {
    // Declarar variables fuera del try para mantener el alcance
    let effectivePath = filePath;
    let effectiveType = fileType;
    let effectiveTitle = title;
    let resolvedSlug = slug;

    try {
      // Resolver filePath desde el slug si no viene
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

      // Intentar resolver slug desde file_url
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
          await logPdfView({ contentType: 'chapter', contentSlug: resolvedSlug || null, urlOrPath: norm.path || effectivePath });
          setIsPDFViewerOpen(true);
          return;
        } catch {
          // Fallback sin URL firmada
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
          setCurrentTitle(effectiveTitle || 'Capítulo');
          await logPdfView({ contentType: 'chapter', contentSlug: resolvedSlug || null, urlOrPath: effectivePath });
          return;
        }
      }

      // No es PDF
      window.open(effectivePath, '_blank');
      return;
    } catch {
      // Fallback: redirigir por slug
      window.location.href = (filePath || `/chapters/${resolvedSlug || slug || ''}`);
    }
  }, [supabase]);

  // Primero resolvemos el perfil por id o username
  useEffect(() => {
    let active = true;
    (async () => {
      await loadProfile();
    })();
    return () => { active = false; };
  }, [loadProfile]);

  // Cuando el id esté resuelto, cargamos el contenido del autor
  useEffect(() => {
    let active = true;
    (async () => {
      // Esperar a tener un UUID válido antes de cargar contenido
      if (!resolvedUserId || !isUUID(resolvedUserId)) { if (active) setLoading(false); return; }
      setLoading(true);
      await Promise.all([
        loadPosts(),
        loadWorks(),
        loadWorksByChapters(),
        loadChaptersIndependent(),
      ]);
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [resolvedUserId, loadPosts, loadWorks, loadWorksByChapters, loadChaptersIndependent]);

  const displayName = (() => {
    // Preferir nombre del perfil; si no existe, usar el de contenido cargado
    const fallbackName =
      posts[0]?.profiles?.display_name ||
      works[0]?.profiles?.display_name ||
      worksByChapters[0]?.profiles?.display_name ||
      chapters[0]?.profiles?.display_name ||
      '';
    const raw = (profile?.display_name || fallbackName || '').trim();
    if (!raw) return 'Autor';
    const base = raw.includes('@') ? raw.split('@')[0] : raw;
    const cleaned = base.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim();
    return cleaned
      .split(' ')
      .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
      .join(' ') || 'Autor';
  })();

  const avatarSrc = (() => {
    const fallbackAvatar = posts[0]?.profiles?.avatar_url || null;
    const src = profile?.avatar_url || fallbackAvatar || null;
    if (!src) return null;
    return src.includes('googleusercontent.com')
      ? `/api/avatar?u=${encodeURIComponent(src)}`
      : src;
  })();

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
              {/* Botón seguir eliminado en esta página */}
            </div>
          </div>

        {/* Contenido */}
        {loading ? (
          <div className="text-gray-600 dark:text-gray-400">Cargando publicaciones...</div>
        ) : (!resolvedUserId || !isUUID(resolvedUserId)) ? (
          <div className="text-gray-600 dark:text-gray-400">Autor no encontrado.</div>
        ) : (
          <div className="space-y-10">
            {/* Posts del autor */}
            <PostsCarousel 
              posts={posts} 
              title={`Posts de ${displayName}`} 
              description="Artículos y publicaciones"
              className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200/60"
            />

            {/* Obras completas (sin capítulos) como en Library */}
            {(() => {
              const workIdsWithChapters = new Set(worksByChapters.map(w => w.id));
              const independentWorks = works.filter(w => !workIdsWithChapters.has(w.id));
              return (
                <WorksCarousel 
                  works={independentWorks} 
                  title={`Obras Completas`}
                  description={`Libros y obras completas de ${displayName}`}
                  className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200/60"
                />
              );
            })()}

            {/* Obras por capítulos con listado de capítulos debajo, igual que Library */}
            <WorksCarousel 
              works={worksByChapters} 
              title={`Obras por capítulos`}
              description={`Obras seriadas publicadas por ${displayName}`}
              className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200/60"
              renderItemFooter={(w) => {
                const relatedChapters = (chaptersByWork[w.id] || []) as Array<{ id: string; title: string; chapter_number: number; slug?: string }>; 
                if (!relatedChapters.length) return null;
                return (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-slate-200 bg-white/60 p-3">
                      <h4 className="text-sm font-medium text-slate-800 mb-2">Capítulos publicados</h4>
                      <ul className="space-y-1">
                        {relatedChapters.map((c) => (
                          <li key={c.id} className="flex items-center justify-between">
                            <span className="text-sm text-slate-700">{c.title}</span>
                            {c.slug && (
                              <a href={`/chapters/${c.slug}`} className="text-xs text-indigo-700 hover:underline">
                                Abrir
                              </a>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              }}
            />

            {/* Capítulos independientes del autor */}
            <ChaptersCarousel 
              chapters={chapters} 
              title={`Capítulos independientes`} 
              description={`Relatos y capítulos sueltos de ${displayName}`}
              className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200/60"
            />
          </div>
        )}
          {isPDFViewerOpen && pdfUrl && (
            <PDFViewer
              fileUrl={pdfUrl}
              fileName={currentTitle || 'Documento PDF'}
              authorName={displayName}
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