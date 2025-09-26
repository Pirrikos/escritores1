"use client";
import { useEffect, useState } from "react";

export default function TestPage() {
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setMsg("");
        
        const res = await fetch("/api/feed", { cache: "no-store" });
        const json = await res.json();
        
        if (!res.ok) {
          throw new Error(json.error || `Error ${res.status}: ${res.statusText}`);
        }
        
        setItems(json.data || []);
      } catch (e) {
        console.error("Error loading feed:", e);
        setMsg(`Error al cargar el feed: ${e.message}`);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <main style={{ maxWidth: 720, margin: "0 auto", padding: 16 }}>
        <h1>Feed publicado</h1>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          padding: '40px 0' 
        }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            border: '4px solid #f3f3f3', 
            borderTop: '4px solid #3498db', 
            borderRadius: '50%', 
            animation: 'spin 1s linear infinite' 
          }}></div>
          <span style={{ marginLeft: '12px', color: '#666' }}>
            Cargando publicaciones...
          </span>
        </div>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 16 }}>
      <h1>Feed publicado</h1>
      
      {msg && (
        <div style={{ 
          padding: '12px', 
          borderRadius: '6px', 
          backgroundColor: '#f8d7da',
          color: '#721c24',
          border: '1px solid #f5c6cb',
          marginBottom: '16px'
        }}>
          ⚠️ {msg}
        </div>
      )}
      
      {!msg && items.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px 0', 
          color: '#666' 
        }}>
          <p>Sin publicaciones (o aún no hay posts publicados).</p>
        </div>
      ) : (
        items.map(p => (
          <article key={p.id} style={{ 
            border: "1px solid #eee", 
            padding: 16, 
            margin: "16px 0",
            borderRadius: '8px',
            backgroundColor: '#fafafa'
          }}>
            <h3 style={{ margin: '0 0 8px 0', color: '#333' }}>{p.title}</h3>
            {p.display_name && (
              <small style={{ color: '#666', fontSize: '12px' }}>
                por {p.display_name}
              </small>
            )}
            {p.content && (
              <p style={{ 
                whiteSpace: "pre-wrap", 
                margin: '12px 0',
                lineHeight: '1.5'
              }}>
                {p.content}
              </p>
            )}
            {p.published_at && (
              <small style={{ color: '#888', fontSize: '11px' }}>
                {new Date(p.published_at).toLocaleString()}
              </small>
            )}
          </article>
        ))
      )}
    </main>
  );
}
