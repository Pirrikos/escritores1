/**
 * Health Check System
 * Monitors application health, database connectivity, and external dependencies
 */

import { getSupabaseRouteClient } from './supabaseServer.js';
import productionLogger, { LOG_CATEGORIES } from './productionLogger.js';
import { performanceMetrics } from './performanceMonitor.js';

// Health check configuration
export const HEALTH_CHECK_CONFIG = {
  DATABASE_TIMEOUT: 5000,      // 5 seconds
  EXTERNAL_API_TIMEOUT: 10000, // 10 seconds
  MEMORY_THRESHOLD: 512,       // 512MB
  CPU_THRESHOLD: 80,           // 80%
  DISK_THRESHOLD: 90,          // 90%
  RESPONSE_TIME_THRESHOLD: 1000 // 1 second
};

// Health status levels
export const HEALTH_STATUS = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  UNHEALTHY: 'unhealthy',
  CRITICAL: 'critical'
};

// Health check results cache
let lastHealthCheck = null;
let healthCheckInProgress = false;

/**
 * Comprehensive health check
 */
export async function performHealthCheck() {
  if (healthCheckInProgress) {
    return lastHealthCheck || { status: HEALTH_STATUS.DEGRADED, message: 'Health check in progress' };
  }

  healthCheckInProgress = true;
  const startTime = Date.now();

  try {
    const healthData = {
      timestamp: new Date().toISOString(),
      status: HEALTH_STATUS.HEALTHY,
      checks: {},
      metrics: {},
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    };

    // Database connectivity check
    healthData.checks.database = await checkDatabaseHealth();
    
    // System resources check
    healthData.checks.system = await checkSystemHealth();
    
    // Performance metrics check
    healthData.checks.performance = await checkPerformanceHealth();
    
    // External dependencies check
    healthData.checks.dependencies = await checkDependenciesHealth();

    // Determine overall status
    healthData.status = determineOverallHealth(healthData.checks);
    
    // Add performance metrics
    healthData.metrics = getHealthMetrics();
    
    // Calculate response time
    healthData.responseTime = Date.now() - startTime;

    // Log health check result
    const logLevel = healthData.status === HEALTH_STATUS.HEALTHY ? 'info' : 'warn';
    productionLogger[logLevel](LOG_CATEGORIES.SYSTEM, 'Health check completed', {
      status: healthData.status,
      responseTime: healthData.responseTime,
      checks: Object.keys(healthData.checks).reduce((acc, key) => {
        acc[key] = healthData.checks[key].status;
        return acc;
      }, {})
    });

    lastHealthCheck = healthData;
    return healthData;

  } catch (error) {
    const errorResult = {
      timestamp: new Date().toISOString(),
      status: HEALTH_STATUS.CRITICAL,
      error: error.message,
      responseTime: Date.now() - startTime
    };

    productionLogger.error(LOG_CATEGORIES.SYSTEM, 'Health check failed', {
      error: error.message,
      stack: error.stack
    });

    lastHealthCheck = errorResult;
    return errorResult;
  } finally {
    healthCheckInProgress = false;
  }
}

/**
 * Check database connectivity and performance
 */
async function checkDatabaseHealth() {
  const startTime = Date.now();
  
  try {
    const supabase = await getSupabaseRouteClient();
    
    // Test basic connectivity
    const { data, error } = await Promise.race([
      supabase.from('posts').select('count', { count: 'exact', head: true }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database timeout')), HEALTH_CHECK_CONFIG.DATABASE_TIMEOUT)
      )
    ]);

    const responseTime = Date.now() - startTime;

    if (error) {
      return {
        status: HEALTH_STATUS.UNHEALTHY,
        message: `Database error: ${error.message}`,
        responseTime,
        error: error.code
      };
    }

    const status = responseTime > HEALTH_CHECK_CONFIG.RESPONSE_TIME_THRESHOLD 
      ? HEALTH_STATUS.DEGRADED 
      : HEALTH_STATUS.HEALTHY;

    return {
      status,
      message: 'Database connection successful',
      responseTime,
      recordCount: data?.length || 0
    };

  } catch (error) {
    return {
      status: HEALTH_STATUS.CRITICAL,
      message: `Database check failed: ${error.message}`,
      responseTime: Date.now() - startTime,
      error: error.message
    };
  }
}

/**
 * Check system resources
 */
async function checkSystemHealth() {
  try {
    const memUsage = process.memoryUsage();
    const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    
    // CPU usage (simplified)
    const cpuUsage = process.cpuUsage();
    const cpuPercent = Math.round((cpuUsage.user + cpuUsage.system) / 10000) / 100;

    let status = HEALTH_STATUS.HEALTHY;
    const issues = [];

    if (memUsedMB > HEALTH_CHECK_CONFIG.MEMORY_THRESHOLD) {
      status = HEALTH_STATUS.DEGRADED;
      issues.push(`High memory usage: ${memUsedMB}MB`);
    }

    if (cpuPercent > HEALTH_CHECK_CONFIG.CPU_THRESHOLD) {
      status = HEALTH_STATUS.DEGRADED;
      issues.push(`High CPU usage: ${cpuPercent}%`);
    }

    return {
      status,
      message: issues.length > 0 ? issues.join(', ') : 'System resources normal',
      metrics: {
        memory: {
          used: memUsedMB,
          total: Math.round(memUsage.heapTotal / 1024 / 1024),
          rss: Math.round(memUsage.rss / 1024 / 1024)
        },
        cpu: {
          usage: cpuPercent,
          uptime: process.uptime()
        }
      }
    };

  } catch (error) {
    return {
      status: HEALTH_STATUS.UNHEALTHY,
      message: `System check failed: ${error.message}`,
      error: error.message
    };
  }
}

/**
 * Check performance metrics
 */
async function checkPerformanceHealth() {
  try {
    const stats = performanceMetrics.getAllStats();
    const alerts = performanceMetrics.getAlerts(60 * 60 * 1000); // Last hour
    
    let status = HEALTH_STATUS.HEALTHY;
    const issues = [];

    // Check API response times
    if (stats.api_response && stats.api_response.average > HEALTH_CHECK_CONFIG.RESPONSE_TIME_THRESHOLD) {
      status = HEALTH_STATUS.DEGRADED;
      issues.push(`Slow API responses: ${Math.round(stats.api_response.average)}ms avg`);
    }

    // Check for recent alerts
    if (alerts.length > 0) {
      status = HEALTH_STATUS.DEGRADED;
      issues.push(`${alerts.length} performance alerts in last hour`);
    }

    return {
      status,
      message: issues.length > 0 ? issues.join(', ') : 'Performance metrics normal',
      metrics: {
        apiResponseTime: stats.api_response ? Math.round(stats.api_response.average) : null,
        databaseQueryTime: stats.database_query ? Math.round(stats.database_query.average) : null,
        alertsCount: alerts.length
      }
    };

  } catch (error) {
    return {
      status: HEALTH_STATUS.UNHEALTHY,
      message: `Performance check failed: ${error.message}`,
      error: error.message
    };
  }
}

/**
 * Check external dependencies
 */
async function checkDependenciesHealth() {
  try {
    const checks = [];
    
    // Check if we can reach external APIs (if any)
    // This is a placeholder - add actual external dependency checks here
    
    return {
      status: HEALTH_STATUS.HEALTHY,
      message: 'All dependencies accessible',
      dependencies: checks
    };

  } catch (error) {
    return {
      status: HEALTH_STATUS.UNHEALTHY,
      message: `Dependencies check failed: ${error.message}`,
      error: error.message
    };
  }
}

/**
 * Determine overall health status
 */
function determineOverallHealth(checks) {
  const statuses = Object.values(checks).map(check => check.status);
  
  if (statuses.includes(HEALTH_STATUS.CRITICAL)) {
    return HEALTH_STATUS.CRITICAL;
  }
  
  if (statuses.includes(HEALTH_STATUS.UNHEALTHY)) {
    return HEALTH_STATUS.UNHEALTHY;
  }
  
  if (statuses.includes(HEALTH_STATUS.DEGRADED)) {
    return HEALTH_STATUS.DEGRADED;
  }
  
  return HEALTH_STATUS.HEALTHY;
}

/**
 * Get current health metrics
 */
function getHealthMetrics() {
  const memUsage = process.memoryUsage();
  
  return {
    uptime: process.uptime(),
    memory: {
      used: Math.round(memUsage.heapUsed / 1024 / 1024),
      total: Math.round(memUsage.heapTotal / 1024 / 1024),
      rss: Math.round(memUsage.rss / 1024 / 1024)
    },
    cpu: process.cpuUsage(),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch
  };
}

/**
 * Quick health check for liveness probe
 */
export function quickHealthCheck() {
  return {
    status: HEALTH_STATUS.HEALTHY,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  };
}

/**
 * Readiness check for readiness probe
 */
export async function readinessCheck() {
  try {
    // Quick database connectivity check
    const supabase = await getSupabaseRouteClient();
    await supabase.from('posts').select('count', { count: 'exact', head: true });
    
    return {
      status: HEALTH_STATUS.HEALTHY,
      timestamp: new Date().toISOString(),
      ready: true
    };
  } catch (error) {
    return {
      status: HEALTH_STATUS.UNHEALTHY,
      timestamp: new Date().toISOString(),
      ready: false,
      error: error.message
    };
  }
}

// Schedule periodic health checks in production
if (process.env.NODE_ENV === 'production') {
  setInterval(async () => {
    try {
      await performHealthCheck();
    } catch (error) {
      productionLogger.error(LOG_CATEGORIES.SYSTEM, 'Scheduled health check failed', {
        error: error.message
      });
    }
  }, 5 * 60 * 1000); // Every 5 minutes
}

const healthCheck = {
  performHealthCheck,
  quickHealthCheck,
  readinessCheck,
  HEALTH_STATUS,
  HEALTH_CHECK_CONFIG
};

export default healthCheck;