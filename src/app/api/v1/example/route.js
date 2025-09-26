/**
 * Example API endpoint demonstrating versioning system
 * Version: v1
 */

import { NextResponse } from 'next/server';
import { 
  createVersionedResponse, 
  versionMiddleware,
  API_VERSIONS 
} from '../../../lib/apiVersioning.js';
import { errorHandler } from '../../../lib/errorHandler.js';

// This endpoint supports v1 only
const SUPPORTED_VERSIONS = [API_VERSIONS.V1];

export async function GET(request) {
  try {
    // Extract version from request
    const url = new URL(request.url);
    const version = url.pathname.includes('/v1/') ? 'v1' : API_VERSIONS.LATEST;
    
    // Validate version support
    if (!SUPPORTED_VERSIONS.includes(version)) {
      return NextResponse.json({
        error: 'Unsupported API version for this endpoint',
        code: 'UNSUPPORTED_VERSION',
        supported_versions: SUPPORTED_VERSIONS
      }, { status: 400 });
    }
    
    // Example data
    const exampleData = {
      message: 'Hello from versioned API',
      features: ['authentication', 'rate_limiting', 'versioning'],
      endpoints: [
        '/api/v1/posts',
        '/api/v1/users',
        '/api/v1/auth'
      ],
      timestamp: new Date().toISOString()
    };
    
    // Create versioned response
    const response = createVersionedResponse(exampleData, version, request);
    
    return NextResponse.json(response, {
      status: 200,
      headers: {
        'API-Version': version,
        'API-Supported-Versions': SUPPORTED_VERSIONS.join(', ')
      }
    });
    
  } catch (error) {
    return errorHandler.handleError(error, 'API_EXAMPLE_ERROR');
  }
}

export async function POST(request) {
  try {
    const url = new URL(request.url);
    const version = url.pathname.includes('/v1/') ? 'v1' : API_VERSIONS.LATEST;
    
    if (!SUPPORTED_VERSIONS.includes(version)) {
      return NextResponse.json({
        error: 'Unsupported API version for this endpoint',
        code: 'UNSUPPORTED_VERSION',
        supported_versions: SUPPORTED_VERSIONS
      }, { status: 400 });
    }
    
    const body = await request.json();
    
    // Example processing
    const processedData = {
      received: body,
      processed_at: new Date().toISOString(),
      version: version,
      status: 'success'
    };
    
    const response = createVersionedResponse(processedData, version, request);
    
    return NextResponse.json(response, {
      status: 201,
      headers: {
        'API-Version': version,
        'API-Supported-Versions': SUPPORTED_VERSIONS.join(', ')
      }
    });
    
  } catch (error) {
    return errorHandler.handleError(error, 'API_EXAMPLE_POST_ERROR');
  }
}