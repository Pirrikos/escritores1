import { NextResponse } from 'next/server';
import { getSupabaseRouteClient } from '@/lib/supabaseServer.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAliasLike(name: string | null | undefined, emailLocal?: string | null): boolean {
  if (!name) return true;
  const n = name.trim();
  if (!n) return true;
  // Generic placeholders or email-local fallbacks
  if (n.toLowerCase() === 'usuario') return true;
  if (emailLocal && n.toLowerCase() === emailLocal.toLowerCase()) return true;
  // Single token, all lowercase, looks like a handle
  if (!/\s/.test(n) && /^[a-z0-9._-]+$/.test(n)) return true;
  return false;
}

export async function POST(req: Request) {
  try {
    const supabase = await getSupabaseRouteClient();

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const user = userData.user;
    const meta = user.user_metadata || {} as Record<string, any>;
    const fullNameRaw: string | null = (meta.full_name as string) || (meta.name as string) || null;
    const composedName: string | null = ((meta.given_name || '') + ' ' + (meta.family_name || '')).trim() || null;
    const fullName: string | null = (fullNameRaw && fullNameRaw.trim().length > 0) 
      ? fullNameRaw.trim() 
      : (composedName && composedName.trim().length > 0 ? composedName.trim() : null);
    const emailLocal = user.email ? user.email.split('@')[0] : null;
    const avatarUrl: string | null = (meta.avatar_url as string) || null;

    // Read current profile
    const { data: profile, error: readErr } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .eq('id', user.id)
      .maybeSingle();

    if (readErr) {
      return NextResponse.json({ ok: false, error: 'profile_read_failed' }, { status: 500 });
    }

    const currentName = profile?.display_name || null;
    const desiredName = (fullName && fullName.trim().length > 0) ? fullName.trim() : currentName;
    const shouldUpdateName = !!desiredName && (isAliasLike(currentName, emailLocal) || currentName !== desiredName);
    const desiredAvatar = avatarUrl ?? profile?.avatar_url ?? null;
    const shouldUpdateAvatar = desiredAvatar !== (profile?.avatar_url ?? null);

    if (!shouldUpdateName && !shouldUpdateAvatar) {
      return NextResponse.json({ ok: true, updated: false, display_name: currentName, avatar_url: profile?.avatar_url ?? null });
    }

    const updatePayload: Record<string, any> = { id: user.id };
    if (shouldUpdateName && desiredName) updatePayload.display_name = desiredName;
    if (shouldUpdateAvatar) updatePayload.avatar_url = desiredAvatar;

    const { error: upsertErr } = await supabase
      .from('profiles')
      .upsert(updatePayload)
      .select('id')
      .single();

    if (upsertErr) {
      return NextResponse.json({ ok: false, error: 'profile_update_failed' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, updated: true, display_name: desiredName, avatar_url: desiredAvatar });
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'unexpected' }, { status: 500 });
  }
}