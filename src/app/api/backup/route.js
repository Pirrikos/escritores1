/**
 * API para gestión de backups
 * Permite crear, listar y restaurar backups
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { ensureAdmin } from '@/lib/adminAuth.server.js';
import { 
  createBackup, 
  restoreFromBackup, 
  listBackups, 
  getBackupStatistics 
} from '@/lib/backup.js';
import { 
  withErrorHandling, 
  createErrorResponse, 
  handleAuthError,
  ERROR_CODES 
} from '@/lib/errorHandler.js';
import productionLogger, { LOG_CATEGORIES } from '@/lib/productionLogger.js';
import { PerformanceTimer } from '@/lib/performanceMonitor.js';

// Tablas permitidas para backup
const ALLOWED_TABLES = ['posts', 'profiles', 'follows', 'works'];

/**
 * GET - Obtener lista de backups o estadísticas
 */
export async function GET(request) {
  return withErrorHandling(async () => {
    // Iniciar monitoreo de rendimiento
    const performanceTimer = new PerformanceTimer('api_backup_get', {
      method: 'GET',
      endpoint: '/api/backup',
      userAgent: request.headers.get('user-agent')
    });

    try {
      // Eliminar cliente supabase no utilizado para evitar warnings de lint
      const { searchParams } = new URL(request.url);
      const action = searchParams.get('action');
      const table = searchParams.get('table');

      productionLogger.info(LOG_CATEGORIES.API, 'Backup GET request started', {
        action,
        table,
        userAgent: request.headers.get('user-agent'),
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
      });

      // Autenticación y verificación de admin centralizada
      const admin = await ensureAdmin(request);
      if (!admin.ok) {
        if (admin.code === 'UNAUTHORIZED') {
          productionLogger.error(LOG_CATEGORIES.AUTH, 'Authentication failed in backup endpoint', {
            error: admin.error?.message,
            endpoint: '/api/backup'
          });
          return handleAuthError(admin.error || new Error('No autenticado'));
        }
        productionLogger.warn(LOG_CATEGORIES.SECURITY, 'Unauthorized backup access attempt', {
          userId: admin.user?.id,
          userRole: admin.profile?.role,
          requiredRole: 'admin'
        });
        return createErrorResponse(
          ERROR_CODES.FORBIDDEN,
          'Acceso denegado',
          { requiredRole: 'admin', userRole: admin.profile?.role }
        );
      }

      productionLogger.info(LOG_CATEGORIES.USER_ACTION, 'Admin backup access granted', {
        userId: admin.user.id,
        action: 'backup_access',
        requestedAction: action,
        table
      });

      switch (action) {
        case 'statistics':
          const stats = getBackupStatistics();
          productionLogger.info(LOG_CATEGORIES.SYSTEM, 'Backup statistics retrieved', {
            userId: admin.user.id,
            statsCount: Object.keys(stats).length
          });
          performanceTimer.end();
          return NextResponse.json({
            success: true,
            data: stats
          });

        case 'list':
        default:
          const backups = listBackups(table);
          productionLogger.info(LOG_CATEGORIES.SYSTEM, 'Backup list retrieved', {
            userId: admin.user.id,
            table,
            backupCount: backups.length
          });
          performanceTimer.end();
          return NextResponse.json({
            success: true,
            data: {
              backups,
              total: backups.length,
              tables: ALLOWED_TABLES
            }
          });
      }
    } catch (error) {
      performanceTimer.end();
      productionLogger.error(LOG_CATEGORIES.API, 'Unexpected error in backup GET endpoint', {
        error: error.message,
        stack: error.stack,
        endpoint: '/api/backup'
      });
      throw error;
    }
  })(request);
}

/**
 * POST - Crear backup o restaurar desde backup
 */
export async function POST(request) {
  return withErrorHandling(async () => {
    // Autenticación y verificación de admin centralizada
    const admin = await ensureAdmin(request);
    if (!admin.ok) {
      if (admin.code === 'UNAUTHORIZED') {
        return handleAuthError(admin.error || new Error('No autenticado'));
      }
      return createErrorResponse(
        ERROR_CODES.FORBIDDEN,
        'Acceso denegado',
        { requiredRole: 'admin', userRole: admin.profile?.role }
      );
    }

    const body = await request.json();
    const { action, table, timestamp, options = {} } = body;

    // Validar tabla
    if (table && !ALLOWED_TABLES.includes(table)) {
      return createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        'Tabla no permitida',
        {
          allowedTables: ALLOWED_TABLES,
          providedTable: table
        }
      );
    }

    switch (action) {
      case 'create':
        if (!table) {
          return createErrorResponse(
            ERROR_CODES.VALIDATION_ERROR,
            'Tabla requerida para crear backup'
          );
        }

        try {
          const result = await createBackup(table, { force: true, ...options });
          
          return NextResponse.json({
            success: true,
            message: `Backup de ${table} creado exitosamente`,
            data: result
          });
        } catch (error) {
          return createErrorResponse(
            `Error creando backup de ${table}`,
            500,
            ERROR_CODES.BACKUP_FAILED,
            { 
              table,
              error: error.message
            }
          );
        }

      case 'create_all':
        try {
          const results = [];
          
          for (const tableName of ALLOWED_TABLES) {
            try {
              const result = await createBackup(tableName, { force: true, ...options });
              results.push({
                table: tableName,
                success: true,
                ...result
              });
            } catch (error) {
              results.push({
                table: tableName,
                success: false,
                error: error.message
              });
            }
          }
          
          const successCount = results.filter(r => r.success).length;
          const failCount = results.length - successCount;
          
          return NextResponse.json({
            success: failCount === 0,
            message: `Backup completo: ${successCount} exitosos, ${failCount} fallidos`,
            data: {
              results,
              summary: {
                total: results.length,
                successful: successCount,
                failed: failCount
              }
            }
          });
        } catch (error) {
          return createErrorResponse(
            ERROR_CODES.BACKUP_FAILED,
            'Error en backup completo',
            { error: error.message }
          );
        }

      case 'restore':
        if (!table || !timestamp) {
          return createErrorResponse(
            ERROR_CODES.VALIDATION_ERROR,
            'Tabla y timestamp requeridos para restaurar',
            { required: ['table', 'timestamp'] }
          );
        }

        try {
          const result = await restoreFromBackup(table, timestamp, options);
          
          return NextResponse.json({
            success: true,
            message: options.dryRun 
              ? `Vista previa de restauración para ${table}`
              : `Datos de ${table} restaurados exitosamente`,
            data: result
          });
        } catch (error) {
          return createErrorResponse(
            ERROR_CODES.RESTORE_FAILED,
            `Error restaurando ${table}`,
            { 
              table,
              timestamp,
              error: error.message
            }
          );
        }

      default:
        return createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          'Acción no válida',
          { 
            allowedActions: ['create', 'create_all', 'restore'],
            providedAction: action
          }
        );
    }
  })(request);
}

/**
 * DELETE - Eliminar backups antiguos (limpieza manual)
 */
export async function DELETE(request) {
  return withErrorHandling(async () => {
    const admin = await ensureAdmin(request);
    if (!admin.ok) {
      if (admin.code === 'UNAUTHORIZED') {
        return handleAuthError(admin.error || new Error('No autenticado'));
      }
      return createErrorResponse(
        ERROR_CODES.FORBIDDEN,
        'Acceso denegado',
        { requiredRole: 'admin', userRole: admin.profile?.role }
      );
    }

    // Por ahora, solo retornar mensaje informativo
    // En una implementación completa, aquí se implementaría la limpieza manual
    return NextResponse.json({
      success: true,
      message: 'La limpieza automática está configurada. Use la interfaz de administración para gestión avanzada.',
      data: {
        note: 'La limpieza automática se ejecuta cada 24 horas',
        manualCleanup: 'Disponible en futuras versiones'
      }
    });
  })(request);
}