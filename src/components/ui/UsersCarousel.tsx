'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import { Icon, Icons } from '@/components/ui';
import { generateSlug } from '@/lib/slugUtils';
import FollowButton from '@/components/ui/FollowButton';

interface UserProfile {
  id: string;
  display_name: string | null;
  avatar_url?: string | null;
  username?: string | null;
}

interface UsersCarouselProps {
  users: UserProfile[];
  title?: string;
  description?: string;
  className?: string;
  seeMoreHref?: string;
  seeMoreLabel?: string;
}

function formatDisplayName(raw: string | null | undefined): string {
  const base = (raw || '').trim();
  if (!base) return 'Usuario';
  const emailBase = base.includes('@') ? base.split('@')[0] : base;
  const cleaned = emailBase.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const pretty = cleaned
    .split(' ')
    .map(w => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
    .join(' ');
  return pretty || 'Usuario';
}

export default function UsersCarousel({
  users,
  title = 'Autores',
  description = 'Miembros de la comunidad',
  className = '',
  seeMoreHref,
  seeMoreLabel = 'Ver todos',
}: UsersCarouselProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const scrollLeft = () => {
    if (containerRef.current) containerRef.current.scrollBy({ left: -600, behavior: 'smooth' });
  };
  const scrollRight = () => {
    if (containerRef.current) containerRef.current.scrollBy({ left: 600, behavior: 'smooth' });
  };

  return (
    <div className={className}>
      {(title || description) && (
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{title}</h2>
            {description && (
              <p className="text-gray-600 dark:text-gray-400">{description}</p>
            )}
          </div>
          <div className="flex items-center space-x-3">
            {seeMoreHref && (
              <Link
                href={seeMoreHref}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                {seeMoreLabel}
              </Link>
            )}
            <button
              onClick={scrollLeft}
              className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              aria-label="Scroll izquierda"
            >
              <Icon path={Icons.chevronLeft} size="lg" className="text-gray-600 dark:text-gray-300" />
            </button>
            <button
              onClick={scrollRight}
              className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              aria-label="Scroll derecha"
            >
              <Icon path={Icons.chevronRight} size="lg" className="text-gray-600 dark:text-gray-300" />
            </button>
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        className="overflow-x-auto pb-2"
      >
        <div className="grid grid-flow-col auto-cols-[160px] gap-6">
          {users.map((u) => {
            const name = formatDisplayName(u.display_name);
            const hasAvatar = !!u.avatar_url;
            const avatarSrc = hasAvatar && u.avatar_url
              ? (u.avatar_url.includes('googleusercontent.com')
                  ? `/api/avatar?u=${encodeURIComponent(u.avatar_url)}`
                  : u.avatar_url)
              : null;
            return (
              <div key={u.id} className="flex flex-col items-center text-center">
                <Link href={`/usuario/${u.username || generateSlug(u.display_name || '') || u.id}`} className="flex flex-col items-center text-center">
                  <div className="w-20 h-20 relative">
                    {avatarSrc ? (
                      <img
                        src={avatarSrc}
                        alt={`Avatar de ${name}`}
                        className="w-20 h-20 rounded-full object-cover border border-slate-200"
                        onError={(e) => {
                          const el = e.currentTarget as HTMLImageElement;
                          el.style.display = 'none';
                          const next = el.nextElementSibling as HTMLElement | null;
                          if (next) next.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div
                      style={{ display: avatarSrc ? 'none' as const : 'flex' as const }}
                      className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full items-center justify-center border border-slate-200"
                    >
                      <span className="text-white text-xl font-semibold">
                        {name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3">
                    <p className="text-sm font-medium text-slate-800 truncate" title={name}>{name}</p>
                  </div>
                </Link>
                <FollowButton targetUserId={u.id} className="mt-2" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}