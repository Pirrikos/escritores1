'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { Button } from './Button';
import { Icon, Icons } from './Icon';
import { Modal, ModalHeader, ModalBody, ModalFooter } from './Modal';
import { useToast } from '../../contexts/ToastContext';
import { detectFileType, canViewInBrowser, shouldDownloadOnly, getFileTypeDescription, getSignedFileUrl, type FileType } from '@/lib/fileUtils';

// Importación dinámica de PDFViewer para evitar problemas de SSR
const PDFViewer = dynamic(() => import('./PDFViewer'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center p-8">Cargando visor PDF...</div>
});

export interface ViewDownloadButtonProps {
  /** URL del archivo a ver/descargar o ruta del archivo en storage */
  fileUrl?: string;
  /** Ruta del archivo en el bucket de storage (para URLs firmadas) */
  filePath?: string;
  /** Bucket específico donde se encuentra el archivo (works, chapters, etc.) */
  bucket?: string;
  /** Nombre del archivo para la descarga */
  fileName?: string;
  /** Tipo de archivo (se detecta automáticamente si no se proporciona) */
  fileType?: FileType;
  /** Contenido del archivo (para archivos de texto) */
  fileContent?: string;
  /** Tamaño del botón */
  size?: 'sm' | 'md' | 'lg';
  /** Variante del botón */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  /** Mostrar solo el botón de ver */
  viewOnly?: boolean;
  /** Mostrar solo el botón de descargar */
  downloadOnly?: boolean;
  /** Texto personalizado para el botón */
  label?: string;
  /** Función personalizada para manejar la vista previa */
  onView?: () => void;
  /** Función personalizada para manejar la descarga */
  onDownload?: () => void;
  /** Clase CSS adicional */
  className?: string;
  /** Deshabilitado */
  disabled?: boolean;
}

export function ViewDownloadButton({
  fileUrl,
  filePath,
  bucket,
  fileName,
  fileType,
  fileContent,
  size = 'md',
  variant = 'outline',
  viewOnly = false,
  downloadOnly = false,
  label,
  onView,
  onDownload,
  className = '',
  disabled = false
}: ViewDownloadButtonProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isPDFViewerOpen, setIsPDFViewerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [actualFileUrl, setActualFileUrl] = useState<string | null>(fileUrl || null);
  const [fileExists, setFileExists] = useState<boolean>(true); // Controla si el archivo existe
  const { addToast } = useToast();

  // Generar URL firmada si se proporciona filePath (solo para rutas de bucket, no URLs externas)
  React.useEffect(() => {
    const generateSignedUrl = async () => {
      // Si no hay filePath o ya tenemos una URL, no hacer nada
      if (!filePath || actualFileUrl) {
        return;
      }
      
      // Verificar si filePath es una URL externa
      if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
        setActualFileUrl(filePath);
        setFileExists(true);
        return;
      }

      // Solo generar URL firmada para rutas de bucket si filePath no está vacío
      if (!filePath || filePath.trim() === '' || filePath === 'NULL' || filePath === 'null') {
        setFileExists(false);
        return;
      }

      setIsLoading(true);
      try {
        const signedUrl = await getSignedFileUrl(filePath, 3600, bucket);
        setActualFileUrl(signedUrl);
        setFileExists(true);
      } catch {
        // Asumir que el archivo existe y manejar errores en tiempo de ejecución
        // Esto evita mostrar "Archivo no disponible" cuando el archivo sí existe
        setFileExists(true);
      } finally {
        setIsLoading(false);
      }
    };

    generateSignedUrl();
  }, [filePath, actualFileUrl, bucket, addToast]);

  // Si no hay fileUrl ni filePath, mostrar mensaje de fallback
  if (!actualFileUrl && !filePath) {
    return (
      <div className={`flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-dashed ${className}`}>
        <Icon path={Icons.alertCircle} size="sm" className="text-gray-400" />
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Archivo no disponible
        </span>
      </div>
    );
  }

  // Detectar tipo de archivo automáticamente si no se proporciona
  // Solo usar fileName si tiene extensión, de lo contrario usar solo filePath o actualFileUrl
  const fileNameHasExtension = fileName && fileName.includes('.') && fileName.split('.').pop()?.length;
  const detectedFileType = fileType || detectFileType(
    filePath || actualFileUrl || '', 
    fileNameHasExtension ? fileName : undefined
  );
  

  
  // Determinar comportamiento basado en el tipo de archivo
  const canView = canViewInBrowser(detectedFileType);
  const shouldOnlyDownload = shouldDownloadOnly(detectedFileType);

  // Determinar el nombre del archivo si no se proporciona
  const getFileName = () => {
    if (fileName) return fileName;
    
    // Si tenemos filePath, extraer el nombre del archivo
    if (filePath) {
      return filePath.split('/').pop() || 'archivo';
    }
    
    // Si tenemos actualFileUrl, extraer de la URL
    if (actualFileUrl) {
      try {
        const url = new URL(actualFileUrl);
        const pathname = url.pathname;
        return pathname.split('/').pop() || 'archivo';
      } catch {
        return 'archivo';
      }
    }
    
    return 'archivo';
  };

  // Manejar vista previa
  const handleView = async () => {
    if (onView) {
      onView();
      return;
    }

    // Usar la URL ya generada en useEffect o generar una nueva si es necesario
    let urlToUse = actualFileUrl;
    
    // Si no tenemos URL actual, intentar generar una
    if (!urlToUse && filePath) {
      // Verificar si filePath es una URL externa
      if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
        urlToUse = filePath;
        setActualFileUrl(filePath);
      } else {
        // Solo generar URL firmada para rutas de bucket
        try {
          setIsLoading(true);
          urlToUse = await getSignedFileUrl(filePath, 3600, bucket);
          setActualFileUrl(urlToUse);
        } catch {
          addToast({
            type: 'error',
            message: 'Error al acceder al archivo'
          });
          return;
        } finally {
          setIsLoading(false);
        }
      }
    }

    // Si aún no tenemos URL, intentar usar filePath directamente para vista previa
    if (!urlToUse && filePath) {
      urlToUse = filePath;
    }

    if (!urlToUse) {
      addToast({
        type: 'error',
        message: 'No se pudo acceder al archivo'
      });
      return;
    }

    // Si el archivo no se puede ver en navegador, solo descargar
    if (!canView) {
      addToast({
        type: 'info',
        message: `Los archivos ${getFileTypeDescription(detectedFileType)} solo se pueden descargar`
      });
      handleDownload();
      return;
    }
    
    if (detectedFileType === 'pdf') {
      // Asegurar que tenemos la URL antes de abrir el visor
      if (!actualFileUrl && urlToUse) {
        setActualFileUrl(urlToUse);
      }
      setIsPDFViewerOpen(true);
    } else if (detectedFileType === 'image' || detectedFileType === 'text') {
      setIsPreviewOpen(true);
    } else {
      // Para otros tipos de archivo, abrir en nueva pestaña
      window.open(urlToUse, '_blank');
    }
  };

  // Manejar descarga
  const handleDownload = async () => {
    if (onDownload) {
      onDownload();
      return;
    }

    // Si no tenemos URL actual, intentar generar una
    let urlToUse = actualFileUrl;
    if (!urlToUse && filePath) {
      // Verificar si filePath es una URL externa
      if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
        urlToUse = filePath;
        setActualFileUrl(filePath);
      } else {
        // Solo generar URL firmada para rutas de bucket
        try {
          setIsLoading(true);
          
          // Intentar generar URL firmada directamente sin verificación previa
          try {
            urlToUse = await getSignedFileUrl(filePath);
            setActualFileUrl(urlToUse);
            setFileExists(true); // Asumir que existe si se pudo generar la URL
          } catch {
            setFileExists(false);
            addToast({
              type: 'warning',
              message: 'El archivo no está disponible. Es posible que haya sido movido o eliminado.'
            });
            return;
          }
        } catch {
          addToast({
            type: 'error',
            message: 'Error al acceder al archivo'
          });
          return;
        } finally {
          setIsLoading(false);
        }
      }
    }

    if (!urlToUse) {
      addToast({
        type: 'error',
        message: 'No se pudo acceder al archivo'
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(urlToUse, {
        credentials: 'omit' // No enviar credenciales a URLs firmadas de Supabase
      });
      if (!response.ok) throw new Error('Error al descargar el archivo');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = getFileName();
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      addToast({
        type: 'success',
        message: `Archivo "${getFileName()}" descargado exitosamente`
      });
    } catch {
      addToast({
        type: 'error',
        message: 'Error al descargar el archivo'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Renderizar contenido de vista previa
  const renderPreviewContent = () => {
    const urlToShow = actualFileUrl;
    
    if (!urlToShow) {
      return (
        <div className="text-center py-8">
          <Icon path={Icons.alertCircle} size="xl" className="text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No se pudo cargar la vista previa</p>
        </div>
      );
    }

    switch (detectedFileType) {
      case 'image':
        return (
          <div className="flex justify-center">
            <Image 
              src={urlToShow}
              alt={getFileName()}
              width={1024}
              height={768}
              className="max-w-full max-h-96 object-contain rounded-lg"
            />
          </div>
        );
      
      case 'pdf':
        return (
          <div className="w-full h-96">
            <iframe
              src={urlToShow}
              className="w-full h-full border rounded-lg"
              title={getFileName()}
            />
          </div>
        );
      
      case 'text':
        return (
          <div className="bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
            <pre className="whitespace-pre-wrap text-sm text-gray-800">
              {fileContent || 'Contenido no disponible'}
            </pre>
          </div>
        );
      
      default:
        return (
          <div className="text-center py-8">
            <Icon path={Icons.eye} size="xl" className="text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Vista previa no disponible para este tipo de archivo</p>
            <p className="text-sm text-gray-500 mt-2">
              Haz clic en &quot;Abrir en nueva pestaña&quot; para ver el archivo
            </p>
          </div>
        );
    }
  };

  // Si el archivo no existe, mostrar mensaje informativo sin botones adicionales
  if (!fileExists) {
    return (
      <div className={`flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800 ${className}`}>
        <Icon path={Icons.alertTriangle} size="sm" className="text-orange-500" />
        <span className="text-sm text-orange-700 dark:text-orange-300">
          Archivo no disponible - Es posible que haya sido movido o eliminado
        </span>
      </div>
    );
  }

  // Si es un botón combinado (por defecto)
  if (!viewOnly && !downloadOnly) {
    // Si el archivo solo se puede descargar, mostrar solo botón de descarga
    if (shouldOnlyDownload) {
      return (
        <Button
          variant={variant}
          size={size}
          onClick={handleDownload}
          disabled={disabled || isLoading}
          loading={isLoading}
          className={`flex items-center gap-2 ${className}`}
        >
          <Icon path={Icons.download} size="sm" />
          {label || 'Descargar'}
        </Button>
      );
    }

    return (
      <>
        <div className={`flex gap-2 ${className}`}>
          <Button
            variant={variant}
            size={size}
            onClick={handleView}
            disabled={disabled}
            className="flex items-center gap-2"
          >
            <Icon path={Icons.eye} size="sm" />
            {label || 'Ver'}
          </Button>
          
          <Button
            variant={variant}
            size={size}
            onClick={handleDownload}
            disabled={disabled || isLoading}
            loading={isLoading}
            className="flex items-center gap-2"
          >
            <Icon path={Icons.download} size="sm" />
            Descargar
          </Button>
        </div>

        {/* Modal de vista previa */}
        <Modal isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} size="lg">
          <ModalHeader>
            <div className="flex items-center gap-2">
              <Icon path={Icons.eye} size="md" />
              Vista previa: {getFileName()}
            </div>
          </ModalHeader>
          
          <ModalBody>
            {renderPreviewContent()}
          </ModalBody>
          
          <ModalFooter>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => setIsPreviewOpen(false)}
              >
                Cerrar
              </Button>
              <Button
                variant="primary"
                onClick={handleDownload}
                loading={isLoading}
                className="flex items-center gap-2"
              >
                <Icon path={Icons.download} size="sm" />
                Descargar
              </Button>
            </div>
          </ModalFooter>
        </Modal>

        {/* PDF Viewer integrado */}
        {isPDFViewerOpen && (
          <PDFViewer
            fileUrl={actualFileUrl || filePath || ''}
            fileName={getFileName()}
            onClose={() => setIsPDFViewerOpen(false)}
          />
        )}
      </>
    );
  }

  // Botón solo de ver
  if (viewOnly) {
    // Si el archivo no existe, mostrar mensaje informativo
    if (!fileExists) {
      return (
        <div className={`flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800 ${className}`}>
          <Icon path={Icons.alertTriangle} size="sm" className="text-orange-500" />
          <span className="text-sm text-orange-700 dark:text-orange-300">
            Archivo no disponible para visualización
          </span>
        </div>
      );
    }

    // Si el archivo no se puede ver, mostrar mensaje
    if (!canView) {
      return (
        <div className={`flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800 ${className}`}>
          <Icon path={Icons.alertTriangle} size="sm" className="text-yellow-500" />
          <span className="text-sm text-yellow-700 dark:text-yellow-300">
            Este archivo solo se puede descargar
          </span>
        </div>
      );
    }

    return (
      <>
        <Button
          variant={variant}
          size={size}
          onClick={handleView}
          disabled={disabled}
          className={`flex items-center gap-2 ${className}`}
        >
          <Icon path={Icons.eye} size="sm" />
          {label || 'Ver'}
        </Button>

        {/* Modal de vista previa */}
        <Modal isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} size="lg">
          <ModalHeader>
            <div className="flex items-center gap-2">
              <Icon path={Icons.eye} size="md" />
              Vista previa: {getFileName()}
            </div>
          </ModalHeader>
          
          <ModalBody>
            {renderPreviewContent()}
          </ModalBody>
          
          <ModalFooter>
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                onClick={() => setIsPreviewOpen(false)}
              >
                Cerrar
              </Button>
              
              {detectedFileType !== 'text' && (
                <Button
                  variant="outline"
                  onClick={() => actualFileUrl && window.open(actualFileUrl, '_blank')}
                  className="flex items-center gap-2"
                >
                  <Icon path={Icons.external} size="sm" />
                  Abrir en nueva pestaña
                </Button>
              )}
              
              <Button
                variant="primary"
                onClick={handleDownload}
                loading={isLoading}
                className="flex items-center gap-2"
              >
                <Icon path={Icons.download} size="sm" />
                Descargar
              </Button>
            </div>
          </ModalFooter>
        </Modal>
      </>
    );
  }

  // Botón solo de descargar
  if (downloadOnly) {
    // Si el archivo no existe, mostrar mensaje informativo
    if (!fileExists) {
      return (
        <div className={`flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800 ${className}`}>
          <Icon path={Icons.alertTriangle} size="sm" className="text-orange-500" />
          <span className="text-sm text-orange-700 dark:text-orange-300">
            Archivo no disponible para descarga
          </span>
        </div>
      );
    }

    return (
      <Button
        variant={variant}
        size={size}
        onClick={handleDownload}
        disabled={disabled || isLoading}
        loading={isLoading}
        className={`flex items-center gap-2 ${className}`}
      >
        <Icon path={Icons.download} size="sm" />
        {label || 'Descargar'}
      </Button>
    );
  }

  return null;
}

export default ViewDownloadButton;