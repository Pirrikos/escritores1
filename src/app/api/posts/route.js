export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "../../../lib/supabaseServer";

export async function POST(req) {
  try {
    const supabase = getSupabaseRouteClient();

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) return NextResponse.json({ code:"AUTH_GET_USER_ERROR", error:userErr.message }, { status: 500 });
    const user = userData?.user;
    if (!user) return NextResponse.json({ code:"NO_AUTH", error:"No autenticado" }, { status: 401 });

    // (Opcional) asegurar perfil antes del insert para satisfacer la FK
    const profile = {
      id: user.id,
      display_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Usuario",
      avatar_url: user.user_metadata?.avatar_url ?? null,
    };
    const { error: upsertErr } = await supabase.from("profiles").upsert(profile).select("id").single();
    if (upsertErr) {
      return NextResponse.json({ code:"PROFILE_UPSERT_ERROR", error: upsertErr.message, details: upsertErr.details }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const title = (body.title || "").trim();
    const content = (body.content || "").trim();
    const status = body.status === "published" ? "published" : "draft";

    // Validación básica
    if (!title || !content) {
      return NextResponse.json({ 
        code: "VALIDATION_ERROR", 
        error: "Título y contenido son requeridos" 
      }, { status: 400 });
    }

    // Insertar el post
    const { data: post, error: insertErr } = await supabase
      .from("posts")
      .insert({
        title,
        content,
        status,
        author_id: user.id
      })
      .select()
      .single();

    if (insertErr) {
      return NextResponse.json({ 
        code: "POST_INSERT_ERROR", 
        error: insertErr.message, 
        details: insertErr.details 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      post 
    }, { status: 201 });

  } catch (error) {
    console.error("Error en POST /api/posts:", error);
    return NextResponse.json({ 
      code: "INTERNAL_ERROR", 
      error: "Error interno del servidor" 
    }, { status: 500 });
  }
}
