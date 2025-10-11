"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { AppHeader } from "@/components/ui";
import { generateSlug } from "@/lib/slugUtils";

export default function ActividadRecientePage() {
  const supabase = useMemo(() => createClientComponentClient(), []);
  const [items, setItems] = useState<Array<{
    id: string;
    when: string;
    userId: string;
    userName: string | null;
    username?: string | null;
    avatarUrl?: string | null;
    type: "work" | "chapter";
    slug: string;
    title: string | null;
    href: string;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const meId = auth.user?.id ?? null;

        const sinceIso = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        const { data: views, error: viewsErr } = await supabase
          .from("content_views")
          .select("user_id, content_type, content_slug, created_at")
          .gte("created_at", sinceIso)
          .order("created_at", { ascending: false })
          .limit(200);
        if (viewsErr) throw viewsErr;

        const filtered = (views ?? []).filter(v => v.user_id && v.user_id !== meId);
        // Agrupar: última lectura por usuario (cronológico descendente ya aplicado)
        const latestByUser = new Map<string, any>();
        for (const v of filtered) {
          if (!latestByUser.has(v.user_id)) {
            latestByUser.set(v.user_id, v);
          }
        }
        const latest = Array.from(latestByUser.values());
        const userIds = Array.from(new Set(filtered.map(v => v.user_id)));
        const workSlugs = Array.from(new Set(latest.filter(v => v.content_type === "work").map(v => v.content_slug)));
        const chapterSlugs = Array.from(new Set(latest.filter(v => v.content_type === "chapter").map(v => v.content_slug)));

        // Perfiles: intentar con 'username'; si la columna no existe, hacer fallback sin 'username'
        let profilesData: any[] = [];
        {
          const { data, error } = await supabase
            .from("profiles")
            .select("id, display_name, avatar_url, username")
            .in("id", userIds);
          if (error) {
            const { data: alt, error: err2 } = await supabase
              .from("profiles")
              .select("id, display_name, avatar_url")
              .in("id", userIds);
            if (err2) throw err2;
            profilesData = alt || [];
          } else {
            profilesData = data || [];
          }
        }

        const [worksRes, chaptersRes] = await Promise.all([
          workSlugs.length
            ? supabase.from("works").select("slug, title").in("slug", workSlugs)
            : Promise.resolve({ data: [], error: null }),
          chapterSlugs.length
            ? supabase.from("chapters").select("slug, title").in("slug", chapterSlugs)
            : Promise.resolve({ data: [], error: null }),
        ]);
        if (worksRes.error) throw worksRes.error;
        if (chaptersRes.error) throw chaptersRes.error;

        const profilesById = new Map<string, { display_name: string | null; avatar_url?: string | null; username?: string | null }>();
        (profilesData ?? []).forEach((p: any) => profilesById.set(p.id, { display_name: p.display_name ?? null, avatar_url: p.avatar_url ?? null, username: (p as any).username ?? null }));

        const workTitleBySlug = new Map<string, string | null>();
        (worksRes.data ?? []).forEach(w => workTitleBySlug.set(w.slug, w.title ?? null));

        const chapterTitleBySlug = new Map<string, string | null>();
        (chaptersRes.data ?? []).forEach(c => chapterTitleBySlug.set(c.slug, c.title ?? null));

        // Limite y orden: top N por fecha desc (ya desc). Dedupe implícito por usuario.
        const LIMIT = 20;
        const base = latest.slice(0, LIMIT);

        type ActivityItem = {
          id: string;
          when: string;
          userId: string;
          userName: string | null;
          username?: string | null;
          avatarUrl?: string | null;
          type: "work" | "chapter";
          slug: string;
          title: string | null;
          href: string;
        };

        const mapped: ActivityItem[] = base.map((v: any): ActivityItem => {
          const isWork = v.content_type === "work";
          const title = isWork
            ? workTitleBySlug.get(v.content_slug) ?? null
            : chapterTitleBySlug.get(v.content_slug) ?? null;
          const href = isWork ? `/works/${v.content_slug}` : `/chapters/${v.content_slug}`;
          const p = profilesById.get(v.user_id) || { display_name: null, avatar_url: null, username: null };
          return {
            id: `${v.user_id}:${v.content_type}:${v.content_slug}:${v.created_at}`,
            when: typeof v.created_at === "string" ? v.created_at : new Date(v.created_at).toISOString(),
            userId: String(v.user_id),
            userName: p.display_name ?? null,
            username: p.username ?? null,
            avatarUrl: p.avatar_url ?? null,
            type: (isWork ? "work" : "chapter") as "work" | "chapter",
            slug: String(v.content_slug),
            title,
            href,
          };
        });

        if (!cancelled) setItems(mapped);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Error cargando actividades");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 2 * 60 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [supabase]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <AppHeader className="mb-6" />
      <h1 className="text-2xl font-bold text-slate-800">Lo que otros están leyendo</h1>
      <p className="text-sm text-slate-600 mt-1">
        Lista en tiempo cercano de lecturas recientes (últimas 2 horas).
      </p>
      {loading && (
        <div className="text-slate-500 mt-4">Cargando actividad…</div>
      )}
      {error && (
        <div className="text-red-600 mt-4">{error}</div>
      )}
      {!loading && !error && items.length === 0 && (
        <div className="text-slate-500 mt-4">No hay actividad reciente.</div>
      )}
      <ul className="space-y-3 mt-4">
        {items.map(item => (
          <li key={item.id} className="border border-slate-200 rounded p-3">
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <Link href={`/usuario/${item.username || generateSlug(item.userName || '') || item.userId}`} className="shrink-0">
                <div className="w-9 h-9 relative">
                  {item.avatarUrl ? (
                    <img
                      src={item.avatarUrl.includes('googleusercontent.com') ? `/api/avatar?u=${encodeURIComponent(item.avatarUrl)}` : item.avatarUrl}
                      alt={`Avatar de ${item.userName ?? 'Usuario'}`}
                      className="w-9 h-9 rounded-full object-cover border border-slate-200"
                      onError={(e) => {
                        const el = e.currentTarget as HTMLImageElement;
                        el.style.display = 'none';
                        const next = el.nextElementSibling as HTMLElement | null;
                        if (next) next.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div
                    style={{ display: item.avatarUrl ? 'none' as const : 'flex' as const }}
                    className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full items-center justify-center border border-slate-200"
                  >
                    <span className="text-white text-sm font-semibold">
                      {(item.userName || 'U').charAt(0).toUpperCase()}
                    </span>
                  </div>
                </div>
              </Link>

              {/* Texto y badge */}
              <div className="min-w-0 flex-1">
                <div className="text-sm text-slate-700 truncate">
                  <Link href={`/usuario/${item.username || generateSlug(item.userName || '') || item.userId}`} className="font-medium hover:underline">
                    {formatDisplayName(item.userName)}
                  </Link>{' '}
                  está leyendo{' '}
                  <span className="inline-flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${item.type === 'work' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                      {item.type === 'work' ? 'obra' : 'capítulo'}
                    </span>
                    <Link href={item.href} className="text-blue-600 hover:underline">
                      {item.title ?? item.slug}
                    </Link>
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {formatRelativeTime(new Date(item.when))}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatDisplayName(raw: string | null | undefined): string {
  const base = (raw || '').trim();
  if (!base) return 'Usuario';
  const emailBase = base.includes('@') ? base.split('@')[0] : base;
  const cleaned = emailBase.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned
    .split(' ')
    .map(w => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
    .join(' ') || 'Usuario';
}

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `hace ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}