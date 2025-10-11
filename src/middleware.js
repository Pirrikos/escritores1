import { NextResponse } from 'next/server';
import { createIPRateLimiter } from './lib/rateLimiter.js';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

// Crear rate limiter global para protección DDoS
const globalIPRateLimiter = createIPRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minuto
  maxRequests: 100, // 100 requests por minuto por IP
  blockDuration: 10 * 60 * 1000 // Bloquear por 10 minutos
});

// Simplified middleware for production stability with Supabase Auth support
export async function middleware(request) {
  const { pathname } = request.nextUrl;
  
  // Aplicar rate limiting por IP a todas las rutas API
  if (pathname.startsWith('/api/')) {
    try {
      const ipLimitResult = await globalIPRateLimiter(request);
      if (!ipLimitResult.allowed) {
        return new NextResponse(
          JSON.stringify({
            error: 'Rate limit exceeded',
            message: ipLimitResult.reason,
            retryAfter: ipLimitResult.retryAfter
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': ipLimitResult.retryAfter.toString()
            }
          }
        );
      }
    } catch (error) {
      console.error('Error in IP rate limiting:', error);
      // Continue processing if rate limiting fails
    }
  }
  
  // Create response (necesario para Supabase auth en middleware)
  const response = NextResponse.next();

  // Protección de rutas: exigir sesión para páginas de usuario
  if (pathname.startsWith('/usuario/')) {
    try {
      const supabase = createMiddlewareClient({ req: request, res: response });
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const url = request.nextUrl.clone();
        url.pathname = '/auth/login';
        // preservar destino para volver después del login
        url.searchParams.set('next', `${pathname}${request.nextUrl.search || ''}`);
        return NextResponse.redirect(url);
      }
    } catch (error) {
      // Si falla la verificación de sesión, redirigir a login por seguridad
      const url = request.nextUrl.clone();
      url.pathname = '/auth/login';
      url.searchParams.set('next', `${pathname}${request.nextUrl.search || ''}`);
      return NextResponse.redirect(url);
    }
  }
  
  // Add essential security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // CORS headers for API routes with credentials support for Supabase
  if (pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin');
    const allowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://escritores1.vercel.app'
    ];
    
    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
    } else if (!origin) {
      response.headers.set('Access-Control-Allow-Origin', '*');
    }
    
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    
    // Add rate limit headers
    response.headers.set('X-RateLimit-Limit', '100');
    response.headers.set('X-RateLimit-Window', '60');
  }
  
  return response;
}

// Simple matcher configuration
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)$).*)',
  ],
};