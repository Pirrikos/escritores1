import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request) {
  try {
    const { filePath, expiresIn = 3600, bucket } = await request.json();
    
    console.log('🔍 signed-url endpoint - Parámetros recibidos:', { filePath, expiresIn, bucket });
    
    if (!filePath) {
      console.log('❌ signed-url endpoint - filePath vacío o null');
      return NextResponse.json(
        { error: 'filePath es requerido' },
        { status: 400 }
      );
    }

    // Aumentar duración mínima a 1 hora (3600 segundos)
    const finalExpiresIn = Math.max(expiresIn, 3600);
    console.log(`⏰ signed-url endpoint - Duración ajustada: ${finalExpiresIn}s (${finalExpiresIn/60} minutos)`);

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

      // Extraer el nombre del archivo del filePath
      const fileName = filePath.split('/').pop();
      
      // Buscar primero en works
      const { data: workData } = await supabaseForQuery
        .from('works')
        .select('file_url, cover_image_url')
        .or(`file_url.ilike.%${fileName}%,cover_image_url.ilike.%${fileName}%`)
        .limit(1);

      if (workData && workData.length > 0) {
        bucketName = 'works';
      } else {
        // Si no se encuentra en works, buscar en chapters
        const { data: chapterData } = await supabaseForQuery
          .from('chapters')
          .select('file_url, cover_image_url')
          .or(`file_url.ilike.%${fileName}%,cover_image_url.ilike.%${fileName}%`)
          .limit(1);

        if (chapterData && chapterData.length > 0) {
          bucketName = 'chapters';
        } else {
          // Por defecto usar 'works' si no se encuentra
          bucketName = 'works';
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
      console.log(`🧹 signed-url endpoint - Removiendo prefijo "${bucketName}/" del filePath`);
      console.log(`   Original: ${filePath}`);
      console.log(`   Limpio: ${cleanFilePath}`);
    }
    
    // Generar URL firmada con el bucket correcto y filePath limpio
    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(cleanFilePath, finalExpiresIn);

    if (error) {
      console.error('❌ signed-url endpoint - Error de Supabase:', error);
      console.error('❌ signed-url endpoint - Detalles del error:', JSON.stringify(error, null, 2));
      return NextResponse.json(
        { error: 'Error generando URL firmada', details: error.message },
        { status: 500 }
      );
    }

    console.log('✅ signed-url endpoint - URL firmada generada exitosamente');
    return NextResponse.json({
      signedUrl: data.signedUrl,
      expiresAt: new Date(Date.now() + finalExpiresIn * 1000).toISOString()
    });

  } catch (error) {
    console.error('❌ signed-url endpoint - Error general:', error);
    console.error('❌ signed-url endpoint - Stack trace:', error.stack);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    );
  }
}