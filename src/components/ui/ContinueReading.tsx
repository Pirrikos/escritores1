"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Link from "next/link";
import { Icons, Icon } from "./Icon";
import { getSignedFileUrl } from "@/lib/fileUtils";

type ContentViewRow = {
  user_id: string;
  content_type: "work" | "chapter";
  content_slug: string;
  bucket: string | null;
  file_path: string | null;
  created_at: string;
};

type Work = { slug: string; title: string; file_url?: string | null };
type Chapter = { slug: string; title: string; file_url?: string | null };

type ReadingItem = {
  title: string;
  href: string; // fallback route
  bucket?: string | null;
  filePath?: string | null;
  createdAt: Date;
  progressPercent?: number | null; // optional when available
  initialPage?: number | null;
};

function timeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

export default function ContinueReading({ className = "" }: { className?: string }) {
  const supabase = useMemo(() => createClientComponentClient(), []);
  const [item, setItem] = useState<ReadingItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPDFViewerOpen, setIsPDFViewerOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [initialPage, setInitialPage] = useState<number | undefined>(undefined);

  // Importación dinámica del visor PDF para evitar problemas de SSR
  const PDFViewer = useMemo(() => dynamic(() => import("./PDFViewer"), {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center p-8">
        Cargando visor PDF...
      </div>
    ),
  }), []);

  useEffect(() => {
    let mounted = true;

    async function loadLastReading() {
      try {
        setLoading(true);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (mounted) {
            setItem(null);
            setLoading(false);
          }
          return;
        }

        // Tomar las últimas vistas del usuario y quedarnos con la más reciente
        const { data: views, error } = await supabase
          .from("content_views")
          .select("user_id, content_type, content_slug, bucket, file_path, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10);

        if (error) {
          console.warn("Fallo consultando content_views para lecturas en curso:", error);
          if (mounted) {
            setItem(null);
            setLoading(false);
          }
          return;
        }

        const rows = (views || []) as ContentViewRow[];
        if (rows.length === 0) {
          if (mounted) {
            setItem(null);
            setLoading(false);
          }
          return;
        }

        // Elegir la vista más reciente
        const latest = rows[0];

        // Cargar título por slug según tipo
        if (latest.content_type === "work") {
          const { data: works } = await supabase
            .from("works")
            .select("slug, title, file_url")
            .eq("slug", latest.content_slug)
            .limit(1);
          const w = (works || [])[0] as Work | undefined;
          if (!w) {
            if (mounted) {
              setItem(null);
              setLoading(false);
            }
            return;
          }
          let rp: { last_page?: number; num_pages?: number } | null = null;
          try {
            const { data: progress } = await supabase
              .from('reading_progress')
              .select('last_page, num_pages, updated_at')
              .eq('content_type', 'work')
              .eq('content_slug', w.slug)
              .order('updated_at', { ascending: false })
              .limit(1);
            rp = (progress || [])[0] || null;
          } catch {}
          // Fallback localStorage si no hay progreso en DB
          let lsLastPage: number | undefined;
          let lsNumPages: number | undefined;
          try {
            const key = `reading-progress:work:${w.slug}`;
            const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
            if (raw) {
              const obj = JSON.parse(raw);
              if (typeof obj?.last_page === 'number') lsLastPage = obj.last_page;
              if (typeof obj?.num_pages === 'number') lsNumPages = obj.num_pages;
            }
          } catch {}
          const reading: ReadingItem = {
            title: w.title,
            href: `/works/${w.slug}`,
            bucket: latest.bucket,
            filePath: latest.file_path || w.file_url || null,
            createdAt: new Date(latest.created_at),
            progressPercent: (rp?.last_page && rp?.num_pages)
              ? Math.round((rp.last_page / rp.num_pages) * 100)
              : (lsLastPage && lsNumPages ? Math.round((lsLastPage / lsNumPages) * 100) : null),
            initialPage: (rp?.last_page ?? lsLastPage) ?? null,
          };
          if (mounted) setItem(reading);
        } else {
          const { data: chapters } = await supabase
            .from("chapters")
            .select("slug, title, file_url")
            .eq("slug", latest.content_slug)
            .limit(1);
          const c = (chapters || [])[0] as Chapter | undefined;
          if (!c) {
            if (mounted) {
              setItem(null);
              setLoading(false);
            }
            return;
          }
          let rp: { last_page?: number; num_pages?: number } | null = null;
          try {
            const { data: progress } = await supabase
              .from('reading_progress')
              .select('last_page, num_pages, updated_at')
              .eq('content_type', 'chapter')
              .eq('content_slug', c.slug)
              .order('updated_at', { ascending: false })
              .limit(1);
            rp = (progress || [])[0] || null;
          } catch {}
          // Fallback localStorage si no hay progreso en DB
          let lsLastPage: number | undefined;
          let lsNumPages: number | undefined;
          try {
            const key = `reading-progress:chapter:${c.slug}`;
            const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
            if (raw) {
              const obj = JSON.parse(raw);
              if (typeof obj?.last_page === 'number') lsLastPage = obj.last_page;
              if (typeof obj?.num_pages === 'number') lsNumPages = obj.num_pages;
            }
          } catch {}
          const reading: ReadingItem = {
            title: c.title,
            href: `/chapters/${c.slug}`,
            bucket: latest.bucket,
            filePath: latest.file_path || c.file_url || null,
            createdAt: new Date(latest.created_at),
            progressPercent: (rp?.last_page && rp?.num_pages)
              ? Math.round((rp.last_page / rp.num_pages) * 100)
              : (lsLastPage && lsNumPages ? Math.round((lsLastPage / lsNumPages) * 100) : null),
            initialPage: (rp?.last_page ?? lsLastPage) ?? null,
          };
          if (mounted) setItem(reading);
        }
      } catch (err) {
        console.error("Error cargando Lecturas en curso:", err);
        if (mounted) setItem(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadLastReading();
    // Recarga periódica desactivada temporalmente
    return () => {
      mounted = false;
    };
  }, [supabase]);

  const handleContinueClick = async () => {
    if (!item) return;
    // Consultar SIEMPRE el progreso más reciente (BD y fallback localStorage)
    let ip: number | undefined = undefined;
    const isWork = item.href.startsWith('/works/');
    const slug = item.href.split('/').pop();
    try {
      const { data: progress } = await supabase
        .from('reading_progress')
        .select('last_page, num_pages, updated_at')
        .eq('content_type', isWork ? 'work' : 'chapter')
        .eq('content_slug', slug)
        .order('updated_at', { ascending: false })
        .limit(1);
      const rp = (progress || [])[0] || null;
      if (rp?.last_page && Number.isFinite(rp.last_page)) {
        ip = Math.max(1, rp.last_page);
      }
    } catch (e) {
      // ignorar fallo de consulta
    }
    // Fallback a localStorage si BD no tiene el último valor
    if (typeof ip !== 'number') {
      try {
        const type = isWork ? 'work' : 'chapter';
        const key = `reading-progress:${type}:${slug}`;
        const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
        if (raw) {
          const obj = JSON.parse(raw);
          if (typeof obj?.last_page === 'number') {
            ip = Math.max(1, obj.last_page);
          }
        }
      } catch {}
    }
    // Si no hay nada, usar el initialPage existente del item como último recurso
    if (typeof ip !== 'number' && typeof item.initialPage === 'number') {
      ip = Math.max(1, item.initialPage);
    }
    // Abrir dentro de la app con visor PDF integrado (preferido)
    if (item.filePath) {
      try {
        const signed = await getSignedFileUrl(item.filePath, 3600, item.bucket || undefined);
        const urlToUse = signed || item.filePath;
        if (urlToUse) {
          setPdfUrl(urlToUse);
          setInitialPage(ip);
          try { console.info('[ContinueReading] abrir visor', { initialPage: ip, url: urlToUse, slug: item.href.split('/').pop() }); } catch {}
          setIsPDFViewerOpen(true);
          return;
        }
      } catch (e) {
        console.warn("No se pudo firmar la URL, se usará la ruta por defecto.", e);
        if (item.filePath) {
          setPdfUrl(item.filePath);
          setInitialPage(ip);
          try { console.info('[ContinueReading] abrir visor (fallback sin firma)', { initialPage: ip, url: item.filePath }); } catch {}
          setIsPDFViewerOpen(true);
          return;
        }
      }
    }
    // Fallback: navegar a la página del contenido para continuar desde allí.
    window.location.href = item.href;
  };

  if (loading) {
    return (
      <div className={`rounded-2xl border border-slate-200 bg-white/70 p-4 ${className}`}>
        <div className="flex items-center gap-2">
          <Icon path={Icons.loader} size="sm" className="animate-spin text-slate-500" />
          <span className="text-sm text-slate-600">Cargando lecturas en curso…</span>
        </div>
      </div>
    );
  }

  if (!item) {
    return null; // No mostrar el bloque si no hay lecturas
  }

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white/70 p-4 ${className}`} aria-label="Lecturas en curso">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-semibold text-slate-700">📚 Sigue leyendo</span>
        <span className="text-xs text-slate-500">Engancha y mejora la retención</span>
      </div>

      <button
        onClick={handleContinueClick}
        className="group w-full text-left flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50"
      >
        <Icon path={Icons.play} size="sm" className="text-indigo-600 group-hover:text-indigo-700" />
        <span className="text-sm text-slate-700">
          Continuar <span className="font-semibold text-indigo-700 group-hover:underline">{item.title}</span>
        </span>
        <span className="ml-2 text-xs text-slate-400">· {timeAgo(item.createdAt)}</span>
        {typeof item.progressPercent === "number" && (
          <span className="ml-2 text-xs text-slate-500">· {item.progressPercent}% leído</span>
        )}
      </button>

      <div className="mt-2">
        <Link href={item.href} className="text-xs text-slate-500 hover:text-indigo-700 hover:underline">
          Ir a la obra/capítulo
        </Link>
      </div>

      {/* Visor PDF integrado */}
      {isPDFViewerOpen && pdfUrl && (
        <PDFViewer
          fileUrl={pdfUrl}
          fileName={item.title}
          onClose={() => setIsPDFViewerOpen(false)}
          initialPage={initialPage}
          onProgress={async (page, totalPages) => {
            try {
              const normalizedPath = (() => {
                const src = item.filePath || '';
                if (src && (src.startsWith('http://') || src.startsWith('https://'))) {
                  try {
                    const u = new URL(src);
                    const parts = u.pathname.split('/');
                    const signIdx = parts.findIndex(p => p === 'sign');
                    if (signIdx >= 0 && parts.length > signIdx + 2) {
                      const bkt = parts[signIdx + 1];
                      const rest = parts.slice(signIdx + 2).join('/');
                      return `${bkt}/${rest}`;
                    }
                  } catch {}
                }
                return src;
              })();

              await fetch('/api/activity/reading-progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  contentType: item.href.startsWith('/works/') ? 'work' : 'chapter',
                  contentSlug: item.href.split('/').pop(),
                  bucket: item.bucket,
                  filePath: normalizedPath,
                  lastPage: page,
                  numPages: totalPages,
                }),
              });
              // Guardar también en localStorage (fallback para usuarios sin sesión)
              try {
                const type = item.href.startsWith('/works/') ? 'work' : 'chapter';
                const slug = item.href.split('/').pop() || '';
                const key = `reading-progress:${type}:${slug}`;
                const payload = { last_page: page, num_pages: totalPages, updated_at: new Date().toISOString() };
                if (typeof window !== 'undefined') {
                  window.localStorage.setItem(key, JSON.stringify(payload));
                }
              } catch {}
            } catch (e) {
              // no-op
            }
          }}
        />
      )}
    </div>
  );
}