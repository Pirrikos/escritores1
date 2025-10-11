'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { generateSlug } from '@/lib/slugUtils';
import Image from 'next/image';
import CoverRenderer from '@/components/ui/CoverRenderer';
import { parsePreviewCover } from '@/lib/utils';

type ContentViewRow = {
  user_id: string;
  content_type: 'work' | 'chapter';
  content_slug: string;
  created_at: string;
};

type ProfileRow = { id: string; display_name: string | null };
type Profile = { id: string; display_name: string | null };
type WorkRow = { slug: string; title: string; cover_url?: string | null; profiles?: { display_name: string | null } | null };
type Work = { id: string; title: string; slug?: string | null; cover_url?: string | null; author_name?: string | null };

type FeedItem = {
  userName: string;
  targetTitle: string;
  href: string;
  createdAt: Date;
  coverUrl?: string | null;
  authorName?: string | null;
};

function timeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'hace un momento';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

export default function SocialNowFeed({ className = '' }: { className?: string }) {
  const supabase = useMemo(() => createClientComponentClient(), []);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadFeed() {
      try {
        setLoading(true);
        const sinceIso = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(); // últimas 3 horas
        
        // 1) Últimas vistas de PDF sobre obras y capítulos
        const { data: views, error: viewsErr } = await supabase
          .from('content_views')
          .select('user_id, content_type, content_slug, created_at')
          .gte('created_at', sinceIso)
          .order('created_at', { ascending: false })
          .limit(30);
        
        // Si la tabla no existe o hay error, hacer fallback a likes
        if (viewsErr) {
          console.warn('Fallo consultando content_views, aplicando fallback a likes:', viewsErr);
        }

        // Obtener usuario actual y filtrar su propia actividad
        const { data: { user: me } } = await supabase.auth.getUser();
        const allViewRows: ContentViewRow[] = Array.isArray(views) ? (views as ContentViewRow[]) : [];
        const viewRows: ContentViewRow[] = (allViewRows || []).filter(v => v.user_id && v.user_id !== me?.id);

        // 2) Quedarnos SOLO con obras y deduplicar por usuario (última obra vista)
        const workViewRows = (viewRows || []).filter(v => v.content_type === 'work');
        const latestWorkPerUser = new Map<string, ContentViewRow>();
        for (const v of workViewRows) {
          if (!latestWorkPerUser.has(v.user_id)) {
            latestWorkPerUser.set(v.user_id, v);
          }
        }
        const dedupRows = Array.from(latestWorkPerUser.values());

        // 3) Cargar perfiles de usuarios que vieron contenido
        if (!dedupRows || dedupRows.length === 0) {
          if (mounted) setItems([]);
          return;
        }
        const userIds = Array.from(new Set(dedupRows.map(v => v.user_id))).filter(Boolean);
        let profilesRows: ProfileRow[] = [];
        if (userIds.length > 0) {
          const { data: pr, error: profilesErr } = await supabase
            .from('profiles')
            .select('id, display_name')
            .in('id', userIds);
          if (profilesErr) throw profilesErr;
          profilesRows = (pr as ProfileRow[]) || [];
        }
        const profileMap = new Map<string, Profile>();
        (profilesRows || []).forEach((p) => profileMap.set(p.id, { id: p.id, display_name: p.display_name }));
        // 4) Cargar títulos por slug de obras
        const workSlugs = Array.from(new Set(dedupRows.map(v => v.content_slug)));
        const { data: works } = workSlugs.length > 0
          ? await supabase
              .from('works')
              .select('slug, title, cover_url, profiles:profiles!works_author_id_fkey(display_name)')
              .in('slug', workSlugs)
          : { data: [] as WorkRow[] };
        const workMap = new Map<string, Work>();
        (works as WorkRow[] || []).forEach((w) =>
          workMap.set(w.slug, {
            id: w.slug,
            title: w.title,
            slug: w.slug,
            cover_url: w.cover_url || null,
            author_name: w && w.profiles ? w.profiles.display_name : null,
          })
        );

        // 5) Construir items del feed (solo obras, última por usuario)
        const built: FeedItem[] = dedupRows.map(v => {
          const profile = profileMap.get(v.user_id);
          const userName = profile?.display_name || 'Alguien';
          let targetTitle = 'una obra';
          let href = '#';
          const w = workMap.get(v.content_slug);
          targetTitle = w?.title || 'una obra';
          const slug = w?.slug || (w?.title ? generateSlug(w.title) : undefined);
          href = slug ? `/works/${slug}` : '/works';
          return {
            userName,
            targetTitle,
            href,
            createdAt: new Date(v.created_at),
            coverUrl: w?.cover_url || null,
            authorName: w?.author_name || null,
          };
        });

        if (mounted) setItems(built);
      } catch {
        // Silenciar errores del Rincón social en consola
        if (mounted) setItems([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadFeed();
    const interval = setInterval(loadFeed, 10_000); // refresco cada 10s
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [supabase]);

  if (loading && items.length === 0) {
    return (
      <div className={`rounded-xl border border-slate-200 bg-white/70 p-4 ${className}`}>
        <div className="animate-pulse h-4 w-2/3 bg-slate-200 rounded" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={`rounded-xl border border-slate-200 bg-white/70 p-4 ${className}`}>
        <p className="text-sm text-slate-600">no hay actividad reciente</p>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-slate-200 bg-white/70 p-3 overflow-hidden ${className}`}
         aria-label="Rincón social: Lo que se está leyendo ahora">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-semibold text-slate-700">💬 Rincón social</span>
        <span className="text-xs text-slate-500">Lo que se está leyendo ahora</span>
      </div>

      {/* Banda inferior animada (scroll horizontal) */}
      <div className="flex gap-6 overflow-x-auto scrollbar-hide py-1"
           style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {items.map((it, idx) => {
          const meta = parsePreviewCover(it.coverUrl || undefined, it.targetTitle, it.authorName || 'Autor');
          return (
            <div key={idx} className="flex-shrink-0 flex items-center gap-3">
              <Link href={it.href} className="block">
                {meta.mode === 'image' ? (
                  <Image
                    src={meta.url}
                    alt={it.targetTitle}
                    width={80}
                    height={120}
                    className="rounded-md border border-slate-200 object-cover"
                  />
                ) : (
                  (() => {
                    if (meta.mode === 'template') {
                      const validTemplateIds = ['template-1','template-2','template-3','template-4','template-5','template-6','template-7','template-8'] as const;
                      const validPaletteIds = ['marino','rojo','negro','verde','purpura'] as const;
                      const safeTemplateId = (validTemplateIds as readonly string[]).includes(meta.templateId) ? meta.templateId as typeof validTemplateIds[number] : 'template-1';
                      const safePaletteId = (validPaletteIds as readonly string[]).includes(meta.paletteId) ? meta.paletteId as typeof validPaletteIds[number] : 'marino';
                      return (
                        <CoverRenderer
                          mode="template"
                          templateId={safeTemplateId}
                          paletteId={safePaletteId}
                          title={meta.title}
                          author={meta.author}
                          width={80}
                          height={120}
                          className="rounded-md border border-slate-200"
                        />
                      );
                    }
                    return (
                      <CoverRenderer
                        mode="auto"
                        title={it.targetTitle}
                        author={it.authorName || 'Autor'}
                        paletteId="marino"
                        width={80}
                        height={120}
                        className="rounded-md border border-slate-200"
                      />
                    );
                  })()
                )}
              </Link>
              <div className="min-w-[12rem]">
                <span className="text-sm text-slate-700">{it.userName} está leyendo </span>
                <Link href={it.href} className="text-sm font-semibold text-indigo-700 hover:text-indigo-800 hover:underline">
                  {it.targetTitle}
                </Link>
                <span className="text-xs text-slate-400 ml-2">hace {timeAgo(it.createdAt)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}