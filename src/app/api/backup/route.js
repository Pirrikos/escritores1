/**
 * API para gestión de backups
 * Permite crear, listar y restaurar backups
 */

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { 
  createBackup, 
  restoreFromBackup, 
  listBackups, 
  getBackupStatistics 
} from '@/lib/backup';
import { 
  withErrorHandling, 
  createErrorResponse, 
  handleAuthError,
  ERROR_CODES 
} from '@/lib/errorHandler';

// Tablas permitidas para backup
const ALLOWED_TABLES = ['posts', 'profiles', 'follows', 'works'];

/**
 * GET - Obtener lista de backups o estadísticas
 */
export async function GET(request) {
  return withErrorHandling(async () => {
    const supabase = createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const table = searchParams.get('table');

    // Verificar autenticación y permisos de admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return handleAuthError(authError || new Error('No autenticado'));
    }

    // Verificar rol de administrador
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return createErrorResponse(
        'Acceso denegado',
        403,
        ERROR_CODES.FORBIDDEN,
        { requiredRole: 'admin', userRole: profile?.role }
      );
    }

    switch (action) {
      case 'statistics':
        const stats = getBackupStatistics();
        return NextResponse.json({
          success: true,
          data: stats
        });

      case 'list':
      default:
        const backups = listBackups(table);
        return NextResponse.json({
          success: true,
          data: {
            backups,
            total: backups.length,
            tables: ALLOWED_TABLES
          }
        });
    }
  });
}

/**
 * POST - Crear backup o restaurar desde backup
 */
export async function POST(request) {
  return withErrorHandling(async () => {
    const supabase = createServerSupabaseClient();
    
    // Verificar autenticación y permisos de admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return handleAuthError(authError || new Error('No autenticado'));
    }

    // Verificar rol de administrador
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return createErrorResponse(
        'Acceso denegado',
        403,
        ERROR_CODES.FORBIDDEN,
        { requiredRole: 'admin', userRole: profile?.role }
      );
    }

    const body = await request.json();
    const { action, table, timestamp, options = {} } = body;

    // Validar tabla
    if (table && !ALLOWED_TABLES.includes(table)) {
      return createErrorResponse(
        'Tabla no permitida',
        400,
        ERROR_CODES.VALIDATION_ERROR,
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
            'Tabla requerida para crear backup',
            400,
            ERROR_CODES.VALIDATION_ERROR
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
            'Error en backup completo',
            500,
            ERROR_CODES.BACKUP_FAILED,
            { error: error.message }
          );
        }

      case 'restore':
        if (!table || !timestamp) {
          return createErrorResponse(
            'Tabla y timestamp requeridos para restaurar',
            400,
            ERROR_CODES.VALIDATION_ERROR,
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
            `Error restaurando ${table}`,
            500,
            ERROR_CODES.RESTORE_FAILED,
            { 
              table,
              timestamp,
              error: error.message
            }
          );
        }

      default:
        return createErrorResponse(
          'Acción no válida',
          400,
          ERROR_CODES.VALIDATION_ERROR,
          { 
            allowedActions: ['create', 'create_all', 'restore'],
            providedAction: action
          }
        );
    }
  });
}

/**
 * DELETE - Eliminar backups antiguos (limpieza manual)
 */
export async function DELETE(request) {
  return withErrorHandling(async () => {
    const supabase = createServerSupabaseClient();
    
    // Verificar autenticación y permisos de admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return handleAuthError(authError || new Error('No autenticado'));
    }

    // Verificar rol de administrador
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return createErrorResponse(
        'Acceso denegado',
        403,
        ERROR_CODES.FORBIDDEN,
        { requiredRole: 'admin', userRole: profile?.role }
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
  });
}