'use client';

import Link from 'next/link';
import { MouseEvent, useEffect, useState } from 'react';

type Props = {
  targetType: 'post' | 'chapter' | 'work';
  targetId: string;
  className?: string;
};

export default function CommentsButton({ targetType, targetId, className = '' }: Props) {
  const href = `/comentarios?target_type=${encodeURIComponent(targetType)}&target_id=${encodeURIComponent(targetId)}`;
  const onClick = (e: MouseEvent) => {
    // Evitar que el click dispare navegación del card padre
    e.stopPropagation();
  };

  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    const fetchCount = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/comments?target_type=${encodeURIComponent(targetType)}&target_id=${encodeURIComponent(targetId)}&count=1`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          credentials: 'include',
          cache: 'no-store',
        });
        if (!res.ok) throw new Error('failed');
        const json = await res.json();
        if (!cancelled) setCount(typeof json?.count === 'number' ? json.count : 0);
      } catch {
        if (!cancelled) setCount(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchCount();
    return () => { cancelled = true; };
  }, [targetType, targetId]);

  return (
    <Link
      href={href}
      onClick={onClick}
      className={
        `inline-flex items-center gap-2 rounded-md bg-slate-100 text-slate-800 px-3 py-2 hover:bg-slate-200 ` +
        `border border-slate-200 shadow-sm ${className}`
      }
      aria-label="Abrir comentarios"
    >
      <span className="inline-block w-2 h-2 rounded-full bg-slate-500" />
      <span className="text-sm font-medium">Comentarios</span>
      <span className="text-xs text-slate-600">
        {loading ? '...' : (count ?? '—')}
      </span>
    </Link>
  );
}