import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getSupabaseRouteClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ user: data.user || null });
}
