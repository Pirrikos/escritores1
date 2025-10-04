/**
 * Inicializador del Sistema de Backup
 * Configura e inicia el sistema de backup automático de manera segura
 */

import { initializeBackupSystem, stopBackupSystem } from './backup';
import { getValidatedEnv, assertBackupEnv } from './env';
import { logCriticalError, CRITICAL_ERROR_TYPES, SEVERITY_LEVELS } from './monitoring';

// Estado del sistema de backup
let backupSystemInitialized = false;
let initializationPromise = null;

/**
 * Inicializa el sistema de backup de manera segura
 * Evita múltiples inicializaciones simultáneas
 */
export async function safeInitializeBackup() {
  // Si ya está inicializado, no hacer nada
  if (backupSystemInitialized) {
    console.log('✅ Sistema de backup ya inicializado');
    return { success: true, alreadyInitialized: true };
  }

  // Si hay una inicialización en progreso, esperar a que termine
  if (initializationPromise) {
    console.log('⏳ Esperando inicialización de backup en progreso...');
    return await initializationPromise;
  }

  // Crear promesa de inicialización
  initializationPromise = performBackupInitialization();
  
  try {
    const result = await initializationPromise;
    return result;
  } finally {
    initializationPromise = null;
  }
}

/**
 * Realiza la inicialización real del sistema de backup
 */
async function performBackupInitialization() {
  console.log('🚀 Iniciando sistema de backup...');
  
  try {
    // Verificar que estamos en el entorno correcto
    if (typeof window !== 'undefined') {
      console.log('⚠️ Sistema de backup no se ejecuta en el cliente');
      return { success: false, reason: 'client_environment' };
    }

    // Validar variables de entorno con Zod
    try {
      getValidatedEnv();
      assertBackupEnv();
    } catch (envError) {
      console.error('❌ Error de entorno:', envError.message);
      await logCriticalError(CRITICAL_ERROR_TYPES.SYSTEM_FAILURE, {
        message: 'Fallo en inicialización de backup por variables de entorno',
        error: envError.message,
        component: 'backup_initializer'
      }, SEVERITY_LEVELS.HIGH);
      return { success: false, reason: 'missing_or_invalid_env', error: envError.message };
    }

    // Inicializar el sistema de backup
    initializeBackupSystem();
    
    // Marcar como inicializado
    backupSystemInitialized = true;
    
    console.log('✅ Sistema de backup inicializado exitosamente');
    
    return { 
      success: true, 
      timestamp: new Date().toISOString(),
      environment: 'server'
    };
    
  } catch (error) {
    console.error('❌ Error inicializando sistema de backup:', error);
    
    await logCriticalError(CRITICAL_ERROR_TYPES.SYSTEM_FAILURE, {
      message: 'Fallo crítico en inicialización de backup',
      error: error.message,
      stack: error.stack,
      component: 'backup_initializer'
    }, SEVERITY_LEVELS.CRITICAL);
    
    return { 
      success: false, 
      reason: 'initialization_error',
      error: error.message 
    };
  }
}

/**
 * Detiene el sistema de backup de manera segura
 */
export async function safeStopBackup() {
  if (!backupSystemInitialized) {
    console.log('ℹ️ Sistema de backup no estaba inicializado');
    return { success: true, wasRunning: false };
  }

  try {
    console.log('🛑 Deteniendo sistema de backup...');
    
    stopBackupSystem();
    backupSystemInitialized = false;
    
    console.log('✅ Sistema de backup detenido exitosamente');
    
    return { 
      success: true, 
      wasRunning: true,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ Error deteniendo sistema de backup:', error);
    
    await logCriticalError(CRITICAL_ERROR_TYPES.SYSTEM_FAILURE, {
      message: 'Error deteniendo sistema de backup',
      error: error.message,
      stack: error.stack,
      component: 'backup_initializer'
    }, SEVERITY_LEVELS.MEDIUM);
    
    return { 
      success: false, 
      error: error.message 
    };
  }
}

/**
 * Verifica el estado del sistema de backup
 */
export function getBackupSystemStatus() {
  return {
    initialized: backupSystemInitialized,
    initializing: initializationPromise !== null,
    environment: typeof window === 'undefined' ? 'server' : 'client',
    timestamp: new Date().toISOString()
  };
}

/**
 * Reinicia el sistema de backup
 */
export async function restartBackupSystem() {
  console.log('🔄 Reiniciando sistema de backup...');
  
  try {
    // Detener si está corriendo
    await safeStopBackup();
    
    // Esperar un momento antes de reiniciar
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Inicializar nuevamente
    const result = await safeInitializeBackup();
    
    if (result.success) {
      console.log('✅ Sistema de backup reiniciado exitosamente');
    } else {
      console.error('❌ Error reiniciando sistema de backup:', result);
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Error en reinicio de sistema de backup:', error);
    
    await logCriticalError(CRITICAL_ERROR_TYPES.SYSTEM_FAILURE, {
      message: 'Error en reinicio de sistema de backup',
      error: error.message,
      stack: error.stack,
      component: 'backup_initializer'
    }, SEVERITY_LEVELS.HIGH);
    
    return { 
      success: false, 
      error: error.message 
    };
  }
}

/**
 * Hook para inicialización automática en el arranque del servidor
 * Se ejecuta automáticamente cuando se importa este módulo en el servidor
 */
if (typeof window === 'undefined' && process.env.NODE_ENV !== 'test') {
  // Inicializar después de un breve delay para permitir que otros sistemas se configuren
  setTimeout(() => {
    safeInitializeBackup().then(result => {
      if (result.success) {
        console.log('🎯 Sistema de backup auto-inicializado');
      } else {
        console.warn('⚠️ Fallo en auto-inicialización de backup:', result.reason);
      }
    }).catch(error => {
      console.error('💥 Error crítico en auto-inicialización de backup:', error);
    });
  }, 5000); // 5 segundos de delay
}

// Manejar cierre graceful del proceso
if (typeof process !== 'undefined') {
  const gracefulShutdown = async (signal) => {
    console.log(`📡 Recibida señal ${signal}, cerrando sistema de backup...`);
    
    try {
      await safeStopBackup();
      console.log('✅ Sistema de backup cerrado correctamente');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error en cierre graceful:', error);
      process.exit(1);
    }
  };

  // Registrar manejadores de señales
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  
  // Manejar errores no capturados
  process.on('uncaughtException', async (error) => {
    console.error('💥 Excepción no capturada:', error);
    
    try {
      await logCriticalError(CRITICAL_ERROR_TYPES.SYSTEM_FAILURE, {
        message: 'Excepción no capturada en sistema de backup',
        error: error.message,
        stack: error.stack,
        component: 'backup_initializer'
      }, SEVERITY_LEVELS.CRITICAL);
    } catch (logError) {
      console.error('Error logging critical error:', logError);
    }
    
    await safeStopBackup();
    process.exit(1);
  });
  
  process.on('unhandledRejection', async (reason, promise) => {
    console.error('💥 Promesa rechazada no manejada:', reason);
    
    try {
      await logCriticalError(CRITICAL_ERROR_TYPES.SYSTEM_FAILURE, {
        message: 'Promesa rechazada no manejada en sistema de backup',
        reason: reason?.toString(),
        component: 'backup_initializer'
      }, SEVERITY_LEVELS.HIGH);
    } catch (logError) {
      console.error('Error logging critical error:', logError);
    }
  });
}