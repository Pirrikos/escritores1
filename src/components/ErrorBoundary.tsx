'use client';

import React from 'react';
import { logSuspiciousActivity, SecuritySeverity } from '@/lib/securityLogger';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
  errorId?: string;
  retryCount: number;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error?: Error; resetError: () => void; errorId?: string }>;
  maxRetries?: number;
  onError?: (error: Error, errorInfo: React.ErrorInfo, errorId: string) => void;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeouts: NodeJS.Timeout[] = [];

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { 
      hasError: false, 
      retryCount: 0 
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return {
      hasError: true,
      error,
      errorId,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const errorId = this.state.errorId || `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.error(`Error Boundary caught an error [${errorId}]:`, error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
      errorId,
    });

    // Log security event for suspicious errors
    if (this.isSecurityRelatedError(error)) {
      logSuspiciousActivity(
        'client_error',
        `Potential security-related error: ${error.message}`,
        SecuritySeverity.MEDIUM,
        {
          errorId,
          errorMessage: error.message,
          errorStack: error.stack,
          componentStack: errorInfo.componentStack,
          retryCount: this.state.retryCount
        }
      );
    }

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo, errorId);
    }

    // Auto-retry for certain types of errors
    if (this.shouldAutoRetry(error) && this.state.retryCount < (this.props.maxRetries || 3)) {
      const retryDelay = Math.min(1000 * Math.pow(2, this.state.retryCount), 10000); // Exponential backoff
      const timeout = setTimeout(() => {
        this.setState(prevState => ({
          hasError: false,
          error: undefined,
          errorInfo: undefined,
          retryCount: prevState.retryCount + 1
        }));
      }, retryDelay);
      
      this.retryTimeouts.push(timeout);
    }
  }

  componentWillUnmount() {
    // Clear any pending retry timeouts
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
  }

  private isSecurityRelatedError(error: Error): boolean {
    const securityKeywords = [
      'script', 'eval', 'function', 'constructor',
      'prototype', 'xss', 'injection', 'unauthorized',
      'forbidden', 'csrf', 'cors'
    ];
    
    const errorMessage = error.message.toLowerCase();
    return securityKeywords.some(keyword => errorMessage.includes(keyword));
  }

  private shouldAutoRetry(error: Error): boolean {
    // Auto-retry for network errors, timeout errors, etc.
    const retryableErrors = [
      'NetworkError',
      'TimeoutError',
      'AbortError',
      'fetch',
      'network',
      'timeout',
      'connection'
    ];
    
    const errorMessage = error.message.toLowerCase();
    const errorName = error.name.toLowerCase();
    
    return retryableErrors.some(keyword => 
      errorMessage.includes(keyword) || errorName.includes(keyword)
    );
  }

  resetError = () => {
    // Clear any pending retry timeouts
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
    this.retryTimeouts = [];
    
    this.setState({ 
      hasError: false, 
      error: undefined, 
      errorInfo: undefined,
      errorId: undefined,
      retryCount: 0 
    });
  };

  render() {
    if (this.state.hasError) {
      // Si hay un componente fallback personalizado, úsalo
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return (
          <FallbackComponent 
            error={this.state.error} 
            resetError={this.resetError}
            errorId={this.state.errorId}
          />
        );
      }

      // Fallback UI por defecto mejorado
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            
            <h2 className="text-xl font-semibold text-gray-900 text-center mb-2">
              ¡Oops! Algo salió mal
            </h2>
            
            <p className="text-gray-600 text-center mb-4">
              Ha ocurrido un error inesperado. Por favor, intenta recargar la página.
            </p>

            {this.state.errorId && (
              <p className="text-xs text-gray-500 text-center mb-4">
                ID del error: {this.state.errorId}
              </p>
            )}

            {this.state.retryCount > 0 && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-sm text-yellow-800">
                  Intentos de recuperación: {this.state.retryCount}/{this.props.maxRetries || 3}
                </p>
              </div>
            )}

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-4 p-3 bg-gray-100 rounded text-sm">
                <summary className="cursor-pointer font-medium text-gray-700 mb-2">
                  Detalles del error (solo en desarrollo)
                </summary>
                <pre className="whitespace-pre-wrap text-red-600 text-xs overflow-auto max-h-32">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div className="flex space-x-3">
              <button
                onClick={this.resetError}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Intentar de nuevo
              </button>
              
              <button
                onClick={() => window.location.reload()}
                className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Recargar página
              </button>
            </div>

            <button
              onClick={() => window.history.back()}
              className="w-full mt-3 bg-transparent text-gray-600 px-4 py-2 rounded-md hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
              Volver atrás
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

// Hook mejorado para usar en componentes funcionales
export const useErrorHandler = () => {
  const [error, setError] = React.useState<Error | null>(null);
  const [retryCount, setRetryCount] = React.useState(0);

  const resetError = React.useCallback(() => {
    setError(null);
    setRetryCount(0);
  }, []);

  const handleError = React.useCallback((error: Error, shouldRetry: boolean = false) => {
    console.error('Error handled by useErrorHandler:', error);
    
    // Log security-related errors
    if (isSecurityRelatedError(error)) {
      logSuspiciousActivity(
        'client_error',
        `Potential security-related error in component: ${error.message}`,
        SecuritySeverity.MEDIUM,
        {
          errorMessage: error.message,
          errorStack: error.stack,
          retryCount
        }
      );
    }

    if (shouldRetry && retryCount < 3) {
      setRetryCount(prev => prev + 1);
      // Auto-retry after delay
      setTimeout(() => {
        setError(null);
      }, Math.min(1000 * Math.pow(2, retryCount), 5000));
    } else {
      setError(error);
    }
  }, [retryCount]);

  // Si hay error, lanzarlo para que lo capture el Error Boundary
  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return { handleError, resetError, retryCount };
};

// Utility function for security error detection
const isSecurityRelatedError = (error: Error): boolean => {
  const securityKeywords = [
    'script', 'eval', 'function', 'constructor',
    'prototype', 'xss', 'injection', 'unauthorized',
    'forbidden', 'csrf', 'cors'
  ];
  
  const errorMessage = error.message.toLowerCase();
  return securityKeywords.some(keyword => errorMessage.includes(keyword));
};

// HOC para envolver componentes con Error Boundary
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
};

// Error Boundary específico para rutas API
export const ApiErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ErrorBoundary
    maxRetries={2}
    onError={(error, errorInfo, errorId) => {
      // Log API errors specifically
      console.error(`API Error [${errorId}]:`, error);
      
      // Could send to external monitoring service
      if (process.env.NODE_ENV === 'production') {
        // sendToMonitoringService({ error, errorInfo, errorId, type: 'api' });
      }
    }}
    fallback={({ resetError, errorId }) => (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md">
        <h3 className="text-red-800 font-medium mb-2">Error de API</h3>
        <p className="text-red-600 text-sm mb-3">
          No se pudo completar la operación. Por favor, intenta de nuevo.
        </p>
        {errorId && (
          <p className="text-xs text-red-500 mb-3">ID: {errorId}</p>
        )}
        <button
          onClick={resetError}
          className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
        >
          Reintentar
        </button>
      </div>
    )}
  >
    {children}
  </ErrorBoundary>
);