/**
 * Production Logging System
 * Advanced logging with multiple levels, structured data, and production-ready features
 */

import { securityLogger } from './securityLogger.js';

// Log levels
export const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4
};

// Log categories
export const LOG_CATEGORIES = {
  API: 'api',
  AUTH: 'auth',
  DATABASE: 'database',
  SECURITY: 'security',
  PERFORMANCE: 'performance',
  USER_ACTION: 'user_action',
  SYSTEM: 'system',
  BUSINESS: 'business'
};

// Production environment detection
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

class ProductionLogger {
  constructor() {
    this.logLevel = this.getLogLevel();
    this.enabledCategories = this.getEnabledCategories();
    this.logBuffer = [];
    this.maxBufferSize = 1000;
    this.flushInterval = 30000; // 30 seconds
    
    // Start periodic flush in production
    if (isProduction) {
      this.startPeriodicFlush();
    }
  }

  getLogLevel() {
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    return LOG_LEVELS[envLevel] ?? (isProduction ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG);
  }

  getEnabledCategories() {
    const envCategories = process.env.LOG_CATEGORIES;
    if (envCategories) {
      return envCategories.split(',').map(cat => cat.trim().toLowerCase());
    }
    return Object.values(LOG_CATEGORIES);
  }

  shouldLog(level, category) {
    if (level > this.logLevel) return false;
    if (category && !this.enabledCategories.includes(category)) return false;
    return true;
  }

  formatLogEntry(level, category, message, data = {}, context = {}) {
    const timestamp = new Date().toISOString();
    const levelName = Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === level);
    
    return {
      timestamp,
      level: levelName,
      category,
      message,
      data,
      context: {
        ...context,
        nodeEnv: process.env.NODE_ENV,
        pid: process.pid,
        memory: process.memoryUsage(),
        uptime: process.uptime()
      }
    };
  }

  log(level, category, message, data = {}, context = {}) {
    if (!this.shouldLog(level, category)) return;

    const logEntry = this.formatLogEntry(level, category, message, data, context);
    
    // Console output for development
    if (isDevelopment) {
      this.consoleLog(logEntry);
    }
    
    // Buffer for production
    if (isProduction) {
      this.bufferLog(logEntry);
    }
    
    // Critical errors always go to security logger
    if (level === LOG_LEVELS.ERROR) {
      securityLogger.logCriticalError('PRODUCTION_ERROR', {
        message,
        data,
        context
      });
    }
  }

  consoleLog(logEntry) {
    const { timestamp, level, category, message, data } = logEntry;
    const colorMap = {
      ERROR: '\x1b[31m', // Red
      WARN: '\x1b[33m',  // Yellow
      INFO: '\x1b[36m',  // Cyan
      DEBUG: '\x1b[32m', // Green
      TRACE: '\x1b[37m'  // White
    };
    
    const color = colorMap[level] || '\x1b[0m';
    const reset = '\x1b[0m';
    
    console.log(
      `${color}[${timestamp}] ${level} [${category}]${reset} ${message}`,
      Object.keys(data).length > 0 ? data : ''
    );
  }

  bufferLog(logEntry) {
    this.logBuffer.push(logEntry);
    
    if (this.logBuffer.length >= this.maxBufferSize) {
      this.flushLogs();
    }
  }

  async flushLogs() {
    if (this.logBuffer.length === 0) return;
    
    const logsToFlush = [...this.logBuffer];
    this.logBuffer = [];
    
    try {
      // In a real production environment, you would send these to:
      // - External logging service (e.g., Datadog, New Relic, CloudWatch)
      // - Database for persistence
      // - File system for local storage
      
      // For now, we'll use console in production with structured format
      if (isProduction) {
        logsToFlush.forEach(log => {
          console.log(JSON.stringify(log));
        });
      }
      
      // Send critical logs to monitoring service
      const criticalLogs = logsToFlush.filter(log => 
        log.level === 'ERROR' || log.category === LOG_CATEGORIES.SECURITY
      );
      
      if (criticalLogs.length > 0) {
        await this.sendToMonitoring(criticalLogs);
      }
      
    } catch (error) {
      console.error('Failed to flush logs:', error);
      // Put logs back in buffer for retry
      this.logBuffer.unshift(...logsToFlush);
    }
  }

  async sendToMonitoring(logs) {
    // In production, integrate with monitoring services
    // For now, just ensure they're logged
    logs.forEach(log => {
      securityLogger.logCriticalError('PRODUCTION_LOG', log);
    });
  }

  startPeriodicFlush() {
    setInterval(() => {
      this.flushLogs();
    }, this.flushInterval);
  }

  // Convenience methods
  error(category, message, data = {}, context = {}) {
    this.log(LOG_LEVELS.ERROR, category, message, data, context);
  }

  warn(category, message, data = {}, context = {}) {
    this.log(LOG_LEVELS.WARN, category, message, data, context);
  }

  info(category, message, data = {}, context = {}) {
    this.log(LOG_LEVELS.INFO, category, message, data, context);
  }

  debug(category, message, data = {}, context = {}) {
    this.log(LOG_LEVELS.DEBUG, category, message, data, context);
  }

  trace(category, message, data = {}, context = {}) {
    this.log(LOG_LEVELS.TRACE, category, message, data, context);
  }

  // API-specific logging methods
  logAPIRequest(method, path, userId = null, duration = null, statusCode = null) {
    this.info(LOG_CATEGORIES.API, 'API Request', {
      method,
      path,
      userId,
      duration,
      statusCode,
      timestamp: Date.now()
    });
  }

  logAPIError(method, path, error, userId = null, statusCode = 500) {
    this.error(LOG_CATEGORIES.API, 'API Error', {
      method,
      path,
      error: error.message,
      stack: error.stack,
      userId,
      statusCode
    });
  }

  logUserAction(userId, action, resource = null, metadata = {}) {
    this.info(LOG_CATEGORIES.USER_ACTION, 'User Action', {
      userId,
      action,
      resource,
      metadata,
      timestamp: Date.now()
    });
  }

  logPerformanceMetric(metric, value, context = {}) {
    this.info(LOG_CATEGORIES.PERFORMANCE, 'Performance Metric', {
      metric,
      value,
      unit: context.unit || 'ms',
      threshold: context.threshold,
      exceeded: context.threshold && value > context.threshold,
      ...context
    });
  }

  logDatabaseOperation(operation, table, duration, success = true, error = null) {
    const level = success ? LOG_LEVELS.DEBUG : LOG_LEVELS.ERROR;
    this.log(level, LOG_CATEGORIES.DATABASE, 'Database Operation', {
      operation,
      table,
      duration,
      success,
      error: error?.message
    });
  }

  logBusinessEvent(event, data = {}, userId = null) {
    this.info(LOG_CATEGORIES.BUSINESS, 'Business Event', {
      event,
      data,
      userId,
      timestamp: Date.now()
    });
  }

  // System health logging
  logSystemHealth() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    this.info(LOG_CATEGORIES.SYSTEM, 'System Health', {
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024) // MB
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      uptime: Math.round(process.uptime()),
      timestamp: Date.now()
    });
  }

  // Get logging statistics
  getStats() {
    return {
      bufferSize: this.logBuffer.length,
      maxBufferSize: this.maxBufferSize,
      logLevel: Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === this.logLevel),
      enabledCategories: this.enabledCategories,
      isProduction,
      flushInterval: this.flushInterval
    };
  }
}

// Create singleton instance
const productionLogger = new ProductionLogger();

// Start system health monitoring in production
if (isProduction) {
  setInterval(() => {
    productionLogger.logSystemHealth();
  }, 60000); // Every minute
}

export default productionLogger;
export { ProductionLogger };