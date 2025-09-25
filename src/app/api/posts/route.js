export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "../../../lib/supabaseServer";

function slugify(s) {
  return s.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function POST(req) {
  try {
    const supabase = getSupabaseRouteClient();

    // 1) Usuario
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) return NextResponse.json({ code:"AUTH_GET_USER_ERROR", error:userErr.message }, { status: 500 });
    const user = userData?.user;
    if (!user) return NextResponse.json({ code:"NO_AUTH", error:"No autenticado" }, { status: 401 });

    // 2) Datos
    const body = await req.json().catch(() => ({}));
    const title = (body.title || "").trim();
    const content = (body.content || "").trim();
    const status = body.status === "published" ? "published" : "draft";
    const published_at = status === "published" ? new Date().toISOString() : null;

    // 👉 campos que suelen ser NOT NULL en tu tabla
    const type = body.type || "post"; // <— IMPRESCINDIBLE si 'type' es NOT NULL
    const slug = body.slug || `${slugify(title || "post")}-${Math.random().toString(36).slice(2,6)}`;

    if (!title) return NextResponse.json({ code:"TITLE_REQUIRED", error:"Título requerido" }, { status: 400 });

    // 3) Insert
    const { data, error } = await supabase
      .from("posts")
      .insert({
        author_id: user.id,
        title,
        content,
        status,
        published_at,
        type,   // 👈 importante
        // slug, // 👈 descomenta SOLO si tu tabla tiene columna 'slug' y es NOT NULL
      })
      .select("id,title,status,published_at,type")
      .single();

    if (error) {
      return NextResponse.json(
        { code: error.code || "DB_ERROR", error: error.message, details: error.details, hint: error.hint },
        { status: 500 }
      );
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ code:"UNEXPECTED", error: String(e?.message || e) }, { status: 500 });
  }
}
