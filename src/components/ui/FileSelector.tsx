'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, File, FileText } from 'lucide-react';

interface FileSelectorProps {
  onFileSelect?: (file: File | null) => void;
  maxSize?: number; // en bytes
  acceptedTypes?: string[];
  placeholder?: string;
  className?: string;
  selectedFile?: File | null;
}

const FileSelector: React.FC<FileSelectorProps> = ({
  onFileSelect,
  maxSize = 50 * 1024 * 1024, // 50MB por defecto
  acceptedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain'
  ],
  placeholder = "Arrastra un archivo aquí o haz clic para seleccionar",
  className = '',
  selectedFile = null
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFileIcon = (fileType: string) => {
    if (fileType === 'application/pdf') return <FileText className="w-6 h-6 text-red-500" />;
    if (fileType.includes('word')) return <FileText className="w-6 h-6 text-blue-600" />;
    if (fileType === 'text/plain') return <FileText className="w-6 h-6 text-gray-600" />;
    return <File className="w-6 h-6" />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const validateFile = (file: File): string | null => {
    // Validar tipo de archivo
    if (!acceptedTypes.includes(file.type)) {
      return `Tipo de archivo no permitido. Tipos aceptados: ${acceptedTypes.join(', ')}`;
    }

    // Validar tamaño
    if (file.size > maxSize) {
      return `El archivo es demasiado grande. Tamaño máximo: ${formatFileSize(maxSize)}`;
    }

    return null;
  };

  const handleFile = useCallback((file: File) => {
    const validationError = validateFile(file);
    
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    onFileSelect?.(file);
  }, [acceptedTypes, maxSize, onFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, [handleFile]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  }, [handleFile]);

  const removeFile = () => {
    setError(null);
    onFileSelect?.(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Zona de drop */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 cursor-pointer
          ${isDragOver 
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }
          ${selectedFile ? 'mb-4' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes.join(',')}
          onChange={handleFileInputChange}
          className="hidden"
        />
        
        <Upload className={`mx-auto mb-3 w-10 h-10 ${isDragOver ? 'text-blue-500' : 'text-gray-400'}`} />
        
        <h3 className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-100">
          {isDragOver ? 'Suelta el archivo aquí' : placeholder}
        </h3>
        
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Tamaño máximo: {formatFileSize(maxSize)}
        </p>
      </div>

      {/* Archivo seleccionado */}
      {selectedFile && (
        <div className="flex items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
          <div className="flex-shrink-0 mr-3">
            {getFileIcon(selectedFile.type)}
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {selectedFile.name}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatFileSize(selectedFile.size)}
            </p>
          </div>
          
          <button
            onClick={removeFile}
            className="flex-shrink-0 ml-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
};

export default FileSelector;