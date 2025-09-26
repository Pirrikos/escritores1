/**
 * API para inicialización y gestión del sistema de backup
 * Permite a los administradores controlar el estado del sistema de backup
 */

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { 
  safeInitializeBackup, 
  safeStopBackup, 
  restartBackupSystem,
  getBackupSystemStatus 
} from '@/lib/backupInitializer';
import { 
  withErrorHandling, 
  createErrorResponse, 
  handleAuthError,
  ERROR_CODES 
} from '@/lib/errorHandler';

/**
 * GET - Obtener estado del sistema de backup
 */
export async function GET(request) {
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

    // Obtener estado del sistema
    const status = getBackupSystemStatus();
    
    return NextResponse.json({
      success: true,
      data: {
        ...status,
        message: status.initialized 
          ? 'Sistema de backup funcionando correctamente'
          : status.initializing 
            ? 'Sistema de backup inicializándose...'
            : 'Sistema de backup detenido'
      }
    });
  });
}

/**
 * POST - Controlar el sistema de backup (iniciar, detener, reiniciar)
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
    const { action } = body;

    switch (action) {
      case 'start':
      case 'initialize':
        try {
          const result = await safeInitializeBackup();
          
          if (result.success) {
            return NextResponse.json({
              success: true,
              message: result.alreadyInitialized 
                ? 'Sistema de backup ya estaba inicializado'
                : 'Sistema de backup inicializado exitosamente',
              data: result
            });
          } else {
            return createErrorResponse(
              'Error inicializando sistema de backup',
              500,
              ERROR_CODES.SYSTEM_ERROR,
              { 
                reason: result.reason,
                details: result
              }
            );
          }
        } catch (error) {
          return createErrorResponse(
            'Error crítico inicializando backup',
            500,
            ERROR_CODES.SYSTEM_ERROR,
            { error: error.message }
          );
        }

      case 'stop':
        try {
          const result = await safeStopBackup();
          
          return NextResponse.json({
            success: true,
            message: result.wasRunning 
              ? 'Sistema de backup detenido exitosamente'
              : 'Sistema de backup no estaba ejecutándose',
            data: result
          });
        } catch (error) {
          return createErrorResponse(
            'Error deteniendo sistema de backup',
            500,
            ERROR_CODES.SYSTEM_ERROR,
            { error: error.message }
          );
        }

      case 'restart':
        try {
          const result = await restartBackupSystem();
          
          if (result.success) {
            return NextResponse.json({
              success: true,
              message: 'Sistema de backup reiniciado exitosamente',
              data: result
            });
          } else {
            return createErrorResponse(
              'Error reiniciando sistema de backup',
              500,
              ERROR_CODES.SYSTEM_ERROR,
              { 
                error: result.error,
                details: result
              }
            );
          }
        } catch (error) {
          return createErrorResponse(
            'Error crítico reiniciando backup',
            500,
            ERROR_CODES.SYSTEM_ERROR,
            { error: error.message }
          );
        }

      case 'status':
        const status = getBackupSystemStatus();
        return NextResponse.json({
          success: true,
          data: status
        });

      default:
        return createErrorResponse(
          'Acción no válida',
          400,
          ERROR_CODES.VALIDATION_ERROR,
          { 
            allowedActions: ['start', 'initialize', 'stop', 'restart', 'status'],
            providedAction: action
          }
        );
    }
  });
}