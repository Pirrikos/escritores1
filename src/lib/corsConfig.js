/**
 * Enhanced CORS Configuration
 * Provides secure and restrictive CORS settings for production
 */

import securityLogger from './securityLogger.js';

// Environment-based allowed origins
const getAllowedOrigins = () => {
  const baseOrigins = [];
  
  // Production origins
  if (process.env.NODE_ENV === 'production') {
    if (process.env.PRODUCTION_DOMAIN) {
      baseOrigins.push(`https://${process.env.PRODUCTION_DOMAIN}`);
    }
    if (process.env.ADDITIONAL_ALLOWED_ORIGINS) {
      const additionalOrigins = process.env.ADDITIONAL_ALLOWED_ORIGINS.split(',');
      baseOrigins.push(...additionalOrigins.map(origin => origin.trim()));
    }
  } else {
    // Development origins
    baseOrigins.push(
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001'
    );
  }
  
  return baseOrigins;
};

// CORS configuration for different endpoint types
export const CORS_CONFIGS = {
  // Strict configuration for sensitive endpoints
  strict: {
    origin: (origin, callback) => {
      const allowedOrigins = getAllowedOrigins();
      
      // Allow requests with no origin (mobile apps, Postman, etc.) only in development
      if (!origin && process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      
      if (!origin || !allowedOrigins.includes(origin)) {
        securityLogger.logSecurityEvent('CORS_VIOLATION', 'WARNING', {
          origin,
          allowedOrigins,
          endpoint: 'strict'
        });
        
        const error = new Error(`CORS policy violation: Origin ${origin} not allowed`);
        error.code = 'CORS_NOT_ALLOWED';
        return callback(error, false);
      }
      
      callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-API-Key',
      'X-CSRF-Token'
    ],
    exposedHeaders: [
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'X-Request-ID'
    ],
    credentials: true,
    maxAge: 86400, // 24 hours
    optionsSuccessStatus: 200
  },
  
  // Standard configuration for API endpoints
  api: {
    origin: (origin, callback) => {
      const allowedOrigins = getAllowedOrigins();
      
      if (!origin && process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      
      if (!origin || !allowedOrigins.includes(origin)) {
        securityLogger.logSecurityEvent('CORS_VIOLATION', 'INFO', {
          origin,
          allowedOrigins,
          endpoint: 'api'
        });
        return callback(null, false);
      }
      
      callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With'
    ],
    exposedHeaders: [
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset'
    ],
    credentials: true,
    maxAge: 3600, // 1 hour
    optionsSuccessStatus: 200
  },
  
  // Public configuration for health checks and public endpoints
  public: {
    origin: '*',
    methods: ['GET', 'HEAD'],
    allowedHeaders: ['Content-Type'],
    credentials: false,
    maxAge: 300, // 5 minutes
    optionsSuccessStatus: 200
  },
  
  // Upload configuration for file uploads
  upload: {
    origin: (origin, callback) => {
      const allowedOrigins = getAllowedOrigins();
      
      if (!origin && process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      
      if (!origin || !allowedOrigins.includes(origin)) {
        securityLogger.logSecurityEvent('CORS_VIOLATION', 'WARNING', {
          origin,
          allowedOrigins,
          endpoint: 'upload'
        });
        return callback(null, false);
      }
      
      callback(null, true);
    },
    methods: ['POST', 'PUT'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Content-Length'
    ],
    credentials: true,
    maxAge: 1800, // 30 minutes
    optionsSuccessStatus: 200
  }
};

/**
 * Get CORS configuration based on request path and method
 */
export function getCorsConfig(pathname) {
  // Health check endpoints - public access
  if (pathname.includes('/health') || pathname.includes('/status')) {
    return CORS_CONFIGS.public;
  }
  
  // Upload endpoints - strict upload config
  if (pathname.includes('/upload') || pathname.includes('/file')) {
    return CORS_CONFIGS.upload;
  }
  
  // Admin endpoints - strict config
  if (pathname.includes('/admin') || pathname.includes('/system')) {
    return CORS_CONFIGS.strict;
  }
  
  // Authentication endpoints - strict config
  if (pathname.includes('/auth') || pathname.includes('/login') || pathname.includes('/register')) {
    return CORS_CONFIGS.strict;
  }
  
  // API endpoints - standard API config
  if (pathname.startsWith('/api/')) {
    return CORS_CONFIGS.api;
  }
  
  // Default to strict for everything else
  return CORS_CONFIGS.strict;
}

/**
 * Apply CORS headers to Next.js response
 */
export function applyCorsHeaders(request, response, corsConfig) {
  const { pathname } = new URL(request.url);
  const origin = request.headers.get('origin');
  
  // Use provided config or get default
  const config = corsConfig || getCorsConfig(pathname);
  
  // Handle origin
  if (typeof config.origin === 'function') {
    config.origin(origin, (error, allowed) => {
      if (error || !allowed) {
        // Origin not allowed - don't set CORS headers
        return;
      }
      response.headers.set('Access-Control-Allow-Origin', origin || '*');
    });
  } else if (config.origin === '*') {
    response.headers.set('Access-Control-Allow-Origin', '*');
  } else if (Array.isArray(config.origin)) {
    if (origin && config.origin.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
    }
  } else {
    response.headers.set('Access-Control-Allow-Origin', config.origin);
  }
  
  // Set other CORS headers
  if (config.methods) {
    response.headers.set('Access-Control-Allow-Methods', config.methods.join(', '));
  }
  
  if (config.allowedHeaders) {
    response.headers.set('Access-Control-Allow-Headers', config.allowedHeaders.join(', '));
  }
  
  if (config.exposedHeaders) {
    response.headers.set('Access-Control-Expose-Headers', config.exposedHeaders.join(', '));
  }
  
  if (config.credentials) {
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }
  
  if (config.maxAge) {
    response.headers.set('Access-Control-Max-Age', config.maxAge.toString());
  }
  
  return response;
}

/**
 * CORS middleware for Next.js API routes
 */
export function corsMiddleware(config = null) {
  return (req, res, next) => {
    const pathname = req.url || '/';
    const corsConfig = config || getCorsConfig(pathname);
    const origin = req.headers.origin;
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      if (typeof corsConfig.origin === 'function') {
        corsConfig.origin(origin, (error, allowed) => {
          if (error || !allowed) {
            return res.status(403).json({ error: 'CORS policy violation' });
          }
          
          res.setHeader('Access-Control-Allow-Origin', origin || '*');
          res.setHeader('Access-Control-Allow-Methods', corsConfig.methods?.join(', ') || 'GET,POST,PUT,DELETE');
          res.setHeader('Access-Control-Allow-Headers', corsConfig.allowedHeaders?.join(', ') || 'Content-Type,Authorization');
          
          if (corsConfig.credentials) {
            res.setHeader('Access-Control-Allow-Credentials', 'true');
          }
          
          if (corsConfig.maxAge) {
            res.setHeader('Access-Control-Max-Age', corsConfig.maxAge.toString());
          }
          
          return res.status(corsConfig.optionsSuccessStatus || 200).end();
        });
      } else {
        // Handle non-function origin
        const allowedOrigin = corsConfig.origin === '*' ? '*' : 
                            (Array.isArray(corsConfig.origin) && origin && corsConfig.origin.includes(origin)) ? origin :
                            corsConfig.origin === origin ? origin : null;
        
        if (!allowedOrigin && corsConfig.origin !== '*') {
          return res.status(403).json({ error: 'CORS policy violation' });
        }
        
        res.setHeader('Access-Control-Allow-Origin', allowedOrigin || '*');
        res.setHeader('Access-Control-Allow-Methods', corsConfig.methods?.join(', ') || 'GET,POST,PUT,DELETE');
        res.setHeader('Access-Control-Allow-Headers', corsConfig.allowedHeaders?.join(', ') || 'Content-Type,Authorization');
        
        if (corsConfig.credentials) {
          res.setHeader('Access-Control-Allow-Credentials', 'true');
        }
        
        return res.status(corsConfig.optionsSuccessStatus || 200).end();
      }
    } else {
      // Handle actual requests
      if (typeof corsConfig.origin === 'function') {
        corsConfig.origin(origin, (error, allowed) => {
          if (!error && allowed) {
            res.setHeader('Access-Control-Allow-Origin', origin || '*');
            if (corsConfig.credentials) {
              res.setHeader('Access-Control-Allow-Credentials', 'true');
            }
            if (corsConfig.exposedHeaders) {
              res.setHeader('Access-Control-Expose-Headers', corsConfig.exposedHeaders.join(', '));
            }
          }
        });
      }
      
      if (next) next();
    }
  };
}

/**
 * Validate origin against allowed list
 */
export function validateOrigin(origin, allowedOrigins = null) {
  const allowed = allowedOrigins || getAllowedOrigins();
  
  if (!origin && process.env.NODE_ENV !== 'production') {
    return true;
  }
  
  return allowed.includes(origin);
}

const corsConfig = {
  CORS_CONFIGS,
  getCorsConfig,
  applyCorsHeaders,
  corsMiddleware,
  validateOrigin,
  getAllowedOrigins
};

export default corsConfig;