export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import securityLogger, { SECURITY_EVENTS, SECURITY_LEVELS } from "@/lib/securityLogger.js";
import { 
  withErrorHandling, 
  handleAuthError, 
  createErrorResponse,
  ERROR_CODES 
} from "@/lib/errorHandler.js";
import productionLogger, { LOG_CATEGORIES } from "@/lib/productionLogger.js";
import { PerformanceTimer } from "@/lib/performanceMonitor.js";
import { ensureAdmin } from "@/lib/adminAuth.server.js";

export async function GET(request) {
  return withErrorHandling(async (req) => {
    const performanceTimer = new PerformanceTimer('api_whoami_request', {
      method: 'GET',
      endpoint: '/api/whoami',
      userAgent: req.headers.get('user-agent')
    });

    try {
      // Log de inicio
      productionLogger.info(LOG_CATEGORIES.API, 'Whoami request started', {
        userAgent: req.headers.get('user-agent'),
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
      });

      // Usar flujo centralizado de admin con fallbacks seguros
      const admin = await ensureAdmin(req);

      if (!admin.ok) {
        if (admin.code === 'UNAUTHORIZED') {
          return handleAuthError(admin.error || new Error('No autenticado'), {
            endpoint: '/api/whoami',
            method: 'GET'
          });
        }
        return createErrorResponse(
          ERROR_CODES.FORBIDDEN,
          'Acceso denegado',
          { requiredRole: 'admin', userRole: admin.profile?.role }
        );
      }

      // Log de éxito
      productionLogger.info(LOG_CATEGORIES.USER_ACTION, 'User identified successfully', {
        userId: admin.user.id,
        email: admin.user.email
      });

      const duration = performanceTimer.end();
      productionLogger.logAPIRequest('GET', '/api/whoami', admin.user.id, duration, 200);

      return NextResponse.json({
        success: true,
        user: {
          id: admin.user.id,
          email: admin.user.email,
          user_metadata: admin.user.user_metadata
        }
      });
    } catch (error) {
      performanceTimer.end();
      productionLogger.error(LOG_CATEGORIES.API, 'Unexpected error in whoami endpoint', {
        error: error.message,
        stack: error.stack,
        endpoint: '/api/whoami'
      });
      return handleAuthError(error, { endpoint: '/api/whoami', method: 'GET' });
    }
  })(request);
}
