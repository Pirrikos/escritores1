/**
 * Utilidades para manejo de archivos
 */

export type FileType = 'pdf' | 'docx' | 'doc' | 'epub' | 'image' | 'text' | 'video' | 'audio' | 'other';

interface SignedUrlResponse {
  signedUrl: string;
  expiresAt: string;
}

interface CachedSignedUrl {
  signedUrl: string;
  expiresAt: Date;
  filePath: string;
}

// Cache en memoria para URLs firmadas
const signedUrlCache = new Map<string, CachedSignedUrl>();

/**
 * Genera una URL firmada para acceder a un archivo privado con memorización
 * @param filePath - Ruta del archivo en el bucket
 * @param expiresIn - Tiempo de expiración en segundos (default: 1 hora)
 * @param bucket - Bucket específico (opcional, se determinará automáticamente si no se proporciona)
 * @returns Promise con la URL firmada
 */
export async function getSignedFileUrl(
  filePath: string, 
  expiresIn: number = 3600,
  bucket?: string
): Promise<string> {
  try {
    // Validación temprana: verificar que filePath no esté vacío
    if (!filePath || filePath.trim() === '') {
      throw new Error('La ruta del archivo no puede estar vacía');
    }

    // Validación temprana: verificar que no sea una URL externa
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      throw new Error('No se puede generar URL firmada para URLs externas');
    }

    // Crear clave de cache única
    const cacheKey = `${filePath}:${bucket || 'auto'}`;
    
    // Verificar si tenemos una URL firmada válida en cache
    const cached = signedUrlCache.get(cacheKey);
    if (cached && cached.expiresAt > new Date(Date.now() + 300000)) { // 5 minutos de margen
      console.log('🔄 getSignedFileUrl - Usando URL firmada desde cache:', filePath);
      return cached.signedUrl;
    }

    console.log('🔑 getSignedFileUrl - Generando nueva URL firmada para:', filePath);

    const response = await fetch('/api/storage/signed-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Para API interna necesitamos credenciales
      body: JSON.stringify({
        filePath,
        expiresIn,
        bucket
      })
    });

    if (!response.ok) {
      let error;
      try {
        error = await response.json();
      } catch (parseError) {
        console.error('❌ getSignedFileUrl - Error parseando respuesta del servidor:', parseError);
        throw new Error(`Error del servidor (${response.status}): ${response.statusText}`);
      }
      console.error('❌ getSignedFileUrl - Error del servidor:', error);
      throw new Error(error.error || error.details || 'Error generando URL firmada');
    }

    const data: SignedUrlResponse = await response.json();
    
    // Guardar en cache
    signedUrlCache.set(cacheKey, {
      signedUrl: data.signedUrl,
      expiresAt: new Date(data.expiresAt),
      filePath
    });
    
    console.log('✅ getSignedFileUrl - URL firmada generada y guardada en cache');
    return data.signedUrl;
  } catch (error) {
    console.error('❌ getSignedFileUrl - Error obteniendo URL firmada:', error);
    throw error;
  }
}

/**
 * Extrae el nombre del archivo de una ruta
 * @param filePath - Ruta completa del archivo
 * @returns Nombre del archivo
 */
export function getFileNameFromPath(filePath: string): string {
  return filePath.split('/').pop() || filePath;
}

/**
 * Formatea el tamaño de archivo en formato legible
 * @param bytes - Tamaño en bytes
 * @returns Tamaño formateado (ej: "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Detecta el tipo de archivo basado en la URL o extensión
 */
export function detectFileType(fileUrl: string, fileName?: string): FileType {
  let url = fileName || fileUrl;
  
  // Si es una URL firmada de Supabase, extraer la parte antes de los parámetros de consulta
  if (url.includes('?')) {
    url = url.split('?')[0];
  }
  
  // Si es una URL, extraer solo el pathname
  if (url.startsWith('http')) {
    try {
      const urlObj = new URL(url);
      url = urlObj.pathname;
    } catch (e) {
      // Si falla el parsing, usar la URL original sin parámetros
    }
  }
  
  const extension = url.toLowerCase().split('.').pop() || '';
  
  switch (extension) {
    case 'pdf':
      return 'pdf';
    case 'docx':
      return 'docx';
    case 'doc':
      return 'doc';
    case 'epub':
      return 'epub';
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
    case 'svg':
      return 'image';
    case 'txt':
    case 'md':
      return 'text';
    case 'mp4':
    case 'avi':
    case 'mov':
    case 'webm':
      return 'video';
    case 'mp3':
    case 'wav':
    case 'ogg':
      return 'audio';
    default:
      return 'other';
  }
}

/**
 * Determina si un archivo se puede ver en el navegador
 */
export function canViewInBrowser(fileType: FileType): boolean {
  return ['pdf', 'image', 'text'].includes(fileType);
}

/**
 * Determina si un archivo debe solo descargarse
 */
export function shouldDownloadOnly(fileType: FileType): boolean {
  return ['docx', 'doc', 'epub'].includes(fileType);
}

/**
 * Obtiene el tipo MIME basado en el tipo de archivo
 */
export function getMimeType(fileType: FileType): string {
  switch (fileType) {
    case 'pdf':
      return 'application/pdf';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'doc':
      return 'application/msword';
    case 'epub':
      return 'application/epub+zip';
    case 'image':
      return 'image/*';
    case 'text':
      return 'text/plain';
    case 'video':
      return 'video/*';
    case 'audio':
      return 'audio/*';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Obtiene una descripción amigable del tipo de archivo
 */
export function getFileTypeDescription(fileType: FileType): string {
  switch (fileType) {
    case 'pdf':
      return 'Documento PDF';
    case 'docx':
      return 'Documento Word (.docx)';
    case 'doc':
      return 'Documento Word (.doc)';
    case 'epub':
      return 'Libro electrónico EPUB';
    case 'image':
      return 'Imagen';
    case 'text':
      return 'Archivo de texto';
    case 'video':
      return 'Video';
    case 'audio':
      return 'Audio';
    default:
      return 'Archivo';
  }
}