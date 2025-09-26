"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabaseClient";
import { AdminGuard } from "../../../lib/adminAuth";
import { default as AdminLayout } from "../../../components/admin/AdminLayout";
import { Button, Input } from "@/components/ui";
import { Icon, Icons } from "@/components/ui";

export default function AdminPosts() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [postsLoading, setPostsLoading] = useState(false);
  const [error, setError] = useState(null);

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
      loadPosts();
    }
  }, [session]);

  const loadPosts = async () => {
    try {
      setPostsLoading(true);
      setError(null);
      
      const { data: posts, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts(posts || []);
    } catch (error) {
      console.error('Error loading posts:', error);
      setError('Error al cargar los posts. Por favor, intenta de nuevo.');
    } finally {
      setPostsLoading(false);
    }
  };

  const deletePost = async (postId) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este post?')) return;

    try {
      setError(null);
      
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;

      setPosts(posts.filter(post => post.id !== postId));
    } catch (error) {
      console.error('Error deleting post:', error);
      setError('Error al eliminar el post. Por favor, intenta de nuevo.');
    }
  };

  const togglePostStatus = async (postId, currentStatus) => {
    const newStatus = currentStatus === 'published' ? 'draft' : 'published';
    
    try {
      setError(null);
      
      const { error } = await supabase
        .from('posts')
        .update({ status: newStatus })
        .eq('id', postId);

      if (error) throw error;

      setPosts(posts.map(post => 
        post.id === postId ? { ...post, status: newStatus } : post
      ));
    } catch (error) {
      console.error('Error updating post status:', error);
      setError('Error al actualizar el estado del post. Por favor, intenta de nuevo.');
    }
  };

  const filteredPosts = posts.filter(post => {
    const matchesSearch = post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         post.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || post.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando posts...</p>
        </div>
      </div>
    );
  }

  return (
    <AdminGuard session={session}>
      <AdminLayout activeTab="posts">
        <div className="space-y-8">
          {/* Header */}
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-200/60">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 mb-2">Gestión de Posts</h1>
                <p className="text-slate-600">Administra todos tus artículos y publicaciones</p>
              </div>
              <div className="flex items-center space-x-2 text-sm text-slate-500 bg-slate-100 px-4 py-2 rounded-full">
                <Icon path={Icons.posts} size="sm" />
                <span>{posts.length} posts</span>
              </div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-200/60">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Buscar posts
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Icon path={Icons.search} size="md" className="text-slate-400" />
                  </div>
                  <Input
                    type="text"
                    placeholder="Buscar por título..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-0 transition-colors"
                  />
                </div>
              </div>
              
              <div className="md:w-48">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Filtrar por estado
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-0 transition-colors bg-white"
                >
                  <option value="all">Todos los estados</option>
                  <option value="published">📗 Publicados</option>
                  <option value="draft">📝 Borradores</option>
                </select>
              </div>
              
              <div className="flex items-end">
                <Button 
                  onClick={() => window.location.href = '/write'}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <div className="flex items-center space-x-2">
                    <Icon path={Icons.plus} size="md" />
                    <span>Nuevo Post</span>
                  </div>
                </Button>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <Icon path={Icons.warning} size="md" className="text-red-500" />
                </div>
                <div className="flex-1">
                  <p className="text-red-800 font-medium">{error}</p>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="flex-shrink-0 text-red-500 hover:text-red-700 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Posts List */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200/60">
            <div className="p-8 border-b border-slate-200/60">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-900">Posts</h2>
                <div className="flex items-center space-x-4 text-sm text-slate-500">
                  <span>{filteredPosts.filter(p => p.status === 'published').length} publicados</span>
                  <span>{filteredPosts.filter(p => p.status === 'draft').length} borradores</span>
                </div>
              </div>
            </div>

            {postsLoading ? (
              <div className="p-12 text-center">
                <div className="inline-flex items-center space-x-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  <span className="text-slate-600 font-medium">Cargando posts...</span>
                </div>
              </div>
            ) : filteredPosts.length > 0 ? (
              <div className="divide-y divide-slate-200/60">
                {filteredPosts.map((post) => (
                  <div key={post.id} className="p-8 hover:bg-slate-50/50 transition-all duration-200">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          <h3 className="text-xl font-bold text-slate-900">{post.title}</h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            post.status === 'published' 
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}>
                            {post.status === 'published' ? '📗 Publicado' : '📝 Borrador'}
                          </span>
                        </div>
                        
                        {post.content && (
                          <p className="text-slate-600 mb-4 line-clamp-2">
                            {post.content.substring(0, 200)}...
                          </p>
                        )}
                        
                        <div className="flex items-center space-x-6 text-sm text-slate-500">
                          <div className="flex items-center space-x-1">
                            <Icon path={Icons.calendar} size="sm" />
                            <span>Creado: {new Date(post.created_at).toLocaleDateString('es-ES', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}</span>
                          </div>
                          
                          {post.updated_at && post.updated_at !== post.created_at && (
                            <div className="flex items-center space-x-1">
                              <Icon path={Icons.edit} size="sm" />
                              <span>Editado: {new Date(post.updated_at).toLocaleDateString('es-ES', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3 ml-6">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => togglePostStatus(post.id, post.status)}
                          className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                            post.status === 'published'
                              ? 'border-amber-300 text-amber-700 hover:bg-amber-50'
                              : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          {post.status === 'published' ? 'Despublicar' : 'Publicar'}
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deletePost(post.id)}
                          className="px-4 py-2 border-red-300 text-red-700 hover:bg-red-50 rounded-lg font-medium transition-all duration-200"
                        >
                          <Icon path={Icons.trash} size="sm" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Icon path={Icons.posts} size="lg" className="text-slate-400" />
                </div>
                <h3 className="text-2xl font-semibold text-slate-900 mb-3">
                  {searchTerm || filterStatus !== 'all' ? 'No se encontraron posts' : 'No hay posts aún'}
                </h3>
                <p className="text-slate-600 mb-8">
                  {searchTerm || filterStatus !== 'all' 
                    ? 'Intenta ajustar los filtros de búsqueda' 
                    : '¡Crea tu primer post para comenzar!'
                  }
                </p>
                {!searchTerm && filterStatus === 'all' && (
                  <Button 
                    onClick={() => window.location.href = '/write'}
                    className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    Crear Primer Post
                  </Button>
                )}
              </div>
            )}
          </div>
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