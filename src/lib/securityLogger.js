// src/lib/securityLogger.js
// Security logging utilities for monitoring suspicious activities

/**
 * Security Logger
 * Enhanced security logging system for monitoring and alerting
 */

// Security event types
export const SECURITY_EVENTS = {
  // Authentication events
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  LOGOUT: 'LOGOUT',
  TOKEN_REFRESH: 'TOKEN_REFRESH',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  
  // Authorization events
  UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  ADMIN_ACTION: 'ADMIN_ACTION',
  
  // Data validation events
  VALIDATION_FAILURE: 'VALIDATION_FAILURE',
  MALICIOUS_CONTENT: 'MALICIOUS_CONTENT',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Suspicious activities
  SUSPICIOUS_PATTERN: 'SUSPICIOUS_PATTERN',
  MULTIPLE_FAILED_ATTEMPTS: 'MULTIPLE_FAILED_ATTEMPTS',
  UNUSUAL_ACTIVITY: 'UNUSUAL_ACTIVITY',
  
  // System events
  DATABASE_ERROR: 'DATABASE_ERROR',
  API_ERROR: 'API_ERROR',
  SYSTEM_ERROR: 'SYSTEM_ERROR'
};

export const SecurityEventTypes = {
  AUTHENTICATION_FAILURE: 'auth_failure',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  INVALID_INPUT: 'invalid_input',
  UNAUTHORIZED_ACCESS: 'unauthorized_access',
  SUSPICIOUS_ACTIVITY: 'suspicious_activity',
  DATA_BREACH_ATTEMPT: 'data_breach_attempt',
  SQL_INJECTION_ATTEMPT: 'sql_injection_attempt',
  XSS_ATTEMPT: 'xss_attempt',
  CSRF_ATTEMPT: 'csrf_attempt',
  ADMIN_ACTION: 'admin_action',
  USER_REGISTRATION: 'user_registration',
  PASSWORD_RESET: 'password_reset',
  DATA_EXPORT: 'data_export',
  CONFIGURATION_CHANGE: 'config_change'
};

// Security levels
export const SECURITY_LEVELS = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  CRITICAL: 'CRITICAL',
  EMERGENCY: 'EMERGENCY'
};

/**
 * Security event severity levels
 */
export const SecuritySeverity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

class SecurityLogger {
  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
    this.logBuffer = [];
    this.maxBufferSize = 1000;
    this.flushInterval = 30000; // 30 seconds
    
    // Start periodic flush in production
    if (this.isProduction) {
      setInterval(() => this.flushLogs(), this.flushInterval);
    }
  }

  /**
   * Log a security event
   * @param {string} event - Event type from SECURITY_EVENTS
   * @param {string} level - Security level from SECURITY_LEVELS
   * @param {Object} details - Event details
   * @param {Object} context - Request context (user, IP, etc.)
   */
  log(event, level, details = {}, context = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      level,
      details,
      context: this.sanitizeContext(context),
      environment: process.env.NODE_ENV || 'development',
      sessionId: this.generateSessionId()
    };

    // Add to buffer
    this.logBuffer.push(logEntry);
    
    // Manage buffer size
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer = this.logBuffer.slice(-this.maxBufferSize);
    }

    // Immediate actions based on level
    this.handleImmediateActions(logEntry);

    // Console logging in development
    if (!this.isProduction) {
      this.consoleLog(logEntry);
    }

    return logEntry;
  }

  /**
   * Log authentication events
   */
  logAuth(event, userId, details = {}, request = {}) {
    const context = {
      userId,
      userAgent: request.headers?.['user-agent'],
      ip: this.getClientIP(request),
      referer: request.headers?.referer
    };

    const level = event.includes('FAILURE') || event.includes('INVALID') 
      ? SECURITY_LEVELS.WARNING 
      : SECURITY_LEVELS.INFO;

    return this.log(event, level, details, context);
  }

  /**
   * Log suspicious activities
   */
  logSuspicious(event, details = {}, context = {}) {
    return this.log(event, SECURITY_LEVELS.CRITICAL, details, context);
  }

  /**
   * Log validation failures
   */
  logValidation(field, error, value, context = {}) {
    const details = {
      field,
      error,
      valueLength: typeof value === 'string' ? value.length : null,
      valueType: typeof value
    };

    return this.log(
      SECURITY_EVENTS.VALIDATION_FAILURE, 
      SECURITY_LEVELS.WARNING, 
      details, 
      context
    );
  }

  /**
   * Log rate limit violations
   */
  logRateLimit(userId, endpoint, attempts, context = {}) {
    const details = {
      userId,
      endpoint,
      attempts,
      timeWindow: '5 minutes'
    };

    return this.log(
      SECURITY_EVENTS.RATE_LIMIT_EXCEEDED,
      SECURITY_LEVELS.WARNING,
      details,
      context
    );
  }

  /**
   * Log database errors with security implications
   */
  logDatabaseError(error, query, context = {}) {
    const details = {
      errorMessage: error.message,
      errorCode: error.code,
      queryType: this.getQueryType(query),
      // Don't log actual query in production for security
      query: this.isProduction ? '[REDACTED]' : query
    };

    const level = this.isDatabaseSecurityError(error) 
      ? SECURITY_LEVELS.CRITICAL 
      : SECURITY_LEVELS.WARNING;

    return this.log(SECURITY_EVENTS.DATABASE_ERROR, level, details, context);
  }

  /**
   * Log API errors
   */
  logAPIError(error, endpoint, method, context = {}) {
    const details = {
      errorMessage: error.message,
      errorStack: this.isProduction ? '[REDACTED]' : error.stack,
      endpoint,
      method,
      statusCode: error.statusCode || 500
    };

    return this.log(SECURITY_EVENTS.API_ERROR, SECURITY_LEVELS.WARNING, details, context);
  }

  /**
   * Check for suspicious patterns
   */
  detectSuspiciousActivity(userId, action, context = {}) {
    const recentLogs = this.getRecentLogsByUser(userId, 300000); // 5 minutes
    
    // Check for rapid successive actions
    const sameActionLogs = recentLogs.filter(log => 
      log.details.action === action && 
      log.context.userId === userId
    );

    if (sameActionLogs.length > 10) {
      this.logSuspicious(SECURITY_EVENTS.SUSPICIOUS_PATTERN, {
        pattern: 'rapid_successive_actions',
        action,
        count: sameActionLogs.length,
        timeWindow: '5 minutes'
      }, context);
      return true;
    }

    // Check for multiple failed attempts
    const failureLogs = recentLogs.filter(log => 
      log.event.includes('FAILURE') && 
      log.context.userId === userId
    );

    if (failureLogs.length > 5) {
      this.logSuspicious(SECURITY_EVENTS.MULTIPLE_FAILED_ATTEMPTS, {
        failureCount: failureLogs.length,
        timeWindow: '5 minutes'
      }, context);
      return true;
    }

    return false;
  }

  /**
   * Get security metrics
   */
  getSecurityMetrics(timeWindow = 3600000) { // 1 hour default
    const cutoff = new Date(Date.now() - timeWindow);
    const recentLogs = this.logBuffer.filter(log => 
      new Date(log.timestamp) > cutoff
    );

    const metrics = {
      totalEvents: recentLogs.length,
      byLevel: {},
      byEvent: {},
      topUsers: {},
      topIPs: {},
      suspiciousActivities: 0
    };

    recentLogs.forEach(log => {
      // Count by level
      metrics.byLevel[log.level] = (metrics.byLevel[log.level] || 0) + 1;
      
      // Count by event
      metrics.byEvent[log.event] = (metrics.byEvent[log.event] || 0) + 1;
      
      // Count by user
      if (log.context.userId) {
        metrics.topUsers[log.context.userId] = (metrics.topUsers[log.context.userId] || 0) + 1;
      }
      
      // Count by IP
      if (log.context.ip) {
        metrics.topIPs[log.context.ip] = (metrics.topIPs[log.context.ip] || 0) + 1;
      }
      
      // Count suspicious activities
      if (log.level === SECURITY_LEVELS.CRITICAL) {
        metrics.suspiciousActivities++;
      }
    });

    return metrics;
  }

  // Legacy methods for backward compatibility
  logLoginAttempt(userId, success, context = {}) {
    return this.logAuth(
      success ? SECURITY_EVENTS.LOGIN_SUCCESS : SECURITY_EVENTS.LOGIN_FAILURE,
      userId,
      { success },
      context
    );
  }

  logUnauthorizedAccess(resource, context = {}) {
    return this.log(
      SECURITY_EVENTS.UNAUTHORIZED_ACCESS,
      SECURITY_LEVELS.WARNING,
      { resource, timestamp: new Date().toISOString() },
      context
    );
  }

  logSuspiciousActivity(activity, context = {}) {
    return this.logSuspicious(
      SECURITY_EVENTS.SUSPICIOUS_PATTERN,
      { activity, severity: 'high' },
      context
    );
  }

  logRateLimitExceeded(endpoint, context = {}) {
    return this.logRateLimit(
      context.userId,
      endpoint,
      1,
      context
    );
  }

  getRecentEvents(limit = 50) {
    return this.logBuffer.slice(-limit).reverse();
  }

  getEventsByType(eventType, limit = 50) {
    return this.logBuffer
      .filter(log => log.event === eventType)
      .slice(-limit)
      .reverse();
  }

  getEventsForUser(userId, limit = 50) {
    return this.logBuffer
      .filter(log => log.context.userId === userId)
      .slice(-limit)
      .reverse();
  }

  detectSuspiciousPatterns(userId, timeWindow = 300000) {
    return this.detectSuspiciousActivity(userId, 'general', { userId, timeWindow });
  }

  /**
   * Private helper methods
   */
  sanitizeContext(context) {
    const sanitized = { ...context };
    
    // Remove sensitive information
    delete sanitized.password;
    delete sanitized.token;
    delete sanitized.secret;
    delete sanitized.key;
    
    // Truncate long values
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'string' && sanitized[key].length > 500) {
        sanitized[key] = sanitized[key].substring(0, 500) + '...[TRUNCATED]';
      }
    });
    
    return sanitized;
  }

  getClientIP(request) {
    return request.headers?.['x-forwarded-for']?.split(',')[0] ||
           request.headers?.['x-real-ip'] ||
           request.connection?.remoteAddress ||
           request.socket?.remoteAddress ||
           'unknown';
  }

  generateSessionId() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  getQueryType(query) {
    if (!query) return 'unknown';
    const upperQuery = query.toUpperCase().trim();
    
    if (upperQuery.startsWith('SELECT')) return 'SELECT';
    if (upperQuery.startsWith('INSERT')) return 'INSERT';
    if (upperQuery.startsWith('UPDATE')) return 'UPDATE';
    if (upperQuery.startsWith('DELETE')) return 'DELETE';
    if (upperQuery.startsWith('CREATE')) return 'CREATE';
    if (upperQuery.startsWith('DROP')) return 'DROP';
    if (upperQuery.startsWith('ALTER')) return 'ALTER';
    
    return 'other';
  }

  isDatabaseSecurityError(error) {
    const securityErrorCodes = [
      '42501', // insufficient_privilege
      '42601', // syntax_error (potential injection)
      '23505', // unique_violation (potential enumeration)
      '23503'  // foreign_key_violation (potential manipulation)
    ];
    
    return securityErrorCodes.includes(error.code) ||
           error.message.toLowerCase().includes('permission') ||
           error.message.toLowerCase().includes('access denied');
  }

  getRecentLogsByUser(userId, timeWindow) {
    const cutoff = new Date(Date.now() - timeWindow);
    return this.logBuffer.filter(log => 
      log.context.userId === userId && 
      new Date(log.timestamp) > cutoff
    );
  }

  handleImmediateActions(logEntry) {
    // In production, you might want to:
    // - Send alerts for CRITICAL/EMERGENCY events
    // - Block IPs with too many suspicious activities
    // - Notify administrators
    
    if (logEntry.level === SECURITY_LEVELS.EMERGENCY) {
      console.error('🚨 SECURITY EMERGENCY:', logEntry);
      // TODO: Implement immediate notification system
    }
  }

  consoleLog(logEntry) {
    const emoji = {
      [SECURITY_LEVELS.INFO]: 'ℹ️',
      [SECURITY_LEVELS.WARNING]: '⚠️',
      [SECURITY_LEVELS.CRITICAL]: '🚨',
      [SECURITY_LEVELS.EMERGENCY]: '🔥'
    };

    console.log(
      `${emoji[logEntry.level]} [${logEntry.timestamp}] ${logEntry.event}`,
      logEntry.details,
      logEntry.context
    );
  }

  flushLogs() {
    if (this.logBuffer.length === 0) return;
    
    // In production, send logs to external service
    // For now, just clear old logs
    const oneHourAgo = new Date(Date.now() - 3600000);
    this.logBuffer = this.logBuffer.filter(log => 
      new Date(log.timestamp) > oneHourAgo
    );
  }

  generateId() {
    return this.generateSessionId();
  }
}

// Create singleton instance
const securityLogger = new SecurityLogger();

/**
 * Get client information from request
 * @param {Request} request - The incoming request
 * @returns {object} - Client information object
 */
function getClientInfo(request) {
  const headers = request?.headers || {};
  
  return {
    ip: request?.ip || headers.get?.('x-forwarded-for') || headers.get?.('x-real-ip') || 'unknown',
    userAgent: headers.get?.('user-agent') || 'unknown',
    referer: headers.get?.('referer') || null,
    origin: headers.get?.('origin') || null,
    timestamp: new Date().toISOString(),
    url: request?.url || 'unknown',
    method: request?.method || 'unknown'
  };
}

/**
 * Detect potentially malicious patterns in input
 * @param {string} input - Input string to analyze
 * @returns {object} - Detection results
 */
function detectMaliciousPatterns(input) {
  if (!input || typeof input !== 'string') {
    return { detected: false, patterns: [] };
  }
  
  const patterns = {
    sqlInjection: [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
      /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
      /(--|\/\*|\*\/)/,
      /(\b(SCRIPT|JAVASCRIPT|VBSCRIPT)\b)/i
    ],
    xss: [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe[^>]*>/i,
      /<object[^>]*>/i,
      /<embed[^>]*>/i
    ],
    pathTraversal: [
      /\.\.\//,
      /\.\.\\/,
      /%2e%2e%2f/i,
      /%2e%2e%5c/i
    ],
    commandInjection: [
      /[;&|`$()]/,
      /\b(cat|ls|dir|type|echo|wget|curl|nc|netcat)\b/i
    ]
  };
  
  const detected = [];
  
  for (const [category, regexList] of Object.entries(patterns)) {
    for (const regex of regexList) {
      if (regex.test(input)) {
        detected.push(category);
        break;
      }
    }
  }
  
  return {
    detected: detected.length > 0,
    patterns: [...new Set(detected)] // Remove duplicates
  };
}

/**
 * Log security event to console and potentially external services
 * @param {string} eventType - Type of security event
 * @param {string} severity - Severity level
 * @param {string} message - Event message
 * @param {object} metadata - Additional metadata
 * @param {Request} request - Optional request object
 */
export function logSecurityEvent(eventType, severity, message, metadata = {}, request = null) {
  const timestamp = new Date().toISOString();
  const clientInfo = request ? getClientInfo(request) : {};
  
  const logEntry = {
    timestamp,
    eventType,
    severity,
    message,
    clientInfo,
    metadata,
    environment: process.env.NODE_ENV || 'development'
  };
  
  // Console logging with appropriate level
  const logMethod = severity === SecuritySeverity.CRITICAL || severity === SecuritySeverity.HIGH 
    ? console.error 
    : severity === SecuritySeverity.MEDIUM 
    ? console.warn 
    : console.log;
  
  logMethod(`[SECURITY ${severity.toUpperCase()}] ${eventType}: ${message}`, logEntry);
  
  // In production, you might want to send to external logging service
  if (process.env.NODE_ENV === 'production') {
    // Example: Send to external logging service
    // await sendToLoggingService(logEntry);
  }
  
  return logEntry;
}

/**
 * Log authentication failure
 * @param {string} reason - Failure reason
 * @param {object} metadata - Additional metadata
 * @param {Request} request - Request object
 */
export function logAuthFailure(reason, metadata = {}, request = null) {
  return logSecurityEvent(
    SecurityEventTypes.AUTHENTICATION_FAILURE,
    SecuritySeverity.MEDIUM,
    `Authentication failed: ${reason}`,
    metadata,
    request
  );
}

/**
 * Log rate limit exceeded
 * @param {string} identifier - Client identifier
 * @param {number} requestCount - Number of requests
 * @param {Request} request - Request object
 */
export function logRateLimitExceeded(identifier, requestCount, request = null) {
  return logSecurityEvent(
    SecurityEventTypes.RATE_LIMIT_EXCEEDED,
    SecuritySeverity.MEDIUM,
    `Rate limit exceeded for client: ${identifier}`,
    { identifier, requestCount },
    request
  );
}

/**
 * Log invalid input attempt
 * @param {string} field - Field name
 * @param {string} value - Invalid value
 * @param {array} errors - Validation errors
 * @param {Request} request - Request object
 */
export function logInvalidInput(field, value, errors = [], request = null) {
  const maliciousCheck = detectMaliciousPatterns(value);
  const severity = maliciousCheck.detected ? SecuritySeverity.HIGH : SecuritySeverity.LOW;
  
  return logSecurityEvent(
    maliciousCheck.detected ? SecurityEventTypes.SUSPICIOUS_ACTIVITY : SecurityEventTypes.INVALID_INPUT,
    severity,
    `Invalid input detected in field: ${field}`,
    { 
      field, 
      value: value?.substring(0, 100), // Truncate for logging
      errors,
      maliciousPatterns: maliciousCheck.patterns
    },
    request
  );
}

/**
 * Log unauthorized access attempt
 * @param {string} resource - Attempted resource
 * @param {string} userId - User ID (if available)
 * @param {Request} request - Request object
 */
export function logUnauthorizedAccess(resource, userId = null, request = null) {
  return logSecurityEvent(
    SecurityEventTypes.UNAUTHORIZED_ACCESS,
    SecuritySeverity.HIGH,
    `Unauthorized access attempt to: ${resource}`,
    { resource, userId },
    request
  );
}

/**
 * Log admin action
 * @param {string} action - Admin action performed
 * @param {string} userId - Admin user ID
 * @param {object} metadata - Action metadata
 * @param {Request} request - Request object
 */
export function logAdminAction(action, userId, metadata = {}, request = null) {
  return logSecurityEvent(
    SecurityEventTypes.ADMIN_ACTION,
    SecuritySeverity.MEDIUM,
    `Admin action performed: ${action}`,
    { action, userId, ...metadata },
    request
  );
}

/**
 * Log user registration
 * @param {string} userId - New user ID
 * @param {string} email - User email
 * @param {Request} request - Request object
 */
export function logUserRegistration(userId, email, request = null) {
  return logSecurityEvent(
    SecurityEventTypes.USER_REGISTRATION,
    SecuritySeverity.LOW,
    `New user registered: ${email}`,
    { userId, email },
    request
  );
}

/**
 * Log data export action
 * @param {string} userId - User performing export
 * @param {string} dataType - Type of data exported
 * @param {number} recordCount - Number of records
 * @param {Request} request - Request object
 */
export function logDataExport(userId, dataType, recordCount, request = null) {
  return logSecurityEvent(
    SecurityEventTypes.DATA_EXPORT,
    SecuritySeverity.MEDIUM,
    `Data export performed: ${dataType}`,
    { userId, dataType, recordCount },
    request
  );
}

/**
 * Log suspicious activity
 * @param {string} description - Activity description
 * @param {object} metadata - Additional metadata
 * @param {Request} request - Request object
 */
export function logSuspiciousActivity(description, metadata = {}, request = null) {
  return logSecurityEvent(
    SecurityEventTypes.SUSPICIOUS_ACTIVITY,
    SecuritySeverity.HIGH,
    `Suspicious activity detected: ${description}`,
    metadata,
    request
  );
}

/**
 * Middleware helper to log request details
 * @param {Request} request - Request object
 * @param {string} eventType - Event type
 * @param {string} message - Log message
 * @param {object} metadata - Additional metadata
 */
export function logRequestEvent(request, eventType, message, metadata = {}) {
  return logSecurityEvent(
    eventType,
    SecuritySeverity.LOW,
    message,
    {
      ...metadata,
      requestSize: request.headers?.get('content-length') || 0,
      contentType: request.headers?.get('content-type') || 'unknown'
    },
    request
  );
}

/**
 * Create a security audit trail entry
 * @param {string} userId - User performing action
 * @param {string} action - Action performed
 * @param {string} resource - Resource affected
 * @param {object} changes - Changes made
 * @param {Request} request - Request object
 */
export function createAuditTrail(userId, action, resource, changes = {}, request = null) {
  return logSecurityEvent(
    SecurityEventTypes.ADMIN_ACTION,
    SecuritySeverity.LOW,
    `Audit trail: ${action} on ${resource}`,
    {
      userId,
      action,
      resource,
      changes,
      auditTrail: true
    },
    request
  );
}

export default securityLogger;