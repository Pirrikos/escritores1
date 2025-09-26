# API Versioning System

## Overview

The API versioning system provides backward compatibility and smooth API evolution for the application. It supports multiple versioning strategies and automatic deprecation management.

## Supported Versions

- **v1**: Current stable version (default)
- **v2**: Planned future version

## Version Specification

You can specify the API version using any of these methods:

### 1. Header-based (Recommended)
```http
API-Version: v1
# or
X-API-Version: v1
```

### 2. URL Path-based
```
/api/v1/posts
/api/v1/users
```

### 3. Query Parameter
```
/api/posts?version=v1
/api/posts?api_version=v1
```

## Version Features

### Version 1 (v1)
- Status: Stable
- Features:
  - Basic CRUD operations
  - Authentication system
  - File upload functionality
  - Search capabilities
- Response format: snake_case fields for backward compatibility

### Version 2 (v2) - Planned
- Status: In development
- Features:
  - Enhanced search with filters
  - Real-time updates
  - Advanced analytics
  - Improved response metadata
- Response format: camelCase fields with enhanced metadata

## Response Format

### Version 1 Response
```json
{
  "success": true,
  "data": {
    "user_id": 123,
    "user_name": "john_doe",
    "created_at": "2025-01-26T10:00:00Z"
  },
  "version": "v1",
  "timestamp": "2025-01-26T10:00:00Z"
}
```

### Version 2 Response (Future)
```json
{
  "success": true,
  "data": {
    "userId": 123,
    "userName": "john_doe",
    "createdAt": "2025-01-26T10:00:00Z"
  },
  "meta": {
    "version": "v2",
    "timestamp": "2025-01-26T10:00:00Z",
    "request_id": "req_1234567890_abc123"
  },
  "version": "v2"
}
```

## Deprecation Handling

When a version is deprecated, the API will:

1. Add deprecation headers to responses:
   ```http
   Deprecation: 2025-06-01
   Sunset: 2025-12-01
   Link: </docs/migration/v1-to-v2>; rel="migration-guide"
   ```

2. Include warnings in response body:
   ```json
   {
     "success": true,
     "data": {...},
     "warnings": [{
       "type": "deprecation",
       "message": "API version v1 is deprecated. Please migrate to v2.",
       "sunset_date": "2025-12-01",
       "migration_guide": "/docs/migration/v1-to-v2"
     }]
   }
   ```

3. Log usage for monitoring and analytics

## Error Responses

### Unsupported Version
```json
{
  "error": "Unsupported API version",
  "code": "UNSUPPORTED_VERSION",
  "requested_version": "v3",
  "supported_versions": ["v1", "v2"],
  "latest_version": "v1"
}
```

### Version Not Implemented
```json
{
  "error": "Version not implemented",
  "code": "VERSION_NOT_IMPLEMENTED",
  "version": "v2",
  "available_versions": ["v1"]
}
```

## Implementation Examples

### Basic Versioned Endpoint
```javascript
import { createVersionedResponse, extractApiVersion } from '../../../lib/apiVersioning.js';

export async function GET(request) {
  const version = extractApiVersion(request);
  const data = await fetchData();
  
  return NextResponse.json(
    createVersionedResponse(data, version, request)
  );
}
```

### Multi-Version Handler
```javascript
import { createVersionedHandler } from '../../../lib/apiVersioning.js';

const handlers = {
  v1: async (req, res) => {
    // v1 implementation
    return handleV1Request(req, res);
  },
  v2: async (req, res) => {
    // v2 implementation
    return handleV2Request(req, res);
  }
};

export const GET = createVersionedHandler(handlers);
```

### Version Middleware
```javascript
import { versionMiddleware } from '../../../lib/apiVersioning.js';

// Support only specific versions
const middleware = versionMiddleware(['v1', 'v2']);

export async function GET(request) {
  // Version is validated and available in request.apiVersion
  const version = request.apiVersion;
  // ... handle request
}
```

## Migration Guide

### From v1 to v2

#### Breaking Changes
1. **Response Format**: Field names changed from snake_case to camelCase
   - `user_id` → `userId`
   - `created_at` → `createdAt`

2. **Metadata**: Enhanced response metadata structure
   - Added `meta` object with request tracking
   - Moved version info to `meta.version`

#### Migration Steps
1. Update client code to handle camelCase fields
2. Update response parsing to use new metadata structure
3. Test with both versions during transition period
4. Update API version headers to v2

## Best Practices

1. **Always specify version**: Don't rely on default version
2. **Monitor deprecation warnings**: Plan migrations early
3. **Test with multiple versions**: Ensure compatibility
4. **Use semantic versioning**: Follow clear versioning strategy
5. **Document breaking changes**: Maintain clear migration guides

## Security Considerations

- Version information is logged for security monitoring
- Deprecated version usage is tracked and alerted
- Unsupported versions are rejected with appropriate errors
- Version validation happens at middleware level

## Monitoring and Analytics

The system automatically tracks:
- Version usage statistics
- Deprecation warning frequency
- Migration patterns
- Error rates per version

This data helps inform deprecation timelines and migration strategies.