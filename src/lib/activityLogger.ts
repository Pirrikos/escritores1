export type ContentType = 'work' | 'chapter' | 'post' | 'other';

/**
 * Normaliza bucket y filePath a partir de una URL firmada de Supabase
 * Espera rutas del tipo: /sign/<bucket>/<filePath>
 */
export function normalizeBucketAndPath(src: string, fallback?: { bucket?: string | null; path?: string | null }) {
  try {
    if (src && (src.startsWith('http://') || src.startsWith('https://'))) {
      const u = new URL(src);
      const parts = u.pathname.split('/');
      const signIdx = parts.findIndex((p) => p === 'sign');
      if (signIdx >= 0 && parts.length > signIdx + 2) {
        const bucket = parts[signIdx + 1];
        const path = parts.slice(signIdx + 2).join('/');
        return { bucket, path };
      }
    }
  } catch {}
  return { bucket: fallback?.bucket ?? null, path: fallback?.path ?? src ?? null };
}

/**
 * Registra una vista de PDF en el endpoint de actividad.
 */
export async function logPdfView(params: {
  contentType: ContentType;
  contentSlug?: string | null;
  urlOrPath: string;
  bucketOverride?: string | null;
}) {
  const { contentType, contentSlug, urlOrPath, bucketOverride } = params;
  const normalized = normalizeBucketAndPath(urlOrPath, { bucket: bucketOverride ?? null, path: urlOrPath });
  try {
    await fetch('/api/activity/view-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        contentType,
        contentSlug,
        bucket: normalized.bucket,
        filePath: normalized.path,
      }),
    });
  } catch {}
}