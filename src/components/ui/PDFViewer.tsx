'use client';

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

// Configurar el worker de PDF.js usando el método recomendado
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// Importar estilos
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

interface PDFViewerProps {
  fileUrl: string;
  fileName?: string;
  onClose: () => void;
}

// Memoizar el componente para evitar re-renders innecesarios
const PDFViewer = React.memo(function PDFViewer({ fileUrl, fileName, onClose }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState<number>(1.0);
  
  // Ref para controlar el AbortController
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Ref para evitar múltiples peticiones con la misma URL
  const lastUrlRef = useRef<string>('');
  
  // Ref para el flag de carga en progreso
  const loadingInProgressRef = useRef<boolean>(false);
  
  // Ref para almacenar el ArrayBuffer del PDF
  const pdfDataRef = useRef<ArrayBuffer | null>(null);

  // Memoizar el objeto file para evitar re-renders innecesarios
  const fileObject = useMemo(() => {
    return pdfDataRef.current ? { data: pdfDataRef.current } : null;
  }, [pdfDataRef.current]);

  // Memoize the options object to prevent unnecessary reloads
  const documentOptions = useMemo(() => ({
    withCredentials: false,
  }), []);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
    setError(null);
  }, [fileUrl]);

  const onDocumentLoadError = useCallback((error: Error) => {
    setError(`Error al cargar el PDF: ${error.message || error}`);
    setLoading(false);
  }, [fileUrl]);

  // Cargar PDF como ArrayBuffer en lugar de usar URL directa
  useEffect(() => {
    // Evitar peticiones duplicadas para la misma URL
    if (lastUrlRef.current === fileUrl && pdfDataRef.current) {
      return;
    }
    
    // Evitar ejecución en paralelo
    if (loadingInProgressRef.current) {
      return;
    }
    
    // Cancelar petición anterior si existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Crear nuevo AbortController para esta petición
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    lastUrlRef.current = fileUrl;
    loadingInProgressRef.current = true;
    
    if (fileUrl) {
      fetch(fileUrl, {
        method: 'GET',
        credentials: 'omit', // Sin credenciales para URLs de Supabase
        signal: abortController.signal
      })
        .then(response => {
          if (!abortController.signal.aborted) {
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.arrayBuffer();
          }
          return null;
        })
        .then(arrayBuffer => {
          if (!abortController.signal.aborted && arrayBuffer) {
            pdfDataRef.current = arrayBuffer;
            setLoading(false);
            setError(null);
          }
        })
        .catch(error => {
          if (error.name !== 'AbortError') {
            setError(`Error al descargar el PDF: ${error.message}`);
            setLoading(false);
          }
        })
        .finally(() => {
          loadingInProgressRef.current = false;
        });
    }
    
    // Cleanup function para cancelar peticiones pendientes
    return () => {
      if (abortController && !abortController.signal.aborted) {
        abortController.abort();
      }
      loadingInProgressRef.current = false;
    };
  }, [fileUrl]);

  const goToPrevPage = useCallback(() => {
    setPageNumber(prev => Math.max(1, prev - 1));
  }, []);

  const goToNextPage = useCallback(() => {
    setPageNumber(prev => Math.min(numPages, prev + 1));
  }, [numPages]);

  const zoomIn = useCallback(() => {
    setScale(prev => Math.min(3.0, prev + 0.2));
  }, []);

  const zoomOut = useCallback(() => {
    setScale(prev => Math.max(0.5, prev - 0.2));
  }, []);

  const resetZoom = useCallback(() => {
    setScale(1.0);
  }, []);

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-red-600">Error al cargar PDF</h3>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          <p className="text-gray-700 mb-4">{error}</p>
          <div className="flex justify-end space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl max-h-[90vh] w-full mx-4 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-semibold truncate">
            {fileName || 'Documento PDF'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl font-bold"
          >
            ✕
          </button>
        </div>

        {/* Controls */}
        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
          <div className="flex items-center space-x-2">
            <button
              onClick={goToPrevPage}
              disabled={pageNumber <= 1}
              className="px-3 py-1 bg-blue-500 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              ← Anterior
            </button>
            <span className="text-sm">
              Página {pageNumber} de {numPages}
            </span>
            <button
              onClick={goToNextPage}
              disabled={pageNumber >= numPages}
              className="px-3 py-1 bg-blue-500 text-white rounded disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Siguiente →
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={zoomOut}
              className="px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              −
            </button>
            <span className="text-sm min-w-[60px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={zoomIn}
              className="px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              +
            </button>
            <button
              onClick={resetZoom}
              className="px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs"
            >
              Reset
            </button>
          </div>
        </div>

        {/* PDF Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading && (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2">Cargando PDF...</span>
            </div>
          )}

          {!loading && fileObject && (
             <div className="flex justify-center">
               <Document
                 file={fileObject}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={
                  <div className="flex items-center justify-center p-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="ml-2">Cargando PDF...</span>
                  </div>
                }
                error={
                  <div className="text-red-600 p-4 text-center">
                    <p>Error al cargar el PDF</p>
                    <p className="text-sm mt-2">Verifica que el archivo sea válido</p>
                  </div>
                }
                options={documentOptions}
              >
                <Page
                  pageNumber={pageNumber}
                  scale={scale}
                  loading={
                    <div className="flex items-center justify-center p-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      <span className="ml-2">Cargando página...</span>
                    </div>
                  }
                  error={
                    <div className="text-red-600 p-4 text-center">
                      <p>Error al cargar la página</p>
                    </div>
                  }
                />
              </Document>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default PDFViewer;