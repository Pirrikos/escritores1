import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function getSupabaseRouteClient() {
  const cookieStore = await cookies();
  return createRouteHandlerClient(
    { cookies: () => cookieStore },
    {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    }
  );
}

// Alias para compatibilidad con el sistema de backup
export async function createServerSupabaseClient() {
  return await getSupabaseRouteClient();
}
