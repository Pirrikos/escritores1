import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabaseServer";

export async function POST(req) {
  const supabase = getSupabaseRouteClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 });
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json();
  const title = (body.title || "").trim();
  const content = (body.content || "").trim();
  const status = body.status === "published" ? "published" : "draft";
  const published_at = status === "published" ? new Date().toISOString() : null;

  if (!title) return NextResponse.json({ error: "Título requerido" }, { status: 400 });

  const { data, error } = await supabase
    .from("posts")
    .insert({
      author_id: user.id,
      title,
      content,
      status,
      published_at,
    })
    .select("id,title,status,published_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
