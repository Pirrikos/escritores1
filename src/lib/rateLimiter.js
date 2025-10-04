/**
 * Advanced Rate Limiting System
 * Provides comprehensive rate limiting with multiple strategies and IP-based protection
 */

import securityLogger from './securityLogger.js';
import { createErrorResponse, ERROR_CODES } from './errorHandler.js';

// Rate limiting configurations
export const RATE_LIMIT_CONFIGS = {
  // API endpoints
  API_GENERAL: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  },
  
  // Authentication endpoints
  AUTH: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  },
  
  // Post creation
  POST_CREATION: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 5,
    skipSuccessfulRequests: false,
    skipFailedRequests: true
  },
  
  // Search and feed
  SEARCH: {
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 30,
    skipSuccessfulRequests: false,
    skipFailedRequests: true
  },
  
  // Admin operations
  ADMIN: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 20,
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  },
  
  // File uploads
  UPLOAD: {
    windowMs: 10 * 60 * 1000, // 10 minutes
    maxRequests: 10,
    skipSuccessfulRequests: false,
    skipFailedRequests: true
  }
};

// In-memory store for rate limiting (in production, use Redis)
class RateLimitStore {
  constructor() {
    this.store = new Map();
    this.cleanup();
  }

  // Get current count for a key
  get(key) {
    const data = this.store.get(key);
    if (!data) return { count: 0, resetTime: null };
    
    // Check if window has expired
    if (Date.now() > data.resetTime) {
      this.store.delete(key);
      return { count: 0, resetTime: null };
    }
    
    return data;
  }

  // Increment count for a key
  increment(key, windowMs) {
    const now = Date.now();
    const data = this.get(key);
    
    if (data.count === 0) {
      // First request in window
      const resetTime = now + windowMs;
      this.store.set(key, { count: 1, resetTime });
      return { count: 1, resetTime };
    } else {
      // Increment existing count
      const newCount = data.count + 1;
      this.store.set(key, { count: newCount, resetTime: data.resetTime });
      return { count: newCount, resetTime: data.resetTime };
    }
  }

  // Clean up expired entries
  cleanup() {
    setInterval(() => {
      const now = Date.now();
      for (const [key, data] of this.store.entries()) {
        if (now > data.resetTime) {
          this.store.delete(key);
        }
      }
    }, 60000); // Clean up every minute
  }

  // Reset specific key
  reset(key) {
    this.store.delete(key);
  }

  // Get all active keys (for monitoring)
  getActiveKeys() {
    const now = Date.now();
    const active = [];
    for (const [key, data] of this.store.entries()) {
      if (now <= data.resetTime) {
        active.push({ key, ...data });
      }
    }
    return active;
  }
}

// Global store instance
const rateLimitStore = new RateLimitStore();

/**
 * Get client identifier for rate limiting
 */
function getClientIdentifier(request) {
  // Try to get user ID from session/auth
  const userId = request.headers.get('x-user-id') || 
                 request.cookies?.get('user-id')?.value;
  
  if (userId) {
    return `user:${userId}`;
  }
  
  // Fall back to IP address
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 
             request.headers.get('x-real-ip') || 
             request.ip || 
             'unknown';
  
  return `ip:${ip}`;
}

/**
 * Create rate limiting middleware
 */
export function createRateLimiter(configName, customConfig = {}) {
  const config = { ...RATE_LIMIT_CONFIGS[configName], ...customConfig };
  
  if (!config) {
    throw new Error(`Rate limit configuration '${configName}' not found`);
  }

  return async (request) => {
    try {
      const identifier = getClientIdentifier(request);
      const key = `${configName}:${identifier}`;
      
      // Get current state
      const current = rateLimitStore.get(key);
      
      // Check if limit exceeded
      if (current.count >= config.maxRequests) {
        const retryAfter = Math.ceil((current.resetTime - Date.now()) / 1000);
        
        // Log rate limit exceeded
        securityLogger.logRateLimitExceeded(key, {
          identifier,
          endpoint: configName,
          count: current.count,
          limit: config.maxRequests,
          resetTime: current.resetTime,
          ip: request.headers.get('x-forwarded-for') || request.ip,
          userAgent: request.headers.get('user-agent')
        });
        
        return {
          allowed: false,
          limit: config.maxRequests,
          remaining: 0,
          resetTime: current.resetTime,
          retryAfter
        };
      }
      
      // Increment counter
      const updated = rateLimitStore.increment(key, config.windowMs);
      
      return {
        allowed: true,
        limit: config.maxRequests,
        remaining: config.maxRequests - updated.count,
        resetTime: updated.resetTime,
        retryAfter: 0
      };
      
    } catch (error) {
      // Log error but allow request to proceed
      securityLogger.logAPIError('RATE_LIMITER_ERROR', {
        error: error.message,
        configName,
        stack: error.stack
      });
      
      return {
        allowed: true,
        limit: config.maxRequests,
        remaining: config.maxRequests,
        resetTime: Date.now() + config.windowMs,
        retryAfter: 0
      };
    }
  };
}

/**
 * Rate limiting middleware for Next.js API routes
 */
export function withRateLimit(configName, customConfig = {}) {
  const rateLimiter = createRateLimiter(configName, customConfig);
  
  return function rateLimitMiddleware(handler) {
    return async function(request, context) {
      const result = await rateLimiter(request);
      
      if (!result.allowed) {
        return createErrorResponse(
          ERROR_CODES.RATE_LIMIT_EXCEEDED,
          `Rate limit exceeded. Try again in ${result.retryAfter} seconds.`,
          {
            limit: result.limit,
            remaining: result.remaining,
            resetTime: result.resetTime
          },
          {
            'Retry-After': result.retryAfter.toString(),
            'X-RateLimit-Limit': result.limit.toString(),
            'X-RateLimit-Remaining': result.remaining.toString(),
            'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString()
          }
        );
      }
      
      // Add rate limit headers to successful responses
      const response = await handler(request, context);
      
      if (response && typeof response.headers?.set === 'function') {
        response.headers.set('X-RateLimit-Limit', result.limit.toString());
        response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
        response.headers.set('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000).toString());
      }
      
      return response;
    };
  };
}

/**
 * IP-based rate limiting for DDoS protection
 */
export function createIPRateLimiter(config = {}) {
  const defaultConfig = {
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute per IP
    blockDuration: 15 * 60 * 1000, // Block for 15 minutes
    ...config
  };
  
  const blockedIPs = new Map();
  
  return async (request) => {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
               request.headers.get('x-real-ip') || 
               request.ip || 
               'unknown';
    
    // Check if IP is currently blocked
    const blockInfo = blockedIPs.get(ip);
    if (blockInfo && Date.now() < blockInfo.unblockTime) {
      const retryAfter = Math.ceil((blockInfo.unblockTime - Date.now()) / 1000);
      
      securityLogger.logSecurityEvent('BLOCKED_IP_ACCESS_ATTEMPT', 'HIGH', {
        ip,
        unblockTime: blockInfo.unblockTime,
        reason: blockInfo.reason
      });
      
      return {
        allowed: false,
        blocked: true,
        retryAfter,
        reason: 'IP temporarily blocked due to excessive requests'
      };
    }
    
    // Check rate limit
    const key = `ip-limit:${ip}`;
    const current = rateLimitStore.get(key);
    
    if (current.count >= defaultConfig.maxRequests) {
      // Block the IP
      const unblockTime = Date.now() + defaultConfig.blockDuration;
      blockedIPs.set(ip, {
        unblockTime,
        reason: 'Rate limit exceeded',
        blockedAt: Date.now()
      });
      
      securityLogger.logSecurityEvent('IP_BLOCKED_RATE_LIMIT', 'CRITICAL', {
        ip,
        requestCount: current.count,
        limit: defaultConfig.maxRequests,
        blockDuration: defaultConfig.blockDuration,
        unblockTime
      });
      
      return {
        allowed: false,
        blocked: true,
        retryAfter: Math.ceil(defaultConfig.blockDuration / 1000),
        reason: 'IP blocked due to rate limit violation'
      };
    }
    
    // Increment counter
    rateLimitStore.increment(key, defaultConfig.windowMs);
    
    return {
      allowed: true,
      blocked: false
    };
  };
}

/**
 * Get rate limiting statistics
 */
export function getRateLimitStats() {
  const activeKeys = rateLimitStore.getActiveKeys();
  const stats = {
    totalActiveKeys: activeKeys.length,
    byType: {},
    topClients: []
  };
  
  // Group by rate limit type
  activeKeys.forEach(({ key, count }) => {
    const [type] = key.split(':');
    if (!stats.byType[type]) {
      stats.byType[type] = { count: 0, totalRequests: 0 };
    }
    stats.byType[type].count++;
    stats.byType[type].totalRequests += count;
  });
  
  // Get top clients by request count
  stats.topClients = activeKeys
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map(({ key, count, resetTime }) => ({
      identifier: key,
      requests: count,
      resetTime: new Date(resetTime).toISOString()
    }));
  
  return stats;
}

export {
  rateLimitStore,
  RateLimitStore
};