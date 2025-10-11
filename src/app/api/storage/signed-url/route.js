export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabaseServer.js';
import { withErrorHandling, createErrorResponse, handleAuthError, ERROR_CODES } from '@/lib/errorHandler.js';

export async function POST(request) {
  return withErrorHandling(async (req) => {
    // Intentar obtener sesión de usuario (no requiere rol admin). Si no hay usuario, se permite continuar
    // siempre que el archivo pertenezca a contenido publicado.
    const supabaseRoute = await createServerSupabaseClient();
    // Obtener usuario con fallback desde cookie si fuese necesario
    let { data: { user }, error: authErr } = await supabaseRoute.auth.getUser();
    if ((!user || authErr) && req?.headers?.get('cookie')) {
      try {
        const cookieHeader = req.headers.get('cookie') || '';
        const tokenMatch = cookieHeader.match(/(?:^|;\s*)(sb-access-token|sb:token)=([^;]+)/i);
        const jwt = tokenMatch?.[2];
        if (jwt) {
          const result = await supabaseRoute.auth.getUser(jwt);
          user = result.data?.user || user;
          authErr = result.error || undefined;
        }
      } catch {}
    }
    const isAuthenticated = !authErr && !!user;

    // Leer cuerpo solo para usuarios autorizados
    const { filePath, expiresIn = 3600, bucket } = await req.json();
    
    if (!filePath) {
      return createErrorResponse(
        ERROR_CODES.MISSING_REQUIRED_FIELD,
        'filePath es requerido',
        { field: 'filePath' }
      );
    }

    // Aumentar duración mínima a 1 hora (3600 segundos)
    const finalExpiresIn = Math.max(expiresIn, 3600);

    // Utilidad: extraer bucket y ruta desde una URL completa de Supabase Storage
    const extractFromStorageUrl = (input) => {
      try {
        const url = new URL(input);
        const m = url.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/([^\/]+)\/(.+)/);
        if (m && m[1] && m[2]) {
          return { bucket: m[1], path: m[2] };
        }
      } catch {}
      return null;
    };

    // Determinar el bucket correcto
    let bucketName = bucket;
    
    if (!bucketName) {
      // Si no se especifica bucket, intentar determinarlo por el contexto del filePath
      // Buscar en la base de datos para determinar si es un work o chapter
      const supabaseForQuery = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );

      // Buscar primero en chapters usando la ruta completa
      const { data: chapterData } = await supabaseForQuery
        .from('chapters')
        .select('file_url, cover_url')
        .or(`file_url.eq.${filePath},cover_url.eq.${filePath}`)
        .limit(1);

      if (chapterData && chapterData.length > 0) {
        bucketName = 'chapters';
      } else {
        // Si no se encuentra en chapters, buscar en works
        const { data: workData } = await supabaseForQuery
          .from('works')
          .select('file_url, cover_url')
          .or(`file_url.eq.${filePath},cover_url.eq.${filePath}`)
          .limit(1);

        if (workData && workData.length > 0) {
          bucketName = 'works';
        } else {
          // Si no se encuentra con ruta exacta, intentar con nombre de archivo
          const fileName = filePath.split('/').pop();
          
          // Buscar en chapters por nombre de archivo
          const { data: chapterByName } = await supabaseForQuery
            .from('chapters')
            .select('file_url, cover_url')
            .or(`file_url.ilike.%${fileName}%,cover_url.ilike.%${fileName}%`)
            .limit(1);

          if (chapterByName && chapterByName.length > 0) {
            bucketName = 'chapters';
          } else {
            // Por defecto usar 'chapters' para archivos que parecen ser de capítulos
            bucketName = filePath.includes('capitulo-') || filePath.includes('cover-') ? 'chapters' : 'works';
          }
        }
      }
    }

    // Validar publicación si no está autenticado
    if (!isAuthenticated) {
      try {
        const supabaseForQuery = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY,
          { auth: { autoRefreshToken: false, persistSession: false } }
        );

        let isPublished = false;
        if (bucketName === 'chapters') {
          const { data: ch } = await supabaseForQuery
            .from('chapters')
            .select('id, status')
            .or(`file_url.eq.${filePath},cover_url.eq.${filePath}`)
            .limit(1);
          isPublished = Array.isArray(ch) && ch[0]?.status === 'published';
        } else if (bucketName === 'works') {
          const { data: w } = await supabaseForQuery
            .from('works')
            .select('id, status')
            .or(`file_url.eq.${filePath},cover_url.eq.${filePath}`)
            .limit(1);
          isPublished = Array.isArray(w) && w[0]?.status === 'published';
        }

        if (!isPublished) {
          return createErrorResponse(
            ERROR_CODES.UNAUTHORIZED,
            'No autenticado o archivo no publicado'
          );
        }
      } catch (e) {
        return createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Validación pública fallida', 401);
      }
    }

    // Usar service role key para operaciones administrativas como generar URLs firmadas
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    
    // Limpiar y normalizar el filePath para evitar duplicación del prefijo del bucket y URLs completas
    let cleanFilePath = (filePath || '').trim();

    // Si es una URL completa de Supabase, extraer bucket y ruta
    if (cleanFilePath.startsWith('http://') || cleanFilePath.startsWith('https://')) {
      const extracted = extractFromStorageUrl(cleanFilePath);
      if (extracted) {
        // Priorizar bucket proporcionado por el cliente si existe, de lo contrario usar el extraído
        bucketName = bucketName || extracted.bucket;
        cleanFilePath = extracted.path;
      } else {
        // Si es una URL externa que no es de Supabase, no podemos firmarla
        return createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          'No se puede generar URL firmada para URLs externas'
        );
      }
    }

    // Si el filePath incluye el prefijo del bucket, removerlo
    if (bucketName && cleanFilePath.startsWith(`${bucketName}/`)) {
      cleanFilePath = cleanFilePath.substring(`${bucketName}/`.length);
    }

    // Remover prefijos comunes innecesarios y barras iniciales
    cleanFilePath = cleanFilePath.replace(/^public\//, '');
    cleanFilePath = cleanFilePath.replace(/^\/+/, '');

    // Log de depuración para entender bucket y ruta efectiva
    try {
      console.log('[signed-url] ▶ bucket:', bucketName, 'orig:', filePath, 'clean:', cleanFilePath);
    } catch {}
    // Intentar variantes comunes para evitar 404 por diferencias mínimas
    const dropFirstFolder = (p) => {
      const parts = (p || '').split('/');
      return parts.length > 1 ? parts.slice(1).join('/') : p;
    };
    const candidates = Array.from(new Set([
      cleanFilePath,
      filePath,
      cleanFilePath.replace(/^works\//, '').replace(/^chapters\//, ''),
      cleanFilePath.startsWith('/') ? cleanFilePath.slice(1) : `/${cleanFilePath}`,
      dropFirstFolder(cleanFilePath),
    ].filter(Boolean)));

    let signed = null;
    let lastErr = null;
    for (const candidate of candidates) {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(candidate, finalExpiresIn);
      if (data && !error) {
        signed = data;
        try { console.log('[signed-url] ✓ firmado con path:', candidate); } catch {}
        break;
      }
      lastErr = error;
      try { console.warn('[signed-url] ✗ intento fallido con path:', candidate, 'err:', error?.message); } catch {}
    }

    if (!signed) {
      const msg = (lastErr?.message || '').toLowerCase();
      if (msg.includes('not found') || msg.includes('no such') || msg.includes('does not exist')) {
        return createErrorResponse(
          ERROR_CODES.RESOURCE_NOT_FOUND,
          'Archivo no encontrado en almacenamiento',
          { bucket: bucketName, filePath: cleanFilePath, originalMessage: lastErr?.message }
        );
      }
      return createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        'Error generando URL firmada',
        { bucket: bucketName, filePath: cleanFilePath, originalMessage: lastErr?.message }
      );
    }

    return NextResponse.json({
      success: true,
      signedUrl: signed.signedUrl,
      expiresAt: new Date(Date.now() + finalExpiresIn * 1000).toISOString()
    });
  })(request);
}