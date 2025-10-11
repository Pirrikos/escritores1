import { getSupabaseBrowserClient } from '@/lib/supabaseClient';

export async function getCurrentUserId(): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

export async function isFollowing(targetUserId: string): Promise<boolean> {
  if (!targetUserId) return false;
  try {
    const res = await fetch(`/api/follows?targetId=${encodeURIComponent(targetUserId)}`, { method: 'GET', credentials: 'include' });
    if (!res.ok) return false;
    const json = await res.json();
    return !!json?.following;
  } catch {
    return false;
  }
}

export async function follow(targetUserId: string): Promise<{ ok: boolean; message?: string }>{
  try {
    const res = await fetch('/api/follows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ targetId: targetUserId })
    });
    const json = await res.json();
    return { ok: !!json?.ok, message: json?.message };
  } catch {
    return { ok: false, message: 'Error de red' };
  }
}

export async function unfollow(targetUserId: string): Promise<{ ok: boolean; message?: string }>{
  try {
    const res = await fetch('/api/follows', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ targetId: targetUserId })
    });
    const json = await res.json();
    return { ok: !!json?.ok, message: json?.message };
  } catch {
    return { ok: false, message: 'Error de red' };
  }
}

export async function getFollowCounts(userId: string): Promise<{ followers: number; following: number }>{
  try {
    const res = await fetch(`/api/follows?countsOf=${encodeURIComponent(userId)}`, { method: 'GET' });
    if (!res.ok) return { followers: 0, following: 0 };
    const json = await res.json();
    return { followers: Number(json?.followers || 0), following: Number(json?.following || 0) };
  } catch {
    return { followers: 0, following: 0 };
  }
}