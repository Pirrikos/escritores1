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

export async function GET(request) {
  return withErrorHandling(async (req) => {
    const supabase = getSupabaseRouteClient();
    
    // Log request for monitoring
    securityLogger.log(SECURITY_EVENTS.API_REQUEST, SECURITY_LEVELS.INFO, {
      endpoint: '/api/whoami',
      method: 'GET',
      userAgent: req.headers.get('user-agent'),
      ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
    });
    
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error("Error de autenticación:", error);
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
      
      return createErrorResponse(
        ERROR_CODES.UNAUTHORIZED,
        "Usuario no autenticado"
      );
    }
    
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata
      }
    });

  })(request);
}
