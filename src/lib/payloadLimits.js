/**
 * Payload Limits and File Validation System
 * Prevents DoS attacks and ensures data integrity
 */

import { securityLogger } from './securityLogger.js';

// Payload size limits (in bytes)
export const PAYLOAD_LIMITS = {
  // Text content limits
  POST_CONTENT: 50000,        // 50KB for posts
  PROFILE_BIO: 2000,          // 2KB for bio
  WORK_DESCRIPTION: 10000,    // 10KB for work descriptions
  COMMENT: 1000,              // 1KB for comments
  
  // File upload limits
  PROFILE_IMAGE: 5 * 1024 * 1024,    // 5MB
  WORK_COVER: 10 * 1024 * 1024,      // 10MB
  DOCUMENT_UPLOAD: 50 * 1024 * 1024, // 50MB
  
  // General API limits
  JSON_PAYLOAD: 1024 * 1024,         // 1MB for JSON
  FORM_DATA: 100 * 1024 * 1024,      // 100MB for form data
};

// Allowed file types
export const ALLOWED_FILE_TYPES = {
  images: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  documents: ['application/pdf', 'text/plain', 'application/msword', 
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  archives: ['application/zip', 'application/x-rar-compressed']
};

// File extension validation
export const ALLOWED_EXTENSIONS = {
  images: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
  documents: ['.pdf', '.txt', '.doc', '.docx'],
  archives: ['.zip', '.rar']
};

/**
 * Validates payload size against limits
 */
export function validatePayloadSize(data, type, req = null) {
  try {
    const limit = PAYLOAD_LIMITS[type];
    if (!limit) {
      throw new Error(`Unknown payload type: ${type}`);
    }

    let size;
    if (typeof data === 'string') {
      size = Buffer.byteLength(data, 'utf8');
    } else if (data instanceof Buffer) {
      size = data.length;
    } else if (typeof data === 'object') {
      size = Buffer.byteLength(JSON.stringify(data), 'utf8');
    } else {
      size = String(data).length;
    }

    if (size > limit) {
      const error = new Error(`Payload too large: ${size} bytes exceeds limit of ${limit} bytes for type ${type}`);
      
      securityLogger.logSecurityEvent('PAYLOAD_SIZE_VIOLATION', 'WARNING', {
        type,
        size,
        limit,
        userAgent: req?.headers?.['user-agent'],
        ip: req?.ip || req?.connection?.remoteAddress
      });
      
      throw error;
    }

    return true;
  } catch (error) {
    securityLogger.logSecurityEvent('PAYLOAD_VALIDATION_ERROR', 'CRITICAL', {
      error: error.message,
      type,
      userAgent: req?.headers?.['user-agent']
    });
    throw error;
  }
}

/**
 * Validates file type and extension
 */
export function validateFileType(file, allowedCategory) {
  try {
    const { mimetype, originalname } = file;
    
    // Check MIME type
    const allowedMimeTypes = ALLOWED_FILE_TYPES[allowedCategory];
    if (!allowedMimeTypes || !allowedMimeTypes.includes(mimetype)) {
      throw new Error(`Invalid file type: ${mimetype} not allowed for category ${allowedCategory}`);
    }
    
    // Check file extension
    const extension = originalname.toLowerCase().substring(originalname.lastIndexOf('.'));
    const allowedExts = ALLOWED_EXTENSIONS[allowedCategory];
    if (!allowedExts || !allowedExts.includes(extension)) {
      throw new Error(`Invalid file extension: ${extension} not allowed for category ${allowedCategory}`);
    }
    
    return true;
  } catch (error) {
    securityLogger.logSecurityEvent('FILE_TYPE_VIOLATION', 'WARNING', {
      mimetype: file.mimetype,
      filename: file.originalname,
      category: allowedCategory,
      error: error.message
    });
    throw error;
  }
}

/**
 * Comprehensive file validation
 */
export function validateFile(file, category, maxSize = null) {
  try {
    if (!file) {
      throw new Error('No file provided');
    }
    
    // Validate file type
    validateFileType(file, category);
    
    // Validate file size
    const sizeLimit = maxSize || PAYLOAD_LIMITS[`${category.toUpperCase()}_FILE`] || PAYLOAD_LIMITS.DOCUMENT_UPLOAD;
    if (file.size > sizeLimit) {
      throw new Error(`File too large: ${file.size} bytes exceeds limit of ${sizeLimit} bytes`);
    }
    
    // Additional security checks
    if (file.originalname.includes('..') || file.originalname.includes('/') || file.originalname.includes('\\')) {
      throw new Error('Invalid filename: path traversal detected');
    }
    
    return true;
  } catch (error) {
    securityLogger.logSecurityEvent('FILE_VALIDATION_ERROR', 'WARNING', {
      filename: file?.originalname,
      size: file?.size,
      mimetype: file?.mimetype,
      category,
      error: error.message
    });
    throw error;
  }
}

/**
 * Middleware for payload size validation
 */
export function createPayloadLimitMiddleware(type) {
  return (req, res, next) => {
    try {
      // Check Content-Length header
      const contentLength = parseInt(req.headers['content-length'] || '0');
      const limit = PAYLOAD_LIMITS[type] || PAYLOAD_LIMITS.JSON_PAYLOAD;
      
      if (contentLength > limit) {
        securityLogger.logSecurityEvent('PAYLOAD_SIZE_VIOLATION', 'WARNING', {
          contentLength,
          limit,
          type,
          ip: req.ip,
          userAgent: req.headers['user-agent']
        });
        
        return res.status(413).json({
          error: 'Payload too large',
          code: 'PAYLOAD_TOO_LARGE',
          limit: limit,
          received: contentLength
        });
      }
      
      next();
    } catch (error) {
      securityLogger.logSecurityEvent('PAYLOAD_MIDDLEWARE_ERROR', 'CRITICAL', {
        error: error.message,
        type
      });
      
      res.status(500).json({
        error: 'Internal server error',
        code: 'PAYLOAD_VALIDATION_ERROR'
      });
    }
  };
}

/**
 * Request timeout middleware
 */
export function createTimeoutMiddleware(timeoutMs = 30000) {
  return (req, res, next) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        securityLogger.logSecurityEvent('REQUEST_TIMEOUT', 'WARNING', {
          url: req.url,
          method: req.method,
          timeout: timeoutMs,
          ip: req.ip,
          userAgent: req.headers['user-agent']
        });
        
        res.status(408).json({
          error: 'Request timeout',
          code: 'REQUEST_TIMEOUT'
        });
      }
    }, timeoutMs);
    
    res.on('finish', () => {
      clearTimeout(timeout);
    });
    
    next();
  };
}

export default {
  PAYLOAD_LIMITS,
  ALLOWED_FILE_TYPES,
  ALLOWED_EXTENSIONS,
  validatePayloadSize,
  validateFileType,
  validateFile,
  createPayloadLimitMiddleware,
  createTimeoutMiddleware
};