/**
 * Utilidades de sanitización de datos para prevenir ataques XSS y validar entradas
 */

/**
 * Escapa caracteres HTML peligrosos
 * @param {string} text - Texto a escapar
 * @returns {string} - Texto escapado
 */
export function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  
  const htmlEscapes = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;'
  };
  
  return text.replace(/[&<>"'/]/g, (match) => htmlEscapes[match]);
}

/**
 * Limpia y sanitiza texto eliminando scripts y tags peligrosos
 * @param {string} text - Texto a sanitizar
 * @returns {string} - Texto sanitizado
 */
export function sanitizeText(text) {
  if (typeof text !== 'string') return '';
  
  // Eliminar scripts y tags peligrosos
  let sanitized = text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/<link\b[^>]*>/gi, '')
    .replace(/<meta\b[^>]*>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
  
  // Escapar caracteres HTML restantes
  return escapeHtml(sanitized);
}

/**
 * Sanitiza datos de entrada para posts
 * @param {Object} postData - Datos del post
 * @returns {Object} - Datos sanitizados
 */
export function sanitizePostData(postData) {
  if (!postData || typeof postData !== 'object') {
    throw new Error('Los datos del post son requeridos');
  }

  const sanitized = {};

  // Título: requerido, máximo 200 caracteres
  if (typeof postData.title === 'string') {
    sanitized.title = sanitizeText(postData.title.trim()).substring(0, 200);
  } else {
    sanitized.title = '';
  }

  // Contenido: requerido, máximo 10000 caracteres
  if (typeof postData.content === 'string') {
    sanitized.content = sanitizeText(postData.content.trim()).substring(0, 10000);
  } else {
    sanitized.content = '';
  }

  // Estado: solo valores permitidos
  const allowedStatuses = ['draft', 'published'];
  sanitized.status = allowedStatuses.includes(postData.status) ? postData.status : 'draft';

  // Tipo: solo valores permitidos
  const allowedTypes = ['poem', 'chapter'];
  sanitized.type = allowedTypes.includes(postData.type) ? postData.type : 'poem';

  return sanitized;
}

/**
 * Valida y sanitiza parámetros de consulta
 * @param {Object} queryParams - Parámetros de consulta
 * @returns {Object} - Parámetros sanitizados
 */
export function sanitizeQueryParams(queryParams) {
  const sanitized = {};

  // Limit: número entero positivo, máximo 100
  if (queryParams.limit !== undefined) {
    const limit = parseInt(queryParams.limit, 10);
    sanitized.limit = isNaN(limit) || limit < 1 ? 20 : Math.min(limit, 100);
  }

  // Offset: número entero no negativo
  if (queryParams.offset !== undefined) {
    const offset = parseInt(queryParams.offset, 10);
    sanitized.offset = isNaN(offset) || offset < 0 ? 0 : offset;
  }

  // Search: texto sanitizado, máximo 100 caracteres
  if (typeof queryParams.search === 'string') {
    sanitized.search = sanitizeText(queryParams.search.trim()).substring(0, 100);
  }

  // Status: solo valores permitidos
  const allowedStatuses = ['draft', 'published', 'all'];
  if (allowedStatuses.includes(queryParams.status)) {
    sanitized.status = queryParams.status;
  }

  return sanitized;
}

/**
 * Valida formato de email
 * @param {string} email - Email a validar
 * @returns {boolean} - True si es válido
 */
export function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Sanitiza y valida datos de usuario
 * @param {Object} userData - Datos del usuario
 * @returns {Object} - Datos sanitizados
 */
export function sanitizeUserData(userData) {
  if (!userData || typeof userData !== 'object') {
    throw new Error('Los datos del usuario son requeridos');
  }

  const sanitized = {};

  // Email: validar formato
  if (typeof userData.email === 'string') {
    const email = userData.email.trim().toLowerCase();
    if (isValidEmail(email)) {
      sanitized.email = email;
    }
  }

  // Display name: sanitizar texto, máximo 50 caracteres
  if (typeof userData.display_name === 'string') {
    sanitized.display_name = sanitizeText(userData.display_name.trim()).substring(0, 50);
  }

  // Bio: sanitizar texto, máximo 500 caracteres
  if (typeof userData.bio === 'string') {
    sanitized.bio = sanitizeText(userData.bio.trim()).substring(0, 500);
  }

  return sanitized;
}

/**
 * Limpia espacios en blanco excesivos y normaliza texto
 * @param {string} text - Texto a normalizar
 * @returns {string} - Texto normalizado
 */
export function normalizeText(text) {
  if (typeof text !== 'string') return '';
  
  return text
    .trim()
    .replace(/\s+/g, ' ')  // Múltiples espacios a uno solo
    .replace(/\n\s*\n/g, '\n\n');  // Múltiples saltos de línea a máximo dos
}

/**
 * Valida que un ID sea un UUID válido
 * @param {string} id - ID a validar
 * @returns {boolean} - True si es un UUID válido
 */
export function isValidUUID(id) {
  if (typeof id !== 'string') return false;
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}