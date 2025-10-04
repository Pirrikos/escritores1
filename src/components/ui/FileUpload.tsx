'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, File, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabaseClient';

interface FileUploadProps {
  onFileUploaded?: (url: string, fileName: string) => void;
  onError?: (error: string) => void;
  maxSizeInMB?: number;
  acceptedTypes?: string[];
  multiple?: boolean;
  className?: string;
}

interface UploadingFile {
  file: File;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  url?: string;
  error?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({
  onFileUploaded,
  onError,
  maxSizeInMB = 10,
  acceptedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ],
  multiple = false,
  className = ''
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFileIcon = (fileType: string) => {
    if (fileType === 'application/pdf') return <FileText className="w-6 h-6 text-red-500" />;
    if (fileType.includes('word')) return <FileText className="w-6 h-6 text-blue-600" />;
    return <File className="w-6 h-6" />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const validateFile = useCallback((file: File): string | null => {
    // Validar tipo de archivo
    if (!acceptedTypes.includes(file.type)) {
      return `Tipo de archivo no permitido. Tipos aceptados: ${acceptedTypes.join(', ')}`;
    }

    // Validar tamaño
    const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
    if (file.size > maxSizeInBytes) {
      return `El archivo es demasiado grande. Tamaño máximo: ${maxSizeInMB}MB`;
    }

    return null;
  }, [acceptedTypes, maxSizeInMB]);

  const uploadFile = useCallback(async (file: File): Promise<string> => {
    const supabase = getSupabaseBrowserClient();
    
    // Verificar autenticación
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Debes estar autenticado para subir archivos');
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    // Nueva estructura: archivos organizados por usuario en bucket works
    const filePath = `${user.id}/${fileName}`;

    const { error } = await supabase.storage
      .from('works')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      throw new Error(`Error al subir archivo: ${error.message}`);
    }

    // Para buckets privados, devolvemos el path del archivo
    // La URL firmada se generará cuando sea necesario mostrar el archivo
    return filePath;
  }, []);

  const handleFiles = useCallback(async (files: FileList) => {
    const filesToProcess = Array.from(files).slice(0, multiple ? files.length : 1);
    
    for (const file of filesToProcess) {
      const validationError = validateFile(file);
      
      if (validationError) {
        onError?.(validationError);
        continue;
      }

      const uploadingFile: UploadingFile = {
        file,
        progress: 0,
        status: 'uploading'
      };

      setUploadingFiles(prev => [...prev, uploadingFile]);

      try {
        // Simular progreso
        const progressInterval = setInterval(() => {
          setUploadingFiles(prev => 
            prev.map(f => 
              f.file === file && f.status === 'uploading'
                ? { ...f, progress: Math.min(f.progress + Math.random() * 30, 90) }
                : f
            )
          );
        }, 200);

        const url = await uploadFile(file);

        clearInterval(progressInterval);

        setUploadingFiles(prev => 
          prev.map(f => 
            f.file === file
              ? { ...f, progress: 100, status: 'success', url }
              : f
          )
        );

        onFileUploaded?.(url, file.name);

        // Remover archivo de la lista después de 3 segundos
        setTimeout(() => {
          setUploadingFiles(prev => prev.filter(f => f.file !== file));
        }, 3000);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        
        setUploadingFiles(prev => 
          prev.map(f => 
            f.file === file
              ? { ...f, status: 'error', error: errorMessage }
              : f
          )
        );

        onError?.(errorMessage);
      }
    }
  }, [multiple, onFileUploaded, onError, validateFile, uploadFile]);

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
    
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  }, [handleFiles]);

  const removeFile = (fileToRemove: File) => {
    setUploadingFiles(prev => prev.filter(f => f.file !== fileToRemove));
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Zona de drop */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200
          ${isDragOver 
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }
          ${uploadingFiles.length > 0 ? 'mb-4' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          accept={acceptedTypes.join(',')}
          onChange={handleFileInputChange}
          className="hidden"
        />
        
        <Upload className={`mx-auto mb-4 w-12 h-12 ${isDragOver ? 'text-blue-500' : 'text-gray-400'}`} />
        
        <h3 className="mb-2 text-lg font-medium text-gray-900 dark:text-gray-100">
          {isDragOver ? 'Suelta los archivos aquí' : 'Subir archivos'}
        </h3>
        
        <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
          Arrastra y suelta archivos aquí, o haz clic para seleccionar
        </p>
        
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Tipos permitidos: PDF, Word (.docx, .doc) (máx. {maxSizeInMB}MB)
        </p>
      </div>

      {/* Lista de archivos subiendo */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-3">
          {uploadingFiles.map((uploadingFile, index) => (
            <div
              key={index}
              className="flex items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border"
            >
              <div className="flex-shrink-0 mr-3">
                {getFileIcon(uploadingFile.file.type)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {uploadingFile.file.name}
                  </p>
                  <div className="flex items-center space-x-2">
                    {uploadingFile.status === 'success' && (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    )}
                    {uploadingFile.status === 'error' && (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    )}
                    <button
                      onClick={() => removeFile(uploadingFile.file)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>{formatFileSize(uploadingFile.file.size)}</span>
                  {uploadingFile.status === 'uploading' && (
                    <span>{Math.round(uploadingFile.progress)}%</span>
                  )}
                  {uploadingFile.status === 'success' && (
                    <span className="text-green-600 dark:text-green-400">Completado</span>
                  )}
                  {uploadingFile.status === 'error' && (
                    <span className="text-red-600 dark:text-red-400">Error</span>
                  )}
                </div>
                
                {/* Barra de progreso */}
                {uploadingFile.status === 'uploading' && (
                  <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${uploadingFile.progress}%` }}
                    />
                  </div>
                )}
                
                {/* Mensaje de error */}
                {uploadingFile.status === 'error' && uploadingFile.error && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {uploadingFile.error}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileUpload;