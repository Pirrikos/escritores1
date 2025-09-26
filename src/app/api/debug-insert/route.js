export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "../../../lib/supabaseServer";
import securityLogger, { SECURITY_EVENTS, SECURITY_LEVELS } from "../../../lib/securityLogger";
import { 
  withErrorHandling, 
  handleAuthError, 
  handleDatabaseError,
  createErrorResponse,
  ERROR_CODES 
} from "../../../lib/errorHandler";

export async function GET(request) {
  return withErrorHandling(async (req) => {
    // Prevent use in production
    if (process.env.NODE_ENV === 'production') {
      securityLogger.logSuspicious(SECURITY_EVENTS.SUSPICIOUS_PATTERN, {
        pattern: 'debug_endpoint_in_production',
        endpoint: '/api/debug-insert',
        userAgent: req.headers.get('user-agent'),
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
      });
      
      return createErrorResponse(
        ERROR_CODES.FORBIDDEN,
        "Endpoint no disponible en producción"
      );
    }
    
    const supabase = getSupabaseRouteClient();
    
    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      return handleAuthError(authError, {
        endpoint: '/api/debug-insert',
        action: 'getUser'
      });
    }
    
    if (!user) {
      return createErrorResponse(
        ERROR_CODES.UNAUTHORIZED,
        "Usuario no autenticado"
      );
    }
    
    // Log admin action
    securityLogger.log(SECURITY_EVENTS.ADMIN_ACTION, SECURITY_LEVELS.INFO, {
      action: 'debug_insert',
      userId: user.id,
      endpoint: '/api/debug-insert',
      userAgent: req.headers.get('user-agent'),
      ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
    });
    
    // Insert test data
    const testPost = {
      title: "Post de Prueba",
      content: "Este es un post de prueba creado por el endpoint de debug.",
      author_id: user.id,
      status: "published",
      published_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from("posts")
      .insert(testPost)
      .select()
      .single();
    
    if (error) {
      console.error("Error al insertar post de prueba:", error);
      return handleDatabaseError(error, 'insert', {
        endpoint: '/api/debug-insert',
        table: 'posts',
        data: testPost
      });
    }
    
    return NextResponse.json({
      success: true,
      message: "Post de prueba insertado correctamente",
      data
    });

  })(request);
}
