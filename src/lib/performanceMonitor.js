/**
 * Performance Monitoring System
 * Tracks API response times, database queries, and system performance metrics
 */

import productionLogger, { LOG_CATEGORIES } from './productionLogger.js';
import securityLogger from './securityLogger.js';

// Performance thresholds (in milliseconds)
export const PERFORMANCE_THRESHOLDS = {
  API_RESPONSE: 1000,      // 1 second
  DATABASE_QUERY: 500,     // 500ms
  FILE_OPERATION: 2000,    // 2 seconds
  EXTERNAL_API: 5000,      // 5 seconds
  MEMORY_USAGE: 512,       // 512MB
  CPU_USAGE: 80            // 80%
};

// Performance metrics storage
class PerformanceMetrics {
  constructor() {
    this.metrics = new Map();
    this.alerts = [];
    this.maxMetricsHistory = 1000;
    this.alertThreshold = 5; // Number of consecutive threshold breaches before alert
  }

  recordMetric(name, value, metadata = {}) {
    const timestamp = Date.now();
    const metric = {
      name,
      value,
      timestamp,
      metadata
    };

    // Store metric
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const metricHistory = this.metrics.get(name);
    metricHistory.push(metric);
    
    // Keep only recent metrics
    if (metricHistory.length > this.maxMetricsHistory) {
      metricHistory.shift();
    }

    // Check thresholds
    this.checkThreshold(name, value, metadata);

    // Log performance metric
    productionLogger.logPerformanceMetric(name, value, {
      ...metadata,
      threshold: PERFORMANCE_THRESHOLDS[name.toUpperCase()],
      unit: this.getUnit(name)
    });
  }

  checkThreshold(name, value, metadata) {
    const threshold = PERFORMANCE_THRESHOLDS[name.toUpperCase()];
    if (!threshold) return;

    if (value > threshold) {
      this.recordThresholdBreach(name, value, threshold, metadata);
    }
  }

  recordThresholdBreach(name, value, threshold, metadata) {
    const breach = {
      name,
      value,
      threshold,
      timestamp: Date.now(),
      metadata
    };

    // Check for consecutive breaches
    const recentBreaches = this.getRecentBreaches(name, 5 * 60 * 1000); // Last 5 minutes
    // Track this breach for future statistics/alerts
    this.alerts.push(breach);
    
    if (recentBreaches.length >= this.alertThreshold) {
      this.triggerAlert(name, recentBreaches);
    }

    // Log warning
    productionLogger.warn(LOG_CATEGORIES.PERFORMANCE, 'Performance threshold exceeded', {
      metric: name,
      value,
      threshold,
      exceedBy: value - threshold,
      metadata
    });
  }

  getRecentBreaches(name, timeWindow) {
    const now = Date.now();
    return this.alerts.filter(alert => 
      alert.name === name && 
      (now - alert.timestamp) < timeWindow
    );
  }

  triggerAlert(name, breaches) {
    const alert = {
      type: 'PERFORMANCE_DEGRADATION',
      metric: name,
      breachCount: breaches.length,
      timestamp: Date.now(),
      breaches: breaches.slice(-5) // Last 5 breaches
    };

    this.alerts.push(alert);

    // Log critical alert
    securityLogger.logCriticalError('PERFORMANCE_ALERT', {
      alert,
      message: `Performance degradation detected for ${name}`
    });

    productionLogger.error(LOG_CATEGORIES.PERFORMANCE, 'Performance Alert Triggered', alert);
  }

  getUnit(metricName) {
    const timeMetrics = ['api_response', 'database_query', 'file_operation', 'external_api'];
    if (timeMetrics.some(metric => metricName.toLowerCase().includes(metric))) {
      return 'ms';
    }
    
    if (metricName.toLowerCase().includes('memory')) {
      return 'MB';
    }
    
    if (metricName.toLowerCase().includes('cpu')) {
      return '%';
    }
    
    return 'units';
  }

  getMetricStats(name, timeWindow = 60 * 60 * 1000) { // Default: 1 hour
    const metrics = this.metrics.get(name) || [];
    const now = Date.now();
    const recentMetrics = metrics.filter(m => (now - m.timestamp) < timeWindow);
    
    if (recentMetrics.length === 0) {
      return null;
    }

    const values = recentMetrics.map(m => m.value);
    const sum = values.reduce((a, b) => a + b, 0);
    
    return {
      count: values.length,
      average: sum / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      median: this.calculateMedian(values),
      p95: this.calculatePercentile(values, 95),
      p99: this.calculatePercentile(values, 99)
    };
  }

  calculateMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2 
      : sorted[mid];
  }

  calculatePercentile(values, percentile) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  getAllStats() {
    const stats = {};
    for (const [name] of this.metrics) {
      stats[name] = this.getMetricStats(name);
    }
    return stats;
  }

  getAlerts(timeWindow = 24 * 60 * 60 * 1000) { // Default: 24 hours
    const now = Date.now();
    return this.alerts.filter(alert => (now - alert.timestamp) < timeWindow);
  }
}

// Global metrics instance
const performanceMetrics = new PerformanceMetrics();

// Performance monitoring utilities
export class PerformanceTimer {
  constructor(name, metadata = {}) {
    this.name = name;
    this.metadata = metadata;
    this.startTime = process.hrtime.bigint();
  }

  end() {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - this.startTime) / 1000000; // Convert to milliseconds
    
    performanceMetrics.recordMetric(this.name, duration, this.metadata);
    return duration;
  }
}

// Middleware for API performance monitoring
export function createPerformanceMiddleware(metricName) {
  return function performanceMiddleware(handler) {
    return async function(request, context) {
      const timer = new PerformanceTimer(metricName, {
        method: request.method,
        url: request.url,
        userAgent: request.headers.get('user-agent')
      });

      try {
        const response = await handler(request, context);
        const duration = timer.end();
        
        // Log successful API call
        productionLogger.logAPIRequest(
          request.method,
          new URL(request.url).pathname,
          request.headers.get('x-user-id'),
          duration,
          response?.status
        );

        return response;
      } catch (error) {
        timer.end();
        
        // Log API error
        productionLogger.logAPIError(
          request.method,
          new URL(request.url).pathname,
          error,
          request.headers.get('x-user-id'),
          500
        );

        throw error;
      }
    };
  };
}

// Database operation monitoring
export function monitorDatabaseOperation(operation, table) {
  return new PerformanceTimer(`database_query`, {
    operation,
    table
  });
}

// System resource monitoring
export function monitorSystemResources() {
  const memUsage = process.memoryUsage();
  const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  
  performanceMetrics.recordMetric('memory_usage', memUsedMB, {
    rss: Math.round(memUsage.rss / 1024 / 1024),
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
    external: Math.round(memUsage.external / 1024 / 1024)
  });

  // CPU usage monitoring (simplified)
  const cpuUsage = process.cpuUsage();
  const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
  
  performanceMetrics.recordMetric('cpu_usage', cpuPercent, {
    user: cpuUsage.user,
    system: cpuUsage.system,
    uptime: process.uptime()
  });
}

// Start system monitoring in production
if (process.env.NODE_ENV === 'production') {
  setInterval(monitorSystemResources, 30000); // Every 30 seconds
}

// Export functions and classes
export {
  performanceMetrics,
  PerformanceMetrics
};

const performanceMonitor = {
  PerformanceTimer,
  performanceMetrics,
  createPerformanceMiddleware,
  monitorDatabaseOperation,
  monitorSystemResources,
  PERFORMANCE_THRESHOLDS
};

export default performanceMonitor;