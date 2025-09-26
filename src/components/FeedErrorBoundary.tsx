'use client';

import React from 'react';
import ErrorBoundary from './ErrorBoundary';
import { RefreshCw, AlertCircle, Home } from 'lucide-react';

interface FeedErrorBoundaryProps {
  children: React.ReactNode;
}

const FeedErrorBoundary: React.FC<FeedErrorBoundaryProps> = ({ children }) => {
  return (
    <ErrorBoundary
      maxRetries={3}
      onError={(error, errorInfo, errorId) => {
        console.error(`Feed Error [${errorId}]:`, error);
        
        // Log feed-specific errors
        if (process.env.NODE_ENV === 'production') {
          // Could send to monitoring service with feed context
          console.log('Feed error logged for monitoring');
        }
      }}
      fallback={({ error, resetError, errorId }) => (
        <div className="max-w-2xl mx-auto p-6">
          <div className="bg-white border border-red-200 rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            
            <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
              Error al cargar el feed
            </h3>
            
            <p className="text-gray-600 text-center mb-4">
              No pudimos cargar los posts en este momento. Esto puede deberse a un problema temporal de conexión.
            </p>

            {errorId && (
              <p className="text-xs text-gray-500 text-center mb-4">
                Código de error: {errorId}
              </p>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={resetError}
                className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <RefreshCw className="w-4 h-4" />
                Recargar feed
              </button>
              
              <button
                onClick={() => window.location.href = '/'}
                className="flex items-center justify-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                <Home className="w-4 h-4" />
                Ir al inicio
              </button>
            </div>

            {process.env.NODE_ENV === 'development' && error && (
              <details className="mt-4 p-3 bg-gray-100 rounded text-sm">
                <summary className="cursor-pointer font-medium text-gray-700 mb-2">
                  Detalles técnicos (desarrollo)
                </summary>
                <pre className="whitespace-pre-wrap text-red-600 text-xs overflow-auto max-h-32">
                  {error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
};

export default FeedErrorBoundary;