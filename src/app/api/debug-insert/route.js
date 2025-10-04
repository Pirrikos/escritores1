export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "../../../lib/supabaseServer.js";
import securityLogger, { SECURITY_EVENTS, SECURITY_LEVELS } from "../../../lib/securityLogger.js";
import { ensureAdmin } from '../../../lib/adminAuth.server.js';
import { 
  withErrorHandling, 
  handleAuthError, 
  handleDatabaseError,
  createErrorResponse,
  ERROR_CODES 
} from "../../../lib/errorHandler.js";

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
    // Requiere permisos de administrador (RLS-safe)
    const admin = await ensureAdmin(req);
    if (!admin.ok) {
      if (admin.code === 'UNAUTHORIZED') {
        return handleAuthError(admin.error || new Error('No autenticado'), {
          endpoint: '/api/debug-insert',
          method: 'GET'
        });
      }
      return createErrorResponse(
        ERROR_CODES.FORBIDDEN,
        'Acceso denegado',
        { requiredRole: 'admin', userRole: admin.profile?.role }
      );
    }
    
    // Inicializar cliente Supabase solo después de validar admin
    const supabase = await getSupabaseRouteClient();
    
    // Log admin action
    securityLogger.log(SECURITY_EVENTS.ADMIN_ACTION, SECURITY_LEVELS.INFO, {
      action: 'debug_insert',
      userId: admin.user?.id,
      endpoint: '/api/debug-insert',
      userAgent: req.headers.get('user-agent'),
      ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
    });
    
    // Insert test data
    const testPost = {
      title: "Post de Prueba",
      content: "Este es un post de prueba creado por el endpoint de debug.",
      author_id: admin.user?.id,
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
