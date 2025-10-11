'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

type Profile = {
  id: string;
  display_name?: string;
  avatar_url?: string;
  username?: string;
};

type CommentRow = {
  id: string;
  target_type: 'post' | 'chapter' | 'work';
  target_id: string;
  parent_id?: string | null;
  user_id: string;
  body: string;
  is_edited: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  profiles?: Profile | null;
};

const VALID_TYPES = new Set(['post', 'chapter', 'work']);

export default function ComentariosPage() {
  const searchParams = useSearchParams();
  const targetType = searchParams.get('target_type') || '';
  const targetId = searchParams.get('target_id') || '';
  const valid = VALID_TYPES.has(targetType) && !!targetId;

  const supabase = useMemo(() => createClientComponentClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [body, setBody] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setUserId(data.user?.id || null);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [supabase]);

  const fetchComments = async () => {
    if (!valid) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const url = `/api/comments?target_type=${encodeURIComponent(targetType)}&target_id=${encodeURIComponent(targetId)}&limit=50`;
      const res = await fetch(url, { method: 'GET' });
      const json = await res.json();
      setComments(Array.isArray(json.data) ? json.data : []);
    } catch (e) {
      setErrorMsg('No se pudieron cargar los comentarios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchComments(); }, [targetType, targetId]);

  const submitComment = async () => {
    if (!valid || !userId) return;
    const text = body.trim();
    if (!text) return;
    setPosting(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, body: text })
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setErrorMsg('No se pudo publicar el comentario');
      } else {
        setBody('');
        await fetchComments();
      }
    } catch (e) {
      setErrorMsg('Error de red al publicar');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-slate-200/60">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Comentarios</h1>
            <Link href="/" className="text-sm text-indigo-700 hover:underline">Volver</Link>
          </div>
          {!valid ? (
            <p className="text-gray-700">Parámetros inválidos. Usa target_type y target_id.</p>
          ) : (
            <div className="space-y-6">
              {/* Formulario */}
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                {userId ? (
                  <div className="space-y-3">
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="Escribe un comentario…"
                      className="w-full min-h-[80px] rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      maxLength={5000}
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-500">Máximo 5000 caracteres</p>
                      <button
                        onClick={submitComment}
                        disabled={posting || body.trim().length === 0}
                        className="inline-flex items-center gap-2 rounded-md bg-indigo-600 text-white px-4 py-2 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {posting ? 'Publicando…' : 'Publicar'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-700">Inicia sesión para comentar.</p>
                )}
              </div>

              {errorMsg && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
                  {errorMsg}
                </div>
              )}

              {/* Lista */}
              <div className="space-y-4">
                {loading ? (
                  <p className="text-slate-600">Cargando comentarios…</p>
                ) : comments.length === 0 ? (
                  <p className="text-slate-600">Sé el primero en comentar.</p>
                ) : (
                  comments.map((c) => {
                    const author = c.profiles?.display_name || 'Usuario';
                    const isDeleted = c.is_deleted;
                    return (
                      <div key={c.id} className="rounded-lg border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm text-slate-700">
                            <span className="font-medium">{author}</span>
                            <span className="ml-2 text-slate-500">{new Date(c.created_at).toLocaleString()}</span>
                          </div>
                          {c.is_edited && (
                            <span className="text-xs text-slate-500">(editado)</span>
                          )}
                        </div>
                        <p className={`text-slate-800 ${isDeleted ? 'italic text-slate-500' : ''}`}>{c.body}</p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}