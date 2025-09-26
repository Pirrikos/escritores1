'use client';

import React from 'react';
import ErrorBoundary from './ErrorBoundary';
import { PenTool, AlertTriangle, Save } from 'lucide-react';

interface WriteErrorBoundaryProps {
  children: React.ReactNode;
  onSaveDraft?: () => void;
}

const WriteErrorBoundary: React.FC<WriteErrorBoundaryProps> = ({ children, onSaveDraft }) => {
  return (
    <ErrorBoundary
      maxRetries={2}
      onError={(error, errorInfo, errorId) => {
        console.error(`Write Error [${errorId}]:`, error);
        
        // Try to save draft before showing error
        if (onSaveDraft) {
          try {
            onSaveDraft();
          } catch (saveError) {
            console.error('Failed to save draft on error:', saveError);
          }
        }
      }}
      fallback={({ error, resetError, errorId }) => (
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-white border border-orange-200 rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-orange-100 rounded-full mb-4">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
            
            <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
              Error en el editor
            </h3>
            
            <p className="text-gray-600 text-center mb-4">
              Ha ocurrido un problema con el editor de texto. Tu trabajo puede haberse guardado automáticamente.
            </p>

            {errorId && (
              <p className="text-xs text-gray-500 text-center mb-4">
                Referencia: {errorId}
              </p>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
              <p className="text-sm text-blue-800">
                💡 <strong>Consejo:</strong> Si estabas escribiendo algo importante, revisa si se guardó en borradores antes de continuar.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={resetError}
                className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <PenTool className="w-4 h-4" />
                Reintentar editor
              </button>
              
              {onSaveDraft && (
                <button
                  onClick={() => {
                    try {
                      onSaveDraft();
                      resetError();
                    } catch (err) {
                      console.error('Save draft failed:', err);
                    }
                  }}
                  className="flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <Save className="w-4 h-4" />
                  Guardar y reintentar
                </button>
              )}
              
              <button
                onClick={() => window.location.href = '/'}
                className="flex items-center justify-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Volver al inicio
              </button>
            </div>

            {process.env.NODE_ENV === 'development' && error && (
              <details className="mt-4 p-3 bg-gray-100 rounded text-sm">
                <summary className="cursor-pointer font-medium text-gray-700 mb-2">
                  Información técnica
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

export default WriteErrorBoundary;