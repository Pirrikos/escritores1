"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { useErrorMonitoring } from "@/lib/monitoring";
import { Button } from "@/components/ui";

export default function MonitoringPage() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const { getStats, clearCache } = useErrorMonitoring();
  
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [monitoringData, setMonitoringData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadMonitoringData();
      // Auto-refresh cada 30 segundos
      const interval = setInterval(loadMonitoringData, 30000);
      return () => clearInterval(interval);
    }
  }, [isAdmin]);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);

      if (!session) {
        router.push('/');
        return;
      }

      // Verificar si es admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (profile?.role === 'admin') {
        setIsAdmin(true);
      } else {
        router.push('/');
      }
    } catch (error) {
      console.error('Error verificando autenticación:', error);
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const loadMonitoringData = async () => {
    if (!isAdmin) return;
    
    setRefreshing(true);
    try {
      const response = await fetch('/api/monitoring/errors');
      if (response.ok) {
        const data = await response.json();
        setMonitoringData(data.data);
        setLastRefresh(new Date());
      } else {
        console.error('Error cargando datos de monitoreo');
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleClearCache = async () => {
    try {
      const response = await fetch('/api/monitoring/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_cache' })
      });

      if (response.ok) {
        clearCache(); // Limpiar cache local también
        await loadMonitoringData(); // Recargar datos
        alert('Cache de errores limpiado exitosamente');
      } else {
        alert('Error al limpiar cache');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al limpiar cache');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy': return '#28a745';
      case 'warning': return '#ffc107';
      case 'critical': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'low': return '#28a745';
      case 'medium': return '#ffc107';
      case 'high': return '#fd7e14';
      case 'critical': return '#dc3545';
      default: return '#6c757d';
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Cargando...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Acceso denegado</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Dashboard de Monitoreo</h1>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {lastRefresh && (
            <span style={{ fontSize: '12px', color: '#666' }}>
              Última actualización: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <Button 
            onClick={loadMonitoringData} 
            disabled={refreshing}
            size="sm"
          >
            {refreshing ? 'Actualizando...' : 'Actualizar'}
          </Button>
          <Button 
            onClick={handleClearCache}
            variant="outline"
            size="sm"
          >
            Limpiar Cache
          </Button>
        </div>
      </div>

      {monitoringData ? (
        <div style={{ display: 'grid', gap: '20px' }}>
          {/* Estado del Sistema */}
          <div style={{ 
            padding: '20px', 
            border: '1px solid #ddd', 
            borderRadius: '8px',
            backgroundColor: '#f8f9fa'
          }}>
            <h2 style={{ margin: '0 0 15px 0' }}>Estado del Sistema</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
              <div>
                <strong>Estado:</strong>
                <span style={{ 
                  marginLeft: '10px', 
                  padding: '4px 8px', 
                  borderRadius: '4px',
                  backgroundColor: getStatusColor(monitoringData.systemHealth.status),
                  color: 'white',
                  fontSize: '12px'
                }}>
                  {monitoringData.systemHealth.status.toUpperCase()}
                </span>
              </div>
              <div>
                <strong>Uptime:</strong> {Math.floor(monitoringData.systemHealth.uptime / 3600)}h {Math.floor((monitoringData.systemHealth.uptime % 3600) / 60)}m
              </div>
              <div>
                <strong>Memoria:</strong> {Math.round(monitoringData.systemHealth.memoryUsage.used / 1024 / 1024)}MB
              </div>
            </div>
          </div>

          {/* Estadísticas de Errores */}
          <div style={{ 
            padding: '20px', 
            border: '1px solid #ddd', 
            borderRadius: '8px' 
          }}>
            <h2 style={{ margin: '0 0 15px 0' }}>Estadísticas de Errores</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px' }}>
              <div style={{ textAlign: 'center', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#007bff' }}>
                  {monitoringData.statistics.total}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>Total</div>
              </div>
              <div style={{ textAlign: 'center', padding: '10px', backgroundColor: '#fff3cd', borderRadius: '4px' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#856404' }}>
                  {monitoringData.statistics.lastHour}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>Última Hora</div>
              </div>
              <div style={{ textAlign: 'center', padding: '10px', backgroundColor: '#d1ecf1', borderRadius: '4px' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0c5460' }}>
                  {monitoringData.statistics.lastDay}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>Último Día</div>
              </div>
            </div>
          </div>

          {/* Errores por Tipo */}
          {Object.keys(monitoringData.statistics.byType).length > 0 && (
            <div style={{ 
              padding: '20px', 
              border: '1px solid #ddd', 
              borderRadius: '8px' 
            }}>
              <h2 style={{ margin: '0 0 15px 0' }}>Errores por Tipo</h2>
              <div style={{ display: 'grid', gap: '10px' }}>
                {Object.entries(monitoringData.statistics.byType).map(([type, count]) => (
                  <div key={type} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    padding: '8px 12px',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '4px'
                  }}>
                    <span>{type.replace(/_/g, ' ').toUpperCase()}</span>
                    <span style={{ fontWeight: 'bold' }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Errores por Severidad */}
          {Object.keys(monitoringData.statistics.bySeverity).length > 0 && (
            <div style={{ 
              padding: '20px', 
              border: '1px solid #ddd', 
              borderRadius: '8px' 
            }}>
              <h2 style={{ margin: '0 0 15px 0' }}>Errores por Severidad</h2>
              <div style={{ display: 'grid', gap: '10px' }}>
                {Object.entries(monitoringData.statistics.bySeverity).map(([severity, count]) => (
                  <div key={severity} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    padding: '8px 12px',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '4px'
                  }}>
                    <span style={{ color: getPriorityColor(severity) }}>
                      {severity.toUpperCase()}
                    </span>
                    <span style={{ fontWeight: 'bold' }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recomendaciones */}
          <div style={{ 
            padding: '20px', 
            border: '1px solid #ddd', 
            borderRadius: '8px' 
          }}>
            <h2 style={{ margin: '0 0 15px 0' }}>Recomendaciones</h2>
            <div style={{ display: 'grid', gap: '10px' }}>
              {monitoringData.recommendations.map((rec, index) => (
                <div key={index} style={{ 
                  padding: '12px',
                  border: `1px solid ${getPriorityColor(rec.priority)}`,
                  borderRadius: '4px',
                  backgroundColor: `${getPriorityColor(rec.priority)}10`
                }}>
                  <div style={{ 
                    fontWeight: 'bold', 
                    color: getPriorityColor(rec.priority),
                    marginBottom: '5px'
                  }}>
                    {rec.priority.toUpperCase()}: {rec.message}
                  </div>
                  <div style={{ fontSize: '14px', color: '#666' }}>
                    {rec.action}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Errores Recientes */}
          {monitoringData.statistics.recentErrors.length > 0 && (
            <div style={{ 
              padding: '20px', 
              border: '1px solid #ddd', 
              borderRadius: '8px' 
            }}>
              <h2 style={{ margin: '0 0 15px 0' }}>Errores Recientes</h2>
              <div style={{ display: 'grid', gap: '10px' }}>
                {monitoringData.statistics.recentErrors.map((error, index) => (
                  <div key={index} style={{ 
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '12px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span style={{ fontWeight: 'bold' }}>{error.type}</span>
                      <span style={{ color: getPriorityColor(error.severity) }}>
                        {error.severity}
                      </span>
                    </div>
                    <div style={{ color: '#666' }}>
                      {new Date(error.timestamp).toLocaleString()}
                    </div>
                    {error.details?.message && (
                      <div style={{ marginTop: '5px', fontFamily: 'monospace' }}>
                        {error.details.message}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>Cargando datos de monitoreo...</p>
        </div>
      )}
    </div>
  );
}