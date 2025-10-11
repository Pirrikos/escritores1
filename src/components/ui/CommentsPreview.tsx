'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

type TargetType = 'post' | 'chapter' | 'work';

type CommentRow = {
  id: string;
  body: string;
  created_at: string;
  profiles?: {
    id: string;
    display_name?: string | null;
    avatar_url?: string | null;
    username?: string | null;
  } | null;
};

type CommentsPreviewProps = {
  targetType: TargetType;
  targetId: string;
  limit?: number;
  className?: string;
};

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.max(0, now.getTime() - d.getTime());
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'hace unos segundos';
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `hace ${hr} h`;
  const days = Math.floor(hr / 24);
  return `hace ${days} d`;
}

export default function CommentsPreview({ targetType, targetId, limit = 2, className = '' }: CommentsPreviewProps) {
  const [items, setItems] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = `/api/comments?target_type=${encodeURIComponent(targetType)}&target_id=${encodeURIComponent(targetId)}&limit=${limit}`;
        const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
        const json = await res.json();
        if (!cancelled) {
          const rows = Array.isArray(json?.data) ? json.data : [];
          setItems(rows.slice(0, limit));
        }
      } catch (e) {
        if (!cancelled) setError('No se pudo cargar el preview');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [targetType, targetId, limit]);

  if (loading) {
    return (
      <div className={`rounded-md border border-slate-200 bg-white/60 p-3 text-sm text-slate-600 ${className}`}>
        Cargando comentarios…
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 ${className}`}>
        {error}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={`rounded-md border border-slate-200 bg-white/60 p-3 text-sm text-slate-600 ${className}`}>
        Sé el primero en comentar.
      </div>
    );
  }

  return (
    <div className={`rounded-md border border-slate-200 bg-white/60 p-3 ${className}`}>
      <ul className="space-y-2">
        {items.map((c) => (
          <li key={c.id} className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-slate-200 overflow-hidden flex-shrink-0" aria-hidden>
              {/* avatar placeholder; se puede mejorar si hay avatar_url público */}
            </div>
            <div className="flex-1">
              <div className="text-xs text-slate-500">
                {c.profiles?.display_name || c.profiles?.username || 'Usuario'} • {timeAgo(c.created_at)}
              </div>
              <div className="text-sm text-slate-800 line-clamp-2">
                {c.body}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-2">
        <Link
          href={`/comentarios?target_type=${encodeURIComponent(targetType)}&target_id=${encodeURIComponent(targetId)}`}
          className="text-xs text-indigo-700 hover:underline"
        >
          Ver todos los comentarios
        </Link>
      </div>
    </div>
  );
}