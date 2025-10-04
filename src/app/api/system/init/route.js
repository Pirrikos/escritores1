/**
 * API para inicialización y gestión del sistema de backup
 * Permite a los administradores controlar el estado del sistema de backup
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { ensureAdmin } from '../../../lib/adminAuth.server';
import { 
  safeInitializeBackup, 
  safeStopBackup, 
  restartBackupSystem,
  getBackupSystemStatus 
} from '../../../lib/backupInitializer';
import { 
  withErrorHandling, 
  createErrorResponse, 
  handleAuthError,
  ERROR_CODES 
} from '../../../lib/errorHandler';

/**
 * GET - Obtener estado del sistema de backup
 */
export async function GET(request) {
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
  })(request);
}

/**
 * POST - Controlar el sistema de backup (iniciar, detener, reiniciar)
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
              ERROR_CODES.INTERNAL_ERROR,
              'Error inicializando sistema de backup',
              { 
                reason: result.reason,
                details: result
              }
            );
          }
        } catch (error) {
          return createErrorResponse(
            ERROR_CODES.INTERNAL_ERROR,
            'Error crítico inicializando backup',
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
            ERROR_CODES.INTERNAL_ERROR,
            'Error deteniendo sistema de backup',
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
              ERROR_CODES.INTERNAL_ERROR,
              'Error reiniciando sistema de backup',
              { 
                error: result.error,
                details: result
              }
            );
          }
        } catch (error) {
          return createErrorResponse(
            ERROR_CODES.INTERNAL_ERROR,
            'Error crítico reiniciando backup',
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
          ERROR_CODES.VALIDATION_ERROR,
          'Acción no válida',
          { 
            allowedActions: ['start', 'initialize', 'stop', 'restart', 'status'],
            providedAction: action
          }
        );
    }
  })(request);
}