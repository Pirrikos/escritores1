'use client';

import { useState, useEffect } from 'react';
import { createClientSupabaseClient } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/Button';

export default function BackupManagement() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [backups, setBackups] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [selectedTable, setSelectedTable] = useState('');
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreOptions, setRestoreOptions] = useState({
    dryRun: true,
    clearExisting: false
  });
  const [message, setMessage] = useState({ type: '', text: '' });

  const TABLES = ['posts', 'profiles', 'follows', 'works'];

  useEffect(() => {
    checkAuth();
    loadData();
  }, []);

  const checkAuth = async () => {
    try {
      const supabase = createClientSupabaseClient();
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        window.location.href = '/admin';
        return;
      }

      // Verificar rol de admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!profile || profile.role !== 'admin') {
        window.location.href = '/';
        return;
      }

      setUser(user);
    } catch (error) {
      console.error('Error verificando autenticación:', error);
      window.location.href = '/admin';
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    try {
      await Promise.all([
        loadBackups(),
        loadStatistics()
      ]);
    } catch (error) {
      console.error('Error cargando datos:', error);
      showMessage('error', 'Error cargando datos de backup');
    }
  };

  const loadBackups = async () => {
    try {
      const response = await fetch('/api/backup?action=list');
      const result = await response.json();
      
      if (result.success) {
        setBackups(result.data.backups);
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Error cargando backups:', error);
      showMessage('error', 'Error cargando lista de backups');
    }
  };

  const loadStatistics = async () => {
    try {
      const response = await fetch('/api/backup?action=statistics');
      const result = await response.json();
      
      if (result.success) {
        setStatistics(result.data);
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
      showMessage('error', 'Error cargando estadísticas');
    }
  };

  const createBackup = async (table = null) => {
    setIsCreatingBackup(true);
    try {
      const action = table ? 'create' : 'create_all';
      const body = { action };
      if (table) body.table = table;

      const response = await fetch('/api/backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
      });

      const result = await response.json();
      
      if (result.success) {
        showMessage('success', result.message);
        await loadData();
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Error creando backup:', error);
      showMessage('error', `Error creando backup: ${error.message}`);
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const initiateRestore = (backup) => {
    setSelectedBackup(backup);
    setShowRestoreModal(true);
    setRestoreOptions({ dryRun: true, clearExisting: false });
  };

  const executeRestore = async () => {
    if (!selectedBackup) return;

    setIsRestoring(true);
    try {
      const response = await fetch('/api/backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'restore',
          table: selectedBackup.table,
          timestamp: selectedBackup.timestamp,
          options: restoreOptions
        })
      });

      const result = await response.json();
      
      if (result.success) {
        showMessage('success', result.message);
        if (!restoreOptions.dryRun) {
          await loadData();
          setShowRestoreModal(false);
        }
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Error restaurando:', error);
      showMessage('error', `Error en restauración: ${error.message}`);
    } finally {
      setIsRestoring(false);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('es-ES');
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando panel de backups...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Gestión de Backups</h1>
          <p className="mt-2 text-gray-600">
            Administra los backups automáticos y restauración de datos
          </p>
        </div>

        {/* Mensaje de estado */}
        {message.text && (
          <div className={`mb-6 p-4 rounded-md ${
            message.type === 'success' 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Estadísticas */}
        {statistics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900">Total Backups</h3>
              <p className="text-3xl font-bold text-blue-600">{statistics.totalBackups}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900">Último Backup</h3>
              <p className="text-sm text-gray-600">
                {statistics.newestBackup ? formatDate(statistics.newestBackup) : 'N/A'}
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900">Backup Más Antiguo</h3>
              <p className="text-sm text-gray-600">
                {statistics.oldestBackup ? formatDate(statistics.oldestBackup) : 'N/A'}
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900">Tablas con Backup</h3>
              <p className="text-3xl font-bold text-green-600">
                {Object.keys(statistics.byTable).length}
              </p>
            </div>
          </div>
        )}

        {/* Controles de backup */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Crear Backups</h2>
          </div>
          <div className="p-6">
            <div className="flex flex-wrap gap-4">
              <Button
                onClick={() => createBackup()}
                disabled={isCreatingBackup}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isCreatingBackup ? 'Creando...' : 'Backup Completo'}
              </Button>
              
              {TABLES.map(table => (
                <Button
                  key={table}
                  onClick={() => createBackup(table)}
                  disabled={isCreatingBackup}
                  variant="outline"
                >
                  Backup {table}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Lista de backups */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Backups Disponibles</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tabla
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Registros
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Checksum
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {backups.map((backup, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {backup.table}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(backup.timestamp)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {backup.recordCount?.toLocaleString() || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                      {backup.checksum?.substring(0, 8) || 'N/A'}...
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Button
                        onClick={() => initiateRestore(backup)}
                        variant="outline"
                        size="sm"
                        className="text-green-600 hover:text-green-700"
                      >
                        Restaurar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {backups.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">No hay backups disponibles</p>
                <p className="text-sm text-gray-400 mt-2">
                  Crea tu primer backup usando los botones de arriba
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Modal de restauración */}
        {showRestoreModal && selectedBackup && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Restaurar Backup
                </h3>
                
                <div className="mb-4">
                  <p className="text-sm text-gray-600">
                    <strong>Tabla:</strong> {selectedBackup.table}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Fecha:</strong> {formatDate(selectedBackup.timestamp)}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Registros:</strong> {selectedBackup.recordCount}
                  </p>
                </div>

                <div className="mb-4 space-y-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={restoreOptions.dryRun}
                      onChange={(e) => setRestoreOptions(prev => ({
                        ...prev,
                        dryRun: e.target.checked
                      }))}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">
                      Vista previa (no restaurar realmente)
                    </span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={restoreOptions.clearExisting}
                      onChange={(e) => setRestoreOptions(prev => ({
                        ...prev,
                        clearExisting: e.target.checked
                      }))}
                      disabled={restoreOptions.dryRun}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">
                      Limpiar datos existentes antes de restaurar
                    </span>
                  </label>
                </div>

                <div className="flex justify-end space-x-3">
                  <Button
                    onClick={() => setShowRestoreModal(false)}
                    variant="outline"
                    disabled={isRestoring}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={executeRestore}
                    disabled={isRestoring}
                    className={restoreOptions.dryRun ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}
                  >
                    {isRestoring ? 'Procesando...' : (restoreOptions.dryRun ? 'Vista Previa' : 'Restaurar')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}