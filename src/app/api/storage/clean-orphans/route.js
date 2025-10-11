export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withErrorHandling, handleAuthError } from '@/lib/errorHandler.js';
import { getSupabaseRouteClient, getSupabaseServiceClient } from '@/lib/supabaseServer.js';

function normalizePath(userId, bucket, filePath) {
  if (!filePath) return null;
  let p = String(filePath);
  if (p.startsWith('http')) return null; // Ignorar URL externas
  if (p.startsWith('preview:')) return null; // Ignorar portadas generadas
  const prefix = `${bucket}/`;
  if (p.startsWith(prefix)) {
    p = p.substring(prefix.length);
  }
  // Solo consideramos archivos del usuario
  if (!p.startsWith(`${userId}/`)) return null;
  return p;
}

async function performCleanup() {
  const routeClient = await getSupabaseRouteClient();
  const { data: { user } } = await routeClient.auth.getUser();
  const serviceClient = getSupabaseServiceClient();

  const referencedWorks = new Set();
  const referencedChapters = new Set();
  let userId = user?.id || null;
  let isGlobal = false;
  let supabase = routeClient;

  // Si no hay usuario (cron/servidor), usar cliente de servicio y modo global
  if (!userId && serviceClient) {
    isGlobal = true;
    supabase = serviceClient;
  }
  // Si no hay contexto de usuario ni cliente de servicio, no continuar
  if (!userId && !isGlobal) {
    return handleAuthError(new Error('No autenticado'));
  }

  // works: file_url, cover_url
  try {
    let query = supabase
      .from('works')
      .select('file_url, cover_url, author_id');
    if (!isGlobal && userId) {
      query = query.eq('author_id', userId);
    }
    const { data: worksRows } = await query;
    if (Array.isArray(worksRows)) {
      for (const row of worksRows) {
        const uid = row?.author_id || userId;
        const fp1 = normalizePath(uid, 'works', row?.file_url);
        const fp2 = normalizePath(uid, 'works', row?.cover_url);
        if (fp1) referencedWorks.add(fp1);
        if (fp2) referencedWorks.add(fp2);
      }
    }
  } catch {}

  // chapters (tabla chapters): file_url, cover_url
  try {
    let query = supabase
      .from('chapters')
      .select('file_url, cover_url, author_id');
    if (!isGlobal && userId) {
      query = query.eq('author_id', userId);
    }
    const { data: chRows } = await query;
    if (Array.isArray(chRows)) {
      for (const row of chRows) {
        const uid = row?.author_id || userId;
        const fp1 = normalizePath(uid, 'chapters', row?.file_url);
        const fp2 = normalizePath(uid, 'chapters', row?.cover_url);
        if (fp1) referencedChapters.add(fp1);
        if (fp2) referencedChapters.add(fp2);
      }
    }
  } catch {}

  // chapters (histórico en posts con type='chapter')
  try {
    let query = supabase
      .from('posts')
      .select('file_url, cover_url, type, author_id')
      .eq('type', 'chapter');
    if (!isGlobal && userId) {
      query = query.eq('author_id', userId);
    }
    const { data: postChRows } = await query;
    if (Array.isArray(postChRows)) {
      for (const row of postChRows) {
        const uid = row?.author_id || userId;
        const fp1 = normalizePath(uid, 'chapters', row?.file_url);
        const fp2 = normalizePath(uid, 'chapters', row?.cover_url);
        if (fp1) referencedChapters.add(fp1);
        if (fp2) referencedChapters.add(fp2);
      }
    }
  } catch {}

  // Listar archivos en Storage bajo la carpeta del usuario
  const toDeleteWorks = [];
  const toDeleteChapters = [];
  const MAX_DELETE = 200;

  if (!isGlobal && userId) {
    // Limpieza por usuario
    try {
      const { data: worksList } = await supabase.storage
        .from('works')
        .list(userId, { limit: 1000 });
      for (const entry of worksList || []) {
        const fullPath = `${userId}/${entry.name}`;
        if (!referencedWorks.has(fullPath)) {
          toDeleteWorks.push(fullPath);
        }
      }
    } catch {}

    try {
      const { data: chaptersList } = await supabase.storage
        .from('chapters')
        .list(userId, { limit: 1000 });
      for (const entry of chaptersList || []) {
        const fullPath = `${userId}/${entry.name}`;
        if (!referencedChapters.has(fullPath)) {
          toDeleteChapters.push(fullPath);
        }
      }
    } catch {}
  } else {
    // Limpieza global (cron) iterando por usuarios
    try {
      const { data: profiles } = await supabase.from('profiles').select('id');
      const userIds = (profiles || []).map((p) => p.id).filter(Boolean);
      for (const uid of userIds) {
        // works por usuario
        try {
          const { data: wList } = await supabase.storage.from('works').list(uid, { limit: 1000 });
          for (const entry of wList || []) {
            const fullPath = `${uid}/${entry.name}`;
            if (!referencedWorks.has(fullPath)) {
              toDeleteWorks.push(fullPath);
            }
          }
        } catch {}
        // chapters por usuario
        try {
          const { data: cList } = await supabase.storage.from('chapters').list(uid, { limit: 1000 });
          for (const entry of cList || []) {
            const fullPath = `${uid}/${entry.name}`;
            if (!referencedChapters.has(fullPath)) {
              toDeleteChapters.push(fullPath);
            }
          }
        } catch {}
      }
    } catch {}
  }

  // Limitar borrado por seguridad (por llamada)
  const delWorks = toDeleteWorks.slice(0, MAX_DELETE);
  const delChapters = toDeleteChapters.slice(0, MAX_DELETE);

  const result = {
    success: true,
    scope: isGlobal ? 'global' : 'user',
    userId,
    summary: {
      referenced: {
        works: referencedWorks.size,
        chapters: referencedChapters.size,
      },
      candidates: {
        works: toDeleteWorks.length,
        chapters: toDeleteChapters.length,
      },
      deleted: {
        works: 0,
        chapters: 0,
      }
    }
  };

  try {
    if (delWorks.length > 0) {
      const { error } = await supabase.storage.from('works').remove(delWorks);
      if (!error) {
        result.summary.deleted.works = delWorks.length;
      }
    }
  } catch {}

  try {
    if (delChapters.length > 0) {
      const { error } = await supabase.storage.from('chapters').remove(delChapters);
      if (!error) {
        result.summary.deleted.chapters = delChapters.length;
      }
    }
  } catch {}

  return NextResponse.json(result);
}

export async function GET(request) {
  const handler = withErrorHandling(async () => {
    return await performCleanup();
  });
  return handler(request);
}

export async function POST(request) {
  const handler = withErrorHandling(async () => {
    return await performCleanup();
  });
  return handler(request);
}