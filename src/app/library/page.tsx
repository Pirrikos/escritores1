'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import PostsCarousel from '@/components/ui/PostsCarousel';
import WorksCarousel from '@/components/ui/WorksCarousel';
import ChaptersCarousel from '@/components/ui/ChaptersCarousel';
import CoverRenderer, { type TemplateId, type PaletteId } from '@/components/ui/CoverRenderer';
import { AppHeader, Modal, ModalHeader, ModalBody, ModalFooter, Input, Textarea, Button, Icon, Icons } from '@/components/ui';

// Normalizadores para valores permitidos en CoverRenderer
function normalizeTemplateId(val: string): TemplateId {
  const valid = ['template-1','template-2','template-3','template-4','template-5','template-6','template-7','template-8'] as const;
  return (valid as readonly string[]).includes(val) ? (val as TemplateId) : 'template-1';
}

function normalizePaletteId(val: string): PaletteId {
  const valid = ['marino','rojo','negro','verde','purpura'] as const;
  return (valid as readonly string[]).includes(val) ? (val as PaletteId) : 'marino';
}

interface Post {
  id: string;
  title: string;
  content?: string;
  author_id: string;
  created_at: string;
  published_at?: string;
  status?: 'draft' | 'published';
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
  slug?: string;
  status?: 'draft' | 'published';
  profiles: {
    display_name: string;
  };
}

interface Chapter {
  id: string;
  title: string;
  author_id: string;
  created_at: string;
  published_at?: string;
  cover_url?: string;
  slug?: string;
  status?: 'draft' | 'published';
  work_id?: string | null;
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
  const [deletingIds, setDeletingIds] = useState<Record<string, boolean>>({});
  const [publishingIds, setPublishingIds] = useState<Record<string, boolean>>({});
  const [editTarget, setEditTarget] = useState<null | { type: 'work' | 'chapter'; id: string }>(null);
  const [editForm, setEditForm] = useState<{ title: string; synopsis?: string; cover_url?: string }>({ title: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [coverSettings, setCoverSettings] = useState<{ mode: 'template' | 'url'; templateId: TemplateId; paletteId: PaletteId; authorName: string }>({ mode: 'template', templateId: 'template-1', paletteId: 'marino', authorName: 'Autor' });

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
          status,
          profiles!posts_author_id_fkey (
            display_name
          )
        `)
        .in('status', ['draft', 'published'])
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
          slug,
          status,
          profiles!works_author_id_fkey (
            display_name
          )
        `)
        .in('status', ['draft', 'published'])
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
          published_at,
          slug,
          cover_url,
          status,
          work_id,
          profiles!chapters_author_id_fkey (
            display_name
          )
        `)
        .in('status', ['draft', 'published'])
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

  // Limpieza automática de archivos huérfanos en Storage al iniciar sesión
  useEffect(() => {
    if (!session?.user?.id) return;
    // Ejecutar en background; no bloquear la UI
    fetch('/api/storage/clean-orphans', { method: 'POST' }).catch(() => {});
  }, [session?.user?.id]);

  // Publicados vs borradores y acción de publicar
  const publishedPosts = posts.filter((p) => p.status === 'published');
  const draftPosts = posts.filter((p) => p.status !== 'published');
  const publishedWorks = works.filter((w) => w.status === 'published');
  const draftWorks = works.filter((w) => w.status !== 'published');
  const publishedChapters = chapters.filter((c) => c.status === 'published');
  const draftChapters = chapters.filter((c) => c.status !== 'published');

  // IDs de obras que tienen capítulos (del usuario)
  const workIdsWithChapters = new Set(
    chapters
      .map((c) => c.work_id)
      .filter((id): id is string => !!id)
  );
  const publishedSerialWorks = publishedWorks.filter((w) => workIdsWithChapters.has(w.id));
  const draftSerialWorks = draftWorks.filter((w) => workIdsWithChapters.has(w.id));
  const independentPublishedWorks = publishedWorks.filter((w) => !workIdsWithChapters.has(w.id));
  const independentPublishedChapters = publishedChapters.filter((c) => !c.work_id);

  const publishItem = async (type: 'posts' | 'works' | 'chapters', id: string) => {
    setPublishingIds((prev) => ({ ...prev, [`${type}:${id}`]: true }));
    const payload: any = { status: 'published' };
    if (type !== 'works') {
      payload.published_at = new Date().toISOString();
    }
    const { data: updatedRows, error } = await supabase
      .from(type)
      .update(payload)
      .eq('id', id)
      .eq('author_id', session?.user?.id)
      .select('id, status, published_at');
    if (error) {
      console.error('Error publicando', type, error);
      setPublishingIds((prev) => ({ ...prev, [`${type}:${id}`]: false }));
      return;
    }
    if (!updatedRows || (Array.isArray(updatedRows) && updatedRows.length === 0)) {
      // Aviso si no se afectó ninguna fila (sesión/autor no coincide)
      window.alert('No se pudo publicar: verifica tu sesión o permisos.');
      setPublishingIds((prev) => ({ ...prev, [`${type}:${id}`]: false }));
      return;
    }
    const updatedRow = Array.isArray(updatedRows) ? updatedRows[0] : updatedRows;
    // Actualizar arrays locales sin recargar
    if (type === 'posts') {
      const updated: Post[] = posts.map((p): Post => (
        p.id === id
          ? { ...p, status: 'published', published_at: (updatedRow as any)?.published_at || new Date().toISOString() }
          : p
      ));
      setPosts(updated);
    } else if (type === 'works') {
      const updated: Work[] = works.map((w): Work => (
        w.id === id
          ? { ...w, status: 'published' }
          : w
      ));
      setWorks(updated);
    } else {
      const updated: Chapter[] = chapters.map((c): Chapter => (
        c.id === id
          ? { ...c, status: 'published', published_at: (updatedRow as any)?.published_at || new Date().toISOString() }
          : c
      ));
      setChapters(updated);
    }
    setPublishingIds((prev) => ({ ...prev, [`${type}:${id}`]: false }));
  };

  const openEditWork = (w: Work) => {
    setEditTarget({ type: 'work', id: w.id });
    setEditForm({ title: w.title || '', synopsis: w.synopsis || '', cover_url: w.cover_url || '' });
    const authorName = w.profiles?.display_name || 'Autor';
    if (w.cover_url && w.cover_url.startsWith('preview:')) {
      const parts = w.cover_url.split(':');
      const templateId = normalizeTemplateId(parts[1] || 'template-1');
      const paletteId = normalizePaletteId(parts[2] || 'marino');
      setCoverSettings({ mode: 'template', templateId, paletteId, authorName });
    } else {
      setCoverSettings({ mode: 'url', templateId: 'template-1', paletteId: 'marino', authorName });
    }
  };

  const openEditChapter = (c: Chapter) => {
    setEditTarget({ type: 'chapter', id: c.id });
    setEditForm({ title: c.title || '', cover_url: c.cover_url || '' });
    const authorName = c.profiles?.display_name || 'Autor';
    if (c.cover_url && c.cover_url.startsWith('preview:')) {
      const parts = c.cover_url.split(':');
      const templateId = normalizeTemplateId(parts[1] || 'template-1');
      const paletteId = normalizePaletteId(parts[2] || 'marino');
      setCoverSettings({ mode: 'template', templateId, paletteId, authorName });
    } else {
      setCoverSettings({ mode: 'url', templateId: 'template-1', paletteId: 'marino', authorName });
    }
  };

  const saveEdit = async () => {
    if (!editTarget || !session?.user?.id) return;
    setSavingEdit(true);
    try {
      if (editTarget.type === 'work') {
        // Resolver cover_url según el modo seleccionado
        const current = works.find(w => w.id === editTarget.id);
        let newCoverUrl = (editForm.cover_url ?? '').trim();
        if (coverSettings.mode === 'template') {
          const titleToUse = (editForm.title || current?.title || '').trim();
          const author = coverSettings.authorName || current?.profiles?.display_name || 'Autor';
          newCoverUrl = `preview:${coverSettings.templateId}:${coverSettings.paletteId}:${encodeURIComponent(titleToUse)}:${encodeURIComponent(author)}`;
        } else {
          // modo URL: usar la caja de texto
          const cur = current?.cover_url;
          newCoverUrl = newCoverUrl || cur || '';
        }
        const payload: any = { 
          title: (editForm.title || '').trim(), 
          synopsis: (editForm.synopsis || '').trim(),
          cover_url: newCoverUrl || null,
        };
        const { error } = await supabase
          .from('works')
          .update(payload)
          .eq('id', editTarget.id)
          .eq('author_id', session.user.id);
        if (error) throw error;
        await loadWorks(session.user.id);
      } else {
        // Capítulo: permitir actualización de title y cover_url con el mismo selector
        const current = chapters.find(c => c.id === editTarget.id);
        let newCoverUrl = (editForm.cover_url ?? '').trim();
        if (coverSettings.mode === 'template') {
          const titleToUse = (editForm.title || current?.title || '').trim();
          const author = coverSettings.authorName || current?.profiles?.display_name || 'Autor';
          newCoverUrl = `preview:${coverSettings.templateId}:${coverSettings.paletteId}:${encodeURIComponent(titleToUse)}:${encodeURIComponent(author)}`;
        } else {
          const cur = current?.cover_url;
          newCoverUrl = newCoverUrl || cur || '';
        }
        const payload: any = {
          title: (editForm.title || '').trim(),
          cover_url: newCoverUrl || null,
        };
        const { error } = await supabase
          .from('chapters')
          .update(payload)
          .eq('id', editTarget.id)
          .eq('author_id', session.user.id);
        if (error) throw error;
        await loadChapters(session.user.id);
      }
      setEditTarget(null);
    } catch (err) {
      console.error('Error guardando edición:', err);
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteItem = async (type: 'posts' | 'works' | 'chapters', id: string) => {
    const labels: Record<typeof type, string> = {
      posts: 'post',
      works: 'obra',
      chapters: 'capítulo',
    } as const;
    const confirmed = window.confirm(`¿Seguro que quieres borrar este ${labels[type]}? Esta acción no se puede deshacer.`);
    if (!confirmed) return;
    setDeletingIds((prev) => ({ ...prev, [`${type}:${id}`]: true }));
    
    // Recoger rutas de archivos para limpieza de Storage antes de borrar en DB
    const extractRel = (bucket: 'works' | 'chapters', filePath?: string | null) => {
      if (!filePath) return null;
      const fp = String(filePath);
      if (fp.startsWith('http')) return null; // URL externa
      if (fp.startsWith('preview:')) return null; // portada generada sin archivo
      if (fp.startsWith(`${bucket}/`)) return fp.substring(`${bucket}/`.length);
      return fp;
    };

    let workFiles: string[] = [];
    let chapterFiles: string[] = [];
    try {
      if (type === 'works') {
        const { data: workData } = await supabase
          .from('works')
          .select('file_url, cover_url')
          .eq('id', id)
          .limit(1)
          .maybeSingle();
        if (workData) {
          const wf = [
            extractRel('works', (workData as any).file_url),
            extractRel('works', (workData as any).cover_url),
          ].filter(Boolean) as string[];
          workFiles.push(...wf);
        }
        const { data: chData } = await supabase
          .from('chapters')
          .select('file_url, cover_url')
          .eq('work_id', id);
        if (Array.isArray(chData)) {
          for (const ch of chData) {
            const cf = [
              extractRel('chapters', (ch as any).file_url),
              extractRel('chapters', (ch as any).cover_url),
            ].filter(Boolean) as string[];
            chapterFiles.push(...cf);
          }
        }
      } else if (type === 'chapters') {
        const { data: ch } = await supabase
          .from('chapters')
          .select('file_url, cover_url')
          .eq('id', id)
          .limit(1)
          .maybeSingle();
        if (ch) {
          const cf = [
            extractRel('chapters', (ch as any).file_url),
            extractRel('chapters', (ch as any).cover_url),
          ].filter(Boolean) as string[];
          chapterFiles.push(...cf);
        }
      }
    } catch (e) {
      console.warn('No se pudieron preparar rutas de archivos para limpieza:', e);
    }

    const { error } = await supabase
      .from(type)
      .delete()
      .eq('id', id)
      .eq('author_id', session?.user?.id);
    if (error) {
      console.error('Error borrando', type, error);
      return;
    }

    // Limpieza de archivos en Storage (best-effort)
    try {
      if (workFiles.length > 0) {
        const { error: rmWErr } = await supabase.storage.from('works').remove(workFiles);
        if (rmWErr) console.warn('No se pudieron borrar archivos de works:', rmWErr.message);
      }
      if (chapterFiles.length > 0) {
        const { error: rmCErr } = await supabase.storage.from('chapters').remove(chapterFiles);
        if (rmCErr) console.warn('No se pudieron borrar archivos de chapters:', rmCErr.message);
      }
    } catch (e) {
      console.warn('Error durante limpieza de Storage:', e);
    }

    if (type === 'posts') {
      setPosts((prev) => prev.filter((p) => p.id !== id));
    } else if (type === 'works') {
      // Al borrar obras, capítulos asociados con work_id se borran en cascada (DB)
      setWorks((prev) => prev.filter((w) => w.id !== id));
      // Refrescar capítulos desde la DB para reflejar el borrado en cascada
      if (session?.user?.id) {
        try { await loadChapters(session.user.id); } catch {}
      }
    } else {
      setChapters((prev) => prev.filter((c) => c.id !== id));
    }
    setDeletingIds((prev) => ({ ...prev, [`${type}:${id}`]: false }));
  };

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
              posts={publishedPosts}
              title="Mis posts"
              description="Tus publicaciones recientes"
              className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200/60"
              renderItemFooter={(p) => (
                <div className="flex items-center justify-center">
                  <button
                    className="inline-flex items-center gap-2 rounded-md bg-red-600 text-white px-3 py-2 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
                    onClick={(e) => { e.stopPropagation(); deleteItem('posts', p.id); }}
                    disabled={!!deletingIds[`posts:${p.id}`]}
                    aria-label="Eliminar post"
                  >
                    {deletingIds[`posts:${p.id}`] ? 'Eliminando…' : 'Eliminar'}
                  </button>
                </div>
              )}
            />

            {/* Botón de borrar ya está debajo de cada tarjeta; se elimina la sección aparte */}

            {draftPosts.length > 0 && (
              <PostsCarousel 
                posts={draftPosts}
                title="Borradores de posts"
                description="Publica tus borradores cuando estén listos"
                className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200/60"
                renderItemFooter={(p) => (
                  <div className="flex items-center justify-center gap-2">
                    <button
                      className="inline-flex items-center gap-2 rounded-md bg-indigo-600 text-white px-3 py-2 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
                      onClick={(e) => { e.stopPropagation(); publishItem('posts', p.id); }}
                      disabled={!!publishingIds[`posts:${p.id}`]}
                      aria-label="Publicar post"
                    >
                      {publishingIds[`posts:${p.id}`] ? 'Publicando…' : 'Publicar'}
                    </button>
                    <button
                      className="inline-flex items-center gap-2 rounded-md bg-red-600 text-white px-3 py-2 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
                      onClick={(e) => { e.stopPropagation(); deleteItem('posts', p.id); }}
                      disabled={!!deletingIds[`posts:${p.id}`]}
                      aria-label="Eliminar post"
                    >
                      {deletingIds[`posts:${p.id}`] ? 'Eliminando…' : 'Eliminar'}
                    </button>
                  </div>
                )}
              />
            )}

            {/* Sección: Obras independientes (obras completas) */}
            <WorksCarousel 
              works={independentPublishedWorks}
              title="Obras independientes"
              description="Tus libros y obras completas"
              className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200/60"
              renderItemFooter={(w) => (
                <div className="flex items-center justify-center gap-2">
                  <button
                    className="inline-flex items-center gap-2 rounded-md bg-slate-600 text-white px-3 py-2 hover:bg-slate-700"
                    onClick={(e) => { e.stopPropagation(); openEditWork(w); }}
                    aria-label="Editar obra"
                  >
                    Editar
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-md bg-red-600 text-white px-3 py-2 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
                    onClick={(e) => { e.stopPropagation(); deleteItem('works', w.id); }}
                    disabled={!!deletingIds[`works:${w.id}`]}
                    aria-label="Eliminar obra"
                  >
                    {deletingIds[`works:${w.id}`] ? 'Eliminando…' : 'Eliminar'}
                  </button>
                </div>
              )}
            />

            {/* Se elimina la sección de administración separada para obras publicadas */}

            {draftSerialWorks.length > 0 && (
              <WorksCarousel 
                works={draftSerialWorks}
                title="Borradores de obras por capítulos"
                description="Publica tus obras seriadas cuando estén listas"
                className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200/60"
                renderItemFooter={(w) => (
                  <div className="flex items-center justify-center gap-2">
                    <button
                      className="inline-flex items-center gap-2 rounded-md bg-slate-600 text-white px-3 py-2 hover:bg-slate-700"
                      onClick={(e) => { e.stopPropagation(); openEditWork(w); }}
                      aria-label="Editar obra"
                    >
                      Editar
                    </button>
                    <button
                      className="inline-flex items-center gap-2 rounded-md bg-indigo-600 text-white px-3 py-2 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
                      onClick={(e) => { e.stopPropagation(); publishItem('works', w.id); }}
                      disabled={!!publishingIds[`works:${w.id}`]}
                      aria-label="Publicar obra"
                    >
                      {publishingIds[`works:${w.id}`] ? 'Publicando…' : 'Publicar'}
                    </button>
                    <button
                      className="inline-flex items-center gap-2 rounded-md bg-red-600 text-white px-3 py-2 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
                      onClick={(e) => { e.stopPropagation(); deleteItem('works', w.id); }}
                      disabled={!!deletingIds[`works:${w.id}`]}
                      aria-label="Eliminar obra"
                    >
                      {deletingIds[`works:${w.id}`] ? 'Eliminando…' : 'Eliminar'}
                    </button>
                  </div>
                )}
              />
            )}

            {publishedSerialWorks.length > 0 && (
              <WorksCarousel 
                works={publishedSerialWorks}
                title="Obras por capítulos"
                description="Tus obras seriadas publicadas con capítulos"
                className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200/60"
                renderItemFooter={(w) => {
                  const relatedChapters = publishedChapters.filter((c) => c.work_id === w.id);
                  return (
                    <div className="space-y-3">
                      {relatedChapters.length > 0 && (
                        <div className="rounded-lg border border-slate-200 bg-white/60 p-3">
                          <h4 className="text-sm font-medium text-slate-800 mb-2">Capítulos publicados</h4>
                          <ul className="space-y-1">
                            {relatedChapters.map((c) => (
                              <li key={c.id} className="flex items-center justify-between">
                                <span className="text-sm text-slate-700">{c.title}</span>
                                <div className="flex items-center gap-2">
                                  {c.slug && (
                                    <Link href={`/chapters/${c.slug}`} className="text-xs text-indigo-700 hover:underline">
                                      Abrir
                                    </Link>
                                  )}
                                  <button
                                    className="text-xs rounded-md bg-slate-600 text-white px-2 py-1 hover:bg-slate-700"
                                    onClick={(e) => { e.stopPropagation(); openEditChapter(c as any); }}
                                    aria-label="Editar capítulo"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    className="text-xs rounded-md bg-red-600 text-white px-2 py-1 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
                                    onClick={(e) => { e.stopPropagation(); deleteItem('chapters', c.id); }}
                                    disabled={!!deletingIds[`chapters:${c.id}`]}
                                    aria-label="Eliminar capítulo"
                                  >
                                    {deletingIds[`chapters:${c.id}`] ? 'Eliminando…' : 'Eliminar'}
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className="flex items-center justify-center gap-2">
                        <button
                          className="inline-flex items-center gap-2 rounded-md bg-slate-600 text-white px-3 py-2 hover:bg-slate-700"
                          onClick={(e) => { e.stopPropagation(); openEditWork(w); }}
                          aria-label="Editar obra"
                        >
                          Editar
                        </button>
                        <button
                          className="inline-flex items-center gap-2 rounded-md bg-red-600 text-white px-3 py-2 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
                          onClick={(e) => { e.stopPropagation(); deleteItem('works', w.id); }}
                          disabled={!!deletingIds[`works:${w.id}`]}
                          aria-label="Eliminar obra"
                        >
                          {deletingIds[`works:${w.id}`] ? 'Eliminando…' : 'Eliminar'}
                        </button>
                      </div>
                    </div>
                  );
                }}
              />
            )}

            {/* Sección: Capítulos independientes */}
            <ChaptersCarousel 
              chapters={independentPublishedChapters}
              title="Capítulos independientes"
              description="Tus historias cortas y capítulos independientes publicados"
              className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200/60"
              renderItemFooter={(c) => (
                <div className="flex items-center justify-center gap-2">
                  <button
                    className="inline-flex items-center gap-2 rounded-md bg-slate-600 text-white px-3 py-2 hover:bg-slate-700"
                    onClick={(e) => { e.stopPropagation(); openEditChapter(c as any); }}
                    aria-label="Editar capítulo"
                  >
                    Editar
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-md bg-red-600 text-white px-3 py-2 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
                    onClick={(e) => { e.stopPropagation(); deleteItem('chapters', c.id); }}
                    disabled={!!deletingIds[`chapters:${c.id}`]}
                    aria-label="Eliminar capítulo"
                  >
                    {deletingIds[`chapters:${c.id}`] ? 'Eliminando…' : 'Eliminar'}
                  </button>
                </div>
              )}
            />

            {/* Se elimina la sección de administración separada para capítulos publicados */}

            {draftChapters.length > 0 && (
              <ChaptersCarousel 
                chapters={draftChapters}
                title="Borradores de capítulos"
                description="Publica tus capítulos cuando estén listos"
                className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200/60"
                renderItemFooter={(c) => (
                  <div className="flex items-center justify-center gap-2">
                    <button
                      className="inline-flex items-center gap-2 rounded-md bg-slate-600 text-white px-3 py-2 hover:bg-slate-700"
                      onClick={(e) => { e.stopPropagation(); openEditChapter(c as any); }}
                      aria-label="Editar capítulo"
                    >
                      Editar
                    </button>
                    <button
                      className="inline-flex items-center gap-2 rounded-md bg-indigo-600 text-white px-3 py-2 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
                      onClick={(e) => { e.stopPropagation(); publishItem('chapters', c.id); }}
                      disabled={!!publishingIds[`chapters:${c.id}`]}
                      aria-label="Publicar capítulo"
                    >
                      {publishingIds[`chapters:${c.id}`] ? 'Publicando…' : 'Publicar'}
                    </button>
                    <button
                      className="inline-flex items-center gap-2 rounded-md bg-red-600 text-white px-3 py-2 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
                      onClick={(e) => { e.stopPropagation(); deleteItem('chapters', c.id); }}
                      disabled={!!deletingIds[`chapters:${c.id}`]}
                      aria-label="Eliminar capítulo"
                    >
                      {deletingIds[`chapters:${c.id}`] ? 'Eliminando…' : 'Eliminar'}
                    </button>
                  </div>
                )}
              />
            )}
          </div>
        )}

        {/* Modal de edición de obra/capítulo */}
        <Modal
          isOpen={!!editTarget}
          onClose={() => setEditTarget(null)}
          size="md"
          title={editTarget?.type === 'work' ? 'Editar obra' : editTarget?.type === 'chapter' ? 'Editar capítulo' : ''}
        >
          <ModalBody>
            <div className="space-y-4">
              <Input
                label="Título"
                value={editForm.title}
                onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
              />
              {editTarget?.type === 'work' && (
                <Textarea
                  label="Sinopsis"
                  value={editForm.synopsis || ''}
                  onChange={(e) => setEditForm((p) => ({ ...p, synopsis: e.target.value }))}
                  minRows={4}
                />
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded border">
                  <CoverRenderer
                    mode="template"
                    templateId={coverSettings.templateId}
                    title={editForm.title || 'Título'}
                    author={coverSettings.authorName}
                    paletteId={coverSettings.paletteId}
                    width={180}
                    height={270}
                    className="shadow-sm mx-auto"
                  />
                </div>
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-700">Tipo de portada</label>
                  <select
                    className="w-full px-3 py-2 border rounded-lg"
                    value={coverSettings.mode}
                    onChange={(e) => setCoverSettings((p) => ({ ...p, mode: e.target.value as any }))}
                  >
                    <option value="template">Plantilla</option>
                    <option value="url">URL de imagen</option>
                  </select>
                  {coverSettings.mode === 'template' ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700">Plantilla</label>
                        <select
                          className="w-full px-3 py-2 border rounded-lg"
                          value={coverSettings.templateId}
                          onChange={(e) => setCoverSettings((p) => ({ ...p, templateId: normalizeTemplateId(e.target.value) }))}
                        >
                          <option value="template-1">Franja Diagonal</option>
                          <option value="template-2">Bloques</option>
                          <option value="template-3">Tipografía</option>
                          <option value="template-4">Minimal</option>
                          <option value="template-5">Clásico</option>
                          <option value="template-6">Moderno</option>
                          <option value="template-7">Editorial</option>
                          <option value="template-8">Geometría</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700">Paleta</label>
                        <select
                          className="w-full px-3 py-2 border rounded-lg"
                          value={coverSettings.paletteId}
                          onChange={(e) => setCoverSettings((p) => ({ ...p, paletteId: normalizePaletteId(e.target.value) }))}
                        >
                          <option value="marino">Marino Clásico</option>
                          <option value="rojo">Rojo Profundo</option>
                          <option value="negro">Negro Elegante</option>
                          <option value="verde">Verde Esmeralda</option>
                          <option value="purpura">Púrpura Editorial</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700">Autor (para portada)</label>
                        <Input
                          value={coverSettings.authorName}
                          onChange={(e) => setCoverSettings((p) => ({ ...p, authorName: e.target.value }))}
                        />
                      </div>
                    </>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-slate-700">URL de imagen</label>
                      <Input
                        value={editForm.cover_url || ''}
                        onChange={(e) => setEditForm((p) => ({ ...p, cover_url: e.target.value }))}
                        placeholder="https://..."
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter align="right">
            <button
              className="inline-flex items-center gap-2 rounded-md bg-gray-100 text-gray-800 px-4 py-2 hover:bg-gray-200"
              onClick={() => setEditTarget(null)}
              disabled={savingEdit}
            >
              Cancelar
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 text-white px-4 py-2 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={saveEdit}
              disabled={savingEdit}
            >
              {savingEdit ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </ModalFooter>
        </Modal>

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