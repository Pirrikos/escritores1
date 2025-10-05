"use client";

import { useEffect, useMemo, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

interface QuoteSourcePost {
  id: string;
  title: string;
  content?: string | null;
  author_id: string;
  created_at: string;
  published_at?: string | null;
  profiles?: { display_name: string } | { display_name: string }[] | null;
}

function pickFirstSentence(text: string, limit = 180): string {
  const trimmed = text.trim();
  const sentenceEnd = trimmed.search(/[.!?]\s|$/);
  const sentence = sentenceEnd > 0 ? trimmed.slice(0, sentenceEnd + 1) : trimmed;
  return sentence.length > limit ? sentence.slice(0, limit - 1) + "…" : sentence;
}

function stableIndexByDate(len: number): number {
  const now = new Date();
  const key = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return len > 0 ? hash % len : 0;
}

export default function DailyQuoteBanner({ className = "" }: { className?: string }) {
  const supabase = useMemo(() => createClientComponentClient(), []);
  const [quote, setQuote] = useState<{ text: string; postTitle?: string; authorName?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        // 1) Obtener posts publicados con perfil del autor
        const { data, error } = await supabase
          .from("posts")
          .select(`
            id,
            title,
            content,
            author_id,
            created_at,
            published_at,
            profiles!posts_author_id_fkey ( display_name )
          `)
          .eq("status", "published")
          .order("published_at", { ascending: false })
          .limit(50);
        if (error) throw error;

        const posts: QuoteSourcePost[] = (data || []).map((p: any) => ({
          id: p.id,
          title: p.title,
          content: p.content || null,
          author_id: p.author_id,
          created_at: p.created_at,
          published_at: p.published_at || null,
          profiles: p.profiles,
        }));

        const normalizeProfile = (p: any): { display_name: string } => {
          if (Array.isArray(p)) return { display_name: p[0]?.display_name ?? "Autor desconocido" };
          if (p && typeof p === "object" && "display_name" in p) return p as { display_name: string };
          return { display_name: "Autor desconocido" };
        };

        // 2) Obtener likes de esos posts y elegir el más votado
        let chosen: QuoteSourcePost | undefined;
        if (posts.length > 0) {
          const postIds = posts.map((p) => p.id);
          const { data: likesRows, error: likesError } = await supabase
            .from("likes")
            .select("target_id")
            .eq("target_type", "post")
            .in("target_id", postIds);
          if (likesError) throw likesError;

          const likeCountMap = new Map<string, number>();
          (likesRows || []).forEach((row: any) => {
            const id = row.target_id as string;
            likeCountMap.set(id, (likeCountMap.get(id) || 0) + 1);
          });

          let maxLikes = -1;
          for (const p of posts) {
            const count = likeCountMap.get(p.id) || 0;
            if (count > maxLikes) {
              maxLikes = count;
              chosen = p;
            }
          }

          // Si no hay likes, elegir de forma determinística por fecha
          if (!chosen) {
            chosen = posts[stableIndexByDate(posts.length)];
          }
        }

        if (mounted) {
          if (chosen) {
            const author = normalizeProfile(chosen.profiles);
            const text = chosen.content && chosen.content.trim().length > 0
              ? pickFirstSentence(chosen.content)
              : `“${chosen.title}”`;
            setQuote({ text, postTitle: chosen.title, authorName: author.display_name });
          } else {
            setQuote({
              text: "Explora los posts de nuestra comunidad y descubre nuevas voces.",
            });
          }
        }
      } catch (err) {
        // Silenciar errores de frase diaria en consola
        if (mounted) {
          setQuote({
            text: "Descubre nuevas voces cada día en los posts de la comunidad.",
          });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  if (loading && !quote) {
    return (
      <div className={`mb-6 rounded-2xl border border-slate-200 bg-white/80 backdrop-blur p-4 ${className}`}>
        <div className="animate-pulse h-5 w-3/4 bg-slate-200 rounded" />
      </div>
    );
  }

  if (!quote) return null;

  return (
    <div
      className={`mb-6 rounded-2xl border border-slate-200 bg-white/80 backdrop-blur p-4 shadow-sm ${className}`}
      aria-label="Frase literaria del día"
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none text-indigo-600 select-none">“</span>
        <div className="flex-1">
          <p className="text-slate-800 italic">{quote.text}</p>
          {(quote.postTitle || quote.authorName) && (
            <p className="mt-2 text-sm text-slate-600">
              {quote.postTitle && <span className="font-medium">{quote.postTitle}</span>}
              {quote.authorName && <span> — {quote.authorName}</span>}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}