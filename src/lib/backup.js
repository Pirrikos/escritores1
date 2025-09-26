/**
 * Sistema de Backup Automático y Recuperación de Datos
 * Proporciona funcionalidades para crear backups automáticos y recuperar datos
 */

import { createServerSupabaseClient } from './supabaseServer';
import { logCriticalError, CRITICAL_ERROR_TYPES, SEVERITY_LEVELS } from './monitoring';

// Configuración de backup
const BACKUP_CONFIG = {
  // Intervalos de backup (en milisegundos)
  intervals: {
    posts: 6 * 60 * 60 * 1000,      // 6 horas
    profiles: 24 * 60 * 60 * 1000,   // 24 horas
    follows: 12 * 60 * 60 * 1000,    // 12 horas
    works: 24 * 60 * 60 * 1000       // 24 horas
  },
  
  // Retención de backups (en días)
  retention: {
    daily: 7,    // 7 días de backups diarios
    weekly: 4,   // 4 semanas de backups semanales
    monthly: 12  // 12 meses de backups mensuales
  },
  
  // Límites de datos por backup
  limits: {
    maxRecordsPerBatch: 1000,
    maxBackupSizeMB: 50
  }
};

// Cache para controlar intervalos de backup
let backupTimers = new Map();
let lastBackupTimes = new Map();

/**
 * Inicia el sistema de backup automático
 */
export function initializeBackupSystem() {
  console.log('🔄 Iniciando sistema de backup automático...');
  
  // Programar backups para cada tabla
  Object.entries(BACKUP_CONFIG.intervals).forEach(([table, interval]) => {
    scheduleBackup(table, interval);
  });
  
  // Limpiar backups antiguos cada día
  scheduleCleanup();
  
  console.log('✅ Sistema de backup inicializado');
}

/**
 * Programa un backup automático para una tabla
 */
function scheduleBackup(tableName, interval) {
  // Limpiar timer existente si existe
  if (backupTimers.has(tableName)) {
    clearInterval(backupTimers.get(tableName));
  }
  
  // Crear nuevo timer
  const timer = setInterval(async () => {
    try {
      await createBackup(tableName);
    } catch (error) {
      console.error(`Error en backup automático de ${tableName}:`, error);
      await logCriticalError(CRITICAL_ERROR_TYPES.DATA_CORRUPTION, {
        message: `Fallo en backup automático de ${tableName}`,
        table: tableName,
        error: error.message
      }, SEVERITY_LEVELS.HIGH);
    }
  }, interval);
  
  backupTimers.set(tableName, timer);
  
  // Ejecutar backup inicial después de 1 minuto
  setTimeout(() => createBackup(tableName), 60000);
}

/**
 * Crea un backup de una tabla específica
 */
export async function createBackup(tableName, options = {}) {
  const startTime = Date.now();
  console.log(`📦 Iniciando backup de ${tableName}...`);
  
  try {
    const supabase = createServerSupabaseClient();
    
    // Verificar si es necesario hacer backup
    const lastBackup = lastBackupTimes.get(tableName);
    const minInterval = BACKUP_CONFIG.intervals[tableName] || 60000;
    
    if (lastBackup && (Date.now() - lastBackup) < minInterval && !options.force) {
      console.log(`⏭️ Backup de ${tableName} omitido (muy reciente)`);
      return { success: true, skipped: true };
    }
    
    // Obtener datos de la tabla
    const { data, error, count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(BACKUP_CONFIG.limits.maxRecordsPerBatch);
    
    if (error) {
      throw new Error(`Error consultando ${tableName}: ${error.message}`);
    }
    
    if (!data || data.length === 0) {
      console.log(`📭 No hay datos para backup en ${tableName}`);
      return { success: true, empty: true };
    }
    
    // Crear estructura del backup
    const backupData = {
      metadata: {
        table: tableName,
        timestamp: new Date().toISOString(),
        recordCount: data.length,
        totalRecords: count,
        version: '1.0',
        checksum: generateChecksum(data)
      },
      data: data
    };
    
    // Verificar tamaño del backup
    const backupSize = JSON.stringify(backupData).length / (1024 * 1024); // MB
    if (backupSize > BACKUP_CONFIG.limits.maxBackupSizeMB) {
      throw new Error(`Backup de ${tableName} excede el límite de tamaño (${backupSize.toFixed(2)}MB)`);
    }
    
    // Guardar backup (por ahora en localStorage para desarrollo)
    await saveBackup(tableName, backupData);
    
    // Actualizar tiempo del último backup
    lastBackupTimes.set(tableName, Date.now());
    
    const duration = Date.now() - startTime;
    console.log(`✅ Backup de ${tableName} completado en ${duration}ms (${data.length} registros)`);
    
    return {
      success: true,
      table: tableName,
      recordCount: data.length,
      size: backupSize,
      duration,
      timestamp: backupData.metadata.timestamp
    };
    
  } catch (error) {
    console.error(`❌ Error en backup de ${tableName}:`, error);
    
    await logCriticalError(CRITICAL_ERROR_TYPES.DATA_CORRUPTION, {
      message: `Fallo en backup de ${tableName}`,
      table: tableName,
      error: error.message,
      stack: error.stack
    }, SEVERITY_LEVELS.HIGH);
    
    throw error;
  }
}

/**
 * Guarda un backup (implementación para desarrollo con localStorage)
 */
async function saveBackup(tableName, backupData) {
  try {
    // En producción, esto se guardaría en un servicio de almacenamiento externo
    // como AWS S3, Google Cloud Storage, etc.
    
    const backupKey = `backup_${tableName}_${Date.now()}`;
    
    if (typeof window !== 'undefined') {
      // Cliente: usar localStorage
      localStorage.setItem(backupKey, JSON.stringify(backupData));
    } else {
      // Servidor: simular guardado (en producción sería un servicio externo)
      console.log(`💾 Backup guardado: ${backupKey} (${backupData.data.length} registros)`);
    }
    
    // Mantener registro de backups
    const backupRegistry = getBackupRegistry();
    backupRegistry.push({
      key: backupKey,
      table: tableName,
      timestamp: backupData.metadata.timestamp,
      recordCount: backupData.metadata.recordCount,
      checksum: backupData.metadata.checksum
    });
    
    saveBackupRegistry(backupRegistry);
    
  } catch (error) {
    throw new Error(`Error guardando backup: ${error.message}`);
  }
}

/**
 * Recupera datos desde un backup
 */
export async function restoreFromBackup(tableName, backupTimestamp, options = {}) {
  console.log(`🔄 Iniciando restauración de ${tableName} desde ${backupTimestamp}...`);
  
  try {
    // Buscar el backup
    const backup = await findBackup(tableName, backupTimestamp);
    if (!backup) {
      throw new Error(`Backup no encontrado para ${tableName} en ${backupTimestamp}`);
    }
    
    // Validar integridad del backup
    const isValid = validateBackup(backup);
    if (!isValid) {
      throw new Error(`Backup corrupto para ${tableName}`);
    }
    
    if (options.dryRun) {
      console.log(`🔍 Dry run: Se restaurarían ${backup.data.length} registros`);
      return {
        success: true,
        dryRun: true,
        recordCount: backup.data.length,
        preview: backup.data.slice(0, 5) // Mostrar primeros 5 registros
      };
    }
    
    // Realizar restauración
    const supabase = createServerSupabaseClient();
    
    // Opcionalmente limpiar tabla existente
    if (options.clearExisting) {
      console.log(`🗑️ Limpiando tabla ${tableName}...`);
      const { error: deleteError } = await supabase
        .from(tableName)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Eliminar todos excepto un ID imposible
      
      if (deleteError) {
        throw new Error(`Error limpiando tabla: ${deleteError.message}`);
      }
    }
    
    // Insertar datos del backup en lotes
    const batchSize = 100;
    let insertedCount = 0;
    
    for (let i = 0; i < backup.data.length; i += batchSize) {
      const batch = backup.data.slice(i, i + batchSize);
      
      const { error: insertError } = await supabase
        .from(tableName)
        .insert(batch);
      
      if (insertError) {
        throw new Error(`Error insertando lote ${i / batchSize + 1}: ${insertError.message}`);
      }
      
      insertedCount += batch.length;
      console.log(`📥 Insertados ${insertedCount}/${backup.data.length} registros`);
    }
    
    console.log(`✅ Restauración completada: ${insertedCount} registros restaurados`);
    
    return {
      success: true,
      table: tableName,
      recordCount: insertedCount,
      timestamp: backup.metadata.timestamp
    };
    
  } catch (error) {
    console.error(`❌ Error en restauración:`, error);
    
    await logCriticalError(CRITICAL_ERROR_TYPES.DATA_CORRUPTION, {
      message: `Fallo en restauración de ${tableName}`,
      table: tableName,
      backupTimestamp,
      error: error.message
    }, SEVERITY_LEVELS.CRITICAL);
    
    throw error;
  }
}

/**
 * Lista backups disponibles
 */
export function listBackups(tableName = null) {
  const registry = getBackupRegistry();
  
  let backups = registry;
  if (tableName) {
    backups = registry.filter(backup => backup.table === tableName);
  }
  
  return backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

/**
 * Busca un backup específico
 */
async function findBackup(tableName, timestamp) {
  try {
    const registry = getBackupRegistry();
    const backupEntry = registry.find(entry => 
      entry.table === tableName && entry.timestamp === timestamp
    );
    
    if (!backupEntry) {
      return null;
    }
    
    // Cargar datos del backup
    if (typeof window !== 'undefined') {
      const backupData = localStorage.getItem(backupEntry.key);
      return backupData ? JSON.parse(backupData) : null;
    } else {
      // En servidor, simular carga
      console.log(`📂 Cargando backup: ${backupEntry.key}`);
      return null; // En producción cargaría desde servicio externo
    }
    
  } catch (error) {
    console.error('Error buscando backup:', error);
    return null;
  }
}

/**
 * Valida la integridad de un backup
 */
function validateBackup(backup) {
  try {
    if (!backup || !backup.metadata || !backup.data) {
      return false;
    }
    
    // Verificar checksum
    const calculatedChecksum = generateChecksum(backup.data);
    if (calculatedChecksum !== backup.metadata.checksum) {
      console.error('Checksum no coincide');
      return false;
    }
    
    // Verificar estructura básica
    if (backup.data.length !== backup.metadata.recordCount) {
      console.error('Conteo de registros no coincide');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error validando backup:', error);
    return false;
  }
}

/**
 * Genera checksum para validación de integridad
 */
function generateChecksum(data) {
  const str = JSON.stringify(data);
  let hash = 0;
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convertir a 32-bit integer
  }
  
  return hash.toString(36);
}

/**
 * Obtiene el registro de backups
 */
function getBackupRegistry() {
  try {
    if (typeof window !== 'undefined') {
      const registry = localStorage.getItem('backup_registry');
      return registry ? JSON.parse(registry) : [];
    }
    return []; // En servidor retornar vacío por ahora
  } catch (error) {
    console.error('Error obteniendo registro de backups:', error);
    return [];
  }
}

/**
 * Guarda el registro de backups
 */
function saveBackupRegistry(registry) {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem('backup_registry', JSON.stringify(registry));
    }
  } catch (error) {
    console.error('Error guardando registro de backups:', error);
  }
}

/**
 * Programa limpieza de backups antiguos
 */
function scheduleCleanup() {
  // Limpiar backups antiguos cada 24 horas
  setInterval(async () => {
    try {
      await cleanupOldBackups();
    } catch (error) {
      console.error('Error en limpieza de backups:', error);
    }
  }, 24 * 60 * 60 * 1000);
  
  // Ejecutar limpieza inicial después de 5 minutos
  setTimeout(() => cleanupOldBackups(), 5 * 60 * 1000);
}

/**
 * Limpia backups antiguos según la política de retención
 */
async function cleanupOldBackups() {
  console.log('🧹 Iniciando limpieza de backups antiguos...');
  
  try {
    const registry = getBackupRegistry();
    const now = new Date();
    const toDelete = [];
    
    registry.forEach(backup => {
      const backupDate = new Date(backup.timestamp);
      const daysDiff = Math.floor((now - backupDate) / (1000 * 60 * 60 * 24));
      
      // Aplicar política de retención
      let shouldDelete = false;
      
      if (daysDiff > BACKUP_CONFIG.retention.monthly * 30) {
        shouldDelete = true; // Más de 12 meses
      } else if (daysDiff > BACKUP_CONFIG.retention.weekly * 7) {
        // Mantener solo backups semanales (domingos)
        if (backupDate.getDay() !== 0) {
          shouldDelete = true;
        }
      } else if (daysDiff > BACKUP_CONFIG.retention.daily) {
        // Mantener solo backups diarios
        if (backupDate.getHours() !== 0) {
          shouldDelete = true;
        }
      }
      
      if (shouldDelete) {
        toDelete.push(backup);
      }
    });
    
    // Eliminar backups antiguos
    if (toDelete.length > 0) {
      toDelete.forEach(backup => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(backup.key);
        }
      });
      
      // Actualizar registro
      const updatedRegistry = registry.filter(backup => 
        !toDelete.some(deleted => deleted.key === backup.key)
      );
      saveBackupRegistry(updatedRegistry);
      
      console.log(`🗑️ Eliminados ${toDelete.length} backups antiguos`);
    } else {
      console.log('✅ No hay backups antiguos para eliminar');
    }
    
  } catch (error) {
    console.error('Error en limpieza de backups:', error);
  }
}

/**
 * Detiene el sistema de backup
 */
export function stopBackupSystem() {
  console.log('🛑 Deteniendo sistema de backup...');
  
  // Limpiar todos los timers
  backupTimers.forEach((timer, tableName) => {
    clearInterval(timer);
    console.log(`⏹️ Timer de backup detenido para ${tableName}`);
  });
  
  backupTimers.clear();
  console.log('✅ Sistema de backup detenido');
}

/**
 * Obtiene estadísticas del sistema de backup
 */
export function getBackupStatistics() {
  const registry = getBackupRegistry();
  const now = new Date();
  
  const stats = {
    totalBackups: registry.length,
    byTable: {},
    lastBackups: {},
    totalSize: 0,
    oldestBackup: null,
    newestBackup: null
  };
  
  registry.forEach(backup => {
    // Contar por tabla
    stats.byTable[backup.table] = (stats.byTable[backup.table] || 0) + 1;
    
    // Último backup por tabla
    const backupDate = new Date(backup.timestamp);
    if (!stats.lastBackups[backup.table] || backupDate > new Date(stats.lastBackups[backup.table])) {
      stats.lastBackups[backup.table] = backup.timestamp;
    }
    
    // Backup más antiguo y más nuevo
    if (!stats.oldestBackup || backupDate < new Date(stats.oldestBackup)) {
      stats.oldestBackup = backup.timestamp;
    }
    if (!stats.newestBackup || backupDate > new Date(stats.newestBackup)) {
      stats.newestBackup = backup.timestamp;
    }
  });
  
  return stats;
}