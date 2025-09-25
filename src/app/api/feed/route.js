import { NextResponse } from "next/server";
import {getSupabaseRouteClient } from "../../../lib/supabaseServer";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const supabase = getSupabaseRouteClient();
  const { data, error } = await supabase
    .from("post_feed")
    .select("*")
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
