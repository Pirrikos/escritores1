'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabaseClient';
import type { User } from '@supabase/supabase-js';

interface LikeButtonProps {
  targetType: 'post' | 'chapter' | 'work';
  targetId: string;
  initialCount?: number;
  initialLiked?: boolean;
  className?: string;
  showCount?: boolean;
}

export default function LikeButton({
  targetType,
  targetId,
  initialCount = 0,
  initialLiked = false,
  className = '',
  showCount = true
}: LikeButtonProps) {
  const [count, setCount] = useState(initialCount);
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const supabase = getSupabaseBrowserClient();
  // Abort controller para peticiones GET de likes (evita ruido por abortos en navegación/HMR)
  const fetchAbortRef = useRef<AbortController | null>(null);
  // Visibilidad del botón para diferir la carga hasta que esté en viewport/interacción
  const rootRef = useRef<HTMLButtonElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const hasFetchedRef = useRef(false);

  // Función para obtener datos de likes (declarada antes del useEffect para evitar TDZ)
  const fetchLikeData = useCallback(async (userId?: string, signal?: AbortSignal) => {
    try {
      const params = new URLSearchParams({
        target_type: targetType,
        target_id: targetId,
        ...(userId && { user_id: userId })
      });

      const response = await fetch(`/api/likes?${params}`, { signal });
      
      if (response.ok) {
        const data = await response.json();
        setCount(data.count);
        setIsLiked(data.userHasLiked);
      }
    } catch (error: any) {
      // Silenciar errores de petición (incluye abortos y fallos de red en desarrollo)
      const _ = error; // no-op
    }
  }, [targetType, targetId]);

  // Obtener usuario actual (no dispara fetch automático)
  useEffect(() => {
    let canceled = false;
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!canceled) setUser(user);
    };
    getUser();
    return () => { canceled = true; };
  }, [supabase]);

  // Observar visibilidad del botón para lanzar la carga cuando esté en viewport
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onPointerEnter = () => setIsVisible(true);
    el.addEventListener('pointerenter', onPointerEnter, { passive: true });
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setIsVisible(true);
        });
      },
      { root: null, threshold: 0.1 }
    );
    observer.observe(el);
    return () => {
      try { el.removeEventListener('pointerenter', onPointerEnter as any); } catch {}
      try { observer.disconnect(); } catch {}
    };
  }, []);

  // Lanzar la carga de estado/count de likes solo cuando visible y una vez
  useEffect(() => {
    if (!isVisible || hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    // Cancelar petición previa si existe
    if (fetchAbortRef.current) {
      try { fetchAbortRef.current.abort(); } catch {}
    }
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    const run = () => { fetchLikeData(user?.id, controller.signal); };
    try {
      const ric = (window as any)?.requestIdleCallback;
      if (typeof ric === 'function') {
        ric(run, { timeout: 500 });
      } else {
        setTimeout(run, 150);
      }
    } catch {
      setTimeout(run, 150);
    }
    return () => {
      if (fetchAbortRef.current && !fetchAbortRef.current.signal.aborted) {
        try { fetchAbortRef.current.abort(); } catch {}
      }
    };
  }, [isVisible, user, fetchLikeData]);

  // Manejar click en el botón de like
  const handleLikeClick = async () => {
    if (!user) {
      // Redirigir a login o mostrar mensaje
      alert('Debes iniciar sesión para dar like');
      return;
    }

    if (isLoading) return;

    setIsLoading(true);
    setIsAnimating(true);

    try {
      const response = await fetch('/api/likes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetType,
          targetId,
          userId: user.id
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setCount(data.count);
        setIsLiked(data.userHasLiked);
      } else {
        // Silenciar errores de toggle en consola
      }
    } catch (error) {
      // Silenciar errores de petición de like en consola
    } finally {
      setIsLoading(false);
      setTimeout(() => setIsAnimating(false), 300);
    }
  };

  return (
    <button
      ref={rootRef}
      onClick={handleLikeClick}
      disabled={isLoading}
      className={`
        flex items-center gap-1 px-2 py-1 rounded-lg transition-all duration-200
        hover:bg-gray-100 dark:hover:bg-gray-800
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
      title={isLiked ? 'Quitar like' : 'Dar like'}
    >
      {/* Ícono del corazón */}
      <span 
        className={`
          text-lg transition-all duration-200 select-none
          ${isAnimating ? 'scale-125' : 'scale-100'}
          ${isLiked 
            ? 'text-red-500 hover:text-red-600' 
            : 'text-gray-400 hover:text-red-400'
          }
        `}
      >
        {isLiked ? '❤️' : '🤍'}
      </span>

      {/* Contador */}
      {showCount && (
        <span 
          className={`
            text-sm font-medium transition-all duration-200
            ${isLiked 
              ? 'text-red-500' 
              : 'text-gray-600 dark:text-gray-400'
            }
          `}
        >
          {count}
        </span>
      )}

      {/* Indicador de carga */}
      {isLoading && (
        <span className="text-xs text-gray-400 ml-1">...</span>
      )}
    </button>
  );
}