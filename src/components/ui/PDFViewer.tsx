'use client';

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

// Configurar el worker de PDF.js solo en cliente para evitar errores en SSR
// Se aplica en un efecto para que no se ejecute en el entorno del servidor
const configurePdfWorker = () => {
  try {
    // Evitar reconfiguraciones innecesarias
    if (pdfjs?.GlobalWorkerOptions?.workerSrc) return;
    const worker = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
    pdfjs.GlobalWorkerOptions.workerSrc = worker;
  } catch (e) {
    // Si falla la resolución por URL (entorno no compatible), no romper la app
    try { console.warn('[PDFViewer] No se pudo configurar workerSrc', e); } catch {}
  }
};

// Importar estilos
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

interface PDFViewerProps {
  fileUrl: string;
  fileName?: string;
  authorName?: string;
  onClose: () => void;
  initialPage?: number;
  onProgress?: (page: number, numPages: number) => void;
}

// Memoizar el componente para evitar re-renders innecesarios
const PDFViewer = React.memo(function PDFViewer({ fileUrl, fileName, authorName, onClose, initialPage, onProgress }: PDFViewerProps) {
  // Configurar worker de PDF.js en cliente
  useEffect(() => {
    if (typeof window !== 'undefined') {
      configurePdfWorker();
    }
  }, []);

  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState<number>(1.0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Estado para selección y creación de post
  const [selectedText, setSelectedText] = useState<string>('');
  const [selectionPos, setSelectionPos] = useState<{ top: number; left: number } | null>(null);
  const [showComposer, setShowComposer] = useState<boolean>(false);
  const [titleInput, setTitleInput] = useState<string>('');
  const [contentInput, setContentInput] = useState<string>('');
  const [postStatus, setPostStatus] = useState<'draft' | 'published'>('published');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitMessage, setSubmitMessage] = useState<string>('');
  
  // Ref para controlar el AbortController
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Ref para evitar múltiples peticiones con la misma URL
  const lastUrlRef = useRef<string>('');
  
  // Ref para el flag de carga en progreso
  const loadingInProgressRef = useRef<boolean>(false);
  
  // Estado para almacenar un Object URL del PDF (evita ArrayBuffer "detached")
  const [pdfObjectUrl, setPdfObjectUrl] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  // Memoizar el objeto file para mantener igualdad referencial cuando no cambia
  const fileObject = useMemo(() => (pdfObjectUrl ? pdfObjectUrl : null), [pdfObjectUrl]);

  // Memoize the options object to prevent unnecessary reloads
  const documentOptions = useMemo(() => ({
    withCredentials: false,
  }), []);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
    setError(null);
    // Set initial page when document loads if provided and valid
    if (typeof initialPage === 'number' && Number.isFinite(initialPage)) {
      const ip = Math.max(1, Math.min(numPages, initialPage));
      setPageNumber(ip);
      try { console.info('[PDFViewer] onLoadSuccess -> applying initialPage', { ip, numPages, fileUrl }); } catch {}
      // Reaplicar una vez tras un pequeño retraso para evitar carreras internas
      window.setTimeout(() => {
        setPageNumber(prev => Math.max(1, Math.min(numPages, ip)));
        try { console.info('[PDFViewer] delayed reapply -> pageNumber', { ip, numPages, fileUrl }); } catch {}
      }, 100);
    }
  }, [initialPage]);

  // Apply initial page if it arrives after the document loaded
  useEffect(() => {
    if (numPages > 0 && typeof initialPage === 'number' && Number.isFinite(initialPage)) {
      const ip = Math.max(1, Math.min(numPages, initialPage));
      setPageNumber(ip);
      try { console.info('[PDFViewer] effect apply -> initialPage after load', { ip, numPages, fileUrl }); } catch {}
    }
  }, [initialPage, numPages]);

  const onDocumentLoadError = useCallback((error: Error) => {
    setError(`Error al cargar el PDF: ${error.message || error}`);
    setLoading(false);
  }, []);

  // Cargar PDF y crear un Object URL en lugar de mantener ArrayBuffer
  useEffect(() => {
    // Evitar peticiones duplicadas para la misma URL
    if (lastUrlRef.current === fileUrl && pdfObjectUrl) {
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
            // Crear Blob y Object URL para evitar problemas de ArrayBuffer "detached"
            const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            // Revocar el Object URL anterior si existía
            if (objectUrlRef.current) {
              try { URL.revokeObjectURL(objectUrlRef.current); } catch {}
            }
            objectUrlRef.current = url;
            setPdfObjectUrl(url);
            // Mantener loading hasta que el documento PDF se procese (onLoadSuccess)
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
      // Revocar Object URL en desmontaje
      if (objectUrlRef.current) {
        try { URL.revokeObjectURL(objectUrlRef.current); } catch {}
        objectUrlRef.current = null;
      }
    };
  }, [fileUrl]);

  // Emit progress updates (debounced) when page changes
  const progressTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!onProgress || numPages <= 0) return;
    // Debounce to avoid spamming during rapid navigation
    if (progressTimerRef.current) {
      window.clearTimeout(progressTimerRef.current);
    }
    progressTimerRef.current = window.setTimeout(() => {
      try {
        onProgress(pageNumber, numPages);
      } catch (e) {
        // no-op
      }
    }, 400);
    return () => {
      if (progressTimerRef.current) {
        window.clearTimeout(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    };
  }, [pageNumber, numPages, onProgress]);

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

  // Detectar cambios de selección de texto dentro del visor
  useEffect(() => {
    function handleSelectionChange() {
      try {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) {
          setSelectedText('');
          setSelectionPos(null);
          return;
        }
        const text = sel.toString().trim();
        // Comprobar que la selección pertenece al contenedor del visor
        const anchorNode = sel.anchorNode as Node | null;
        const focusNode = sel.focusNode as Node | null;
        const container = containerRef.current;
        const inside = !!(container && anchorNode && container.contains(anchorNode) && focusNode && container.contains(focusNode));
        if (!inside) {
          setSelectedText('');
          setSelectionPos(null);
          return;
        }
        // Solo mostrar acción si el texto es suficientemente largo
        if (text.length < 10) {
          setSelectedText('');
          setSelectionPos(null);
          return;
        }
        // Calcular posición del botón flotante
        let rect: DOMRect | null = null;
        try {
          rect = sel.rangeCount > 0 ? sel.getRangeAt(0).getBoundingClientRect() : null;
        } catch {}
        if (rect) {
          setSelectedText(text);
          setSelectionPos({ top: rect.bottom + 6, left: Math.min(rect.left + rect.width / 2, window.innerWidth - 140) });
        } else {
          setSelectedText(text);
          setSelectionPos({ top: 80, left: 80 });
        }
      } catch {
        // no-op
      }
    }
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

  // Preparar el compositor cuando se activa
  const openComposerFromSelection = useCallback(() => {
    if (!selectedText) return;
    const autoTitle = fileName || 'Obra';
    const content = selectedText;
    setTitleInput(autoTitle);
    setContentInput(content);
    setPostStatus('published');
    setShowComposer(true);
    setSubmitMessage('');
  }, [selectedText, fileName]);

  const submitPost = useCallback(async () => {
    try {
      setSubmitting(true);
      setSubmitMessage('');
      const payload = {
        title: titleInput.trim(),
        content: contentInput.trim(),
        status: postStatus,
        type: 'poem', // Integrar en posts normales sin cambiar esquema
      };
      // Validaciones mínimas locales
      if (payload.title.length < 3) {
        setSubmitMessage('El título debe tener al menos 3 caracteres');
        setSubmitting(false);
        return;
      }
      if (payload.content.length < 10) {
        setSubmitMessage('El contenido es demasiado corto');
        setSubmitting(false);
        return;
      }
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSubmitMessage(typeof err?.error === 'string' ? err.error : 'No se pudo crear el post');
        setSubmitting(false);
        return;
      }
      const json = await res.json().catch(() => ({}));
      setSubmitMessage('¡Post creado exitosamente!');
      // Limpiar selección y cerrar compositor tras breve pausa
      setTimeout(() => {
        setShowComposer(false);
        setSelectedText('');
        setSelectionPos(null);
        setSubmitting(false);
      }, 900);
    } catch (e) {
      setSubmitMessage('Error de red creando el post');
      setSubmitting(false);
    }
  }, [titleInput, contentInput, postStatus]);

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
    <div ref={containerRef} className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl max-h-[90vh] w-full mx-4 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold truncate">
              {fileName || 'Documento PDF'}
            </h3>
            {authorName && (
              <div className="text-sm text-slate-600 truncate">por {authorName}</div>
            )}
          </div>
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
        <div className="relative flex-1 overflow-auto p-4">
          {loading && (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2">Cargando PDF...</span>
            </div>
          )}

          {fileObject && (
             <div className="flex justify-center">
               <Document
                key={fileUrl}
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
                  key={pageNumber}
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

          {/* Botón flotante para crear post desde selección */}
          {selectionPos && selectedText && !showComposer && (
            <div
              style={{ position: 'fixed', top: selectionPos.top, left: selectionPos.left, transform: 'translateX(-50%)' }}
              className="z-[60]"
            >
              <button
                onClick={openComposerFromSelection}
                className="px-3 py-1 bg-indigo-600 text-white text-sm rounded shadow hover:bg-indigo-700"
              >
                Crear post desde selección
              </button>
            </div>
          )}

          {/* Modal de compositor */}
          {showComposer && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[70]">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-xl mx-4">
                <div className="flex justify-between items-center p-4 border-b">
                  <h4 className="font-semibold">Nuevo post a partir de selección</h4>
                  <button className="text-gray-500 hover:text-gray-700" onClick={() => setShowComposer(false)}>✕</button>
                </div>
                <div className="p-4 space-y-3">
                  {authorName && (
                    <div className="text-sm text-slate-600">Autor: {authorName}</div>
                  )}
                  <div>
                    <label className="block text-sm font-medium mb-1">Título</label>
                    <input
                      type="text"
                      value={titleInput}
                      onChange={(e) => setTitleInput(e.target.value)}
                      className="w-full border rounded px-3 py-2"
                      placeholder="Título del post"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Contenido</label>
                    <textarea
                      value={contentInput}
                      onChange={(e) => setContentInput(e.target.value)}
                      className="w-full border rounded px-3 py-2 h-40"
                      placeholder="Contenido del post"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-sm">Estado</label>
                    <select
                      value={postStatus}
                      onChange={(e) => setPostStatus((e.target.value as 'draft' | 'published') || 'published')}
                      className="border rounded px-2 py-1 text-sm"
                    >
                      <option value="published">Publicado</option>
                      <option value="draft">Borrador</option>
                    </select>
                  </div>
                  {submitMessage && (
                    <div className={`text-sm mt-2 ${submitMessage.includes('¡Post') ? 'text-green-700' : 'text-red-700'}`}>
                      {submitMessage}
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2 p-4 border-t">
                  <button
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                    onClick={() => setShowComposer(false)}
                    disabled={submitting}
                  >
                    Cancelar
                  </button>
                  <button
                    className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:bg-indigo-400"
                    onClick={submitPost}
                    disabled={submitting}
                  >
                    {submitting ? 'Creando...' : 'Crear post'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default PDFViewer;