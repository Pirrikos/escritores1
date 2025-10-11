/**
 * API Versioning System
 * Provides backward compatibility and smooth API evolution
 */

import securityLogger from './securityLogger.js';
import * as monitoring from './monitoring.js';

// Supported API versions
export const API_VERSIONS = {
  V1: 'v1',
  V2: 'v2', // Future version
  LATEST: 'v1' // Current latest version
};

// Version deprecation information
export const VERSION_INFO = {
  v1: {
    status: 'stable',
    introduced: '2025-01-26',
    deprecated: null,
    sunset: null,
    features: ['basic_crud', 'authentication', 'file_upload', 'search']
  },
  v2: {
    status: 'planned',
    introduced: null,
    deprecated: null,
    sunset: null,
    features: ['enhanced_search', 'real_time_updates', 'advanced_analytics']
  }
};

// Breaking changes between versions
export const BREAKING_CHANGES = {
  'v1-to-v2': [
    {
      endpoint: '/api/posts',
      change: 'Response format updated to include metadata',
      migration: 'Use response.data instead of direct response'
    },
    {
      endpoint: '/api/users/profile',
      change: 'Field name changed from user_id to userId',
      migration: 'Update field references in client code'
    }
  ]
};

/**
 * Extract API version from request
 */
export function extractApiVersion(request) {
  // Check version in header (preferred method)
  const headerVersion = request.headers.get('API-Version') || 
                       request.headers.get('X-API-Version');
  
  if (headerVersion) {
    return normalizeVersion(headerVersion);
  }
  
  // Check version in URL path
  const url = new URL(request.url);
  const pathMatch = url.pathname.match(/^\/api\/(v\d+)\//);
  
  if (pathMatch) {
    return normalizeVersion(pathMatch[1]);
  }
  
  // Check version in query parameter
  const queryVersion = url.searchParams.get('version') || 
                      url.searchParams.get('api_version');
  
  if (queryVersion) {
    return normalizeVersion(queryVersion);
  }
  
  // Default to latest version
  return API_VERSIONS.LATEST;
}

/**
 * Normalize version string
 */
function normalizeVersion(version) {
  if (!version) return API_VERSIONS.LATEST;
  
  // Handle different version formats
  const normalized = version.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // Map common formats
  const versionMap = {
    '1': 'v1',
    '1.0': 'v1',
    'v1': 'v1',
    'v10': 'v1',
    '2': 'v2',
    '2.0': 'v2',
    'v2': 'v2',
    'v20': 'v2',
    'latest': API_VERSIONS.LATEST
  };
  
  return versionMap[normalized] || API_VERSIONS.LATEST;
}

/**
 * Validate if version is supported
 */
export function isVersionSupported(version) {
  return Object.values(API_VERSIONS).includes(version);
}

/**
 * Check if version is deprecated
 */
export function isVersionDeprecated(version) {
  const versionInfo = VERSION_INFO[version];
  return versionInfo && versionInfo.deprecated !== null;
}

/**
 * Get version deprecation info
 */
export function getDeprecationInfo(version) {
  const versionInfo = VERSION_INFO[version];
  if (!versionInfo || !versionInfo.deprecated) {
    return null;
  }
  
  return {
    deprecated: versionInfo.deprecated,
    sunset: versionInfo.sunset,
    message: `API version ${version} is deprecated. Please migrate to ${API_VERSIONS.LATEST}.`,
    migrationGuide: `/docs/migration/${version}-to-${API_VERSIONS.LATEST}`
  };
}

/**
 * Version-aware response wrapper
 */
export function createVersionedResponse(data, version, request = null) {
  const baseResponse = {
    success: true,
    data,
    version,
    timestamp: new Date().toISOString()
  };
  
  // Add deprecation warnings if needed
  const deprecationInfo = getDeprecationInfo(version);
  if (deprecationInfo) {
    baseResponse.warnings = [{
      type: 'deprecation',
      message: deprecationInfo.message,
      sunset_date: deprecationInfo.sunset,
      migration_guide: deprecationInfo.migrationGuide
    }];
    
    // Log deprecation usage
    securityLogger.logSecurityEvent('API_DEPRECATION_USAGE', 'INFO', {
      version,
      endpoint: request?.url,
      userAgent: request?.headers?.get('user-agent'),
      deprecationInfo
    });
  }
  
  // Transform data based on version
  return transformResponseForVersion(baseResponse, version);
}

/**
 * Transform response data based on API version
 */
function transformResponseForVersion(response, version) {
  switch (version) {
    case 'v1':
      return transformV1Response(response);
    case 'v2':
      return transformV2Response(response);
    default:
      return response;
  }
}

/**
 * Transform response for v1 API
 */
function transformV1Response(response) {
  // V1 specific transformations
  if (response.data && Array.isArray(response.data)) {
    // V1 expects simple array format for lists
    return {
      ...response,
      data: response.data.map(item => {
        // Convert camelCase to snake_case for v1 compatibility
        return convertKeysToSnakeCase(item);
      })
    };
  }
  
  if (response.data && typeof response.data === 'object') {
    return {
      ...response,
      data: convertKeysToSnakeCase(response.data)
    };
  }
  
  return response;
}

/**
 * Transform response for v2 API (future)
 */
function transformV2Response(response) {
  // V2 specific transformations
  return {
    ...response,
    meta: {
      version: response.version,
      timestamp: response.timestamp,
      request_id: generateRequestId()
    },
    data: response.data
  };
}

/**
 * Convert object keys to snake_case
 */
function convertKeysToSnakeCase(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(convertKeysToSnakeCase);
  }
  
  const converted = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    converted[snakeKey] = convertKeysToSnakeCase(value);
  }
  
  return converted;
}

/**
 * Generate unique request ID
 */
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Version middleware for API routes
 */
export function versionMiddleware(supportedVersions = [API_VERSIONS.LATEST]) {
  return (req, res, next) => {
    const requestedVersion = extractApiVersion(req);
    
    // Check if version is supported
    if (!supportedVersions.includes(requestedVersion)) {
      securityLogger.logSecurityEvent('UNSUPPORTED_API_VERSION', 'WARNING', {
        requestedVersion,
        supportedVersions,
        endpoint: req.url,
        userAgent: req.headers['user-agent']
      });
      
      return res.status(400).json({
        error: 'Unsupported API version',
        code: 'UNSUPPORTED_VERSION',
        requested_version: requestedVersion,
        supported_versions: supportedVersions,
        latest_version: API_VERSIONS.LATEST
      });
    }
    
    // Add version info to request
    req.apiVersion = requestedVersion;
    req.versionInfo = VERSION_INFO[requestedVersion];
    
    // Add version headers to response
    res.setHeader('API-Version', requestedVersion);
    res.setHeader('API-Supported-Versions', supportedVersions.join(', '));
    
    // Add deprecation headers if needed
    const deprecationInfo = getDeprecationInfo(requestedVersion);
    if (deprecationInfo) {
      res.setHeader('Deprecation', deprecationInfo.deprecated);
      if (deprecationInfo.sunset) {
        res.setHeader('Sunset', deprecationInfo.sunset);
      }
      res.setHeader('Link', `<${deprecationInfo.migrationGuide}>; rel="migration-guide"`);
    }
    
    next();
  };
}

/**
 * Create versioned API handler
 */
export function createVersionedHandler(handlers) {
  return async (req, res) => {
    const version = req.apiVersion || extractApiVersion(req);
    const handler = handlers[version] || handlers[API_VERSIONS.LATEST];
    
    if (!handler) {
      return res.status(501).json({
        error: 'Version not implemented',
        code: 'VERSION_NOT_IMPLEMENTED',
        version,
        available_versions: Object.keys(handlers)
      });
    }
    
    try {
      const result = await handler(req, res);
      
      // Log version usage for analytics
      monitoring.logCriticalError('API_VERSION_USAGE', 'Version usage tracking', {
        version,
        endpoint: req.url,
        method: req.method,
        success: true
      });
      
      return result;
    } catch (error) {
      // Log version-specific errors
      monitoring.logCriticalError('API_VERSION_ERROR', error.message, {
        version,
        endpoint: req.url,
        method: req.method,
        error: error.stack
      });
      
      throw error;
    }
  };
}

/**
 * Get migration information between versions
 */
export function getMigrationInfo(fromVersion, toVersion) {
  const changeKey = `${fromVersion}-to-${toVersion}`;
  return BREAKING_CHANGES[changeKey] || [];
}

/**
 * Check if migration is needed
 */
export function needsMigration(currentVersion, targetVersion) {
  return currentVersion !== targetVersion && 
         getMigrationInfo(currentVersion, targetVersion).length > 0;
}

const apiVersioning = {
  API_VERSIONS,
  VERSION_INFO,
  extractApiVersion,
  isVersionSupported,
  isVersionDeprecated,
  getDeprecationInfo,
  createVersionedResponse,
  versionMiddleware,
  createVersionedHandler,
  getMigrationInfo,
  needsMigration
};

export default apiVersioning;