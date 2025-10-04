'use client';

import { useState, useEffect, useCallback } from 'react';
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

  // Función para obtener datos de likes (declarada antes del useEffect para evitar TDZ)
  const fetchLikeData = useCallback(async (userId?: string) => {
    try {
      const params = new URLSearchParams({
        target_type: targetType,
        target_id: targetId,
        ...(userId && { user_id: userId })
      });

      const response = await fetch(`/api/likes?${params}`);
      
      if (response.ok) {
        const data = await response.json();
        setCount(data.count);
        setIsLiked(data.userHasLiked);
      }
    } catch (error) {
      console.error('Error fetching like data:', error);
    }
  }, [targetType, targetId]);

  // Obtener usuario actual
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      
      // Si hay usuario, obtener el estado actual de likes
      if (user) {
        await fetchLikeData(user.id);
      }
    };

    getUser();
  }, [supabase, fetchLikeData]);

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
        console.error('Error toggling like');
      }
    } catch (error) {
      console.error('Error in like request:', error);
    } finally {
      setIsLoading(false);
      setTimeout(() => setIsAnimating(false), 300);
    }
  };

  return (
    <button
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