'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/lib/supabaseClient';
import { isAdminUser } from '@/lib/adminAuth';

interface AppHeaderProps {
  className?: string;
}

export default function AppHeader({ className = '' }: AppHeaderProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [hasSession, setHasSession] = useState<boolean>(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    // Cargar sesión inicial
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const user = data.session?.user;
      const avatar = user?.user_metadata?.avatar_url || null;
      const name = (user?.user_metadata?.full_name as string) || user?.email || '';
      setAvatarUrl(avatar);
      setDisplayName(name);
      setHasSession(!!data.session);
      try { setIsAdmin(!!data.session && isAdminUser(data.session)); } catch {}
      // Sincronizar perfil para corregir alias basados en email
      if (data.session) {
        try {
          fetch('/api/system/sync-profile', { method: 'POST' })
            .then(() => {
              try { router.refresh(); } catch {}
            })
            .catch(() => {});
        } catch {}
      }
    });

    // Suscribirse a cambios de sesión
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      const avatar = user?.user_metadata?.avatar_url || null;
      const name = (user?.user_metadata?.full_name as string) || user?.email || '';
      setAvatarUrl(avatar);
      setDisplayName(name);
      setHasSession(!!session);
      try { setIsAdmin(!!session && isAdminUser(session)); } catch {}
      // Reintentar sincronización en cambios de sesión
      if (session) {
        try {
          fetch('/api/system/sync-profile', { method: 'POST' })
            .then(() => {
              try { router.refresh(); } catch {}
            })
            .catch(() => {});
        } catch {}
      }
    });

    // Cerrar al hacer click fuera
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      mounted = false;
      try { sub.subscription.unsubscribe(); } catch {}
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [supabase]);

  const initials = displayName
    ? displayName
        .split(' ')
        .map((s) => s[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : '';

  return (
    <div className={`w-full flex justify-end ${className}`}>
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-3 rounded-full bg-white/80 backdrop-blur px-3 py-2 shadow-sm border border-slate-200 hover:bg-white transition-colors"
        >
          {avatarUrl ? (
            <img
              src={avatarUrl.includes('googleusercontent.com')
                ? `/api/avatar?u=${encodeURIComponent(avatarUrl)}`
                : avatarUrl}
              alt={displayName || 'Usuario'}
              className="w-8 h-8 rounded-full object-cover"
              onError={() => {
                // Fallback si el avatar remoto está bloqueado por ORB/COEP
                try { setAvatarUrl(null); } catch {}
              }}
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-indigo-700 text-white flex items-center justify-center text-xs font-semibold">
              {initials || 'U'}
            </div>
          )}
          <span className="text-sm text-slate-700 max-w-[12rem] truncate">{displayName || 'Invitado'}</span>
          <svg
            className={`w-4 h-4 text-slate-600 transition-transform ${open ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {open && (
          <div
            role="menu"
            aria-label="Menú de usuario"
            className="absolute right-0 mt-2 w-48 rounded-lg bg-white shadow-lg border border-slate-200 py-2 z-50"
          >
            <Link
              href="/library"
              role="menuitem"
              className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
              onClick={() => setOpen(false)}
            >
              Mis publicaciones
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                role="menuitem"
                className="block px-4 py-2 text-sm text-indigo-700 hover:bg-indigo-50"
                onClick={() => setOpen(false)}
                title="Panel de administración"
              >
                Administrador
              </Link>
            )}
            <button
              role="menuitem"
              className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
              onClick={(e) => {
                e.preventDefault();
                setOpen(false);
              }}
              title="Próximamente"
            >
              Ajustes
            </button>
            {hasSession && (
              <>
                <div className="my-1 border-t border-slate-200" />
                <button
                  role="menuitem"
                  className="block w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50"
                  onClick={async (e) => {
                    e.preventDefault();
                    setOpen(false);
                    try {
                      await supabase.auth.signOut();
                      window.location.href = '/';
                    } catch (err) {
                      console.error('Error al cerrar sesión', err);
                    }
                  }}
                  title="Cerrar sesión"
                >
                  Cerrar sesión
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}