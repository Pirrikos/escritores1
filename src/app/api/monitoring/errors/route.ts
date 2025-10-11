import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withErrorHandling, createErrorResponse, handleAuthError, ERROR_CODES } from '@/lib/errorHandler.js';
import { getErrorStatistics, clearErrorCache } from '@/lib/monitoring.js';
import { ensureAdmin } from '@/lib/adminAuth.server.js';

async function getHandler(request: NextRequest): Promise<Response> {
  try {
    const admin = await ensureAdmin(request);
    if (!admin.ok) {
      if (admin.code === 'UNAUTHORIZED') {
        return handleAuthError(admin.error || new Error('Usuario no autenticado'));
      }
      return createErrorResponse(
        ERROR_CODES.FORBIDDEN,
        'Acceso denegado: Se requieren permisos de administrador'
      );
    }

    const stats = getErrorStatistics();

    try {
      // Placeholder para errores persistidos en futuro
    } catch (error) {
      console.warn('No se pudieron obtener errores persistidos:', error);
    }

    const recommendationsInput = {
      lastHour: stats.lastHour,
      bySeverity: (stats.bySeverity ?? {}) as Record<string, number>,
      byType: (stats.byType ?? {}) as Record<string, number>,
    };

    return NextResponse.json({
      success: true,
      data: {
        statistics: stats,
        systemHealth: {
          status: stats.lastHour > 10 ? 'critical' : stats.lastHour > 5 ? 'warning' : 'healthy',
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          timestamp: new Date().toISOString(),
        },
        recommendations: generateRecommendations(recommendationsInput),
      },
    });
  } catch (error) {
    console.error('Error en endpoint de monitoreo:', error);
    return createErrorResponse(
      ERROR_CODES.INTERNAL_ERROR,
      'Error al obtener estadísticas de monitoreo'
    );
  }
}

async function postHandler(request: NextRequest): Promise<Response> {
  try {
    const admin = await ensureAdmin(request);
    if (!admin.ok) {
      if (admin.code === 'UNAUTHORIZED') {
        return handleAuthError(admin.error || new Error('Usuario no autenticado'));
      }
      return createErrorResponse(
        ERROR_CODES.FORBIDDEN,
        'Acceso denegado: Se requieren permisos de administrador'
      );
    }

    const { action } = await request.json();

    if (action === 'clear_cache') {
      clearErrorCache();
      return NextResponse.json({
        success: true,
        message: 'Cache de errores limpiado exitosamente',
      });
    }

    return createErrorResponse(
      ERROR_CODES.INVALID_INPUT,
      'Acción no válida'
    );
  } catch (error) {
    console.error('Error en POST de monitoreo:', error);
    return createErrorResponse(
      ERROR_CODES.INTERNAL_ERROR,
      'Error al procesar solicitud de monitoreo'
    );
  }
}

function generateRecommendations(stats: {
  lastHour: number;
  bySeverity?: Record<string, number>;
  byType?: Record<string, number>;
}): Array<{ priority: 'low' | 'medium' | 'high' | 'critical'; message: string; action: string }> {
  const recommendations: Array<{ priority: 'low' | 'medium' | 'high' | 'critical'; message: string; action: string }> = [];

  if (stats.lastHour > 10) {
    recommendations.push({
      priority: 'high',
      message: 'Alto número de errores en la última hora',
      action: 'Revisar logs del sistema y verificar estado de servicios',
    });
  }

  if ((stats.bySeverity?.critical ?? 0) > 0) {
    recommendations.push({
      priority: 'critical',
      message: 'Se detectaron errores críticos',
      action: 'Investigar inmediatamente y contactar al equipo de desarrollo',
    });
  }

  if ((stats.byType || {})['database_connection'] > 0) {
    recommendations.push({
      priority: 'high',
      message: 'Problemas de conexión a la base de datos detectados',
      action: 'Verificar estado de Supabase y conexiones de red',
    });
  }

  if ((stats.byType || {})['rate_limit_exceeded'] > 5) {
    recommendations.push({
      priority: 'medium',
      message: 'Múltiples violaciones de rate limiting',
      action: 'Considerar ajustar límites o implementar medidas anti-bot',
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      priority: 'low',
      message: 'Sistema funcionando correctamente',
      action: 'Continuar monitoreando',
    });
  }

  return recommendations;
}

export async function GET(request: NextRequest): Promise<Response> {
  return withErrorHandling(getHandler)(request);
}

export async function POST(request: NextRequest): Promise<Response> {
  return withErrorHandling(postHandler)(request);
}