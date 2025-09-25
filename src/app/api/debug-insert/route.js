import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getSupabaseRouteClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) return NextResponse.json({ where:"getUser", error:userErr.message }, { status: 500 });
  const user = userData?.user;
  if (!user) return NextResponse.json({ error:"No autenticado" }, { status: 401 });

  const { data, error } = await supabase
    .from("posts")
    .insert({
      author_id: user.id,
      title: "Debug desde prod",
      content: "Inserción de prueba",
      status: "published",
      published_at: new Date().toISOString(),
    })
    .select("id,title,status,published_at")
    .single();

  if (error) return NextResponse.json({ ok:false, error: error.message, details: error.details, hint: error.hint }, { status: 500 });
  return NextResponse.json({ ok:true, data }, { status: 201 });
}
