/**
 * Sistema de reintentos para operaciones críticas
 * Implementa exponential backoff y diferentes estrategias de reintento
 */

export class RetryError extends Error {
  constructor(message, attempts, lastError) {
    super(message);
    this.name = 'RetryError';
    this.attempts = attempts;
    this.lastError = lastError;
  }
}

/**
 * Configuración por defecto para reintentos
 */
const DEFAULT_RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 segundo
  maxDelay: 30000, // 30 segundos
  backoffFactor: 2,
  jitter: true, // Añade variación aleatoria para evitar thundering herd
  retryCondition: (error) => {
    // Por defecto, reintentar errores de red y temporales
    const retryableErrors = [
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'NetworkError',
      'TimeoutError'
    ];
    
    return retryableErrors.some(errorType => 
      error.message?.includes(errorType) || 
      error.code?.includes(errorType) ||
      error.name?.includes(errorType)
    );
  }
};

/**
 * Ejecuta una función con reintentos automáticos
 * @param {Function} fn - Función a ejecutar
 * @param {Object} config - Configuración de reintentos
 * @returns {Promise} - Resultado de la función o error después de todos los intentos
 */
export async function withRetry(fn, config = {}) {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError;
  
  for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
    try {
      const result = await fn(attempt);
      return result;
    } catch (error) {
      lastError = error;
      
      // Si es el último intento o el error no es reintentable, lanzar error
      if (attempt === finalConfig.maxAttempts || !finalConfig.retryCondition(error)) {
        throw new RetryError(
          `Operation failed after ${attempt} attempts: ${error.message}`,
          attempt,
          error
        );
      }
      
      // Calcular delay con exponential backoff
      const baseDelay = finalConfig.baseDelay * Math.pow(finalConfig.backoffFactor, attempt - 1);
      let delay = Math.min(baseDelay, finalConfig.maxDelay);
      
      // Añadir jitter si está habilitado
      if (finalConfig.jitter) {
        delay = delay * (0.5 + Math.random() * 0.5); // Entre 50% y 100% del delay
      }
      
      console.warn(`Attempt ${attempt} failed, retrying in ${Math.round(delay)}ms:`, error.message);
      
      // Esperar antes del siguiente intento
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Wrapper específico para operaciones de base de datos
 */
export async function withDatabaseRetry(dbOperation, config = {}) {
  const dbConfig = {
    ...DEFAULT_RETRY_CONFIG,
    maxAttempts: 3,
    retryCondition: (error) => {
      // Errores específicos de base de datos que son reintenables
      const retryableCodes = [
        '08000', // connection_exception
        '08003', // connection_does_not_exist
        '08006', // connection_failure
        '57P01', // admin_shutdown
        '57P02', // crash_shutdown
        '57P03', // cannot_connect_now
        '53300', // too_many_connections
        'PGRST301' // Supabase connection error
      ];
      
      return retryableCodes.some(code => 
        error.code === code || 
        error.message?.includes(code) ||
        error.message?.includes('connection') ||
        error.message?.includes('timeout')
      );
    },
    ...config
  };
  
  return withRetry(dbOperation, dbConfig);
}

/**
 * Wrapper específico para operaciones de API externa
 */
export async function withApiRetry(apiOperation, config = {}) {
  const apiConfig = {
    ...DEFAULT_RETRY_CONFIG,
    maxAttempts: 4,
    baseDelay: 500,
    retryCondition: (error) => {
      // Reintentar en errores de red y códigos de estado específicos
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        return true; // Error de red
      }
      
      if (error.status) {
        // Reintentar en errores 5xx y algunos 4xx específicos
        return error.status >= 500 || 
               error.status === 408 || // Request Timeout
               error.status === 429;   // Too Many Requests
      }
      
      return DEFAULT_RETRY_CONFIG.retryCondition(error);
    },
    ...config
  };
  
  return withRetry(apiOperation, apiConfig);
}

/**
 * Wrapper específico para operaciones de autenticación
 */
export async function withAuthRetry(authOperation, config = {}) {
  const authConfig = {
    ...DEFAULT_RETRY_CONFIG,
    maxAttempts: 2, // Menos intentos para auth
    baseDelay: 2000,
    retryCondition: (error) => {
      // Solo reintentar errores de red, no errores de credenciales
      return error.message?.includes('network') ||
             error.message?.includes('timeout') ||
             error.message?.includes('connection') ||
             (error.status && error.status >= 500);
    },
    ...config
  };
  
  return withRetry(authOperation, authConfig);
}

/**
 * Utilidad para crear un circuit breaker simple
 */
export class CircuitBreaker {
  constructor(config = {}) {
    this.failureThreshold = config.failureThreshold || 5;
    this.resetTimeout = config.resetTimeout || 60000; // 1 minuto
    this.monitoringPeriod = config.monitoringPeriod || 10000; // 10 segundos
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
  }
  
  async execute(operation) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  onSuccess() {
    this.failureCount = 0;
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= 3) { // Requiere 3 éxitos para cerrar
        this.state = 'CLOSED';
      }
    }
  }
  
  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }
  
  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime
    };
  }
}

// Instancia global del circuit breaker para la base de datos
export const dbCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 30000, // 30 segundos
  monitoringPeriod: 5000 // 5 segundos
});

/**
 * Wrapper que combina retry y circuit breaker para operaciones críticas
 */
export async function withRetryAndCircuitBreaker(operation, retryConfig = {}, circuitBreaker = dbCircuitBreaker) {
  return circuitBreaker.execute(async () => {
    return withRetry(operation, retryConfig);
  });
}