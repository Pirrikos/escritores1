import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer.js';
import { withErrorHandling, createErrorResponse, handleAuthError, ERROR_CODES } from '@/lib/errorHandler.js';
import securityLogger, { SECURITY_EVENTS, SECURITY_LEVELS } from '@/lib/securityLogger.js';
import { withRateLimit } from '@/lib/rateLimiter.js';

async function POST(request) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Verificar autenticación
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session?.user) {
      return handleAuthError('Usuario no autenticado');
    }

    const { userId } = await request.json();
    
    // Verificar que el usuario solo puede consultar su propio rate limit
    if (userId !== session.user.id) {
      // Log intento de acceso no autorizado
      securityLogger.log(SECURITY_EVENTS.UNAUTHORIZED_ACCESS, SECURITY_LEVELS.WARNING, {
        attemptedUserId: userId,
        actualUserId: session.user.id,
        endpoint: '/api/posts/rate-limit-check',
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
      });
      
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
      // Usar el método log correcto
      securityLogger.log(SECURITY_EVENTS.API_ERROR, SECURITY_LEVELS.WARNING, {
        errorMessage: queryError.message,
        errorStack: queryError.stack,
        endpoint: '/api/posts/rate-limit-check',
        method: 'POST',
        userId
      });
      return createErrorResponse(
        ERROR_CODES.INTERNAL_ERROR,
        'Error al verificar rate limit'
      );
    }

    const postCount = recentPosts?.length || 0;
    const maxPosts = 5; // Límite de 5 posts por 5 minutos
    const allowed = postCount < maxPosts;
    
    // Log rate limit check para monitoreo
    securityLogger.log(SECURITY_EVENTS.RATE_LIMIT_CHECK, SECURITY_LEVELS.INFO, {
      userId,
      currentCount: postCount,
      maxAllowed: maxPosts,
      allowed,
      endpoint: '/api/posts/rate-limit-check'
    });
    
    let resetTime = 0;
    if (!allowed && recentPosts.length > 0) {
      // Calcular cuándo se resetea el límite (5 minutos desde el post más antiguo)
      const oldestPost = new Date(recentPosts[recentPosts.length - 1].created_at);
      resetTime = Math.max(0, (oldestPost.getTime() + 5 * 60 * 1000 - Date.now()) / 1000);
      
      // Log rate limit exceeded usando el método log correcto
      securityLogger.log(SECURITY_EVENTS.RATE_LIMIT_EXCEEDED, SECURITY_LEVELS.WARNING, {
        userId,
        endpoint: '/api/posts',
        currentCount: postCount,
        maxAllowed: maxPosts,
        resetTime: Math.ceil(resetTime)
      });
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
    // Usar función de logging directa en lugar del método de instancia
    try {
      securityLogger.log(SECURITY_EVENTS.API_ERROR, SECURITY_LEVELS.WARNING, {
        errorMessage: error.message,
        errorStack: error.stack,
        endpoint: '/api/posts/rate-limit-check',
        method: 'POST',
        statusCode: error.statusCode || 500
      });
    } catch (logError) {
      console.error('Error logging security event:', logError);
    }
    return createErrorResponse(
      ERROR_CODES.INTERNAL_ERROR,
      'Error interno del servidor'
    );
  }
}

// Aplicar rate limiting y error handling
const rateLimitedPOST = withRateLimit('API_GENERAL')(POST);
export { rateLimitedPOST as POST };
export default withErrorHandling(POST);