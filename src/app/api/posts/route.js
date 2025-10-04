export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "../../../lib/supabaseServer";
import { sanitizePostData, normalizeText } from "../../../lib/sanitization";
import { validateObject, postValidationSchema } from "../../../lib/validation";
import { validatePost, checkPostRateLimit } from "../../../lib/databaseValidation";
import securityLogger, { SECURITY_EVENTS, SECURITY_LEVELS } from "../../../lib/securityLogger";
import { 
  withErrorHandling, 
  handleAuthError, 
  handleValidationError, 
  handleDatabaseError, 
  handleRateLimitError,
  createErrorResponse,
  ERROR_CODES 
} from "../../../lib/errorHandler";
import { withRateLimit, createIPRateLimiter } from "../../../lib/rateLimiter";
import productionLogger, { LOG_CATEGORIES } from "../../../lib/productionLogger";
import { monitorDatabaseOperation } from "../../../lib/performanceMonitor";

// Función de validación de datos del post mejorada
function validatePostData(body, userId) {
  try {
    // Primero sanitizar los datos
    const sanitizedData = sanitizePostData(body);
    
    // Aplicar validación robusta del esquema
    const schemaValidation = validateObject(sanitizedData, postValidationSchema);
    
    if (!schemaValidation.isValid) {
      return {
        isValid: false,
        errors: schemaValidation.errors,
        sanitizedData: null
      };
    }
    
    // Aplicar validaciones específicas de la base de datos
    const dbValidation = validatePost(sanitizedData);
    
    if (!dbValidation.isValid) {
      // Log validation failures for security monitoring
      dbValidation.errors.forEach(error => {
        securityLogger.logValidation(error.field, error.message, sanitizedData[error.field], { userId });
      });
      
      return {
        isValid: false,
        errors: dbValidation.errors.map(e => e.message),
        sanitizedData: null
      };
    }
    
    return {
      isValid: true,
      errors: [],
      sanitizedData: schemaValidation.validatedData
    };
  } catch (error) {
    console.error('Error in validatePostData:', error);
    securityLogger.logAPIError(error, '/api/posts', 'POST', { userId });
    return {
      isValid: false,
      errors: ['Error processing post data'],
      sanitizedData: null
    };
  }
}

// Crear rate limiter para IP (protección DDoS)
const ipRateLimiter = createIPRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minuto
  maxRequests: 30, // 30 requests por minuto por IP
  blockDuration: 15 * 60 * 1000 // Bloquear por 15 minutos
});

export async function POST(req) {
  return withErrorHandling(async (request) => {
    // Iniciar monitoreo de rendimiento
    const performanceTimer = new (await import('../../../lib/performanceMonitor.js')).PerformanceTimer('api_post_creation', {
      method: 'POST',
      endpoint: '/api/posts',
      userAgent: request.headers.get('user-agent')
    });

    try {
      // Log inicio de operación
      productionLogger.info(LOG_CATEGORIES.API, 'Post creation request started', {
        userAgent: request.headers.get('user-agent'),
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
      });

      // Verificar rate limiting por IP primero
      const ipLimitResult = await ipRateLimiter(request);
      if (!ipLimitResult.allowed) {
        productionLogger.warn(LOG_CATEGORIES.SECURITY, 'IP rate limit exceeded for post creation', {
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
          reason: ipLimitResult.reason,
          retryAfter: ipLimitResult.retryAfter
        });
        
        return createErrorResponse(
          ERROR_CODES.RATE_LIMIT_EXCEEDED,
          ipLimitResult.reason,
          { retryAfter: ipLimitResult.retryAfter },
          { 'Retry-After': ipLimitResult.retryAfter.toString() }
        );
      }

      const supabase = await getSupabaseRouteClient();

      // Verificar autenticación
      const authTimer = monitorDatabaseOperation('auth_check', 'auth');
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      authTimer.end();

      if (userErr) {
        console.error("Error de autenticación:", userErr);
        productionLogger.error(LOG_CATEGORIES.AUTH, 'Authentication error in post creation', {
          error: userErr.message,
          code: userErr.code
        });
        return handleAuthError(userErr, { endpoint: '/api/posts', method: 'POST' });
      }
      
      const user = userData?.user;
      if (!user) {
        productionLogger.warn(LOG_CATEGORIES.AUTH, 'Unauthorized post creation attempt', {
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
        });
        return createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'No autenticado. Por favor, inicia sesión.');
      }

      // Log usuario autenticado
      productionLogger.info(LOG_CATEGORIES.USER_ACTION, 'Authenticated user attempting post creation', {
        userId: user.id,
        email: user.email
      });

      // Parsear y validar el cuerpo de la petición
      let body;
      try {
        body = await request.json();
      } catch (parseError) {
        productionLogger.warn(LOG_CATEGORIES.API, 'Invalid JSON in post creation request', {
          userId: user.id,
          error: parseError.message
        });
        return createErrorResponse(ERROR_CODES.INVALID_FORMAT, 'Formato de datos JSON inválido');
      }

      // Verificar rate limiting antes de procesar
      const rateLimitTimer = monitorDatabaseOperation('rate_limit_check', 'posts');
      try {
        const { data: recentPosts } = await supabase
          .from('posts')
          .select('created_at')
          .eq('author_id', user.id)
          .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      const rateLimitCheck = checkPostRateLimit(recentPosts || []);
      rateLimitTimer.end();
      
      if (!rateLimitCheck.isWithinLimit) {
        productionLogger.warn(LOG_CATEGORIES.SECURITY, 'User rate limit exceeded for post creation', {
          userId: user.id,
          currentCount: rateLimitCheck.currentCount,
          maxAllowed: rateLimitCheck.maxAllowed,
          nextAllowedTime: rateLimitCheck.nextAllowedTime
        });
        
        return handleRateLimitError({
          retryAfter: Math.ceil((new Date(rateLimitCheck.nextAllowedTime) - new Date()) / 1000),
          resetTime: rateLimitCheck.nextAllowedTime
        }, { 
          userId: user.id,
          endpoint: '/api/posts',
          currentCount: rateLimitCheck.currentCount,
          maxAllowed: rateLimitCheck.maxAllowed
        });
      }
    } catch (rateLimitError) {
      rateLimitTimer.end();
      console.error('Error checking rate limit:', rateLimitError);
      productionLogger.error(LOG_CATEGORIES.DATABASE, 'Rate limit check failed', {
        userId: user.id,
        error: rateLimitError.message
      });
      // Continue processing - don't block on rate limit check failure
    }

    // Validar datos
    const validationTimer = monitorDatabaseOperation('data_validation', 'posts');
    const validation = validatePostData(body, user.id);
    validationTimer.end();
    
    if (!validation.isValid) {
      productionLogger.warn(LOG_CATEGORIES.API, 'Post validation failed', {
        userId: user.id,
        errors: validation.errors
      });
      return handleValidationError(validation.errors, { userId: user.id, endpoint: '/api/posts' });
    }

    const { sanitizedData } = validation;

    // Log potential suspicious content
    if (sanitizedData.title?.length > 200 || sanitizedData.content.length > 50000) {
      securityLogger.logSuspicious(SECURITY_EVENTS.SUSPICIOUS_PATTERN, {
        pattern: 'oversized_content',
        userId: user.id,
        titleLength: sanitizedData.title?.length || 0,
        contentLength: sanitizedData.content.length,
        endpoint: '/api/posts'
      });
      
      productionLogger.warn(LOG_CATEGORIES.SECURITY, 'Suspicious oversized content detected', {
        userId: user.id,
        titleLength: sanitizedData.title?.length || 0,
        contentLength: sanitizedData.content.length
      });
    }

    // Normalizar el contenido para mejorar la presentación
    sanitizedData.content = normalizeText(sanitizedData.content);

    // Asegurar perfil antes del insert para satisfacer la FK
    const profileTimer = monitorDatabaseOperation('profile_upsert', 'profiles');
    const profile = {
      id: user.id,
      display_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Usuario",
      avatar_url: user.user_metadata?.avatar_url ?? null,
    };
    
    const { error: upsertErr } = await supabase
      .from("profiles")
      .upsert(profile)
      .select("id")
      .single();
    profileTimer.end();
      
    if (upsertErr) {
      console.error("Error al crear/actualizar perfil:", upsertErr);
      productionLogger.error(LOG_CATEGORIES.DATABASE, 'Profile upsert failed', {
        userId: user.id,
        error: upsertErr.message,
        code: upsertErr.code
      });
      return handleDatabaseError(upsertErr, 'upsert', {
        userId: user.id,
        table: 'profiles'
      });
    }

    // Insertar el post
    const insertTimer = monitorDatabaseOperation('post_insert', 'posts');
    const { data: post, error: insertErr } = await supabase
      .from("posts")
      .insert({
        title: sanitizedData.title,
        content: sanitizedData.content,
        status: sanitizedData.status,
        type: sanitizedData.type,
        author_id: user.id,
        published_at: sanitizedData.status === 'published' ? new Date().toISOString() : null
      })
      .select()
      .single();
    insertTimer.end();

    if (insertErr) {
      console.error("Error al insertar post:", insertErr);
      productionLogger.error(LOG_CATEGORIES.DATABASE, 'Post insertion failed', {
        userId: user.id,
        error: insertErr.message,
        code: insertErr.code,
        postTitle: sanitizedData.title.substring(0, 50)
      });
      return handleDatabaseError(insertErr, 'insert', {
        userId: user.id,
        postTitle: sanitizedData.title.substring(0, 50),
        table: 'posts'
      });
    }

    // Log successful post creation for audit trail
    securityLogger.log(SECURITY_EVENTS.RESOURCE_CREATED, SECURITY_LEVELS.INFO, {
      userId: user.id,
      action: 'create_post',
      resource: 'posts',
      resourceId: post.id,
      metadata: {
        title: sanitizedData.title.substring(0, 50),
        status: sanitizedData.status,
        type: sanitizedData.type
      }
    });

    // Log successful post creation
    const totalDuration = performanceTimer.end();
    productionLogger.info(LOG_CATEGORIES.USER_ACTION, 'Post created successfully', {
      userId: user.id,
      postId: post.id,
      title: sanitizedData.title.substring(0, 50),
      status: sanitizedData.status,
      type: sanitizedData.type,
      duration: totalDuration
    });

    // Log business event
    productionLogger.logBusinessEvent('POST_CREATED', {
      userId: user.id,
      postId: post.id,
      status: sanitizedData.status,
      contentLength: sanitizedData.content.length,
      titleLength: sanitizedData.title?.length || 0
    });

    return NextResponse.json({ 
      success: true, 
      data: post,
      message: "Post guardado exitosamente"
    }, { status: 201 });

    } catch (error) {
      // Asegurar que el timer termine en caso de error
      performanceTimer.end();
      
      productionLogger.error(LOG_CATEGORIES.API, 'Unexpected error in post creation', {
        error: error.message,
        stack: error.stack,
        userId: request.headers.get('x-user-id')
      });
      
      throw error; // Re-throw para que withErrorHandling lo maneje
    }

  })(req);
}

// Aplicar rate limiting específico para creación de posts
export const POST_WITH_RATE_LIMIT = withRateLimit('POST_CREATION')(POST);
