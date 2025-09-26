import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "../../../lib/supabaseServer";
import { sanitizeQueryParams } from "../../../lib/sanitization";
import { validateObject, queryParamsSchema } from "../../../lib/validation";
import securityLogger, { SECURITY_EVENTS, SECURITY_LEVELS } from "../../../lib/securityLogger";
import { 
  withErrorHandling, 
  handleDatabaseError, 
  handleValidationError,
  createErrorResponse,
  ERROR_CODES 
} from "../../../lib/errorHandler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  return withErrorHandling(async (req) => {
    const supabase = getSupabaseRouteClient();
    const { searchParams } = new URL(req.url);
    
    // Log request for monitoring
    securityLogger.log(SECURITY_EVENTS.API_REQUEST, SECURITY_LEVELS.INFO, {
      endpoint: '/api/feed',
      method: 'GET',
      userAgent: req.headers.get('user-agent'),
      ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
    });
    
    // Extraer y validar parámetros de consulta
    const queryParams = {
      limit: searchParams.get('limit'),
      offset: searchParams.get('offset'),
      search: searchParams.get('search'),
      status: searchParams.get('status')
    };
    
    // Aplicar sanitización y validación robusta
    const sanitizedParams = sanitizeQueryParams(queryParams);
    const validationResult = validateObject(sanitizedParams, queryParamsSchema);
    
    if (!validationResult.isValid) {
      return handleValidationError(validationResult.errors, {
        endpoint: '/api/feed',
        queryParams
      });
    }
    
    const { limit = 20, offset = 0, search, status } = validationResult.validatedData;
    
    // Validate reasonable limits to prevent abuse
    if (limit > 100) {
      securityLogger.logSuspicious(SECURITY_EVENTS.SUSPICIOUS_PATTERN, {
        pattern: 'excessive_limit_request',
        requestedLimit: limit,
        maxAllowed: 100
      });
      
      return createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        "Límite demasiado alto. El máximo permitido es 100.",
        { requestedLimit: limit, maxAllowed: 100 }
      );
    }
    
    let query = supabase
      .from("posts")
      .select(`
        *,
        profiles:author_id (
          id,
          display_name,
          avatar_url
        )
      `, { count: 'exact' })
      .order('published_at', { ascending: false });
    
    // Aplicar filtros si están presentes
    if (search) {
      // Log search queries for analytics and security monitoring
      securityLogger.log(SECURITY_EVENTS.SEARCH_QUERY, SECURITY_LEVELS.INFO, {
        searchTerm: search.substring(0, 100), // Limit logged search term length
        endpoint: '/api/feed'
      });
      
      query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
    }
    
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    
    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      console.error("Error al obtener feed:", error);
      return handleDatabaseError(error, 'select', {
        endpoint: '/api/feed',
        queryParams: sanitizedParams,
        table: 'posts'
      });
    }

    return NextResponse.json({ 
      success: true,
      data: data || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: count > offset + limit
      }
    });

  })(request);
}
