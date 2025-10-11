import type { SupabaseClient } from '@supabase/supabase-js';

// Devuelve la última página leída (>0) para un usuario y un slug dado
export async function getLastPageForUserSlug(
  supabase: SupabaseClient,
  userId: string,
  type: 'work' | 'chapter',
  slug: string
): Promise<number | null> {
  try {
    const { data, error } = await supabase
      .from('reading_progress')
      .select('last_page, updated_at')
      .eq('user_id', userId)
      .eq('content_type', type)
      .eq('content_slug', slug)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) return null;
    const row = (data || [])[0] as { last_page?: number } | undefined;
    const lp = typeof row?.last_page === 'number' ? row!.last_page! : null;
    if (lp && lp > 0) return lp;
    return null;
  } catch {
    return null;
  }
}