import { NextResponse } from 'next/server';
import { withErrorHandling, createErrorResponse, handleAuthError, ERROR_CODES } from '@/lib/errorHandler';
import securityLogger, { SECURITY_EVENTS, SECURITY_LEVELS } from '@/lib/securityLogger';
import { getRateLimitStats, withRateLimit } from '@/lib/rateLimiter';
import { createServerSupabaseClient } from '@/lib/supabaseServer';

async function GET(request) {
  try {
    const supabase = createServerSupabaseClient();
    
    // Verificar autenticación y permisos de admin
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session?.user) {
      return handleAuthError('Usuario no autenticado');
    }

    // Verificar si el usuario es admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (profile?.role !== 'admin') {
      securityLogger.log(SECURITY_EVENTS.UNAUTHORIZED_ACCESS, SECURITY_LEVELS.WARNING, {
        userId: session.user.id,
        endpoint: '/api/monitoring/rate-limits',
        attemptedAction: 'view_rate_limit_stats',
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
      });
      
      return createErrorResponse(
        ERROR_CODES.FORBIDDEN,
        'Acceso denegado. Se requieren permisos de administrador.'
      );
    }

    // Obtener estadísticas de rate limiting
    const stats = getRateLimitStats();
    
    // Log acceso a estadísticas
    securityLogger.log(SECURITY_EVENTS.ADMIN_ACTION, SECURITY_LEVELS.INFO, {
      userId: session.user.id,
      action: 'view_rate_limit_stats',
      endpoint: '/api/monitoring/rate-limits'
    });

    return NextResponse.json({
      success: true,
      data: {
        ...stats,
        timestamp: new Date().toISOString(),
        serverTime: Date.now()
      }
    });

  } catch (error) {
    console.error('Error en monitoring/rate-limits:', error);
    securityLogger.logAPIError(error, '/api/monitoring/rate-limits', 'GET');
    return createErrorResponse(
      ERROR_CODES.INTERNAL_ERROR,
      'Error interno del servidor'
    );
  }
}

// Aplicar rate limiting para endpoints de monitoreo
const GET_WITH_RATE_LIMIT = withRateLimit('ADMIN')(GET);

export { GET_WITH_RATE_LIMIT as GET };
export default withErrorHandling(GET);