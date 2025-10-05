import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export async function getCurrentUserId(): Promise<string | null> {
  const supabase = createClientComponentClient();
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

export async function isFollowing(targetUserId: string): Promise<boolean> {
  const supabase = createClientComponentClient();
  const { data } = await supabase.auth.getUser();
  const me = data?.user?.id;
  if (!me || !targetUserId || me === targetUserId) return false;
  const { data: rows, error } = await supabase
    .from('follows')
    .select('id')
    .eq('follower_id', me)
    .eq('following_id', targetUserId)
    .limit(1);
  if (error) return false;
  return Array.isArray(rows) && rows.length > 0;
}

export async function follow(targetUserId: string): Promise<{ ok: boolean; message?: string }>{
  const supabase = createClientComponentClient();
  const { data } = await supabase.auth.getUser();
  const me = data?.user?.id;
  if (!me) return { ok: false, message: 'No autenticado' };
  if (!targetUserId) return { ok: false, message: 'Usuario objetivo inválido' };
  if (me === targetUserId) return { ok: false, message: 'No puedes seguirte a ti mismo' };
  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: me, following_id: targetUserId });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function unfollow(targetUserId: string): Promise<{ ok: boolean; message?: string }>{
  const supabase = createClientComponentClient();
  const { data } = await supabase.auth.getUser();
  const me = data?.user?.id;
  if (!me) return { ok: false, message: 'No autenticado' };
  if (!targetUserId) return { ok: false, message: 'Usuario objetivo inválido' };
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', me)
    .eq('following_id', targetUserId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function getFollowCounts(userId: string): Promise<{ followers: number; following: number }>{
  const supabase = createClientComponentClient();
  const followersRes = await supabase.rpc('get_followers_count', { user_uuid: userId });
  const followingRes = await supabase.rpc('get_following_count', { user_uuid: userId });
  const followers = typeof followersRes.data === 'number' ? followersRes.data : 0;
  const following = typeof followingRes.data === 'number' ? followingRes.data : 0;
  return { followers, following };
}