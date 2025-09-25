// src/lib/supabaseClient.js
"use client";
import { createBrowserSupabaseClient } from "@supabase/auth-helpers-nextjs";

export function getSupabaseBrowserClient() {
  return createBrowserSupabaseClient({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}
