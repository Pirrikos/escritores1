import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";

export async function getSupabaseRouteClient() {
  // Ensure compatibility with Next.js where cookies() may be async
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
  return getSupabaseRouteClient();
}

// Cliente de servicio (service role) para operaciones internas seguras en servidor
// Úsalo solo en rutas de servidor y nunca en el cliente.
export function getSupabaseServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return null;
  try {
    return createClient(supabaseUrl, serviceKey);
  } catch {
    return null;
  }
}
