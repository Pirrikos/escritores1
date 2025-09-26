import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { withErrorHandling, createErrorResponse, handleAuthError, ERROR_CODES } from '@/lib/errorHandler';

async function POST(request) {
  try {
    const supabase = createServerSupabaseClient();
    
    // Verificar autenticación
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session?.user) {
      return handleAuthError('Usuario no autenticado');
    }

    const { userId } = await request.json();
    
    // Verificar que el usuario solo puede consultar su propio rate limit
    if (userId !== session.user.id) {
      return createErrorResponse(
        ERROR_CODES.FORBIDDEN,
        'No tienes permisos para consultar este rate limit'
      );
    }

    // Consultar posts recientes del usuario (últimos 5 minutos)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: recentPosts, error: queryError } = await supabase
      .from('posts')
      .select('id, created_at')
      .eq('user_id', userId)
      .gte('created_at', fiveMinutesAgo)
      .order('created_at', { ascending: false });

    if (queryError) {
      console.error('Error consultando posts recientes:', queryError);
      return createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        'Error al verificar rate limit'
      );
    }

    const postCount = recentPosts?.length || 0;
    const maxPosts = 5; // Límite de 5 posts por 5 minutos
    const allowed = postCount < maxPosts;
    
    let resetTime = 0;
    if (!allowed && recentPosts.length > 0) {
      // Calcular cuándo se resetea el límite (5 minutos desde el post más antiguo)
      const oldestPost = new Date(recentPosts[recentPosts.length - 1].created_at);
      resetTime = Math.max(0, (oldestPost.getTime() + 5 * 60 * 1000 - Date.now()) / 1000);
    }

    return NextResponse.json({
      success: true,
      data: {
        allowed,
        currentCount: postCount,
        maxPosts,
        resetTime: Math.ceil(resetTime),
        message: allowed 
          ? `Puedes crear ${maxPosts - postCount} posts más en los próximos 5 minutos`
          : `Has alcanzado el límite de ${maxPosts} posts por 5 minutos`
      }
    });

  } catch (error) {
    console.error('Error en rate-limit-check:', error);
    return createErrorResponse(
      ERROR_CODES.INTERNAL_ERROR,
      'Error interno del servidor'
    );
  }
}

export { POST };
export default withErrorHandling(POST);