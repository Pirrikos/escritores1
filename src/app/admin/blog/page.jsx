"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabaseClient";
import { AdminGuard } from "../../../lib/adminAuth";
import { default as AdminLayout } from "../../../components/admin/AdminLayout";
import { Button, Input, Textarea } from "@/components/ui";
import { Icon, Icons } from "@/components/ui";
import { sanitizeText, normalizeText } from '@/lib/sanitization';
import { 
  logAdminAction, 
  logSuspiciousActivity,
  createAuditTrail 
} from '@/lib/securityLogger';

// Constantes para mejorar legibilidad y mantenimiento
const PRIORIDADES_TAREA = {
  ALTA: 'high',
  MEDIA: 'medium',
  BAJA: 'low'
};

const ESTADOS_TAREA = {
  PENDIENTE: 'pending',
  COMPLETADA: 'completed'
};

// Componente para mostrar el estado de carga
const ComponenteCarga = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
      <p className="text-gray-600">Cargando blog personal...</p>
    </div>
  </div>
);

// Componente para el encabezado del blog
const EncabezadoBlog = ({ totalTareas }) => (
  <div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-200/60">
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Blog Personal</h1>
        <p className="text-slate-600">Gestiona tus tareas y notas personales</p>
      </div>
      <div className="flex items-center space-x-2 text-sm text-slate-500 bg-slate-100 px-4 py-2 rounded-full">
        <Icon path={Icons.check} size="sm" />
        <span>{totalTareas} tareas</span>
      </div>
    </div>
  </div>
);

// Utilidades para manejo de prioridades
const utilidadesPrioridad = {
  obtenerColorPrioridad: (prioridad) => {
    const colores = {
      [PRIORIDADES_TAREA.ALTA]: 'bg-red-100 text-red-800',
      [PRIORIDADES_TAREA.MEDIA]: 'bg-yellow-100 text-yellow-800',
      [PRIORIDADES_TAREA.BAJA]: 'bg-green-100 text-green-800'
    };
    return colores[prioridad] || 'bg-gray-100 text-gray-800';
  },

  obtenerTextoPrioridad: (prioridad) => {
    const textos = {
      [PRIORIDADES_TAREA.ALTA]: 'Alta',
      [PRIORIDADES_TAREA.MEDIA]: 'Media',
      [PRIORIDADES_TAREA.BAJA]: 'Baja'
    };
    return textos[prioridad] || 'Media';
  }
};

export default function AdminBlog() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [sesionUsuario, setSesionUsuario] = useState(null);
  const [cargandoDatos, setCargandoDatos] = useState(true);
  const [listaTareas, setListaTareas] = useState([]);
  const [nuevaTarea, setNuevaTarea] = useState({ 
    title: '', 
    description: '', 
    priority: PRIORIDADES_TAREA.MEDIA 
  });
  const [guardandoTarea, setGuardandoTarea] = useState(false);

  // Efecto para gestionar la autenticación del usuario
  useEffect(() => {
    inicializarSesionUsuario();
  }, [supabase]);

  // Efecto para cargar tareas cuando hay sesión activa
  useEffect(() => {
    if (sesionUsuario) {
      cargarListaTareas();
    }
  }, [sesionUsuario]);

  /**
   * Inicializa la sesión del usuario y configura el listener de cambios de autenticación
   */
  const inicializarSesionUsuario = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      setSesionUsuario(data.session || null);
      setCargandoDatos(false);

      // Configurar listener para cambios en la autenticación
      const { data: subscription } = supabase.auth.onAuthStateChange((_evento, sesion) => {
        setSesionUsuario(sesion);
      });

      return () => subscription.subscription.unsubscribe();
    } catch (error) {
      console.error('Error al inicializar sesión:', error);
      setCargandoDatos(false);
    }
  };

  /**
   * Carga la lista de tareas desde la base de datos
   */
  const cargarListaTareas = async () => {
    try {
      const { data: tareas, error } = await supabase
        .from('admin_tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error && error.code !== 'PGRST116') { // Ignorar error de tabla no encontrada
        console.error('Error al cargar tareas:', error);
      } else {
        setListaTareas(tareas || []);
      }
    } catch (error) {
      console.error('Error al cargar tareas:', error);
    }
  };

  /**
   * Valida los datos de una nueva tarea antes de crearla
   */
  const validarDatosNuevaTarea = (tarea) => {
    if (!tarea.title.trim()) {
      throw new Error('El título de la tarea es obligatorio');
    }
    
    if (tarea.title.length > 200) {
      throw new Error('El título no puede exceder 200 caracteres');
    }
    
    if (tarea.description.length > 1000) {
      throw new Error('La descripción no puede exceder 1000 caracteres');
    }
  };

  /**
   * Registra la acción de creación de tarea para auditoría
   */
  const registrarAccionCreacionTarea = (tituloTarea, prioridadTarea) => {
    logAdminAction(
      'create_admin_task',
      sesionUsuario.user.id,
      {
        title: tituloTarea.substring(0, 50),
        priority: prioridadTarea,
        userEmail: sesionUsuario.user.email
      }
    );
  };

  /**
   * Crea una nueva tarea en la base de datos
   */
  const crearNuevaTarea = async () => {
    if (!nuevaTarea.title.trim()) return;

    setGuardandoTarea(true);
    
    try {
      // Validar datos antes de procesar
      validarDatosNuevaTarea(nuevaTarea);
      
      // Sanitizar datos de entrada
      const tituloSanitizado = sanitizeText(nuevaTarea.title.trim());
      const descripcionSanitizada = sanitizeText(nuevaTarea.description.trim());
      
      // Registrar acción para auditoría
      registrarAccionCreacionTarea(tituloSanitizado, nuevaTarea.priority);
      
      const { data, error } = await supabase
        .from('admin_tasks')
        .insert([{
          title: tituloSanitizado,
          description: descripcionSanitizada,
          priority: nuevaTarea.priority,
          status: ESTADOS_TAREA.PENDIENTE,
          user_id: sesionUsuario.user.id
        }])
        .select();

      if (error) throw error;

      // Crear rastro de auditoría para tarea creada exitosamente
      createAuditTrail(
        sesionUsuario.user.id,
        'create_admin_task',
        'admin_tasks',
        {
          taskId: data[0].id,
          title: tituloSanitizado.substring(0, 50),
          priority: nuevaTarea.priority
        }
      );

      // Actualizar estado local
      setListaTareas([data[0], ...listaTareas]);
      setNuevaTarea({ 
        title: '', 
        description: '', 
        priority: PRIORIDADES_TAREA.MEDIA 
      });
      
    } catch (error) {
      console.error('Error al crear tarea:', error);
      
      // Registrar actividad sospechosa para monitoreo de seguridad
      logSuspiciousActivity(
        'Admin task creation failed',
        {
          error: error.message,
          userId: sesionUsuario.user.id,
          userEmail: sesionUsuario.user.email
        }
      );
      
      alert('Error al crear la tarea. Verifica que la tabla admin_tasks exista en Supabase.');
    } finally {
      setGuardandoTarea(false);
    }
  };

  /**
   * Alterna el estado de una tarea entre pendiente y completada
   */
  const alternarEstadoTarea = async (idTarea, estadoActual) => {
    const nuevoEstado = estadoActual === ESTADOS_TAREA.COMPLETADA 
      ? ESTADOS_TAREA.PENDIENTE 
      : ESTADOS_TAREA.COMPLETADA;
    
    try {
      const { error } = await supabase
        .from('admin_tasks')
        .update({ status: nuevoEstado })
        .eq('id', idTarea);

      if (error) throw error;

      // Actualizar estado local
      setListaTareas(listaTareas.map(tarea => 
        tarea.id === idTarea ? { ...tarea, status: nuevoEstado } : tarea
      ));
    } catch (error) {
      console.error('Error al actualizar tarea:', error);
    }
  };

  /**
   * Elimina una tarea después de confirmación del usuario
   */
  const eliminarTarea = async (idTarea) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta tarea?')) return;

    try {
      const { error } = await supabase
        .from('admin_tasks')
        .delete()
        .eq('id', idTarea);

      if (error) throw error;

      // Actualizar estado local
      setListaTareas(listaTareas.filter(tarea => tarea.id !== idTarea));
    } catch (error) {
      console.error('Error al eliminar tarea:', error);
    }
  };

  // Mostrar componente de carga mientras se inicializa
  if (cargandoDatos) {
    return <ComponenteCarga />;
  }

  return (
    <AdminGuard session={sesionUsuario}>
      <AdminLayout activeTab="blog">
        <div className="space-y-8">
          {/* Encabezado del blog */}
          <EncabezadoBlog totalTareas={listaTareas.length} />

          {/* Formulario para agregar nueva tarea */}
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-200/60">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Agregar Nueva Tarea</h2>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Título de la tarea
                  </label>
                  <Input
                    placeholder="Escribe el título de tu tarea..."
                    value={nuevaTarea.title}
                    onChange={(e) => setNuevaTarea({ ...nuevaTarea, title: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-0 transition-colors"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Prioridad
                  </label>
                  <select
                    value={nuevaTarea.priority}
                    onChange={(e) => setNuevaTarea({ ...nuevaTarea, priority: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-0 transition-colors bg-white"
                  >
                    <option value={PRIORIDADES_TAREA.BAJA}>🟢 Baja</option>
                    <option value={PRIORIDADES_TAREA.MEDIA}>🟡 Media</option>
                    <option value={PRIORIDADES_TAREA.ALTA}>🔴 Alta</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Descripción
                </label>
                <Textarea
                  placeholder="Describe los detalles de tu tarea..."
                  value={nuevaTarea.description}
                  onChange={(e) => setNuevaTarea({ ...nuevaTarea, description: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-0 transition-colors resize-none"
                />
              </div>
              
              <Button 
                onClick={crearNuevaTarea}
                disabled={!nuevaTarea.title.trim() || guardandoTarea}
                className="w-full md:w-auto bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
              >
                {guardandoTarea ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Agregando...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Icon path={Icons.plus} size="md" />
                    <span>Agregar Tarea</span>
                  </div>
                )}
              </Button>
            </div>
          </div>

          {/* Lista de tareas */}
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-200/60">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900">Mis Tareas</h2>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-slate-500">
                  {listaTareas.filter(t => t.status === ESTADOS_TAREA.PENDIENTE).length} pendientes
                </span>
                <span className="text-sm text-slate-500">
                  {listaTareas.filter(t => t.status === ESTADOS_TAREA.COMPLETADA).length} completadas
                </span>
              </div>
            </div>

            {listaTareas.length > 0 ? (
              <div className="space-y-4">
                {listaTareas.map((tarea) => (
                  <div 
                    key={tarea.id} 
                    className={`p-6 rounded-xl border-2 transition-all duration-300 ${
                      tarea.status === ESTADOS_TAREA.COMPLETADA 
                        ? 'bg-gradient-to-r from-emerald-50 to-teal-50/50 border-emerald-200/60' 
                        : 'bg-gradient-to-r from-slate-50 to-slate-100/50 border-slate-200/60 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <button
                            onClick={() => alternarEstadoTarea(tarea.id, tarea.status)}
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                              tarea.status === ESTADOS_TAREA.COMPLETADA
                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                : 'border-slate-300 hover:border-emerald-400'
                            }`}
                          >
                            {tarea.status === ESTADOS_TAREA.COMPLETADA && (
                              <Icon path={Icons.check} size="sm" />
                            )}
                          </button>
                          
                          <h3 className={`text-lg font-semibold ${
                            tarea.status === ESTADOS_TAREA.COMPLETADA ? 'text-slate-500 line-through' : 'text-slate-900'
                          }`}>
                            {tarea.title}
                          </h3>
                          
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            utilidadesPrioridad.obtenerColorPrioridad(tarea.priority)
                          } border`}>
                            {tarea.priority === PRIORIDADES_TAREA.ALTA ? '🔴 Alta' : 
                             tarea.priority === PRIORIDADES_TAREA.MEDIA ? '🟡 Media' : '🟢 Baja'}
                          </span>
                        </div>
                        
                        {tarea.description && (
                          <p className={`text-sm mb-3 ${
                            tarea.status === ESTADOS_TAREA.COMPLETADA 
                              ? 'text-slate-400' 
                              : 'text-slate-600'
                          }`}>
                            {tarea.description}
                          </p>
                        )}
                        
                        <p className="text-xs text-slate-500">
                          Creada: {new Date(tarea.created_at).toLocaleDateString('es-ES', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      
                      <button
                        onClick={() => eliminarTarea(tarea.id)}
                        className="ml-4 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                      >
                        <Icon path={Icons.trash} size="sm" className="text-red-600" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Icon path={Icons.check} size="lg" className="text-slate-400" />
                </div>
                <h3 className="text-2xl font-semibold text-slate-900 mb-3">No hay tareas aún</h3>
                <p className="text-slate-600 mb-8">¡Crea tu primera tarea para comenzar a organizarte!</p>
              </div>
            )}
          </div>

          {/* Instrucciones para Supabase */}
          {listaTareas.length === 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-2">📋 Configuración requerida</h3>
              <p className="text-sm text-blue-700 mb-2">
                Para usar las tareas, necesitas crear la tabla <code>admin_tasks</code> en Supabase:
              </p>
              <pre className="text-xs bg-blue-100 p-2 rounded overflow-x-auto text-blue-800">
{`CREATE TABLE admin_tasks (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'pending',
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW()
);`}
              </pre>
            </div>
          )}
        </div>
      </AdminLayout>
    </AdminGuard>
  );
}

// Estilos CSS para animaciones personalizadas
const estilosAnimacion = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  @keyframes slideIn {
    from { opacity: 0; transform: translateX(-20px); }
    to { opacity: 1; transform: translateX(0); }
  }
  
  .animate-fadeIn {
    animation: fadeIn 0.6s ease-out;
  }
  
  .animate-slideIn {
    animation: slideIn 0.4s ease-out;
  }
`;