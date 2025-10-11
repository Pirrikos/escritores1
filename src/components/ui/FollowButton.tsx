"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { isFollowing as apiIsFollowing, follow as apiFollow, unfollow as apiUnfollow, getCurrentUserId } from '@/lib/follows';
import { useToastHelpers } from '@/contexts/ToastContext';

interface FollowButtonProps {
  targetUserId: string;
  className?: string;
  initialFollowing?: boolean;
}

export const FollowButton: React.FC<FollowButtonProps> = ({ targetUserId, className, initialFollowing }) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [following, setFollowing] = useState<boolean>(!!initialFollowing);
  const [isOwnProfile, setIsOwnProfile] = useState<boolean>(false);
  const { success, error } = useToastHelpers();

  const refreshStatus = useCallback(async () => {
    try {
      const me = await getCurrentUserId();
      setIsOwnProfile(!!me && me === targetUserId);
      if (!me || me === targetUserId) {
        // No forzar cambio de estado si no hay usuario aún o es el propio perfil
        return;
      }
      const f = await apiIsFollowing(targetUserId);
      // Evitar sobrescribir estado optimista tras un toggle reciente
      setFollowing((prev) => prev || !!f);
    } catch {}
  }, [targetUserId]);

  useEffect(() => {
    // Siempre sincronizar con servidor para evitar discrepancias entre navegadores
    (async () => {
      try {
        const me = await getCurrentUserId();
        setIsOwnProfile(!!me && me === targetUserId);
      } catch {}
    })();
    refreshStatus();
  }, [refreshStatus, targetUserId]);

  const onToggle = async () => {
    setLoading(true);
    try {
      if (!following) {
        const res = await apiFollow(targetUserId);
        if (res.ok) {
          setFollowing(true);
          success('Ahora sigues a este usuario', 'Seguir');
        } else {
          error(res.message || 'No se pudo seguir');
        }
      } else {
        const res = await apiUnfollow(targetUserId);
        if (res.ok) {
          setFollowing(false);
          success('Has dejado de seguir a este usuario', 'Dejar de seguir');
        } else {
          error(res.message || 'No se pudo dejar de seguir');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  if (!targetUserId || isOwnProfile) {
    return null;
  }

  const base = 'inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium border transition-colors';
  const styles = following
    ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
    : 'bg-white text-indigo-700 border-indigo-600 hover:bg-indigo-50';

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={loading}
      className={`${base} ${styles} ${className || ''}`}
      aria-pressed={following}
      aria-label={following ? 'Dejar de seguir' : 'Seguir'}
    >
      {loading ? 'Procesando…' : following ? 'Siguiendo' : 'Seguir'}
    </button>
  );
};

export default FollowButton;