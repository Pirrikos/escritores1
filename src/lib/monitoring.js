/**
 * Sistema de Monitoreo y Alertas para Errores Críticos
 * Proporciona funcionalidades para detectar, registrar y alertar sobre errores críticos
 */

// Configuración de niveles de severidad
export const SEVERITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

// Configuración de tipos de errores críticos
export const CRITICAL_ERROR_TYPES = {
  DATABASE_CONNECTION: 'database_connection',
  AUTHENTICATION_FAILURE: 'authentication_failure',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  SECURITY_BREACH: 'security_breach',
  SERVER_OVERLOAD: 'server_overload',
  DATA_CORRUPTION: 'data_corruption',
  EXTERNAL_SERVICE_FAILURE: 'external_service_failure'
};

// Configuración de alertas
const ALERT_CONFIG = {
  maxErrorsPerMinute: 10,
  criticalErrorThreshold: 5,
  alertCooldownMs: 5 * 60 * 1000, // 5 minutos
  retentionDays: 7
};

// Cache en memoria para errores recientes
let errorCache = new Map();
let alertHistory = new Map();

/**
 * Registra un error crítico en el sistema de monitoreo
 */
export async function logCriticalError(errorType, details, severity = SEVERITY_LEVELS.HIGH) {
  const timestamp = new Date().toISOString();
  const errorId = generateErrorId();
  
  const errorEntry = {
    id: errorId,
    type: errorType,
    severity,
    details,
    timestamp,
    userAgent: details.userAgent || 'unknown',
    ip: details.ip || 'unknown',
    userId: details.userId || null,
    url: details.url || 'unknown',
    stackTrace: details.stackTrace || null
  };

  try {
    // Registrar en consola con formato estructurado
    console.error('🚨 CRITICAL ERROR DETECTED:', {
      ...errorEntry,
      formattedTime: new Date(timestamp).toLocaleString('es-ES')
    });

    // Almacenar en cache para análisis de patrones
    addToErrorCache(errorEntry);

    // Verificar si necesitamos enviar alertas
    await checkAndSendAlerts(errorType, severity);

    // Intentar persistir en base de datos si está disponible
    await persistErrorToDatabase(errorEntry);

    return errorId;
  } catch (error) {
    console.error('Error al registrar error crítico:', error);
    return null;
  }
}

/**
 * Detecta patrones de errores y genera alertas automáticas
 */
async function checkAndSendAlerts(errorType, severity) {
  const now = Date.now();
  const oneMinuteAgo = now - 60 * 1000;
  
  // Contar errores recientes
  const recentErrors = Array.from(errorCache.values())
    .filter(error => new Date(error.timestamp).getTime() > oneMinuteAgo);
  
  const errorsByType = recentErrors.filter(error => error.type === errorType);
  const criticalErrors = recentErrors.filter(error => error.severity === SEVERITY_LEVELS.CRITICAL);

  // Verificar si necesitamos alertar
  const shouldAlert = 
    recentErrors.length > ALERT_CONFIG.maxErrorsPerMinute ||
    criticalErrors.length > ALERT_CONFIG.criticalErrorThreshold ||
    severity === SEVERITY_LEVELS.CRITICAL;

  if (shouldAlert) {
    const alertKey = `${errorType}_${severity}`;
    const lastAlert = alertHistory.get(alertKey);
    
    // Verificar cooldown de alertas
    if (!lastAlert || (now - lastAlert) > ALERT_CONFIG.alertCooldownMs) {
      await sendAlert({
        type: errorType,
        severity,
        recentErrorCount: recentErrors.length,
        criticalErrorCount: criticalErrors.length,
        timestamp: new Date().toISOString()
      });
      
      alertHistory.set(alertKey, now);
    }
  }
}

/**
 * Envía alertas a los canales configurados
 */
async function sendAlert(alertData) {
  const alertMessage = formatAlertMessage(alertData);
  
  try {
    // Log de alerta en consola
    console.warn('🔔 ALERT TRIGGERED:', alertMessage);

    // Aquí se pueden agregar integraciones con servicios externos:
    // - Slack/Discord webhooks
    // - Email notifications
    // - SMS alerts
    // - Monitoring services (DataDog, New Relic, etc.)
    
    // Ejemplo de webhook (descomentado cuando se configure)
    // await sendWebhookAlert(alertMessage);
    
    // Ejemplo de email (descomentado cuando se configure)
    // await sendEmailAlert(alertMessage);
    
  } catch (error) {
    console.error('Error enviando alerta:', error);
  }
}

/**
 * Formatea el mensaje de alerta
 */
function formatAlertMessage(alertData) {
  const { type, severity, recentErrorCount, criticalErrorCount, timestamp } = alertData;
  
  return {
    title: `🚨 Alerta de Sistema - ${severity.toUpperCase()}`,
    message: `Se ha detectado un patrón de errores críticos`,
    details: {
      errorType: type,
      severity,
      recentErrors: recentErrorCount,
      criticalErrors: criticalErrorCount,
      timestamp: new Date(timestamp).toLocaleString('es-ES')
    },
    actions: [
      'Revisar logs del sistema',
      'Verificar estado de servicios',
      'Contactar al equipo de desarrollo'
    ]
  };
}

/**
 * Agrega error al cache en memoria
 */
function addToErrorCache(errorEntry) {
  errorCache.set(errorEntry.id, errorEntry);
  
  // Limpiar errores antiguos (mantener solo últimas 24 horas)
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  for (const [id, error] of errorCache.entries()) {
    if (new Date(error.timestamp).getTime() < oneDayAgo) {
      errorCache.delete(id);
    }
  }
}

/**
 * Intenta persistir el error en la base de datos
 */
async function persistErrorToDatabase(errorEntry) {
  try {
    // Aquí se implementaría la lógica para guardar en Supabase
    // Por ahora solo registramos en localStorage para desarrollo
    if (typeof window !== 'undefined') {
      const existingErrors = JSON.parse(localStorage.getItem('criticalErrors') || '[]');
      existingErrors.push(errorEntry);
      
      // Mantener solo los últimos 100 errores
      if (existingErrors.length > 100) {
        existingErrors.splice(0, existingErrors.length - 100);
      }
      
      localStorage.setItem('criticalErrors', JSON.stringify(existingErrors));
    }
  } catch (error) {
    console.error('Error persistiendo en base de datos:', error);
  }
}

/**
 * Genera un ID único para el error
 */
function generateErrorId() {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Obtiene estadísticas de errores
 */
export function getErrorStatistics() {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  
  const allErrors = Array.from(errorCache.values());
  const lastHourErrors = allErrors.filter(error => 
    new Date(error.timestamp).getTime() > oneHourAgo
  );
  const lastDayErrors = allErrors.filter(error => 
    new Date(error.timestamp).getTime() > oneDayAgo
  );

  const errorsByType = {};
  const errorsBySeverity = {};
  
  lastDayErrors.forEach(error => {
    errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
    errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1;
  });

  return {
    total: allErrors.length,
    lastHour: lastHourErrors.length,
    lastDay: lastDayErrors.length,
    byType: errorsByType,
    bySeverity: errorsBySeverity,
    recentErrors: lastHourErrors.slice(-10) // Últimos 10 errores
  };
}

/**
 * Limpia el cache de errores
 */
export function clearErrorCache() {
  errorCache.clear();
  alertHistory.clear();
  
  if (typeof window !== 'undefined') {
    localStorage.removeItem('criticalErrors');
  }
}

/**
 * Middleware para capturar errores automáticamente
 */
export function createErrorMonitoringMiddleware() {
  return async (error, context = {}) => {
    let errorType = CRITICAL_ERROR_TYPES.SERVER_OVERLOAD;
    let severity = SEVERITY_LEVELS.MEDIUM;

    // Clasificar el error automáticamente
    if (error.message?.includes('database') || error.code === 'ECONNREFUSED') {
      errorType = CRITICAL_ERROR_TYPES.DATABASE_CONNECTION;
      severity = SEVERITY_LEVELS.CRITICAL;
    } else if (error.message?.includes('auth') || error.status === 401) {
      errorType = CRITICAL_ERROR_TYPES.AUTHENTICATION_FAILURE;
      severity = SEVERITY_LEVELS.HIGH;
    } else if (error.status === 429) {
      errorType = CRITICAL_ERROR_TYPES.RATE_LIMIT_EXCEEDED;
      severity = SEVERITY_LEVELS.MEDIUM;
    } else if (error.message?.includes('security') || error.message?.includes('malicious')) {
      errorType = CRITICAL_ERROR_TYPES.SECURITY_BREACH;
      severity = SEVERITY_LEVELS.CRITICAL;
    }

    await logCriticalError(errorType, {
      message: error.message,
      stack: error.stack,
      code: error.code,
      status: error.status,
      ...context
    }, severity);
  };
}

/**
 * Hook para React que proporciona funciones de monitoreo
 */
export function useErrorMonitoring() {
  const logError = async (error, context = {}) => {
    return await logCriticalError(
      CRITICAL_ERROR_TYPES.SERVER_OVERLOAD,
      {
        message: error.message,
        stack: error.stack,
        url: window.location.href,
        userAgent: navigator.userAgent,
        ...context
      }
    );
  };

  const getStats = () => getErrorStatistics();
  
  return { logError, getStats, clearCache: clearErrorCache };
}