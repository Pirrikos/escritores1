import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export function getSupabaseRouteClient() {
  return createRouteHandlerClient({ cookies });
}
