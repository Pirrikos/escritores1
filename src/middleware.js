// src/middleware.js
// Next.js middleware for request validation and security

import { NextResponse } from 'next/server';
import { 
  logRateLimitExceeded, 
  logRequestEvent, 
  logSuspiciousActivity,
  SecurityEventTypes,
  SecuritySeverity 
} from './lib/securityLogger.js';
import { 
  extractApiVersion, 
  isVersionSupported, 
  getDeprecationInfo,
  API_VERSIONS 
} from './lib/apiVersioning.js';
import { applyCorsHeaders, getCorsConfig } from './lib/corsConfig.js';

// Enhanced security headers with CSP and additional protections
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none';",
  'X-Permitted-Cross-Domain-Policies': 'none',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin'
};

// Enhanced rate limiting configuration with different limits per endpoint type
const rateLimitStore = new Map();
const RATE_LIMIT_CONFIGS = {
  default: { window: 60 * 1000, maxRequests: 100 }, // 100 requests per minute
  api: { window: 60 * 1000, maxRequests: 60 },      // 60 API requests per minute
  auth: { window: 60 * 1000, maxRequests: 10 },     // 10 auth requests per minute
  upload: { window: 60 * 1000, maxRequests: 5 },    // 5 upload requests per minute
  sensitive: { window: 60 * 1000, maxRequests: 3 }  // 3 sensitive operations per minute
};

/**
 * Enhanced rate limiting implementation with different limits per endpoint type
 * @param {string} identifier - Client identifier (IP address)
 * @param {string} endpointType - Type of endpoint (api, auth, upload, sensitive, default)
 * @returns {object} - Rate limit result with details
 */
function checkRateLimit(identifier, endpointType = 'default') {
  const config = RATE_LIMIT_CONFIGS[endpointType] || RATE_LIMIT_CONFIGS.default;
  const now = Date.now();
  const windowStart = now - config.window;
  const key = `${identifier}:${endpointType}`;
  
  // Clean up old entries
  for (const [storeKey, timestamps] of rateLimitStore.entries()) {
    const validTimestamps = timestamps.filter(timestamp => timestamp > windowStart);
    if (validTimestamps.length === 0) {
      rateLimitStore.delete(storeKey);
    } else {
      rateLimitStore.set(storeKey, validTimestamps);
    }
  }
  
  // Check current client's requests for this endpoint type
  const clientRequests = rateLimitStore.get(key) || [];
  const recentRequests = clientRequests.filter(timestamp => timestamp > windowStart);
  
  if (recentRequests.length >= config.maxRequests) {
    // Log rate limit exceeded with more details
    logRateLimitExceeded(identifier, recentRequests.length, {
      endpointType,
      maxAllowed: config.maxRequests,
      windowMinutes: config.window / (60 * 1000),
      resetTime: new Date(windowStart + config.window).toISOString()
    });
    return { 
      allowed: false, 
      remaining: 0, 
      resetTime: windowStart + config.window,
      retryAfter: Math.ceil((windowStart + config.window - now) / 1000)
    };
  }
  
  // Add current request
  recentRequests.push(now);
  rateLimitStore.set(key, recentRequests);
  
  return { 
    allowed: true, 
    remaining: config.maxRequests - recentRequests.length,
    resetTime: windowStart + config.window,
    retryAfter: 0
  };
}

/**
 * Determine endpoint type for rate limiting
 * @param {string} pathname - Request pathname
 * @param {string} method - HTTP method
 * @returns {string} - Endpoint type
 */
function getEndpointType(pathname, method) {
  if (pathname.includes('/auth') || pathname.includes('/login') || pathname.includes('/whoami')) {
    return 'auth';
  }
  if (pathname.includes('/upload') || (method === 'POST' && pathname.includes('/posts'))) {
    return 'upload';
  }
  if (pathname.includes('/admin') || pathname.includes('/debug')) {
    return 'sensitive';
  }
  if (pathname.startsWith('/api/')) {
    return 'api';
  }
  return 'default';
}

/**
 * Enhanced API request validation
 * @param {Request} request - The incoming request
 * @returns {object} - Validation result
 */
function validateApiRequest(request) {
  const method = request.method;
  const contentType = request.headers.get('content-type') || '';
  const contentLength = parseInt(request.headers.get('content-length') || '0');
  const userAgent = request.headers.get('user-agent') || '';
  
  // Enhanced User-Agent validation
  if (!userAgent || userAgent.length < 10) {
    logSuspiciousActivity(
      'Request with suspicious or missing User-Agent',
      { userAgent, method, url: request.url },
      request
    );
  }
  
  // Check for bot patterns in User-Agent
  const botPatterns = ['bot', 'crawler', 'spider', 'scraper', 'curl', 'wget'];
  const isSuspiciousBot = botPatterns.some(pattern => 
    userAgent.toLowerCase().includes(pattern)
  );
  
  if (isSuspiciousBot && request.nextUrl.pathname.startsWith('/api/')) {
    logSuspiciousActivity(
      'Potential bot accessing API endpoints',
      { userAgent, method, url: request.url },
      request
    );
  }
  
  // Enhanced suspicious headers check
  const suspiciousHeaders = [
    'x-forwarded-host', 'x-original-url', 'x-rewrite-url', 
    'x-cluster-client-ip', 'x-real-ip', 'cf-connecting-ip'
  ];
  
  for (const header of suspiciousHeaders) {
    const value = request.headers.get(header);
    if (value) {
      logSuspiciousActivity(
        `Request contains potentially suspicious header: ${header}`,
        { header, value, method, url: request.url },
        request
      );
    }
  }
  
  // Enhanced content type validation
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    const validContentTypes = [
      'application/json',
      'multipart/form-data',
      'application/x-www-form-urlencoded'
    ];
    
    const hasValidContentType = validContentTypes.some(type => 
      contentType.includes(type)
    );
    
    if (!hasValidContentType) {
      logRequestEvent(
        request,
        SecurityEventTypes.INVALID_INPUT,
        `Invalid content type for ${method} request: ${contentType}`,
        { contentType, method }
      );
      return { valid: false, error: 'Invalid content type', statusCode: 415 };
    }
  }
  
  // Enhanced payload size validation with different limits per endpoint
  const maxSizes = {
    '/api/posts': 5 * 1024 * 1024,    // 5MB for posts
    '/api/upload': 10 * 1024 * 1024,  // 10MB for uploads
    default: 1 * 1024 * 1024          // 1MB for other endpoints
  };
  
  const pathname = request.nextUrl.pathname;
  const maxSize = Object.keys(maxSizes).find(path => pathname.startsWith(path)) 
    ? maxSizes[Object.keys(maxSizes).find(path => pathname.startsWith(path))]
    : maxSizes.default;
  
  if (contentLength > maxSize) {
    logSuspiciousActivity(
      'Request with oversized payload',
      { contentLength, maxSize, method, url: request.url },
      request
    );
    return { valid: false, error: 'Payload too large', statusCode: 413 };
  }
  
  // Check for SQL injection patterns in URL
  const sqlPatterns = [
    'union', 'select', 'insert', 'delete', 'update', 'drop', 'create', 'alter',
    'exec', 'execute', 'sp_', 'xp_', '--', ';--', '/*', '*/', 'char(', 'nchar(',
    'varchar(', 'nvarchar(', 'alter', 'begin', 'cast', 'create', 'cursor',
    'declare', 'delete', 'drop', 'end', 'exec', 'execute', 'fetch', 'insert',
    'kill', 'open', 'select', 'sys', 'sysobjects', 'syscolumns', 'table', 'update'
  ];
  
  const url = request.url.toLowerCase();
  const hasSqlPattern = sqlPatterns.some(pattern => url.includes(pattern));
  
  if (hasSqlPattern) {
    logSuspiciousActivity(
      'Potential SQL injection attempt detected in URL',
      { url: request.url, method },
      request
    );
    return { valid: false, error: 'Suspicious request pattern detected', statusCode: 400 };
  }
  
  return { valid: true };
}

/**
 * Add enhanced security headers to response
 * @param {NextResponse} response - The response object
 * @param {object} rateLimitInfo - Rate limit information
 * @returns {NextResponse} - Response with security headers
 */
function addSecurityHeaders(response, rateLimitInfo = null) {
  // Add standard security headers
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  // Add rate limit headers if provided
  if (rateLimitInfo) {
    response.headers.set('X-RateLimit-Remaining', rateLimitInfo.remaining.toString());
    response.headers.set('X-RateLimit-Reset', Math.ceil(rateLimitInfo.resetTime / 1000).toString());
    if (rateLimitInfo.retryAfter > 0) {
      response.headers.set('Retry-After', rateLimitInfo.retryAfter.toString());
    }
  }
  
  // Add server information headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, nosnippet, noarchive');
  
  return response;
}

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const method = request.method;
  const clientIP = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  
  // Enhanced logging for all API requests
  if (pathname.startsWith('/api/')) {
    logRequestEvent(
      request,
      SecurityEventTypes.ADMIN_ACTION,
      `API request: ${method} ${pathname}`,
      { 
        method,
        pathname,
        userAgent: request.headers.get('user-agent')?.substring(0, 100),
        clientIP: clientIP.substring(0, 45), // Truncate IP for privacy
        contentLength: request.headers.get('content-length') || '0'
      }
    );
  }

  // API Version validation for API routes
  if (pathname.startsWith('/api/')) {
    const apiVersion = extractApiVersion(request);
    
    if (!isVersionSupported(apiVersion)) {
      const response = NextResponse.json(
        { 
          error: 'Unsupported API version',
          code: 'UNSUPPORTED_VERSION',
          requested_version: apiVersion,
          supported_versions: Object.values(API_VERSIONS),
          latest_version: API_VERSIONS.LATEST
        },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Add deprecation warnings if needed
    const deprecationInfo = getDeprecationInfo(apiVersion);
    if (deprecationInfo) {
      // Log deprecation usage for monitoring
      logSuspiciousActivity(
        request,
        SecurityEventTypes.SUSPICIOUS_ACTIVITY,
        `Deprecated API version used: ${apiVersion}`,
        SecuritySeverity.WARNING,
        { 
          version: apiVersion,
          deprecationInfo,
          endpoint: pathname
        }
      );
    }
  }
  
  // Enhanced rate limiting with different limits per endpoint type
  const endpointType = getEndpointType(pathname, method);
  const rateLimitResult = checkRateLimit(clientIP, endpointType);
  
  if (!rateLimitResult.allowed) {
    const response = NextResponse.json(
      { 
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: rateLimitResult.retryAfter,
        message: `Rate limit exceeded. Try again in ${rateLimitResult.retryAfter} seconds.`
      },
      { status: 429 }
    );
    return addSecurityHeaders(response, rateLimitResult);
  }
  
  // Enhanced API request validation
  if (pathname.startsWith('/api/')) {
    const validation = validateApiRequest(request);
    if (!validation.valid) {
      const response = NextResponse.json(
        { 
          error: validation.error,
          code: 'VALIDATION_ERROR'
        },
        { status: validation.statusCode || 400 }
      );
      return addSecurityHeaders(response, rateLimitResult);
    }
  }

  // Apply CORS headers for API routes
  if (pathname.startsWith('/api/')) {
    const corsConfig = getCorsConfig(pathname);
    const response = NextResponse.next();
    applyCorsHeaders(request, response, corsConfig);
    return addSecurityHeaders(response, rateLimitResult);
  }
  
  // Continue with the request and add enhanced security headers
  const response = NextResponse.next();
  return addSecurityHeaders(response, rateLimitResult);
}

// Enhanced matcher configuration
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     * - health check endpoints (for monitoring)
     */
    '/((?!_next/static|_next/image|favicon.ico|health|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)$).*)',
  ],
};