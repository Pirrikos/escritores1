import { NextResponse } from 'next/server';
import { withErrorHandling, createErrorResponse, handleAuthError, ERROR_CODES } from '@/lib/errorHandler.js';
import securityLogger, { SECURITY_EVENTS, SECURITY_LEVELS } from '@/lib/securityLogger.js';
import { getRateLimitStats, withRateLimit } from '@/lib/rateLimiter.js';
import { ensureAdmin } from '@/lib/adminAuth.server.js';

async function GET(request) {
  try {
    const admin = await ensureAdmin(request);
    if (!admin.ok) {
      if (admin.code === 'UNAUTHORIZED') {
        return handleAuthError(admin.error || new Error('Usuario no autenticado'));
      }
      securityLogger.log(SECURITY_EVENTS.UNAUTHORIZED_ACCESS, SECURITY_LEVELS.WARNING, {
        userId: admin.user?.id,
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
      userId: admin.user.id,
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