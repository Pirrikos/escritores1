import { NextResponse } from 'next/server';
import { createServerSupabaseClient, getSupabaseServiceClient } from '@/lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KNOWN_TABLES = [
  'profiles',
  'works',
  'chapters',
  'posts',
  'likes',
  'comment_likes',
  'comments',
  'comment_reports',
  'follows',
  'content_views',
  'reading_progress',
  'reading_list',
  'reading_list_chapters',
  'migration_log',
];

export async function GET() {
  try {
    // Prefer service role to bypass RLS for schema diagnostics
    const serviceClient = getSupabaseServiceClient();
    const client = serviceClient || (await createServerSupabaseClient());

    const results: Array<{ table: string; exists: boolean; count?: number; error?: string }> = [];

    for (const table of KNOWN_TABLES) {
      try {
        const { count, error } = await client
          .from(table)
          .select('*', { head: true, count: 'exact' })
          .limit(1);
        if (error) {
          const msg = error.message || 'unknown_error';
          const notExists = /relation .* does not exist/i.test(msg) || /undefined table/i.test(msg);
          results.push({ table, exists: !notExists, error: msg });
        } else {
          results.push({ table, exists: true, count: count ?? 0 });
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        const notExists = /relation .* does not exist/i.test(msg) || /undefined table/i.test(msg);
        results.push({ table, exists: !notExists, error: msg });
      }
    }

    return NextResponse.json({ tables: results }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'diagnostic_failed', message: msg }, { status: 500 });
  }
}