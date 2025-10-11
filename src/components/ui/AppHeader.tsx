'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/lib/supabaseClient';
import { isAdminUser } from '@/lib/adminAuth';
import { Icon, Icons } from '@/components/ui';
import { Modal, ModalHeader, ModalBody, ModalFooter, Input, Button } from '@/components/ui';
import { generateSlug } from '@/lib/slugUtils';

interface AppHeaderProps {
  className?: string;
}

export default function AppHeader({ className = '' }: AppHeaderProps) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [hasSession, setHasSession] = useState<boolean>(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const publishRef = useRef<HTMLDivElement | null>(null);

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
          fetch('/api/system/sync-profile', { method: 'POST', keepalive: true })
            .then(() => {
              // Evitar refrescos en desarrollo para no provocar aborts/ruido
              if (process.env.NODE_ENV === 'production') {
                try { router.refresh(); } catch {}
              }
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
          fetch('/api/system/sync-profile', { method: 'POST', keepalive: true })
            .then(() => {
              // Evitar refrescos en desarrollo para no provocar aborts/ruido
              if (process.env.NODE_ENV === 'production') {
                try { router.refresh(); } catch {}
              }
            })
            .catch((err) => {
              // Silenciar errores de abort en dev
              if (process.env.NODE_ENV === 'production') {
                console.warn('sync-profile error', err);
              }
            });
        } catch {}
      }
    });

    // Cerrar al hacer click fuera
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
      if (publishRef.current && !publishRef.current.contains(e.target as Node)) {
        setPublishOpen(false);
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
    <div className={`w-full flex justify-between items-center ${className}`}>
      {/* Navegación izquierda */}
      <div className="flex items-center gap-2">
        {/* Botón Inicio */}
        <Link
          href="/home"
          className="inline-flex items-center gap-2 rounded-full bg-white/80 backdrop-blur px-3 py-2 shadow-sm border border-slate-200 hover:bg-white transition-colors text-slate-700"
          aria-label="Volver a inicio"
          title="Inicio"
        >
          <Icon path={Icons.dashboard} size="sm" />
          <span className="text-sm">Inicio</span>
        </Link>
        {/* Botón Mis lecturas */}
        <Link
          href="/mis-lecturas"
          className="inline-flex items-center gap-2 rounded-full bg-white/80 backdrop-blur px-3 py-2 shadow-sm border border-slate-200 hover:bg-white transition-colors text-slate-700"
          aria-label="Mis lecturas"
          title="Mis lecturas"
        >
          <Icon path={Icons.book} size="sm" />
          <span className="text-sm">Mis lecturas</span>
        </Link>
        {/* Botón Actividad reciente */}
        <Link
          href="/actividad-reciente"
          className="inline-flex items-center gap-2 rounded-full bg-white/80 backdrop-blur px-3 py-2 shadow-sm border border-slate-200 hover:bg-white transition-colors text-slate-700"
          aria-label="Actividad reciente"
          title="Actividad reciente"
        >
          <Icon path={Icons.lightning} size="sm" />
          <span className="text-sm">Actividad</span>
        </Link>

        {/* Botón Buscar (lupa) */}
        <HeaderSearch />

        {hasSession && (
          <div className="relative" ref={publishRef}>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={publishOpen}
              onClick={() => setPublishOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-full bg-white/80 backdrop-blur px-3 py-2 shadow-sm border border-slate-200 hover:bg-white transition-colors text-slate-700"
              title="Publicar"
            >
              <span className="text-sm">Publicar</span>
              <svg
                className={`w-4 h-4 text-slate-600 transition-transform ${publishOpen ? 'rotate-180' : ''}`}
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

            {publishOpen && (
              <div
                role="menu"
                aria-label="Menú publicar"
                className="absolute left-0 mt-2 w-56 rounded-lg bg-white shadow-lg border border-slate-200 py-2 z-50"
              >
                <Link
                  href="/write"
                  role="menuitem"
                  className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                  onClick={() => setPublishOpen(false)}
                >
                  Crear post
                </Link>
                <Link
                  href="/upload/works"
                  role="menuitem"
                  className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                  onClick={() => setPublishOpen(false)}
                >
                  Subir obra
                </Link>
                <Link
                  href="/upload/obra-por-capitulos"
                  role="menuitem"
                  className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                  onClick={() => setPublishOpen(false)}
                >
                  Subir obra por capítulos
                </Link>
                <Link
                  href="/upload/chapters"
                  role="menuitem"
                  className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                  onClick={() => setPublishOpen(false)}
                >
                  Subir capítulo
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => {
            if (hasSession) {
              setOpen((v) => !v);
            } else {
              router.push('/auth/login');
            }
          }}
          className="flex items-center gap-3 rounded-full bg-white/80 backdrop-blur px-3 py-2 shadow-sm border border-slate-200 hover:bg-white transition-colors"
          title={hasSession ? 'Abrir menú de usuario' : 'Logear'}
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
          <span className="text-sm text-slate-700 max-w-[12rem] truncate">{hasSession ? (displayName || 'Usuario') : 'Logear'}</span>
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
            {/* Opciones de publicar eliminadas del menú del avatar */}
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
                  // Silenciar errores de cierre de sesión en cliente
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

function HeaderSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [type, setType] = useState<'all' | 'works' | 'chapters' | 'serialized'>('all');
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{
    id: string;
    title: string;
    subtitle?: string;
    href: string;
    type: 'work' | 'chapter' | 'serialized';
  }>>([]);
  const debounceRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleSearch = () => {
    const q = query.trim();
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (type && type !== 'all') params.set('type', type);
    router.push(`/buscar${params.toString() ? `?${params.toString()}` : ''}`);
    setOpen(false);
  };

  // Búsqueda con debounce para sugerencias rápidas
  useEffect(() => {
    // Limpiar sugerencias si modal cerrado o query corta
    if (!open || query.trim().length < 2) {
      setSuggestions([]);
      setLoadingSuggestions(false);
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      return;
    }

    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    debounceRef.current = window.setTimeout(async () => {
      try {
        setLoadingSuggestions(true);
        if (abortRef.current) {
          abortRef.current.abort();
        }
        abortRef.current = new AbortController();
        const q = encodeURIComponent(query.trim());
        const res = await fetch(`/api/search?q=${q}&type=${type}`, { signal: abortRef.current.signal });
        const json = await res.json();
        // Aceptar nuevo formato `{ success: true }` y mantener compatibilidad con `{ ok: true }`
        if (!(json?.success === true || json?.ok === true)) {
          setSuggestions([]);
          setLoadingSuggestions(false);
          return;
        }
        const next: Array<{
          id: string;
          title: string;
          subtitle?: string;
          href: string;
          type: 'work' | 'chapter' | 'serialized';
        }> = [];
        const data = json.data || {};
        const works = Array.isArray(data.works) ? data.works.slice(0, 5) : [];
        const chapters = Array.isArray(data.chapters) ? data.chapters.slice(0, 5) : [];
        const serialized = Array.isArray(data.serializedWorks) ? data.serializedWorks.slice(0, 5) : [];
        for (const w of works) {
          const name = Array.isArray(w?.profiles) ? (w.profiles[0]?.display_name ?? 'Autor') : (w?.profiles?.display_name ?? 'Autor');
          const slugW = generateSlug(w.title);
          next.push({ id: String(w.id), title: w.title, subtitle: name, href: `/works/${slugW}`, type: 'work' });
        }
        for (const c of chapters) {
          const name = Array.isArray(c?.profiles) ? (c.profiles[0]?.display_name ?? 'Autor') : (c?.profiles?.display_name ?? 'Autor');
          const slugC = c.slug || generateSlug(c.title);
          next.push({ id: String(c.id), title: c.title, subtitle: name, href: `/chapters/${slugC}`, type: 'chapter' });
        }
        for (const s of serialized) {
          const name = Array.isArray(s?.profiles) ? (s.profiles[0]?.display_name ?? 'Autor') : (s?.profiles?.display_name ?? 'Autor');
          const slugS = generateSlug(s.title);
          next.push({ id: String(s.id), title: s.title, subtitle: name, href: `/works/${slugS}`, type: 'serialized' });
        }
        setSuggestions(next);
      } catch (e) {
        // Silenciar errores y aborts
        setSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [open, query, type]);

  return (
    <>
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-full bg-white/80 backdrop-blur px-3 py-2 shadow-sm border border-slate-200 hover:bg-white transition-colors text-slate-700"
        aria-label="Buscar"
        title="Buscar"
        onClick={() => setOpen(true)}
      >
        <Icon path={Icons.search} size="sm" />
        <span className="text-sm">Buscar</span>
      </button>

      <Modal isOpen={open} onClose={() => setOpen(false)} size="lg">
        <ModalHeader>
          <div className="flex items-center gap-2">
            <Icon path={Icons.search} size="md" />
            Buscar obras y capítulos
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Icon path={Icons.search} size="md" className="text-slate-400" />
              </div>
              <Input
                type="text"
                placeholder="Título, autor, palabra clave..."
                value={query}
                onChange={(e) => setQuery((e.target as HTMLInputElement).value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
                className="pl-10 w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-0 transition-colors"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'all', label: 'Todos' },
                { key: 'works', label: 'Obras' },
                { key: 'chapters', label: 'Capítulos' },
                { key: 'serialized', label: 'Obras por capítulos' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setType(opt.key as any)}
                  className={`px-3 py-1.5 text-sm rounded-full border ${
                    type === (opt.key as any)
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-700 border-slate-200'
                  }`}
                  aria-pressed={type === (opt.key as any)}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Sugerencias rápidas */}
            <div className="mt-4">
              {loadingSuggestions ? (
                <div className="text-sm text-slate-600">Buscando sugerencias...</div>
              ) : suggestions.length === 0 ? (
                query.trim().length >= 2 ? (
                  <div className="text-sm text-slate-600">Sin sugerencias para "{query.trim()}".</div>
                ) : (
                  <div className="text-sm text-slate-600">Escribe al menos 2 caracteres para ver sugerencias.</div>
                )
              ) : (
                <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 overflow-hidden">
                  {suggestions.map((s) => (
                    <li key={`${s.type}-${s.id}`}>
                      <button
                        type="button"
                        onClick={() => {
                          router.push(s.href);
                          setOpen(false);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3"
                        aria-label={`Abrir ${s.type === 'chapter' ? 'capítulo' : s.type === 'serialized' ? 'obra por capítulos' : 'obra'}: ${s.title}`}
                      >
                        <Icon
                          path={
                            s.type === 'chapter' ? Icons.book : s.type === 'serialized' ? Icons.library : Icons.book
                          }
                          size="sm"
                          className="text-slate-600"
                        />
                        <div>
                          <div className="text-sm font-medium text-slate-900">{s.title}</div>
                          {s.subtitle && (
                            <div className="text-xs text-slate-600">{s.subtitle}</div>
                          )}
                        </div>
                        <span className="ml-auto text-xs text-slate-500">
                          {s.type === 'chapter' ? 'Capítulo' : s.type === 'serialized' ? 'Obra por capítulos' : 'Obra'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </ModalBody>
        <ModalFooter align="between">
          <Button variant="secondary" onClick={() => setOpen(false)}>Cerrar</Button>
          <Button variant="primary" onClick={handleSearch}>
            <Icon path={Icons.search} size="sm" />
            Buscar
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}