// src/app/write/page.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabaseClient";

import { Button, Input, Textarea } from "@/components/ui";

export default function WritePage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [session, setSession] = useState(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("draft");     // 'draft' | 'published'
  const [type, setType] = useState("poem");          // 'poem'  | 'chapter'
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  const signInWithGoogle = async () => {
    setMsg("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/write` },
    });
    if (error) setMsg(`Error: ${error.message}`);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setMsg("Sesión cerrada.");
    setSession(null);
  };

  const publish = async (e) => {
    e.preventDefault();
    setMsg("");
    setSaving(true);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, status }),
      });

      const ct = res.headers.get("content-type") || "";
      const payload = ct.includes("application/json")
        ? await res.json()
        : { error: await res.text() };

      if (!res.ok) {
        setMsg(`Error ${res.status}: ${payload.error || "Fallo al guardar"}`);
        return;
      }

      // Reset del formulario
      setTitle("");
      setContent("");
      setStatus("draft");
      setType("poem");
      setMsg(`Guardado: ${payload.post?.title || "Post sin título"}`);
    } catch (err) {
      setMsg(`Error de red: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 16, display: "grid", gap: 12 }}>
      <h1 style={{ margin: 0 }}>Escribir</h1>

      <p style={{ fontSize: 12, opacity: 0.7 }}>
        Sesión: {session ? `OK (${session.user?.email})` : "NO"}
      </p>

      {!session ? (
        <div style={{ display: "grid", gap: 8 }}>
          <Button onClick={signInWithGoogle}>Entrar con Google</Button>
          {msg && <p>{msg}</p>}
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span>Conectado</span>
            <Button variant="outline" size="sm" onClick={signOut}>Salir</Button>
          </div>

          <form
            onSubmit={publish}
            style={{ display: "grid", gap: 8, border: "1px solid #eee", padding: 12, borderRadius: 8 }}
          >
            <Input
              label="Título"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Escribe el título de tu post..."
              fullWidth
              required
            />
            <Textarea
              label="Contenido"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escribe el contenido de tu post..."
              rows={10}
              fullWidth
              required
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Estado:
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="draft">Borrador</option>
                <option value="published">Publicado</option>
              </select>
            </div>

            <label>
              Tipo:&nbsp;
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="poem">Poema</option>
                <option value="chapter">Capítulo</option>
              </select>
            </label>

            <Button 
              type="submit" 
              disabled={saving}
              loading={saving}
            >
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </form>

          {msg && <p>{msg}</p>}
        </>
      )}
    </main>
  );
}
