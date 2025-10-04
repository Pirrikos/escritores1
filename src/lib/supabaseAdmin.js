/**
 * Supabase Admin Client (server-only)
 * Uses the Service Role key without relying on Next.js cookies.
 * Intended for background jobs like backups and maintenance tasks.
 */

import { createClient } from '@supabase/supabase-js';

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Fallback to anon key only for read operations if service key is missing
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const key = serviceKey || anonKey;

  const client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return client;
}

export default getSupabaseAdmin;