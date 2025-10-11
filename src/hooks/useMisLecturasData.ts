import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { getSignedFileUrl } from "@/lib/fileUtils";
import { logPdfView } from "@/lib/activityLogger";
import { useToast } from "@/contexts/ToastContext";
import { generateSlug } from "@/lib/slugUtils";
import type { MisLecturasItem, PublishedChapter, SerializedFallback } from "@/types/misLecturas";

export default function useMisLecturasData() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToast } = useToast();

  const [items, setItems] = useState<MisLecturasItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"obras" | "capitulos" | "obrasCapitulos">("obrasCapitulos");

  const [serializedBySlug, setSerializedBySlug] = useState<Record<string, SerializedFallback>>({});
  const [publishedChaptersByWorkSlug, setPublishedChaptersByWorkSlug] = useState<Record<string, PublishedChapter[]>>({});
  const [chapterProgressBySlug, setChapterProgressBySlug] = useState<Record<string, number | undefined>>({});
  const [deletedWorksBySlug, setDeletedWorksBySlug] = useState<Record<string, boolean>>({});
  const [deletedChaptersBySlug, setDeletedChaptersBySlug] = useState<Record<string, boolean>>({});

  const [isPDFViewerOpen, setIsPDFViewerOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [initialPage, setInitialPage] = useState<number | undefined>(undefined);
  const [currentTitle, setCurrentTitle] = useState<string>("");
  const [currentItem, setCurrentItem] = useState<MisLecturasItem | null>(null);

  // Normaliza un file_path para compararlo con chapters.file_url (sin prefijos de bucket/public)
  const normalizePathForMatch = (raw?: string | null): string | null => {
    const p = (raw || "").trim();
    if (!p) return null;
    const withoutLeadingSlash = p.replace(/^\/+/, "");
    const stripped = withoutLeadingSlash
      .replace(/^works\//, "")
      .replace(/^chapters\//, "")
      .replace(/^public\//, "");
    return stripped || null;
  };

  useEffect(() => {
    let mounted = true;
    async function loadRecent() {
      try {
        setLoading(true);
        setError(null);

        const resp = await fetch("/api/mis-lecturas", { credentials: "include", cache: "no-store" });
        if (!resp.ok) throw new Error("Fallo cargando lecturas");
        const json = await resp.json();
        const data = Array.isArray(json?.data) ? json.data : [];

        const mapped: MisLecturasItem[] = (data as any[]).map((it: any) => ({
          type: it.type,
          slug: it.slug,
          title: it.title,
          bucket: it.bucket ?? null,
          filePath: it.filePath ?? null,
          lastPage: typeof it.lastPage === "number" ? it.lastPage : undefined,
          numPages: typeof it.numPages === "number" ? it.numPages : undefined,
          updatedAt: new Date(it.updatedAt),
          coverUrl: it.coverUrl ?? null,
          authorName: it.authorName ?? "Autor Desconocido",
          progressRatio: typeof it.progressRatio === "number" ? it.progressRatio : undefined,
          parentWorkSlug: it.parentWorkSlug ?? null,
          hasSerializedChapters: !!it.hasSerializedChapters,
          hasPdf: !!it.hasPdf,
        }));

        // Añadir obras faltantes derivadas de capítulos (cuando solo hay capítulos guardados/vistos)
        try {
          const chapterParentSlugs = Array.from(new Set(
            mapped
              .filter(i => i.type === "chapter" && typeof i.parentWorkSlug === "string" && (i.parentWorkSlug as string))
              .map(i => i.parentWorkSlug as string)
          ));
          const existingWorkSlugs = new Set(mapped.filter(i => i.type === "work").map(i => i.slug));
          const missingWorkSlugs = chapterParentSlugs.filter(s => !existingWorkSlugs.has(s));
          if (missingWorkSlugs.length > 0) {
            const { data: wRows } = await supabase
              .from("works")
              .select(`slug, title, cover_url, profiles:works_author_id_fkey(display_name)`) // eslint-disable-line
              .in("slug", missingWorkSlugs)
              .limit(100);
            const bySlug: Record<string, any> = {};
            for (const w of (wRows || [])) {
              const slug = (w as any)?.slug as string;
              if (slug) bySlug[slug] = w;
            }
            const augmentedWorks: MisLecturasItem[] = missingWorkSlugs.map(slug => {
              const meta = bySlug[slug] || {};
              const relatedChapters = mapped.filter(i => i.type === "chapter" && (i.parentWorkSlug || "") === slug);
              const latestUpdatedAt = relatedChapters.length > 0
                ? new Date(Math.max(...relatedChapters.map(c => c.updatedAt.getTime())))
                : new Date();
              const title = (meta as any)?.title || slug;
              const author = ((meta as any)?.profiles && ((Array.isArray((meta as any).profiles) ? (meta as any).profiles[0] : (meta as any).profiles)?.display_name)) || "Autor Desconocido";
              const coverUrl = (meta as any)?.cover_url || null;
              return {
                type: "work",
                slug,
                title,
                bucket: null,
                filePath: null,
                lastPage: undefined,
                numPages: undefined,
                updatedAt: latestUpdatedAt,
                coverUrl,
                authorName: author,
                progressRatio: undefined,
                parentWorkSlug: null,
                hasSerializedChapters: true,
                hasPdf: undefined,
              } as MisLecturasItem;
            });
            mapped.push(...augmentedWorks);
          }
        } catch {}

        if (mounted) {
          setItems(mapped);
          setLoading(false);
        }
      } catch (e) {
        if (mounted) {
          setError("No se pudo cargar tus lecturas recientes");
          setLoading(false);
        }
      }
    }

    loadRecent();
    return () => { mounted = false; };
  }, [supabase]);

  // Detectar items borrados
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const workItems = items.filter(i => i.type === "work");
        const chapterItems = items.filter(i => i.type === "chapter");
        const workSlugs = Array.from(new Set(workItems.map(i => i.slug)));
        const workTitles = Array.from(new Set(workItems.map(i => i.title).filter(Boolean)));
        const chapterSlugs = Array.from(new Set(chapterItems.map(i => i.slug)));

        const deletedWorks: Record<string, boolean> = {};
        const deletedChapters: Record<string, boolean> = {};

        // Resolver obras existentes por slug y por título (con slug generado)
        const knownWorkSlugs = new Set<string>();
        if (workSlugs.length > 0) {
          const { data: wBySlug } = await supabase
            .from("works")
            .select("slug, title")
            .in("slug", workSlugs)
            .limit(workSlugs.length);
          for (const row of (wBySlug || [])) {
            const s = String((row as any).slug || "");
            const t = String((row as any).title || "");
            if (s) knownWorkSlugs.add(s);
            if (t) knownWorkSlugs.add(generateSlug(t));
          }
        }
        if (workTitles.length > 0) {
          const { data: wByTitle } = await supabase
            .from("works")
            .select("slug, title")
            .in("title", workTitles)
            .limit(workTitles.length);
          for (const row of (wByTitle || [])) {
            const s = String((row as any).slug || "");
            const t = String((row as any).title || "");
            if (s) knownWorkSlugs.add(s);
            if (t) knownWorkSlugs.add(generateSlug(t));
          }
        }
        for (const s of workSlugs) {
          deletedWorks[s] = !knownWorkSlugs.has(s);
        }

        // Resolver capítulos existentes por slug directamente
        if (chapterSlugs.length > 0) {
          const { data: cRows } = await supabase
            .from("chapters")
            .select("slug")
            .in("slug", chapterSlugs)
            .limit(chapterSlugs.length);
          const foundChSlugs = new Set((cRows || []).map((c: any) => String(c.slug || "")));
          for (const s of chapterSlugs) {
            deletedChapters[s] = !foundChSlugs.has(s);
          }
        }

        if (!cancelled) {
          setDeletedWorksBySlug(deletedWorks);
          setDeletedChaptersBySlug(deletedChapters);
        }
      } catch {
        // no-op
      }
    };
    run();
    return () => { cancelled = true; };
  }, [items, supabase]);

  // Detectar obras con capítulos publicados y progreso
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const workSlugs = Array.from(new Set([
          ...items.filter(i => i.type === "work").map(i => i.slug),
          ...items
            .filter(i => i.type === "chapter" && typeof i.parentWorkSlug === "string" && (i.parentWorkSlug as string))
            .map(i => i.parentWorkSlug as string),
        ]));
        if (workSlugs.length === 0) {
          if (!cancelled) setSerializedBySlug({});
          if (!cancelled) setPublishedChaptersByWorkSlug({});
          if (!cancelled) setChapterProgressBySlug({});
          return;
        }
        // Obtener ids de obras por slug
        const { data: workRows, error: workErr } = await supabase
          .from("works")
          .select("id, slug")
          .in("slug", workSlugs)
          .limit(200);
        if (workErr) throw workErr;
        const idBySlug: Record<string, string> = {};
        const slugById: Record<string, string> = {};
        for (const w of (workRows || [])) {
          const id = String((w as any).id || "");
          const slug = String((w as any).slug || "");
          if (id && slug) {
            idBySlug[slug] = id;
            slugById[id] = slug;
          }
        }
        // Fallback: resolver IDs por slug generado desde el título
        const missingForIds = workSlugs.filter(s => !idBySlug[s]);
        if (missingForIds.length > 0) {
          try {
            const { data: publishedWorks } = await supabase
              .from("works")
              .select("id, slug, title, status")
              .eq("status", "published")
              .limit(2000);
            for (const w of (publishedWorks || [])) {
              const id = String((w as any).id || "");
              const rawSlug = (w as any)?.slug as string | undefined;
              const title = (w as any)?.title as string | undefined;
              const candidate = (typeof rawSlug === "string" && rawSlug) ? rawSlug : (typeof title === "string" && title ? generateSlug(title) : "");
              if (id && candidate && missingForIds.includes(candidate) && !idBySlug[candidate]) {
                idBySlug[candidate] = id;
                slugById[id] = candidate;
              }
            }
          } catch {}
        }
        const ids = Object.values(idBySlug).filter(Boolean);
        // Buscar capítulos publicados y no independientes por ID de obra
        const { data: chRows } = ids.length > 0 ? await supabase
          .from("chapters")
          .select("work_id, slug, title, chapter_number, status, is_independent, file_url, file_type")
          .in("work_id", ids)
          .eq("status", "published")
          .or("is_independent.eq.false,is_independent.is.null")
          .order("chapter_number", { ascending: true })
          .limit(1000) : { data: [] } as any;
        const firstByWorkId: Record<string, SerializedFallback> = {};
        const chaptersByWorkId: Record<string, PublishedChapter[]> = {};
        const allChapterSlugs: string[] = [];
        for (const ch of (chRows || [])) {
          const wid = String((ch as any).work_id || "");
          if (!wid) continue;
          const rawSlug = (ch as any).slug as string | undefined;
          const title = (ch as any).title as string | undefined;
          const safeSlug = (typeof rawSlug === "string" && rawSlug.trim() !== "")
            ? rawSlug
            : (typeof title === "string" && title ? generateSlug(title) : "");
          if (!firstByWorkId[wid]) {
            firstByWorkId[wid] = {
              firstSlug: (safeSlug || undefined),
              firstTitle: (ch as any).title || undefined,
              firstHasPdf: !!((ch as any).file_url),
              firstProgressRatio: undefined,
            };
          }
          if (!chaptersByWorkId[wid]) chaptersByWorkId[wid] = [];
          chaptersByWorkId[wid].push({
            slug: safeSlug,
            title: (ch as any).title,
            hasPdf: !!((ch as any).file_url),
            chapter_number: typeof (ch as any).chapter_number === "number" ? (ch as any).chapter_number : null,
            file_type: (ch as any).file_type || null,
          });
          if (typeof safeSlug === "string" && safeSlug) allChapterSlugs.push(safeSlug);
        }

        // Fallback: join por works.slug
        const unresolvedSlugs = workSlugs.filter(s => !idBySlug[s]);
        const slugsWithEmptyById = workSlugs.filter(s => {
          const wid = idBySlug[s];
          if (!wid) return false;
          const arr = chaptersByWorkId[wid];
          return !Array.isArray(arr) || arr.length === 0;
        });
        const needsJoinSlugs = Array.from(new Set([...unresolvedSlugs, ...slugsWithEmptyById]));
        const publishedByWorkSlugFallback: Record<string, PublishedChapter[]> = {};
        const firstByWorkSlugFallback: Record<string, SerializedFallback> = {};
        if (needsJoinSlugs.length > 0) {
          const { data: chJoinRows } = await supabase
            .from("chapters")
            .select("slug, title, chapter_number, status, is_independent, file_url, file_type, works:works!chapters_work_id_fkey(slug)")
            .eq("status", "published")
            .or("is_independent.eq.false,is_independent.is.null")
            .in("works.slug", needsJoinSlugs)
            .order("chapter_number", { ascending: true })
            .limit(1000);
          for (const ch of (chJoinRows || [])) {
            const wslug = (ch as any)?.works?.slug as string | undefined;
            if (!wslug) continue;
            const rawSlug = (ch as any).slug as string | undefined;
            const title = (ch as any).title as string | undefined;
            const safeSlug = (typeof rawSlug === "string" && rawSlug.trim() !== "")
              ? rawSlug
              : (typeof title === "string" && title ? generateSlug(title) : "");
            if (!publishedByWorkSlugFallback[wslug]) publishedByWorkSlugFallback[wslug] = [];
            publishedByWorkSlugFallback[wslug].push({
              slug: safeSlug,
              title: (ch as any).title,
              hasPdf: !!((ch as any).file_url),
              chapter_number: typeof (ch as any).chapter_number === "number" ? (ch as any).chapter_number : null,
              file_type: (ch as any).file_type || null,
            });
            if (!firstByWorkSlugFallback[wslug]) {
              firstByWorkSlugFallback[wslug] = {
                firstSlug: (safeSlug || undefined),
                firstTitle: (ch as any).title || undefined,
                firstHasPdf: !!((ch as any).file_url),
                firstProgressRatio: undefined,
              };
            }
            if (typeof safeSlug === "string" && safeSlug) allChapterSlugs.push(safeSlug);
          }
        }

        // Progreso de capítulos
        try {
          const slugs = Object.values(firstByWorkId).map(v => v.firstSlug).filter(Boolean) as string[];
          const progressBySlug: Record<string, number | undefined> = {};
          const targetSlugs = Array.from(new Set([...(slugs || []), ...allChapterSlugs]));
          if (targetSlugs.length > 0) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const { data: rpRows } = await supabase
                .from("reading_progress")
                .select("content_slug, last_page, num_pages, updated_at")
                .eq("user_id", user.id)
                .eq("content_type", "chapter")
                .in("content_slug", targetSlugs)
                .limit(1000);
              for (const rp of (rpRows || [])) {
                const slug = (rp as any).content_slug as string;
                const lastPage = (rp as any).last_page as number | null;
                const numPages = (rp as any).num_pages as number | null;
                const ratio = (typeof lastPage === "number" && typeof numPages === "number" && (numPages as number) > 0)
                  ? Math.min(1, Math.max(0, (lastPage as number) / (numPages as number)))
                  : (typeof lastPage === "number" ? Math.max(0, lastPage as number) : undefined);
                const entry = Object.values(firstByWorkId).find(v => v.firstSlug === slug);
                if (entry) entry.firstProgressRatio = ratio;
                progressBySlug[slug] = ratio;
              }
              if (!cancelled) setChapterProgressBySlug(progressBySlug);
            }
          }
        } catch {}

        const next: Record<string, SerializedFallback> = {};
        const publishedByWorkSlug: Record<string, PublishedChapter[]> = {};
        for (const wid of Object.keys(firstByWorkId)) {
          const slug = slugById[wid];
          if (slug) next[slug] = firstByWorkId[wid];
        }
        for (const wid of Object.keys(chaptersByWorkId)) {
          const slug = slugById[wid];
          if (slug) publishedByWorkSlug[slug] = chaptersByWorkId[wid];
        }
        // Merge fallbacks por slug
        for (const wslug of Object.keys(firstByWorkSlugFallback)) {
          next[wslug] = firstByWorkSlugFallback[wslug];
        }
        for (const wslug of Object.keys(publishedByWorkSlugFallback)) {
          publishedByWorkSlug[wslug] = (publishedByWorkSlug[wslug] || []).concat(publishedByWorkSlugFallback[wslug]);
        }
        if (!cancelled) setSerializedBySlug(next);
        if (!cancelled) setPublishedChaptersByWorkSlug(publishedByWorkSlug);
      } catch (e) {
        if (!cancelled) setSerializedBySlug({});
        if (!cancelled) setPublishedChaptersByWorkSlug({});
        if (!cancelled) setChapterProgressBySlug({});
      }
    };
    run();
    return () => { cancelled = true; };
  }, [items, supabase]);

  // Auto-abrir item indicado por ?continue=work:slug o chapter:slug
  useEffect(() => {
    try {
      const cont = searchParams?.get("continue") || "";
      if (!cont || loading || items.length === 0) return;
      const [type, slug] = cont.includes(":") ? cont.split(":") : ["", ""];
      const t = type === "work" || type === "chapter" ? type : null;
      const s = slug || "";
      if (!t || !s) return;
      const target = items.find(i => i.type === t && i.slug === s);
      if (target) {
        void openItem(target);
      }
    } catch {}
  }, [searchParams, loading, items]);

  const openItem = async (itm: MisLecturasItem) => {
    try {
      // Resolver última página con prioridad: DB -> localStorage -> item.lastPage
      let ip: number | undefined = undefined;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: rp } = await supabase
            .from("reading_progress")
            .select("last_page, updated_at")
            .eq("user_id", user.id)
            .eq("content_type", itm.type)
            .eq("content_slug", itm.slug)
            .order("updated_at", { ascending: false })
            .limit(1);
          const pr = (rp || [])[0];
          if (pr && typeof pr.last_page === "number") {
            ip = Math.max(1, pr.last_page);
          }
          // Fallback adicional: buscar por file_path normalizado si aún no se encontró
          if (typeof ip !== "number") {
            const matchPath = normalizePathForMatch(itm.filePath || null);
            if (matchPath) {
              const { data: rpByPath } = await supabase
                .from("reading_progress")
                .select("last_page, updated_at")
                .eq("user_id", user.id)
                .eq("content_type", itm.type)
                .eq("file_path", matchPath)
                .order("updated_at", { ascending: false })
                .limit(1);
              const pr2 = (rpByPath || [])[0];
              if (pr2 && typeof pr2.last_page === "number") {
                ip = Math.max(1, pr2.last_page);
              }
            }
          }
        }
      } catch {}

      if (typeof ip !== "number") {
        try {
          const key = `reading-progress:${itm.type}:${itm.slug}`;
          const raw = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
          if (raw) {
            const obj = JSON.parse(raw);
            if (typeof obj?.last_page === "number") {
              ip = Math.max(1, obj.last_page);
            }
          }
        } catch {}
      }

      if (typeof ip !== "number" && typeof itm.lastPage === "number") {
        ip = Math.max(1, itm.lastPage);
      }

      // Normalizar bucket por tipo si no viene en el registro
      const bucket = (itm.bucket && itm.bucket.trim() !== "")
        ? itm.bucket!
        : (itm.type === "work" ? "works" : "chapters");

      // Normalizar filePath antes de firmar
      const rawPath = (itm.filePath || "").trim();
      const normalizedPath = (() => {
        if (!rawPath) return "";
        // Si viene una URL completa firmada, extraer <bucket>/<path>
        if (rawPath.startsWith("http://") || rawPath.startsWith("https://")) {
          try {
            const u = new URL(rawPath);
            const parts = u.pathname.split("/");
            const signIdx = parts.findIndex(p => p === "sign");
            if (signIdx >= 0 && parts.length > signIdx + 2) {
              const rest = parts.slice(signIdx + 2).join("/");
              return rest.startsWith("public/") ? rest.replace(/^public\//, "") : rest;
            }
          } catch {}
        }
        // Si el path incluye el bucket como prefijo, quitarlo para la firma
        const withoutLeadingSlash = rawPath.replace(/^\/+/, "");
        const stripped = withoutLeadingSlash
          .replace(/^works\//, "")
          .replace(/^chapters\//, "")
          .replace(/^public\//, "");
        return stripped;
      })();

      // Resolver path por slug en el servidor si falta
      let effectivePath = normalizedPath;
      let effectiveBucket = bucket;
      if (!effectivePath) {
        try {
          const res = await fetch("/api/files/resolve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ type: itm.type, slug: itm.slug }),
          });
          if (res.ok) {
            const data = await res.json();
            const srvBucket = (data?.bucket || "").trim();
            const srvPath = (data?.filePath || "").trim();
            if (srvPath) {
              effectiveBucket = srvBucket || effectiveBucket;
              const withoutLeadingSlash = srvPath.replace(/^\/+/, "");
              const stripped = withoutLeadingSlash
                .replace(/^works\//, "")
                .replace(/^chapters\//, "")
                .replace(/^public\//, "");
              effectivePath = stripped;
            }
          }
        } catch {}
      }

      // Si continúa sin path, abrir ficha como fallback
      if (!effectivePath) {
        addToast({ type: "info", message: "Archivo no disponible aún. Abriendo ficha…" });
        try {
          const to = itm.type === "work"
            ? `/works/${itm.slug}`
            : `/chapters/${itm.slug}${itm.hasPdf ? "?view=pdf" : ""}`;
          router.push(to);
        } catch {}
        return;
      }

      const signed = await getSignedFileUrl(effectivePath, 3600, effectiveBucket);
      const urlToUse = signed;
      if (!urlToUse) return;
      // Descargar como blob y usar object URL para evitar net::ERR_ABORTED
      let viewerUrl = urlToUse;
      try {
        const pdfResp = await fetch(urlToUse, { cache: "no-store" });
        const blob = await pdfResp.blob();
        viewerUrl = URL.createObjectURL(blob);
      } catch {}
      setPdfUrl(viewerUrl);
      setInitialPage(ip);
      setCurrentTitle(itm.title);
      setCurrentItem(itm);
      await logPdfView({ contentType: itm.type, contentSlug: itm.slug, urlOrPath: urlToUse, bucketOverride: bucket });
      setIsPDFViewerOpen(true);
    } catch (e) {
      console.warn("No se pudo firmar la URL.", e);
      const msg = (e instanceof Error ? e.message : "Error generando URL firmada");
      const low = msg.toLowerCase();
      if (low.includes("no encontrado") || low.includes("404")) {
        addToast({ type: "error", message: "Archivo no encontrado en almacenamiento." });
      } else {
        addToast({ type: "error", message: "No se pudo firmar el PDF." });
      }
      return;
    }
  };

  const removeWork = async (workSlug: string) => {
    try {
      const res = await fetch(`/api/reading-list?workSlug=${encodeURIComponent(workSlug)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setItems(prev => prev.filter(x => {
          if (x.type === "work" && x.slug === workSlug) return false;
          if (x.type === "chapter" && x.parentWorkSlug === workSlug) return false;
          return true;
        }));
        addToast({ type: "success", message: "Se eliminó de Mis lecturas." });
      } else {
        addToast({ type: "error", message: "No se pudo eliminar." });
      }
    } catch {
      addToast({ type: "error", message: "Error de conexión al eliminar." });
    }
  };

  // Derivados para renderizado
  const groupedWorks = useMemo(() => {
    const works = items.filter(i => i.type === "work");
    const chapters = items.filter(i => i.type === "chapter");
    const serializedSet = new Set([
      ...Object.keys(serializedBySlug),
      ...works.filter(w => !!w.hasSerializedChapters).map(w => w.slug),
      ...Object.keys(publishedChaptersByWorkSlug),
    ]);
    return works
      .map(w => ({
        work: w,
        chapters: chapters.filter(c => (c.parentWorkSlug || "") === w.slug),
      }))
      .filter(group => serializedSet.has(group.work.slug) || group.chapters.length > 0);
  }, [items, serializedBySlug, publishedChaptersByWorkSlug]);

  const independentWorks = useMemo(() => {
    const works = items.filter(i => i.type === "work");
    const chapters = items.filter(i => i.type === "chapter");
    const serializedSet = new Set([
      ...Object.keys(serializedBySlug),
      ...works.filter(w => !!w.hasSerializedChapters).map(w => w.slug),
      ...Object.keys(publishedChaptersByWorkSlug),
    ]);
    return works.filter(w => {
      const hasChild = chapters.some(c => (c.parentWorkSlug || "") === w.slug);
      return !serializedSet.has(w.slug) && !hasChild;
    });
  }, [items, serializedBySlug, publishedChaptersByWorkSlug]);

  const independentChapters = useMemo(() => {
    return items.filter(i => i.type === "chapter" && !(i.parentWorkSlug));
  }, [items]);

  return {
    items,
    loading,
    error,
    activeTab,
    setActiveTab,
    serializedBySlug,
    publishedChaptersByWorkSlug,
    chapterProgressBySlug,
    deletedWorksBySlug,
    deletedChaptersBySlug,
    groupedWorks,
    independentWorks,
    independentChapters,
    openItem,
    removeWork,
    isPDFViewerOpen,
    setIsPDFViewerOpen,
    setPdfUrl,
    setCurrentItem,
    pdfUrl,
    initialPage,
    currentTitle,
    currentItem,
  };
}