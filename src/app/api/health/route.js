export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "../../../lib/supabaseServer";
import { 
  withErrorHandling
} from "../../../lib/errorHandler";
import securityLogger from "../../../lib/securityLogger";
import { performHealthCheck, quickHealthCheck, readinessCheck, HEALTH_STATUS } from '../../../lib/healthCheck.js';
import productionLogger, { LOG_CATEGORIES } from '../../../lib/productionLogger.js';

// Health check configuration
const HEALTH_CONFIG = {
  timeout: 5000,
  memoryThreshold: 512, // MB
  criticalServices: ['database', 'supabase_auth', 'supabase_storage']
};

export async function GET(request) {
  return withErrorHandling(async (request) => {
    const url = new URL(request.url);
    const checkType = url.searchParams.get('type') || 'full';

    let healthData;
    let statusCode = 200;

    switch (checkType) {
      case 'liveness':
        healthData = quickHealthCheck();
        break;
      
      case 'readiness':
        healthData = await readinessCheck();
        if (healthData.status !== HEALTH_STATUS.HEALTHY) {
          statusCode = 503; // Service Unavailable
        }
        break;
      
      case 'legacy':
        // Keep legacy health check for backward compatibility
        return await legacyHealthCheck();
      
      case 'full':
      default:
        healthData = await performHealthCheck();
        
        // Set appropriate status code based on health
        switch (healthData.status) {
          case HEALTH_STATUS.CRITICAL:
            statusCode = 503; // Service Unavailable
            break;
          case HEALTH_STATUS.UNHEALTHY:
            statusCode = 503; // Service Unavailable
            break;
          case HEALTH_STATUS.DEGRADED:
            statusCode = 200; // OK but with warnings
            break;
          case HEALTH_STATUS.HEALTHY:
          default:
            statusCode = 200; // OK
            break;
        }
        break;
    }

    // Log health check request
    productionLogger.info(LOG_CATEGORIES.API, 'Health check requested', {
      type: checkType,
      status: healthData.status,
      responseTime: healthData.responseTime,
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
    });

    return NextResponse.json(healthData, { 
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  })(request);
}

// Legacy health check function for backward compatibility
async function legacyHealthCheck() {
  try {
    const startTime = Date.now();
    const supabase = await getSupabaseRouteClient();
    const checks = {};
    let overallStatus = 'healthy';
    let hasWarnings = false;
    
    // Enhanced database connectivity check
    try {
      const dbStartTime = Date.now();
      
      // Test multiple tables to ensure comprehensive connectivity
      const [postsCheck, profilesCheck, worksCheck] = await Promise.allSettled([
        supabase.from('posts').select('id').limit(1),
        supabase.from('profiles').select('id').limit(1),
        supabase.from('works').select('id').limit(1)
      ]);
      
      const dbResponseTime = Date.now() - dbStartTime;
      
      const dbErrors = [postsCheck, profilesCheck, worksCheck]
        .filter(result => result.status === 'rejected' || result.value?.error)
        .map(result => result.reason?.message || result.value?.error?.message);
      
      if (dbErrors.length > 0) {
        checks.database = {
          status: 'unhealthy',
          errors: dbErrors,
          responseTime: dbResponseTime,
          timestamp: new Date().toISOString()
        };
        overallStatus = 'unhealthy';
      } else {
        checks.database = {
          status: 'healthy',
          responseTime: dbResponseTime,
          tablesChecked: ['posts', 'profiles', 'works'],
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      checks.database = {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
      overallStatus = 'unhealthy';
    }
    
    // Supabase Auth service check
    try {
      const authStartTime = Date.now();
      const { error: authError } = await supabase.auth.getSession();
      const authResponseTime = Date.now() - authStartTime;
      
      if (authError && !authError.message.includes('session')) {
        checks.supabase_auth = {
          status: 'unhealthy',
          error: authError.message,
          responseTime: authResponseTime,
          timestamp: new Date().toISOString()
        };
        overallStatus = 'unhealthy';
      } else {
        checks.supabase_auth = {
          status: 'healthy',
          responseTime: authResponseTime,
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      checks.supabase_auth = {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
      overallStatus = 'unhealthy';
    }
    
    // Supabase Storage service check
    try {
      const storageStartTime = Date.now();
      const { data: buckets, error: storageError } = await supabase.storage.listBuckets();
      const storageResponseTime = Date.now() - storageStartTime;
      
      if (storageError) {
        checks.supabase_storage = {
          status: 'degraded',
          error: storageError.message,
          responseTime: storageResponseTime,
          timestamp: new Date().toISOString()
        };
        hasWarnings = true;
      } else {
        checks.supabase_storage = {
          status: 'healthy',
          responseTime: storageResponseTime,
          bucketsCount: buckets?.length || 0,
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      checks.supabase_storage = {
        status: 'degraded',
        error: error.message,
        timestamp: new Date().toISOString()
      };
      hasWarnings = true;
    }
    
    // Enhanced memory usage check with thresholds
    try {
      const memUsage = process.memoryUsage();
      const memUsageMB = {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024)
      };
      
      const memoryStatus = memUsageMB.heapUsed > HEALTH_CONFIG.memoryThreshold ? 'warning' : 'healthy';
      if (memoryStatus === 'warning') hasWarnings = true;
      
      checks.memory = {
        status: memoryStatus,
        usage: memUsageMB,
        threshold: HEALTH_CONFIG.memoryThreshold,
        uptime: formatUptime(process.uptime()),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      checks.memory = {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
      overallStatus = 'unhealthy';
    }
    
    // Backup system check
    try {
      const backupStatus = global.backupSystemStatus || 'unknown';
      const lastBackup = global.lastBackupTime || null;
      const backupAge = lastBackup ? Date.now() - lastBackup : null;
      
      let status = 'healthy';
      if (backupStatus !== 'running') status = 'degraded';
      if (backupAge && backupAge > 24 * 60 * 60 * 1000) status = 'warning'; // 24 hours
      
      if (status !== 'healthy') hasWarnings = true;
      
      checks.backup_system = {
        status,
        systemStatus: backupStatus,
        lastBackup: lastBackup ? new Date(lastBackup).toISOString() : 'never',
        ageHours: backupAge ? Math.round(backupAge / (60 * 60 * 1000)) : null,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      checks.backup_system = {
        status: 'degraded',
        error: error.message,
        timestamp: new Date().toISOString()
      };
      hasWarnings = true;
    }
    
    // Environment and configuration check
    const requiredEnvVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY'
    ];
    
    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    checks.environment = {
      status: missingEnvVars.length > 0 ? 'unhealthy' : 'healthy',
      nodeEnv: process.env.NODE_ENV,
      nodeVersion: process.version,
      platform: process.platform,
      missingEnvVars: missingEnvVars.length > 0 ? missingEnvVars : undefined,
      timestamp: new Date().toISOString()
    };
    
    if (missingEnvVars.length > 0) {
      overallStatus = 'unhealthy';
    }
    
    // Determine final status
    if (overallStatus === 'healthy' && hasWarnings) {
      overallStatus = 'degraded';
    }
    
    const totalResponseTime = Date.now() - startTime;
    
    // Log health issues
    if (overallStatus !== 'healthy') {
      const unhealthyServices = Object.entries(checks)
        .filter(([, check]) => check.status === 'unhealthy')
        .map(([name]) => name);
      
      securityLogger.logSecurityEvent('HEALTH_CHECK_ISSUES', 'WARNING', {
        overallStatus,
        unhealthyServices,
        totalResponseTime
      });
    }
    
    const statusCode = overallStatus === 'unhealthy' ? 503 : 200;
    
    return NextResponse.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTime: totalResponseTime,
      version: process.env.npm_package_version || '1.0.0',
      checks
    }, { status: statusCode });
    
  } catch (error) {
    productionLogger.error(LOG_CATEGORIES.API, 'Health check error', {
      error: error.message,
      stack: error.stack
    });
    
    return NextResponse.json({
      status: 'error',
      message: 'Health check failed',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Helper function to format uptime in human-readable format
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}