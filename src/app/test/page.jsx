"use client";
import { useEffect, useState } from "react";

export default function TestPage() {
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/feed", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Error");
        setItems(json.data || []);
      } catch (e) {
        setMsg(e.message);
      }
    })();
  }, []);

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 16 }}>
      <h1>Feed publicado</h1>
      {msg && <p>⚠️ {msg}</p>}
      {items.length === 0 ? (
        <p>Sin publicaciones (o aún no hay posts publicados).</p>
      ) : (
        items.map(p => (
          <article key={p.id} style={{ border: "1px solid #eee", padding: 12, margin: "12px 0" }}>
            <h3>{p.title}</h3>
            {p.display_name && <small>por {p.display_name}</small>}
            {p.content && <p style={{ whiteSpace: "pre-wrap" }}>{p.content}</p>}
            {p.published_at && <small>{new Date(p.published_at).toLocaleString()}</small>}
          </article>
        ))
      )}
    </main>
  );
}
