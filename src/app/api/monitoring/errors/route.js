import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { withErrorHandling, createErrorResponse, handleAuthError, ERROR_CODES } from '@/lib/errorHandler';
import { getErrorStatistics } from '@/lib/monitoring';

async function GET(request) {
  try {
    const supabase = createServerSupabaseClient();
    
    // Verificar autenticación de administrador
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session?.user) {
      return handleAuthError('Usuario no autenticado');
    }

    // Verificar si el usuario es administrador
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (profile?.role !== 'admin') {
      return createErrorResponse(
        ERROR_CODES.FORBIDDEN,
        'Acceso denegado: Se requieren permisos de administrador'
      );
    }

    // Obtener estadísticas de errores
    const stats = getErrorStatistics();
    
    // Obtener errores persistidos (si existen)
    let persistedErrors = [];
    try {
      // Aquí se podría consultar una tabla de errores en Supabase
      // Por ahora retornamos las estadísticas del cache en memoria
    } catch (error) {
      console.warn('No se pudieron obtener errores persistidos:', error);
    }

    return NextResponse.json({
      success: true,
      data: {
        statistics: stats,
        systemHealth: {
          status: stats.lastHour > 10 ? 'critical' : stats.lastHour > 5 ? 'warning' : 'healthy',
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          timestamp: new Date().toISOString()
        },
        recommendations: generateRecommendations(stats)
      }
    });

  } catch (error) {
    console.error('Error en endpoint de monitoreo:', error);
    return createErrorResponse(
      ERROR_CODES.INTERNAL_ERROR,
      'Error al obtener estadísticas de monitoreo'
    );
  }
}

async function POST(request) {
  try {
    const supabase = createServerSupabaseClient();
    
    // Verificar autenticación
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session?.user) {
      return handleAuthError('Usuario no autenticado');
    }

    const { action } = await request.json();

    if (action === 'clear_cache') {
      // Verificar permisos de administrador
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (profile?.role !== 'admin') {
        return createErrorResponse(
          ERROR_CODES.FORBIDDEN,
          'Acceso denegado: Se requieren permisos de administrador'
        );
      }

      // Limpiar cache de errores
      const { clearErrorCache } = await import('@/lib/monitoring');
      clearErrorCache();

      return NextResponse.json({
        success: true,
        message: 'Cache de errores limpiado exitosamente'
      });
    }

    return createErrorResponse(
      ERROR_CODES.BAD_REQUEST,
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

function generateRecommendations(stats) {
  const recommendations = [];

  if (stats.lastHour > 10) {
    recommendations.push({
      priority: 'high',
      message: 'Alto número de errores en la última hora',
      action: 'Revisar logs del sistema y verificar estado de servicios'
    });
  }

  if (stats.bySeverity?.critical > 0) {
    recommendations.push({
      priority: 'critical',
      message: 'Se detectaron errores críticos',
      action: 'Investigar inmediatamente y contactar al equipo de desarrollo'
    });
  }

  if (stats.byType?.database_connection > 0) {
    recommendations.push({
      priority: 'high',
      message: 'Problemas de conexión a la base de datos detectados',
      action: 'Verificar estado de Supabase y conexiones de red'
    });
  }

  if (stats.byType?.rate_limit_exceeded > 5) {
    recommendations.push({
      priority: 'medium',
      message: 'Múltiples violaciones de rate limiting',
      action: 'Considerar ajustar límites o implementar medidas anti-bot'
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      priority: 'low',
      message: 'Sistema funcionando correctamente',
      action: 'Continuar monitoreando'
    });
  }

  return recommendations;
}

export { GET, POST };
export default withErrorHandling(GET);