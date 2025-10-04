export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ensureAdmin } from '@/lib/adminAuth.server.js';
import { withErrorHandling, createErrorResponse, handleAuthError, ERROR_CODES } from '@/lib/errorHandler.js';

export async function POST(request) {
  return withErrorHandling(async (req) => {
    // Verificación de administrador (RLS-safe) ANTES de leer cuerpo
    const admin = await ensureAdmin(req);
    if (!admin.ok) {
      if (admin.code === 'UNAUTHORIZED') {
        return handleAuthError(admin.error || new Error('No autenticado'), {
          endpoint: '/api/storage/signed-url',
          method: 'POST'
        });
      }
      return createErrorResponse(
        ERROR_CODES.FORBIDDEN,
        'Acceso denegado',
        { requiredRole: 'admin', userRole: admin.profile?.role }
      );
    }

    // Leer cuerpo solo para usuarios autorizados
    const { filePath, expiresIn = 3600, bucket } = await req.json();
    
    if (!filePath) {
      return NextResponse.json(
        { error: 'filePath es requerido' },
        { status: 400 }
      );
    }

    // Aumentar duración mínima a 1 hora (3600 segundos)
    const finalExpiresIn = Math.max(expiresIn, 3600);

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
          .select('file_url, cover_image_url')
          .or(`file_url.eq.${filePath},cover_image_url.eq.${filePath}`)
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
    
    // Limpiar el filePath para evitar duplicación del prefijo del bucket
    let cleanFilePath = filePath;
    
    // Si el filePath incluye el prefijo del bucket, removerlo
    if (cleanFilePath.startsWith(`${bucketName}/`)) {
      cleanFilePath = cleanFilePath.substring(`${bucketName}/`.length);
    }
    
    // Generar URL firmada con el bucket correcto y filePath limpio
    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(cleanFilePath, finalExpiresIn);

    if (error) {
      return NextResponse.json(
        { error: 'Error generando URL firmada', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      signedUrl: data.signedUrl,
      expiresAt: new Date(Date.now() + finalExpiresIn * 1000).toISOString()
    });
  })(request);
}