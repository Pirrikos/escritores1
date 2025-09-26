/**
 * Database Validation Utilities
 * Client-side validation that mirrors database constraints
 * Provides early validation before database operations
 */

// Validation constants that match database constraints
export const VALIDATION_LIMITS = {
  PROFILE: {
    DISPLAY_NAME_MIN: 1,
    DISPLAY_NAME_MAX: 100,
    BIO_MAX: 500
  },
  WORK: {
    TITLE_MIN: 1,
    TITLE_MAX: 200,
    SYNOPSIS_MAX: 2000
  },
  POST: {
    TITLE_MAX: 300,
    CONTENT_MIN: 1,
    CONTENT_MAX: 100000,
    CHAPTER_INDEX_MIN: 1
  }
};

// Validation error types
export const VALIDATION_ERRORS = {
  REQUIRED_FIELD: 'REQUIRED_FIELD',
  LENGTH_EXCEEDED: 'LENGTH_EXCEEDED',
  LENGTH_TOO_SHORT: 'LENGTH_TOO_SHORT',
  INVALID_FORMAT: 'INVALID_FORMAT',
  MALICIOUS_CONTENT: 'MALICIOUS_CONTENT',
  RATE_LIMIT: 'RATE_LIMIT',
  SELF_REFERENCE: 'SELF_REFERENCE'
};

/**
 * Validates profile data
 * @param {Object} profileData - Profile data to validate
 * @returns {Object} Validation result with isValid and errors
 */
export function validateProfile(profileData) {
  const errors = [];
  const { display_name, bio, avatar_url } = profileData;

  // Display name validation
  if (!display_name || display_name.trim().length === 0) {
    errors.push({
      field: 'display_name',
      type: VALIDATION_ERRORS.REQUIRED_FIELD,
      message: 'El nombre de usuario es requerido'
    });
  } else {
    const trimmedName = display_name.trim();
    
    if (trimmedName.length < VALIDATION_LIMITS.PROFILE.DISPLAY_NAME_MIN) {
      errors.push({
        field: 'display_name',
        type: VALIDATION_ERRORS.LENGTH_TOO_SHORT,
        message: `El nombre debe tener al menos ${VALIDATION_LIMITS.PROFILE.DISPLAY_NAME_MIN} carácter`
      });
    }
    
    if (trimmedName.length > VALIDATION_LIMITS.PROFILE.DISPLAY_NAME_MAX) {
      errors.push({
        field: 'display_name',
        type: VALIDATION_ERRORS.LENGTH_EXCEEDED,
        message: `El nombre no puede exceder ${VALIDATION_LIMITS.PROFILE.DISPLAY_NAME_MAX} caracteres`
      });
    }

    // Check for alphanumeric characters
    if (!/[a-zA-Z0-9]/.test(trimmedName)) {
      errors.push({
        field: 'display_name',
        type: VALIDATION_ERRORS.INVALID_FORMAT,
        message: 'El nombre debe contener al menos un carácter alfanumérico'
      });
    }
  }

  // Bio validation
  if (bio && bio.length > VALIDATION_LIMITS.PROFILE.BIO_MAX) {
    errors.push({
      field: 'bio',
      type: VALIDATION_ERRORS.LENGTH_EXCEEDED,
      message: `La biografía no puede exceder ${VALIDATION_LIMITS.PROFILE.BIO_MAX} caracteres`
    });
  }

  // Avatar URL validation
  if (avatar_url && !/^https?:\/\//.test(avatar_url)) {
    errors.push({
      field: 'avatar_url',
      type: VALIDATION_ERRORS.INVALID_FORMAT,
      message: 'La URL del avatar debe ser una URL válida (HTTP/HTTPS)'
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates work data
 * @param {Object} workData - Work data to validate
 * @returns {Object} Validation result with isValid and errors
 */
export function validateWork(workData) {
  const errors = [];
  const { title, synopsis, isbn } = workData;

  // Title validation
  if (!title || title.trim().length === 0) {
    errors.push({
      field: 'title',
      type: VALIDATION_ERRORS.REQUIRED_FIELD,
      message: 'El título es requerido'
    });
  } else {
    const trimmedTitle = title.trim();
    
    if (trimmedTitle.length < VALIDATION_LIMITS.WORK.TITLE_MIN) {
      errors.push({
        field: 'title',
        type: VALIDATION_ERRORS.LENGTH_TOO_SHORT,
        message: `El título debe tener al menos ${VALIDATION_LIMITS.WORK.TITLE_MIN} carácter`
      });
    }
    
    if (trimmedTitle.length > VALIDATION_LIMITS.WORK.TITLE_MAX) {
      errors.push({
        field: 'title',
        type: VALIDATION_ERRORS.LENGTH_EXCEEDED,
        message: `El título no puede exceder ${VALIDATION_LIMITS.WORK.TITLE_MAX} caracteres`
      });
    }
  }

  // Synopsis validation
  if (synopsis && synopsis.length > VALIDATION_LIMITS.WORK.SYNOPSIS_MAX) {
    errors.push({
      field: 'synopsis',
      type: VALIDATION_ERRORS.LENGTH_EXCEEDED,
      message: `La sinopsis no puede exceder ${VALIDATION_LIMITS.WORK.SYNOPSIS_MAX} caracteres`
    });
  }

  // ISBN validation
  if (isbn && !/^[0-9\-X]{10,17}$/.test(isbn)) {
    errors.push({
      field: 'isbn',
      type: VALIDATION_ERRORS.INVALID_FORMAT,
      message: 'El ISBN debe tener un formato válido (10-17 caracteres, números, guiones y X)'
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates post data
 * @param {Object} postData - Post data to validate
 * @returns {Object} Validation result with isValid and errors
 */
export function validatePost(postData) {
  const errors = [];
  const { title, content, type, work_id, chapter_index } = postData;

  // Content validation
  if (!content || content.trim().length === 0) {
    errors.push({
      field: 'content',
      type: VALIDATION_ERRORS.REQUIRED_FIELD,
      message: 'El contenido es requerido'
    });
  } else {
    const trimmedContent = content.trim();
    
    if (trimmedContent.length < VALIDATION_LIMITS.POST.CONTENT_MIN) {
      errors.push({
        field: 'content',
        type: VALIDATION_ERRORS.LENGTH_TOO_SHORT,
        message: `El contenido debe tener al menos ${VALIDATION_LIMITS.POST.CONTENT_MIN} carácter`
      });
    }
    
    if (trimmedContent.length > VALIDATION_LIMITS.POST.CONTENT_MAX) {
      errors.push({
        field: 'content',
        type: VALIDATION_ERRORS.LENGTH_EXCEEDED,
        message: `El contenido no puede exceder ${VALIDATION_LIMITS.POST.CONTENT_MAX} caracteres`
      });
    }

    // Check for malicious content
    const maliciousPatterns = /<script|javascript:|data:|vbscript:|onload|onerror|onclick/i;
    if (maliciousPatterns.test(content)) {
      errors.push({
        field: 'content',
        type: VALIDATION_ERRORS.MALICIOUS_CONTENT,
        message: 'El contenido contiene código potencialmente malicioso'
      });
    }

    // Check for excessive HTML
    const htmlRemoved = content.replace(/<[^>]*>/g, '');
    const htmlRatio = (content.length - htmlRemoved.length) / content.length;
    if (htmlRatio > 0.3) {
      errors.push({
        field: 'content',
        type: VALIDATION_ERRORS.MALICIOUS_CONTENT,
        message: 'El contenido contiene demasiado marcado HTML'
      });
    }
  }

  // Title validation for chapters
  if (type === 'chapter') {
    if (!title || title.trim().length === 0) {
      errors.push({
        field: 'title',
        type: VALIDATION_ERRORS.REQUIRED_FIELD,
        message: 'El título es requerido para los capítulos'
      });
    } else if (title.length > VALIDATION_LIMITS.POST.TITLE_MAX) {
      errors.push({
        field: 'title',
        type: VALIDATION_ERRORS.LENGTH_EXCEEDED,
        message: `El título no puede exceder ${VALIDATION_LIMITS.POST.TITLE_MAX} caracteres`
      });
    }

    // Work ID required for chapters
    if (!work_id) {
      errors.push({
        field: 'work_id',
        type: VALIDATION_ERRORS.REQUIRED_FIELD,
        message: 'Los capítulos deben estar asociados a una obra'
      });
    }
  }

  // Chapter index validation
  if (chapter_index !== null && chapter_index !== undefined) {
    if (chapter_index < VALIDATION_LIMITS.POST.CHAPTER_INDEX_MIN) {
      errors.push({
        field: 'chapter_index',
        type: VALIDATION_ERRORS.INVALID_FORMAT,
        message: `El índice del capítulo debe ser mayor a ${VALIDATION_LIMITS.POST.CHAPTER_INDEX_MIN - 1}`
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates follow relationship
 * @param {string} followerId - ID of the follower
 * @param {string} followingId - ID of the user being followed
 * @returns {Object} Validation result with isValid and errors
 */
export function validateFollow(followerId, followingId) {
  const errors = [];

  if (!followerId || !followingId) {
    errors.push({
      field: 'user_ids',
      type: VALIDATION_ERRORS.REQUIRED_FIELD,
      message: 'Los IDs de usuario son requeridos'
    });
  }

  if (followerId === followingId) {
    errors.push({
      field: 'following_id',
      type: VALIDATION_ERRORS.SELF_REFERENCE,
      message: 'No puedes seguirte a ti mismo'
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Checks if user is within rate limits for posting
 * @param {Array} recentPosts - Array of recent posts by the user
 * @param {number} timeWindowMinutes - Time window in minutes (default: 5)
 * @param {number} maxPosts - Maximum posts allowed in time window (default: 5)
 * @returns {Object} Rate limit check result
 */
export function checkPostRateLimit(recentPosts, timeWindowMinutes = 5, maxPosts = 5) {
  const now = new Date();
  const timeWindow = timeWindowMinutes * 60 * 1000; // Convert to milliseconds
  
  const recentPostsInWindow = recentPosts.filter(post => {
    const postTime = new Date(post.created_at);
    return (now - postTime) < timeWindow;
  });

  const isWithinLimit = recentPostsInWindow.length < maxPosts;
  
  return {
    isWithinLimit,
    currentCount: recentPostsInWindow.length,
    maxAllowed: maxPosts,
    timeWindowMinutes,
    nextAllowedTime: isWithinLimit ? null : new Date(
      Math.min(...recentPostsInWindow.map(p => new Date(p.created_at))) + timeWindow
    )
  };
}

/**
 * Sanitizes content for safe display
 * @param {string} content - Content to sanitize
 * @returns {string} Sanitized content
 */
export function sanitizeContent(content) {
  if (!content) return '';
  
  // Remove potentially dangerous HTML attributes and scripts
  return content
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
}

/**
 * Validates and formats user input
 * @param {string} input - User input to validate
 * @param {Object} options - Validation options
 * @returns {Object} Validation result
 */
export function validateUserInput(input, options = {}) {
  const {
    required = false,
    minLength = 0,
    maxLength = Infinity,
    allowHtml = false,
    pattern = null
  } = options;

  const errors = [];

  if (required && (!input || input.trim().length === 0)) {
    errors.push({
      type: VALIDATION_ERRORS.REQUIRED_FIELD,
      message: 'Este campo es requerido'
    });
    return { isValid: false, errors, sanitized: '' };
  }

  if (!input) {
    return { isValid: true, errors: [], sanitized: '' };
  }

  const trimmed = input.trim();

  if (trimmed.length < minLength) {
    errors.push({
      type: VALIDATION_ERRORS.LENGTH_TOO_SHORT,
      message: `Debe tener al menos ${minLength} caracteres`
    });
  }

  if (trimmed.length > maxLength) {
    errors.push({
      type: VALIDATION_ERRORS.LENGTH_EXCEEDED,
      message: `No puede exceder ${maxLength} caracteres`
    });
  }

  if (pattern && !pattern.test(trimmed)) {
    errors.push({
      type: VALIDATION_ERRORS.INVALID_FORMAT,
      message: 'El formato no es válido'
    });
  }

  const sanitized = allowHtml ? sanitizeContent(trimmed) : trimmed;

  return {
    isValid: errors.length === 0,
    errors,
    sanitized
  };
}

export default {
  validateProfile,
  validateWork,
  validatePost,
  validateFollow,
  checkPostRateLimit,
  sanitizeContent,
  validateUserInput,
  VALIDATION_LIMITS,
  VALIDATION_ERRORS
};