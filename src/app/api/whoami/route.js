export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "../../../lib/supabaseServer";
import securityLogger, { SECURITY_EVENTS, SECURITY_LEVELS } from "../../../lib/securityLogger";
import { 
  withErrorHandling, 
  handleAuthError, 
  createErrorResponse,
  ERROR_CODES 
} from "../../../lib/errorHandler";
import productionLogger, { LOG_CATEGORIES } from "../../../lib/productionLogger";
import { PerformanceTimer } from "../../../lib/performanceMonitor";

export async function GET(request) {
  return withErrorHandling(async (req) => {
    // Iniciar monitoreo de rendimiento
    const performanceTimer = new PerformanceTimer('api_whoami_request', {
      method: 'GET',
      endpoint: '/api/whoami',
      userAgent: req.headers.get('user-agent')
    });

    try {
      const supabase = await getSupabaseRouteClient();
      
      // Log request for monitoring
      securityLogger.log(SECURITY_EVENTS.API_REQUEST, SECURITY_LEVELS.INFO, {
        endpoint: '/api/whoami',
        method: 'GET',
        userAgent: req.headers.get('user-agent'),
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
      });

      productionLogger.info('Whoami request started', LOG_CATEGORIES.API, {
        userAgent: req.headers.get('user-agent'),
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
      });
      
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error) {
        console.error("Error de autenticación:", error);
        productionLogger.error('Authentication error in whoami', LOG_CATEGORIES.AUTH, {
          error: error.message,
          endpoint: '/api/whoami'
        });
        return handleAuthError(error, {
          endpoint: '/api/whoami',
          action: 'getUser'
        });
      }
      
      if (!user) {
        securityLogger.logSuspicious(SECURITY_EVENTS.SUSPICIOUS_PATTERN, {
          pattern: 'unauthenticated_whoami_request',
          endpoint: '/api/whoami',
          userAgent: req.headers.get('user-agent'),
          ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
        });

        productionLogger.warn('Unauthenticated whoami request', LOG_CATEGORIES.SECURITY, {
          userAgent: req.headers.get('user-agent'),
          ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
        });
        
        return createErrorResponse(
          ERROR_CODES.UNAUTHORIZED,
          "Usuario no autenticado"
        );
      }

      // Log successful user identification
      productionLogger.info('User identified successfully', LOG_CATEGORIES.USER_ACTION, {
        userId: user.id,
        email: user.email
      });

      // End performance timer
      performanceTimer.end();
      
      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          user_metadata: user.user_metadata
        }
      });

    } catch (error) {
      // End performance timer in case of error
      performanceTimer.end();
      
      productionLogger.error('Unexpected error in whoami endpoint', LOG_CATEGORIES.API, {
        error: error.message,
        stack: error.stack,
        endpoint: '/api/whoami'
      });
      
      throw error;
    }
  })(request);
}
