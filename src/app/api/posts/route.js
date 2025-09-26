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

export async function POST(req) {
  return withErrorHandling(async (request) => {
    const supabase = getSupabaseRouteClient();

    // Verificar autenticación
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) {
      console.error("Error de autenticación:", userErr);
      return handleAuthError(userErr, { endpoint: '/api/posts', method: 'POST' });
    }
    
    const user = userData?.user;
    if (!user) {
      return createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'No autenticado. Por favor, inicia sesión.');
    }

    // Parsear y validar el cuerpo de la petición
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      return createErrorResponse(ERROR_CODES.INVALID_FORMAT, 'Formato de datos JSON inválido');
    }

    // Verificar rate limiting antes de procesar
    try {
      const { data: recentPosts } = await supabase
        .from('posts')
        .select('created_at')
        .eq('author_id', user.id)
        .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      const rateLimitCheck = checkPostRateLimit(recentPosts || []);
      
      if (!rateLimitCheck.isWithinLimit) {
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
      console.error('Error checking rate limit:', rateLimitError);
      // Continue processing - don't block on rate limit check failure
    }

    // Validar datos
    const validation = validatePostData(body, user.id);
    if (!validation.isValid) {
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
    }

    // Normalizar el contenido para mejorar la presentación
    sanitizedData.content = normalizeText(sanitizedData.content);

    // Asegurar perfil antes del insert para satisfacer la FK
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
      
    if (upsertErr) {
      console.error("Error al crear/actualizar perfil:", upsertErr);
      return handleDatabaseError(upsertErr, 'upsert', {
        userId: user.id,
        table: 'profiles'
      });
    }

    // Insertar el post
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

    if (insertErr) {
      console.error("Error al insertar post:", insertErr);
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

    return NextResponse.json({ 
      success: true, 
      data: post,
      message: "Post guardado exitosamente"
    }, { status: 201 });

  })(req);
}
