// src/lib/errorHandler.js
// Centralized error handling and standardized response codes

import { NextResponse } from 'next/server';
import { logAPIError, logDatabaseError, logValidationError } from './securityLogger.js';
import { logCriticalError, CRITICAL_ERROR_TYPES, SEVERITY_LEVELS } from './monitoring';

// Standardized error codes
export const ERROR_CODES = {
  // Authentication & Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  
  // Database
  DATABASE_ERROR: 'DATABASE_ERROR',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
  CONSTRAINT_VIOLATION: 'CONSTRAINT_VIOLATION',
  
  // Server
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',
  
  // Business Logic
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  RESOURCE_LOCKED: 'RESOURCE_LOCKED',
  OPERATION_NOT_ALLOWED: 'OPERATION_NOT_ALLOWED',
  
  // Network
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED'
};

// HTTP status code mappings
export const STATUS_CODES = {
  [ERROR_CODES.UNAUTHORIZED]: 401,
  [ERROR_CODES.FORBIDDEN]: 403,
  [ERROR_CODES.TOKEN_EXPIRED]: 401,
  [ERROR_CODES.INVALID_CREDENTIALS]: 401,
  
  [ERROR_CODES.VALIDATION_ERROR]: 400,
  [ERROR_CODES.INVALID_INPUT]: 400,
  [ERROR_CODES.MISSING_REQUIRED_FIELD]: 400,
  [ERROR_CODES.INVALID_FORMAT]: 400,
  
  [ERROR_CODES.RATE_LIMIT_EXCEEDED]: 429,
  [ERROR_CODES.TOO_MANY_REQUESTS]: 429,
  
  [ERROR_CODES.DATABASE_ERROR]: 500,
  [ERROR_CODES.RESOURCE_NOT_FOUND]: 404,
  [ERROR_CODES.DUPLICATE_RESOURCE]: 409,
  [ERROR_CODES.CONSTRAINT_VIOLATION]: 400,
  
  [ERROR_CODES.INTERNAL_ERROR]: 500,
  [ERROR_CODES.SERVICE_UNAVAILABLE]: 503,
  [ERROR_CODES.TIMEOUT]: 408,
  
  [ERROR_CODES.INSUFFICIENT_PERMISSIONS]: 403,
  [ERROR_CODES.RESOURCE_LOCKED]: 423,
  [ERROR_CODES.OPERATION_NOT_ALLOWED]: 405,
  
  [ERROR_CODES.PAYLOAD_TOO_LARGE]: 413,
  [ERROR_CODES.UNSUPPORTED_MEDIA_TYPE]: 415,
  [ERROR_CODES.METHOD_NOT_ALLOWED]: 405
};

// User-friendly error messages in Spanish
export const ERROR_MESSAGES = {
  [ERROR_CODES.UNAUTHORIZED]: 'No autorizado. Por favor, inicia sesión.',
  [ERROR_CODES.FORBIDDEN]: 'Acceso denegado. No tienes permisos para realizar esta acción.',
  [ERROR_CODES.TOKEN_EXPIRED]: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.',
  [ERROR_CODES.INVALID_CREDENTIALS]: 'Credenciales inválidas.',
  
  [ERROR_CODES.VALIDATION_ERROR]: 'Los datos proporcionados no son válidos.',
  [ERROR_CODES.INVALID_INPUT]: 'Entrada inválida.',
  [ERROR_CODES.MISSING_REQUIRED_FIELD]: 'Faltan campos requeridos.',
  [ERROR_CODES.INVALID_FORMAT]: 'Formato de datos inválido.',
  
  [ERROR_CODES.RATE_LIMIT_EXCEEDED]: 'Has excedido el límite de solicitudes. Intenta más tarde.',
  [ERROR_CODES.TOO_MANY_REQUESTS]: 'Demasiadas solicitudes. Por favor, espera un momento.',
  
  [ERROR_CODES.DATABASE_ERROR]: 'Error en la base de datos.',
  [ERROR_CODES.RESOURCE_NOT_FOUND]: 'Recurso no encontrado.',
  [ERROR_CODES.DUPLICATE_RESOURCE]: 'El recurso ya existe.',
  [ERROR_CODES.CONSTRAINT_VIOLATION]: 'Los datos no cumplen con las restricciones requeridas.',
  
  [ERROR_CODES.INTERNAL_ERROR]: 'Error interno del servidor.',
  [ERROR_CODES.SERVICE_UNAVAILABLE]: 'Servicio no disponible temporalmente.',
  [ERROR_CODES.TIMEOUT]: 'La solicitud ha excedido el tiempo límite.',
  
  [ERROR_CODES.INSUFFICIENT_PERMISSIONS]: 'Permisos insuficientes para realizar esta acción.',
  [ERROR_CODES.RESOURCE_LOCKED]: 'El recurso está bloqueado temporalmente.',
  [ERROR_CODES.OPERATION_NOT_ALLOWED]: 'Operación no permitida.',
  
  [ERROR_CODES.PAYLOAD_TOO_LARGE]: 'El tamaño de los datos es demasiado grande.',
  [ERROR_CODES.UNSUPPORTED_MEDIA_TYPE]: 'Tipo de contenido no soportado.',
  [ERROR_CODES.METHOD_NOT_ALLOWED]: 'Método HTTP no permitido.'
};

/**
 * Create a standardized error response
 * @param {string} errorCode - Error code from ERROR_CODES
 * @param {string} customMessage - Optional custom message
 * @param {object} details - Additional error details
 * @param {object} metadata - Additional metadata for logging
 * @returns {NextResponse} - Standardized error response
 */
export function createErrorResponse(errorCode, customMessage = null, details = null, metadata = {}) {
  const statusCode = STATUS_CODES[errorCode] || 500;
  const message = customMessage || ERROR_MESSAGES[errorCode] || 'Error desconocido';
  
  const errorResponse = {
    success: false,
    error: {
      code: errorCode,
      message,
      timestamp: new Date().toISOString(),
      ...(details && { details }),
      ...(process.env.NODE_ENV === 'development' && metadata.stack && { stack: metadata.stack })
    }
  };
  
  // Add retry information for rate limiting errors
  if (errorCode === ERROR_CODES.RATE_LIMIT_EXCEEDED && metadata.retryAfter) {
    errorResponse.error.retryAfter = metadata.retryAfter;
  }
  
  return NextResponse.json(errorResponse, { status: statusCode });
}

/**
 * Handle database errors with specific error code mapping
 * @param {object} dbError - Database error object
 * @param {string} operation - Database operation (select, insert, update, delete)
 * @param {object} context - Additional context for logging
 * @returns {NextResponse} - Standardized error response
 */
export function handleDatabaseError(dbError, operation = 'unknown', context = {}) {
  let errorCode = ERROR_CODES.DATABASE_ERROR;
  let customMessage = null;
  
  // Map specific database error codes
  switch (dbError.code) {
    case '23505': // Unique constraint violation
      errorCode = ERROR_CODES.DUPLICATE_RESOURCE;
      customMessage = 'El recurso ya existe';
      break;
    case '23503': // Foreign key violation
      errorCode = ERROR_CODES.CONSTRAINT_VIOLATION;
      customMessage = 'Error de referencia en los datos';
      break;
    case '23514': // Check constraint violation
      errorCode = ERROR_CODES.CONSTRAINT_VIOLATION;
      customMessage = 'Los datos no cumplen con los requisitos de validación';
      break;
    case '42P01': // Undefined table
      errorCode = ERROR_CODES.INTERNAL_ERROR;
      customMessage = 'Error de configuración de la base de datos';
      break;
    case '42703': // Undefined column
      errorCode = ERROR_CODES.INTERNAL_ERROR;
      customMessage = 'Error de estructura de la base de datos';
      break;
    case 'PGRST116': // PostgREST: no rows returned
      errorCode = ERROR_CODES.RESOURCE_NOT_FOUND;
      customMessage = 'Recurso no encontrado';
      break;
    default:
      if (dbError.message?.includes('timeout')) {
        errorCode = ERROR_CODES.TIMEOUT;
        customMessage = 'La operación ha excedido el tiempo límite';
      }
  }
  
  // Log the database error
  logDatabaseError(dbError, context.table || 'unknown', operation, {
    ...context,
    errorCode: dbError.code,
    errorMessage: dbError.message
  });
  
  // Log crítico para monitoreo
  logCriticalError(CRITICAL_ERROR_TYPES.DATABASE_CONNECTION, {
    message: dbError.message,
    stack: dbError.stack,
    code: dbError.code,
    ...context
  }, SEVERITY_LEVELS.HIGH);
  
  return createErrorResponse(errorCode, customMessage, 
    process.env.NODE_ENV === 'development' ? {
      originalError: dbError.message,
      code: dbError.code,
      details: dbError.details,
      hint: dbError.hint
    } : null,
    { stack: dbError.stack }
  );
}

/**
 * Handle validation errors
 * @param {array|object} validationErrors - Validation error details
 * @param {object} context - Additional context for logging
 * @returns {NextResponse} - Standardized error response
 */
export function handleValidationError(validationErrors, context = {}) {
  const errors = Array.isArray(validationErrors) ? validationErrors : [validationErrors];
  
  // Log validation errors
  logValidationError('input_validation', 'Validation failed', errors, context);
  
  return createErrorResponse(
    ERROR_CODES.VALIDATION_ERROR,
    'Los datos proporcionados no son válidos',
    { validationErrors: errors }
  );
}

/**
 * Handle authentication errors
 * @param {object} authError - Authentication error object
 * @param {object} context - Additional context for logging
 * @returns {NextResponse} - Standardized error response
 */
export function handleAuthError(authError, context = {}) {
  let errorCode = ERROR_CODES.UNAUTHORIZED;
  let customMessage = null;
  
  if (authError.status === 401) {
    errorCode = ERROR_CODES.TOKEN_EXPIRED;
    customMessage = 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.';
  } else if (authError.message?.includes('Invalid')) {
    errorCode = ERROR_CODES.INVALID_CREDENTIALS;
    customMessage = 'Credenciales inválidas';
  }
  
  // Log authentication error
  logAPIError(authError, context.endpoint || 'unknown', context.method || 'unknown', {
    ...context,
    errorType: 'authentication'
  });
  
  // Log crítico para monitoreo si es un patrón sospechoso
  if (context.suspiciousActivity) {
    logCriticalError(CRITICAL_ERROR_TYPES.SECURITY_BREACH, {
      message: authError.message,
      ...context
    }, SEVERITY_LEVELS.HIGH);
  } else {
    logCriticalError(CRITICAL_ERROR_TYPES.AUTHENTICATION_FAILURE, {
      message: authError.message,
      ...context
    }, SEVERITY_LEVELS.MEDIUM);
  }
  
  return createErrorResponse(errorCode, customMessage,
    process.env.NODE_ENV === 'development' ? {
      originalError: authError.message
    } : null
  );
}

/**
 * Handle rate limiting errors
 * @param {object} rateLimitInfo - Rate limit information
 * @param {object} context - Additional context for logging
 * @returns {NextResponse} - Standardized error response
 */
export function handleRateLimitError(rateLimitInfo, context = {}) {
  const retryAfter = rateLimitInfo.retryAfter || 60;
  
  // Log crítico para monitoreo
  logCriticalError(CRITICAL_ERROR_TYPES.RATE_LIMIT_EXCEEDED, {
    message: 'Rate limit exceeded',
    ...context
  }, SEVERITY_LEVELS.MEDIUM);
  
  return createErrorResponse(
    ERROR_CODES.RATE_LIMIT_EXCEEDED,
    `Has excedido el límite de solicitudes. Intenta de nuevo en ${retryAfter} segundos.`,
    {
      retryAfter,
      resetTime: rateLimitInfo.resetTime,
      remaining: 0
    },
    { retryAfter }
  );
}

/**
 * Handle internal server errors
 * @param {Error} error - Error object
 * @param {object} context - Additional context for logging
 * @returns {NextResponse} - Standardized error response
 */
export function handleInternalError(error, context = {}) {
  // Log internal error
  logAPIError(error, context.endpoint || 'unknown', context.method || 'unknown', {
    ...context,
    errorType: 'internal'
  });
  
  return createErrorResponse(
    ERROR_CODES.INTERNAL_ERROR,
    'Error interno del servidor',
    process.env.NODE_ENV === 'development' ? {
      originalError: error.message
    } : null,
    { stack: error.stack }
  );
}

/**
 * Wrap API route handlers with standardized error handling
 * @param {Function} handler - API route handler function
 * @returns {Function} - Wrapped handler with error handling
 */
export function withErrorHandling(handler) {
  return async (request, context = {}) => {
    try {
      return await handler(request, context);
    } catch (error) {
      console.error(`Unhandled error in API route:`, error);
      return handleInternalError(error, {
        endpoint: request.url,
        method: request.method,
        ...context
      });
    }
  };
}