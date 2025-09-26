/**
 * Circuit Breaker and Timeout Management System
 * Prevents cascading failures and manages external service dependencies
 */

import { securityLogger } from './securityLogger.js';
import { monitoring } from './monitoring.js';

// Circuit breaker states
const CIRCUIT_STATES = {
  CLOSED: 'CLOSED',     // Normal operation
  OPEN: 'OPEN',         // Circuit is open, requests fail fast
  HALF_OPEN: 'HALF_OPEN' // Testing if service is back
};

// Default configuration
const DEFAULT_CONFIG = {
  failureThreshold: 5,        // Number of failures before opening circuit
  recoveryTimeout: 60000,     // Time to wait before trying again (1 minute)
  monitoringPeriod: 10000,    // Time window for failure counting (10 seconds)
  requestTimeout: 30000,      // Default request timeout (30 seconds)
  maxRetries: 3,              // Maximum retry attempts
  retryDelay: 1000           // Base delay between retries (1 second)
};

/**
 * Circuit Breaker Class
 */
class CircuitBreaker {
  constructor(name, config = {}) {
    this.name = name;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = CIRCUIT_STATES.CLOSED;
    this.failures = [];
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
    this.successCount = 0;
    this.totalRequests = 0;
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute(fn, ...args) {
    this.totalRequests++;
    
    // Check if circuit is open
    if (this.state === CIRCUIT_STATES.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        const error = new Error(`Circuit breaker is OPEN for ${this.name}`);
        error.code = 'CIRCUIT_BREAKER_OPEN';
        throw error;
      } else {
        // Try to transition to half-open
        this.state = CIRCUIT_STATES.HALF_OPEN;
        securityLogger.logSecurityEvent('CIRCUIT_BREAKER_HALF_OPEN', 'INFO', {
          service: this.name,
          previousFailures: this.failures.length
        });
      }
    }

    try {
      // Execute the function with timeout
      const result = await this.executeWithTimeout(fn, ...args);
      
      // Success - handle state transitions
      this.onSuccess();
      return result;
      
    } catch (error) {
      // Failure - handle state transitions
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Execute function with timeout protection
   */
  async executeWithTimeout(fn, ...args) {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const error = new Error(`Request timeout after ${this.config.requestTimeout}ms for ${this.name}`);
        error.code = 'REQUEST_TIMEOUT';
        reject(error);
      }, this.config.requestTimeout);

      try {
        const result = await fn(...args);
        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Handle successful execution
   */
  onSuccess() {
    this.successCount++;
    
    if (this.state === CIRCUIT_STATES.HALF_OPEN) {
      // Transition back to closed
      this.state = CIRCUIT_STATES.CLOSED;
      this.failures = [];
      this.lastFailureTime = null;
      this.nextAttemptTime = null;
      
      securityLogger.logSecurityEvent('CIRCUIT_BREAKER_CLOSED', 'INFO', {
        service: this.name,
        successCount: this.successCount
      });
    }
    
    // Clean old failures outside monitoring period
    this.cleanOldFailures();
  }

  /**
   * Handle failed execution
   */
  onFailure(error) {
    const now = Date.now();
    this.failures.push({
      timestamp: now,
      error: error.message,
      code: error.code
    });
    this.lastFailureTime = now;

    // Clean old failures
    this.cleanOldFailures();

    // Check if we should open the circuit
    if (this.failures.length >= this.config.failureThreshold) {
      this.state = CIRCUIT_STATES.OPEN;
      this.nextAttemptTime = now + this.config.recoveryTimeout;
      
      securityLogger.logSecurityEvent('CIRCUIT_BREAKER_OPEN', 'WARNING', {
        service: this.name,
        failureCount: this.failures.length,
        lastError: error.message,
        recoveryTime: new Date(this.nextAttemptTime).toISOString()
      });
      
      // Log critical error for monitoring
      monitoring.logCriticalError('CIRCUIT_BREAKER_OPEN', `Circuit breaker opened for ${this.name}`, {
        service: this.name,
        failures: this.failures,
        config: this.config
      });
    }
  }

  /**
   * Clean failures outside monitoring period
   */
  cleanOldFailures() {
    const cutoff = Date.now() - this.config.monitoringPeriod;
    this.failures = this.failures.filter(failure => failure.timestamp > cutoff);
  }

  /**
   * Get circuit breaker status
   */
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failures.length,
      successCount: this.successCount,
      totalRequests: this.totalRequests,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
      config: this.config
    };
  }

  /**
   * Reset circuit breaker
   */
  reset() {
    this.state = CIRCUIT_STATES.CLOSED;
    this.failures = [];
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
    this.successCount = 0;
    this.totalRequests = 0;
    
    securityLogger.logSecurityEvent('CIRCUIT_BREAKER_RESET', 'INFO', {
      service: this.name
    });
  }
}

/**
 * Circuit Breaker Manager
 */
class CircuitBreakerManager {
  constructor() {
    this.breakers = new Map();
  }

  /**
   * Get or create a circuit breaker
   */
  getBreaker(name, config = {}) {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker(name, config));
    }
    return this.breakers.get(name);
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute(serviceName, fn, config = {}) {
    const breaker = this.getBreaker(serviceName, config);
    return breaker.execute(fn);
  }

  /**
   * Execute with retry logic
   */
  async executeWithRetry(serviceName, fn, config = {}) {
    const breaker = this.getBreaker(serviceName, config);
    let lastError;
    
    for (let attempt = 0; attempt <= breaker.config.maxRetries; attempt++) {
      try {
        return await breaker.execute(fn);
      } catch (error) {
        lastError = error;
        
        // Don't retry if circuit is open
        if (error.code === 'CIRCUIT_BREAKER_OPEN') {
          throw error;
        }
        
        // Don't retry on last attempt
        if (attempt === breaker.config.maxRetries) {
          break;
        }
        
        // Wait before retry with exponential backoff
        const delay = breaker.config.retryDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        securityLogger.logSecurityEvent('RETRY_ATTEMPT', 'INFO', {
          service: serviceName,
          attempt: attempt + 1,
          maxRetries: breaker.config.maxRetries,
          delay,
          error: error.message
        });
      }
    }
    
    throw lastError;
  }

  /**
   * Get status of all circuit breakers
   */
  getAllStatus() {
    const status = {};
    for (const [name, breaker] of this.breakers) {
      status[name] = breaker.getStatus();
    }
    return status;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll() {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }

  /**
   * Reset specific circuit breaker
   */
  reset(serviceName) {
    const breaker = this.breakers.get(serviceName);
    if (breaker) {
      breaker.reset();
    }
  }
}

// Global circuit breaker manager instance
const circuitBreakerManager = new CircuitBreakerManager();

/**
 * Utility functions for common use cases
 */

/**
 * Wrap fetch with circuit breaker and timeout
 */
export async function safeFetch(url, options = {}, config = {}) {
  const serviceName = config.serviceName || new URL(url).hostname;
  
  return circuitBreakerManager.executeWithRetry(serviceName, async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout || 30000);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        const timeoutError = new Error(`Request timeout for ${url}`);
        timeoutError.code = 'REQUEST_TIMEOUT';
        throw timeoutError;
      }
      throw error;
    }
  }, config);
}

/**
 * Wrap Supabase operations with circuit breaker
 */
export async function safeSupabaseOperation(operationName, operation, config = {}) {
  return circuitBreakerManager.executeWithRetry(`supabase_${operationName}`, operation, {
    failureThreshold: 3,
    recoveryTimeout: 30000,
    requestTimeout: 15000,
    ...config
  });
}

/**
 * Create timeout middleware for Express/Next.js
 */
export function createTimeoutMiddleware(timeoutMs = 30000) {
  return (req, res, next) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        securityLogger.logSecurityEvent('REQUEST_TIMEOUT', 'WARNING', {
          url: req.url,
          method: req.method,
          timeout: timeoutMs,
          userAgent: req.headers['user-agent']
        });
        
        res.status(408).json({
          error: 'Request timeout',
          code: 'REQUEST_TIMEOUT',
          timeout: timeoutMs
        });
      }
    }, timeoutMs);
    
    res.on('finish', () => clearTimeout(timeout));
    res.on('close', () => clearTimeout(timeout));
    
    next();
  };
}

export {
  CircuitBreaker,
  CircuitBreakerManager,
  circuitBreakerManager,
  CIRCUIT_STATES,
  DEFAULT_CONFIG
};

export default circuitBreakerManager;