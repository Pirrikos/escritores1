import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "../../../lib/supabaseServer";
import { sanitizeQueryParams } from "../../../lib/sanitization";
import { validateObject, queryParamsSchema } from "../../../lib/validation";
import securityLogger, { SECURITY_EVENTS, SECURITY_LEVELS } from "../../../lib/securityLogger";
import { 
  handleValidationError, 
  handleDatabaseError,
  createErrorResponse,
  ERROR_CODES 
} from "../../../lib/errorHandler";
import { withRateLimit } from "../../../lib/rateLimiter";
import productionLogger, { LOG_CATEGORIES } from "../../../lib/productionLogger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  // Iniciar monitoreo de rendimiento
  const performanceTimer = new (await import('../../../lib/performanceMonitor.js')).PerformanceTimer('api_feed_request', {
    method: 'GET',
    endpoint: '/api/feed',
    userAgent: request.headers.get('user-agent')
  });

  try {
    const supabase = await getSupabaseRouteClient();
    const { searchParams } = new URL(request.url);
    
    // Log request for monitoring
    securityLogger.log(SECURITY_EVENTS.API_REQUEST, SECURITY_LEVELS.INFO, {
      endpoint: '/api/feed',
      method: 'GET',
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
    });

    productionLogger.info(LOG_CATEGORIES.API, 'Feed request started', {
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      searchParams: Object.fromEntries(searchParams.entries())
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
        // Log validation failures for security monitoring
        securityLogger.logValidation('query_params', 'Feed query validation failed', sanitizedParams, {
          endpoint: '/api/feed',
          errors: validationResult.errors,
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
        });

        productionLogger.warn(LOG_CATEGORIES.API, 'Feed query validation failed', {
          errors: validationResult.errors,
          queryParams: sanitizedParams,
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
        });
        
        return handleValidationError(validationResult.errors, {
          endpoint: '/api/feed',
          queryParams
        });
      }
      
      const { limit = 20, offset = 0, search, status } = validationResult.validatedData;
      
      // Validate reasonable limits to prevent abuse
      if (limit > 100) {
        securityLogger.log(SECURITY_EVENTS.SUSPICIOUS_PATTERN, SECURITY_LEVELS.WARNING, {
          pattern: 'excessive_limit_request',
          requestedLimit: limit,
          maxAllowed: 100,
          endpoint: '/api/feed',
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
        });

        productionLogger.warn(LOG_CATEGORIES.SECURITY, 'Excessive limit request detected', {
          requestedLimit: limit,
          maxAllowed: 100,
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
        });
        
        return createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          "Límite demasiado alto. El máximo permitido es 100.",
          { requestedLimit: limit, maxAllowed: 100 }
        );
      }
      
      // Validate offset to prevent excessive pagination abuse
      if (offset > 10000) {
      securityLogger.log(SECURITY_EVENTS.SUSPICIOUS_PATTERN, SECURITY_LEVELS.WARNING, {
        pattern: 'excessive_offset_request',
        requestedOffset: offset,
        maxRecommended: 10000,
        endpoint: '/api/feed',
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
      });
      
      return createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        "Offset demasiado alto. Considera usar filtros más específicos.",
        { requestedOffset: offset, maxRecommended: 10000 }
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
      // Validate search term length and content
      if (search.length > 200) {
        securityLogger.log(SECURITY_EVENTS.SUSPICIOUS_PATTERN, SECURITY_LEVELS.WARNING, {
          pattern: 'excessive_search_length',
          searchLength: search.length,
          maxAllowed: 200,
          endpoint: '/api/feed'
        });
        
        return createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          "Término de búsqueda demasiado largo.",
          { maxLength: 200 }
        );
      }
      
      // Check for potentially malicious search patterns
      const suspiciousPatterns = [
        /[<>]/g,  // HTML tags
        /javascript:/i,  // JavaScript protocol
        /data:/i,  // Data protocol
        /vbscript:/i,  // VBScript protocol
        /on\w+=/i  // Event handlers
      ];
      
      const hasSuspiciousContent = suspiciousPatterns.some(pattern => pattern.test(search));
      if (hasSuspiciousContent) {
        securityLogger.log(SECURITY_EVENTS.SUSPICIOUS_PATTERN, SECURITY_LEVELS.HIGH, {
          pattern: 'malicious_search_content',
          searchTerm: search.substring(0, 50),
          endpoint: '/api/feed',
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
        });
        
        return createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          "Término de búsqueda contiene caracteres no permitidos."
        );
      }
      
      // Log search queries for analytics and security monitoring
      securityLogger.log(SECURITY_EVENTS.SEARCH_QUERY, SECURITY_LEVELS.INFO, {
        searchTerm: search.substring(0, 100), // Limit logged search term length
        searchLength: search.length,
        endpoint: '/api/feed'
      });
      
      query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
    }
    
    if (status && status !== 'all') {
      // Validate status values
      const validStatuses = ['published', 'draft', 'archived'];
      if (!validStatuses.includes(status)) {
        securityLogger.log(SECURITY_EVENTS.SUSPICIOUS_PATTERN, SECURITY_LEVELS.WARNING, {
          pattern: 'invalid_status_filter',
          providedStatus: status,
          validStatuses,
          endpoint: '/api/feed'
        });
        
        return createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          "Estado de filtro no válido.",
          { validStatuses }
        );
      }
      
      query = query.eq('status', status);
    } else {
      // Por defecto, mostrar solo posts publicados
      query = query.eq('status', 'published');
    }
    
    // Monitor database operation for feed query
    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      console.error("Error al obtener feed:", error);
      productionLogger.error('Database error in feed query', LOG_CATEGORIES.DATABASE, {
        error: error.message,
        queryParams: sanitizedParams,
        table: 'posts',
        endpoint: '/api/feed'
      });
      
      securityLogger.logAPIError(error, '/api/feed', 'GET', {
        queryParams: sanitizedParams,
        table: 'posts'
      });
      
      return handleDatabaseError(error, 'select', {
        endpoint: '/api/feed',
        queryParams: sanitizedParams,
        table: 'posts'
      });
    }

    // Log successful feed retrieval for analytics
    productionLogger.info('Feed query completed successfully', LOG_CATEGORIES.API, {
      endpoint: '/api/feed',
      recordsReturned: data?.length || 0,
      totalRecords: count,
      hasSearch: !!search,
      hasStatusFilter: !!status,
      queryParams: sanitizedParams
    });

    securityLogger.log(SECURITY_EVENTS.DATA_ACCESS, SECURITY_LEVELS.INFO, {
      endpoint: '/api/feed',
      recordsReturned: data?.length || 0,
      totalRecords: count,
      hasSearch: !!search,
      hasStatusFilter: !!status
    });

    // End performance timer
    performanceTimer.end();

    return NextResponse.json({
      success: true,
      data: data || [],
      pagination: {
        limit,
        offset,
        total: count,
        hasMore: count > offset + limit
      },
      filters: {
        search: search || null,
        status: status || 'all'
      }
    });
  } catch (error) {
    // End performance timer in case of error
    performanceTimer.end();
    
    productionLogger.error('Unexpected error in feed endpoint', LOG_CATEGORIES.API, {
      error: error.message,
      stack: error.stack,
      endpoint: '/api/feed'
    });
    
    throw error;
  }
}

// Aplicar rate limiting para búsquedas y feed
export const GET_WITH_RATE_LIMIT = withRateLimit('SEARCH')(GET);
