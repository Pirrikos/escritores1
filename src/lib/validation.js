// src/lib/validation.js
// Comprehensive validation utilities for robust input validation

/**
 * Validates email format using a comprehensive regex
 * @param {string} email - Email to validate
 * @returns {boolean} - True if valid email format
 */
export const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email) && email.length <= 254;
};

/**
 * Validates UUID format (v4)
 * @param {string} uuid - UUID to validate
 * @returns {boolean} - True if valid UUID format
 */
export const isValidUUID = (uuid) => {
  if (!uuid || typeof uuid !== 'string') return false;
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

/**
 * Validates string length within specified bounds
 * @param {string} str - String to validate
 * @param {number} min - Minimum length (inclusive)
 * @param {number} max - Maximum length (inclusive)
 * @returns {object} - Validation result with isValid and error
 */
export const validateStringLength = (str, min = 0, max = Infinity) => {
  if (typeof str !== 'string') {
    return { isValid: false, error: 'El valor debe ser una cadena de texto' };
  }
  
  const trimmed = str.trim();
  
  if (trimmed.length < min) {
    return { isValid: false, error: `Debe tener al menos ${min} caracteres` };
  }
  
  if (trimmed.length > max) {
    return { isValid: false, error: `No debe exceder ${max} caracteres` };
  }
  
  return { isValid: true, value: trimmed };
};

/**
 * Validates numeric input within specified range
 * @param {any} value - Value to validate as number
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @returns {object} - Validation result with isValid, error, and parsed value
 */
export const validateNumber = (value, min = -Infinity, max = Infinity) => {
  const num = Number(value);
  
  if (isNaN(num)) {
    return { isValid: false, error: 'Debe ser un número válido' };
  }
  
  if (num < min) {
    return { isValid: false, error: `Debe ser al menos ${min}` };
  }
  
  if (num > max) {
    return { isValid: false, error: `No debe exceder ${max}` };
  }
  
  return { isValid: true, value: num };
};

/**
 * Validates integer input within specified range
 * @param {any} value - Value to validate as integer
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @returns {object} - Validation result with isValid, error, and parsed value
 */
export const validateInteger = (value, min = -Infinity, max = Infinity) => {
  const num = Number(value);
  
  if (isNaN(num) || !Number.isInteger(num)) {
    return { isValid: false, error: 'Debe ser un número entero válido' };
  }
  
  if (num < min) {
    return { isValid: false, error: `Debe ser al menos ${min}` };
  }
  
  if (num > max) {
    return { isValid: false, error: `No debe exceder ${max}` };
  }
  
  return { isValid: true, value: num };
};

/**
 * Validates that value is one of allowed options
 * @param {any} value - Value to validate
 * @param {array} allowedValues - Array of allowed values
 * @returns {object} - Validation result with isValid and error
 */
export const validateEnum = (value, allowedValues) => {
  if (!Array.isArray(allowedValues)) {
    return { isValid: false, error: 'Configuración de valores permitidos inválida' };
  }
  
  if (!allowedValues.includes(value)) {
    return { isValid: false, error: `Debe ser uno de: ${allowedValues.join(', ')}` };
  }
  
  return { isValid: true, value };
};

/**
 * Validates URL format
 * @param {string} url - URL to validate
 * @param {array} allowedProtocols - Allowed protocols (default: ['http', 'https'])
 * @returns {object} - Validation result with isValid and error
 */
export const validateURL = (url, allowedProtocols = ['http', 'https']) => {
  if (!url || typeof url !== 'string') {
    return { isValid: false, error: 'La URL debe ser una cadena de texto' };
  }
  
  try {
    const urlObj = new URL(url);
    
    if (!allowedProtocols.includes(urlObj.protocol.slice(0, -1))) {
      return { isValid: false, error: `El protocolo debe ser uno de: ${allowedProtocols.join(', ')}` };
    }
    
    return { isValid: true, value: url };
  } catch {
    return { isValid: false, error: 'Formato de URL inválido' };
  }
};

/**
 * Validates date string and converts to Date object
 * @param {string} dateStr - Date string to validate
 * @param {Date} minDate - Minimum allowed date (optional)
 * @param {Date} maxDate - Maximum allowed date (optional)
 * @returns {object} - Validation result with isValid, error, and Date object
 */
export const validateDate = (dateStr, minDate = null, maxDate = null) => {
  if (!dateStr || typeof dateStr !== 'string') {
    return { isValid: false, error: 'La fecha debe ser una cadena de texto' };
  }
  
  const date = new Date(dateStr);
  
  if (isNaN(date.getTime())) {
    return { isValid: false, error: 'Formato de fecha inválido' };
  }
  
  if (minDate && date < minDate) {
    return { isValid: false, error: `La fecha debe ser posterior a ${minDate.toISOString()}` };
  }
  
  if (maxDate && date > maxDate) {
    return { isValid: false, error: `La fecha debe ser anterior a ${maxDate.toISOString()}` };
  }
  
  return { isValid: true, value: date };
};

/**
 * Validates array input
 * @param {any} value - Value to validate as array
 * @param {number} minLength - Minimum array length
 * @param {number} maxLength - Maximum array length
 * @param {function} itemValidator - Optional validator function for each item
 * @returns {object} - Validation result with isValid, error, and validated array
 */
export const validateArray = (value, minLength = 0, maxLength = Infinity, itemValidator = null) => {
  if (!Array.isArray(value)) {
    return { isValid: false, error: 'El valor debe ser un arreglo' };
  }
  
  if (value.length < minLength) {
    return { isValid: false, error: `El arreglo debe tener al menos ${minLength} elementos` };
  }
  
  if (value.length > maxLength) {
    return { isValid: false, error: `El arreglo no debe exceder ${maxLength} elementos` };
  }
  
  if (itemValidator && typeof itemValidator === 'function') {
    const errors = [];
    const validatedItems = [];
    
    for (let i = 0; i < value.length; i++) {
      const result = itemValidator(value[i], i);
      if (!result.isValid) {
        errors.push(`Elemento ${i}: ${result.error}`);
      } else {
        validatedItems.push(result.value !== undefined ? result.value : value[i]);
      }
    }
    
    if (errors.length > 0) {
      return { isValid: false, error: errors.join('; ') };
    }
    
    return { isValid: true, value: validatedItems };
  }
  
  return { isValid: true, value };
};

/**
 * Validates object structure against a schema
 * @param {object} obj - Object to validate
 * @param {object} schema - Validation schema
 * @returns {object} - Validation result with isValid, errors, and validated data
 */
export const validateObject = (obj, schema) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { isValid: false, errors: ['El valor debe ser un objeto'] };
  }
  
  const errors = [];
  const validatedData = {};
  
  // Check required fields and validate present fields
  for (const [field, rules] of Object.entries(schema)) {
    const value = obj[field];
    const isRequired = rules.required !== false;
    
    // Check if required field is missing
    if (isRequired && (value === undefined || value === null || value === '')) {
      errors.push(`${field} es requerido`);
      continue;
    }
    
    // Skip validation if field is optional and not provided
    if (!isRequired && (value === undefined || value === null || value === '')) {
      continue;
    }
    
    // Apply validator function if provided
    if (rules.validator && typeof rules.validator === 'function') {
      const result = rules.validator(value);
      if (!result.isValid) {
        errors.push(`${field}: ${result.error}`);
      } else {
        validatedData[field] = result.value !== undefined ? result.value : value;
      }
    } else {
      validatedData[field] = value;
    }
  }
  
  // Check for unexpected fields
  const allowedFields = Object.keys(schema);
  const providedFields = Object.keys(obj);
  const unexpectedFields = providedFields.filter(field => !allowedFields.includes(field));
  
  if (unexpectedFields.length > 0) {
    errors.push(`Campos inesperados: ${unexpectedFields.join(', ')}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    validatedData: errors.length === 0 ? validatedData : null
  };
};

/**
 * Post-specific validation schema
 */
export const postValidationSchema = {
  title: {
    required: true,
    validator: (value) => validateStringLength(value, 3, 200)
  },
  content: {
    required: true,
    validator: (value) => validateStringLength(value, 10, 10000)
  },
  status: {
    required: false,
    validator: (value) => validateEnum(value, ['draft', 'published'])
  },
  type: {
    required: false,
    validator: (value) => validateEnum(value, ['poem', 'chapter'])
  }
};

/**
 * Query parameters validation schema
 */
export const queryParamsSchema = {
  limit: {
    required: false,
    validator: (value) => validateInteger(value, 1, 100)
  },
  offset: {
    required: false,
    validator: (value) => validateInteger(value, 0, 10000)
  },
  search: {
    required: false,
    validator: (value) => validateStringLength(value, 0, 100)
  },
  status: {
    required: false,
    validator: (value) => validateEnum(value, ['draft', 'published', 'all'])
  }
};

/**
 * User data validation schema
 */
export const userValidationSchema = {
  email: {
    required: true,
    validator: (value) => {
      if (!isValidEmail(value)) {
        return { isValid: false, error: 'Formato de email inválido' };
      }
      return { isValid: true, value };
    }
  },
  display_name: {
    required: false,
    validator: (value) => validateStringLength(value, 1, 100)
  },
  bio: {
    required: false,
    validator: (value) => validateStringLength(value, 0, 500)
  }
};