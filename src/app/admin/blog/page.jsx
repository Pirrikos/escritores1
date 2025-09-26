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

export default function AdminBlog() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'medium' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Obtener sesión
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session || null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });

    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (session) {
      loadTasks();
    }
  }, [session]);

  const loadTasks = async () => {
    try {
      const { data: tasks, error } = await supabase
        .from('admin_tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error && error.code !== 'PGRST116') { // Ignore table not found error
        console.error('Error loading tasks:', error);
      } else {
        setTasks(tasks || []);
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  };

  const createTask = async () => {
    if (!newTask.title.trim()) return;

    setSaving(true);
    try {
      // Sanitizar datos antes de enviar
      const sanitizedTitle = sanitizeText(newTask.title.trim());
      const sanitizedDescription = sanitizeText(newTask.description.trim());
      
      // Log admin action for audit trail
      logAdminAction(
        'create_admin_task',
        session.user.id,
        {
          title: sanitizedTitle.substring(0, 50),
          priority: newTask.priority,
          userEmail: session.user.email
        }
      );
      
      const { data, error } = await supabase
        .from('admin_tasks')
        .insert([{
          title: sanitizedTitle,
          description: sanitizedDescription,
          priority: newTask.priority,
          status: 'pending',
          user_id: session.user.id
        }])
        .select();

      if (error) throw error;

      // Create audit trail for successful task creation
      createAuditTrail(
        session.user.id,
        'create_admin_task',
        'admin_tasks',
        {
          taskId: data[0].id,
          title: sanitizedTitle.substring(0, 50),
          priority: newTask.priority
        }
      );

      setTasks([data[0], ...tasks]);
      setNewTask({ title: '', description: '', priority: 'medium' });
    } catch (error) {
      console.error('Error creating task:', error);
      
      // Log error for security monitoring
      logSuspiciousActivity(
        'Admin task creation failed',
        {
          error: error.message,
          userId: session.user.id,
          userEmail: session.user.email
        }
      );
      
      alert('Error al crear la tarea. Verifica que la tabla admin_tasks exista en Supabase.');
    } finally {
      setSaving(false);
    }
  };

  const toggleTaskStatus = async (taskId, currentStatus) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    
    try {
      const { error } = await supabase
        .from('admin_tasks')
        .update({ status: newStatus })
        .eq('id', taskId);

      if (error) throw error;

      setTasks(tasks.map(task => 
        task.id === taskId ? { ...task, status: newStatus } : task
      ));
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const deleteTask = async (taskId) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta tarea?')) return;

    try {
      const { error } = await supabase
        .from('admin_tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      setTasks(tasks.filter(task => task.id !== taskId));
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityText = (priority) => {
    switch (priority) {
      case 'high': return 'Alta';
      case 'medium': return 'Media';
      case 'low': return 'Baja';
      default: return 'Media';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando blog personal...</p>
        </div>
      </div>
    );
  }

  return (
    <AdminGuard session={session}>
      <AdminLayout activeTab="blog">
        <div className="space-y-8">
          {/* Header */}
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-200/60">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 mb-2">Blog Personal</h1>
                <p className="text-slate-600">Gestiona tus tareas y notas personales</p>
              </div>
              <div className="flex items-center space-x-2 text-sm text-slate-500 bg-slate-100 px-4 py-2 rounded-full">
                <Icon path={Icons.check} size="sm" />
                <span>{tasks.length} tareas</span>
              </div>
            </div>
          </div>

          {/* Add Task Form */}
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
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-0 transition-colors"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Prioridad
                  </label>
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-0 transition-colors bg-white"
                  >
                    <option value="low">🟢 Baja</option>
                    <option value="medium">🟡 Media</option>
                    <option value="high">🔴 Alta</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Descripción
                </label>
                <Textarea
                  placeholder="Describe los detalles de tu tarea..."
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-0 transition-colors resize-none"
                />
              </div>
              
              <Button 
                onClick={createTask}
                disabled={!newTask.title.trim() || saving}
                className="w-full md:w-auto bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
              >
                {saving ? (
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

          {/* Tasks List */}
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-200/60">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900">Mis Tareas</h2>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-slate-500">
                  {tasks.filter(t => t.status === 'pending').length} pendientes
                </span>
                <span className="text-sm text-slate-500">
                  {tasks.filter(t => t.status === 'completed').length} completadas
                </span>
              </div>
            </div>

            {tasks.length > 0 ? (
              <div className="space-y-4">
                {tasks.map((task) => (
                  <div 
                    key={task.id} 
                    className={`p-6 rounded-xl border-2 transition-all duration-300 ${
                      task.status === 'completed' 
                        ? 'bg-gradient-to-r from-emerald-50 to-teal-50/50 border-emerald-200/60' 
                        : 'bg-gradient-to-r from-slate-50 to-slate-100/50 border-slate-200/60 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <button
                            onClick={() => toggleTaskStatus(task.id, task.status)}
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                              task.status === 'completed'
                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                : 'border-slate-300 hover:border-emerald-400'
                            }`}
                          >
                            {task.status === 'completed' && (
                              <Icon path={Icons.check} size="sm" />
                            )}
                          </button>
                          
                          <h3 className={`text-lg font-semibold ${
                            task.status === 'completed' ? 'text-slate-500 line-through' : 'text-slate-900'
                          }`}>
                            {task.title}
                          </h3>
                          
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            task.priority === 'high' 
                              ? 'bg-red-100 text-red-800 border border-red-200'
                              : task.priority === 'medium'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}>
                            {task.priority === 'high' ? '🔴 Alta' : task.priority === 'medium' ? '🟡 Media' : '🟢 Baja'}
                          </span>
                        </div>
                        
                        {task.description && (
                          <p className={`text-sm mb-3 ${
                            task.status === 'completed' 
                              ? 'text-slate-400' 
                              : 'text-slate-600'
                          }`}>
                            {task.description}
                          </p>
                        )}
                        
                        <p className="text-xs text-slate-500">
                          Creada: {new Date(task.created_at).toLocaleDateString('es-ES', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      
                      <button
                        onClick={() => deleteTask(task.id)}
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
          {tasks.length === 0 && (
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

// Agregar estas clases CSS al final del archivo o en un archivo CSS global
const styles = `
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