"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from "../../lib/supabaseClient";
import { AdminGuard } from "../../lib/adminAuth";
import { default as AdminLayout } from "../../components/admin/AdminLayout";
import { Button, Icon, Icons } from "@/components/ui";

export default function AdminDashboard() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center" role="status" aria-live="polite">
          <div 
            className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"
            aria-hidden="true"
          ></div>
          <p className="text-gray-600">Cargando panel de administración...</p>
          <span className="sr-only">El panel de administración se está cargando, por favor espera</span>
        </div>
      </div>
    );
  }

  return (
    <AdminGuard session={session}>
      <AdminLayout activeTab="dashboard">
        <div className="space-y-8">
          {/* Sistema de Pestañas */}
          <section className="bg-white rounded-2xl p-6 shadow-lg shadow-slate-200/50 border border-slate-100">
            <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4 mb-6">
              {/* Dashboard */}
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  activeTab === 'dashboard'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Dashboard
              </button>

              {/* Páginas Principales */}
              <button
                onClick={() => setActiveTab('main-pages')}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  activeTab === 'main-pages'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Páginas Principales
              </button>

              {/* Admin Pages */}
              <button
                onClick={() => setActiveTab('admin-pages')}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  activeTab === 'admin-pages'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Páginas Admin
              </button>



              {/* Auth Pages */}
              <button
                onClick={() => setActiveTab('auth-pages')}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  activeTab === 'auth-pages'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Auth Pages
              </button>

              {/* Other Pages */}
              <button
                onClick={() => setActiveTab('other-pages')}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  activeTab === 'other-pages'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Otras Páginas
              </button>
            </div>

            {/* Contenido de las Pestañas */}
            {activeTab === 'dashboard' && (
              <div>
                <h2 className="text-xl font-semibold text-slate-700 mb-4">Dashboard Principal</h2>
                <p className="text-slate-600 mb-4">Bienvenido al panel de administración. Usa las pestañas para navegar entre las diferentes secciones.</p>
              </div>
            )}

            {activeTab === 'main-pages' && (
              <div>
                <h2 className="text-xl font-semibold text-slate-700 mb-4">Páginas Principales</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Página Principal */}
                  <button
                    onClick={() => window.open('/', '_blank')}
                    className="flex flex-col items-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl hover:from-blue-100 hover:to-blue-200 transition-all duration-300 group hover:scale-[1.02] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                      <Icon path={Icons.external} size="md" className="text-white" />
                    </div>
                    <span className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors duration-300">Página Principal</span>
                    <span className="text-xs text-slate-600 mt-1">/ (Home)</span>
                  </button>

                  {/* Escribir */}
                  <button
                    onClick={() => router.push('/write')}
                    className="flex flex-col items-center p-6 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl hover:from-emerald-100 hover:to-emerald-200 transition-all duration-300 group hover:scale-[1.02] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                  >
                    <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                      <Icon path={Icons.edit} size="md" className="text-white" />
                    </div>
                    <span className="font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors duration-300">Escribir</span>
                    <span className="text-xs text-slate-600 mt-1">/write</span>
                  </button>

                  {/* Feed Público */}
                  <button
                    onClick={() => router.push('/test')}
                    className="flex flex-col items-center p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl hover:from-purple-100 hover:to-purple-200 transition-all duration-300 group hover:scale-[1.02] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                  >
                    <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                      <Icon path={Icons.feed} size="md" className="text-white" />
                    </div>
                    <span className="font-semibold text-slate-900 group-hover:text-purple-700 transition-colors duration-300">Feed Público</span>
                    <span className="text-xs text-slate-600 mt-1">/test</span>
                  </button>

                  {/* Biblioteca */}
                  <button
                    onClick={() => router.push('/library')}
                    className="flex flex-col items-center p-6 bg-gradient-to-br from-teal-50 to-teal-100 rounded-2xl hover:from-teal-100 hover:to-teal-200 transition-all duration-300 group hover:scale-[1.02] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
                  >
                    <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                      <Icon path={Icons.book} size="md" className="text-white" />
                    </div>
                    <span className="font-semibold text-slate-900 group-hover:text-teal-700 transition-colors duration-300">Biblioteca</span>
                    <span className="text-xs text-slate-600 mt-1">/library</span>
                  </button>

                  {/* Capítulos */}
                  <button
                    onClick={() => router.push('/chapters')}
                    className="flex flex-col items-center p-6 bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-2xl hover:from-cyan-100 hover:to-cyan-200 transition-all duration-300 group hover:scale-[1.02] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2"
                  >
                    <div className="w-10 h-10 bg-cyan-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                      <Icon path={Icons.book} size="md" className="text-white" />
                    </div>
                    <span className="font-semibold text-slate-900 group-hover:text-cyan-700 transition-colors duration-300">Capítulos</span>
                    <span className="text-xs text-slate-600 mt-1">/chapters</span>
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'admin-pages' && (
              <div>
                <h2 className="text-xl font-semibold text-slate-700 mb-4">Páginas de Administración</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Subir Obras */}
                  <button
                    onClick={() => router.push('/admin/upload-works')}
                    className="flex flex-col items-center p-6 bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl hover:from-orange-100 hover:to-orange-200 transition-all duration-300 group hover:scale-[1.02] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                  >
                    <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                      <Icon path={Icons.upload} size="md" className="text-white" />
                    </div>
                    <span className="font-semibold text-slate-900 group-hover:text-orange-700 transition-colors duration-300">Subir Obras</span>
                    <span className="text-xs text-slate-600 mt-1">/admin/upload-works</span>
                  </button>

                  {/* Subir Capítulos */}
                  <button
                    onClick={() => router.push('/admin/upload-chapters')}
                    className="flex flex-col items-center p-6 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-2xl hover:from-indigo-100 hover:to-indigo-200 transition-all duration-300 group hover:scale-[1.02] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  >
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                      <Icon path={Icons.book} size="md" className="text-white" />
                    </div>
                    <span className="font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors duration-300">Subir Capítulos</span>
                    <span className="text-xs text-slate-600 mt-1">/admin/upload-chapters</span>
                  </button>

                  {/* Posts */}
                  <button
                    onClick={() => router.push('/admin/posts')}
                    className="flex flex-col items-center p-6 bg-gradient-to-br from-pink-50 to-pink-100 rounded-2xl hover:from-pink-100 hover:to-pink-200 transition-all duration-300 group hover:scale-[1.02] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2"
                  >
                    <div className="w-10 h-10 bg-pink-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                      <Icon path={Icons.edit} size="md" className="text-white" />
                    </div>
                    <span className="font-semibold text-slate-900 group-hover:text-pink-700 transition-colors duration-300">Posts</span>
                    <span className="text-xs text-slate-600 mt-1">/admin/posts</span>
                  </button>

                  {/* Blog */}
                  <button
                    onClick={() => router.push('/admin/blog')}
                    className="flex flex-col items-center p-6 bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-2xl hover:from-cyan-100 hover:to-cyan-200 transition-all duration-300 group hover:scale-[1.02] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2"
                  >
                    <div className="w-10 h-10 bg-cyan-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                      <Icon path={Icons.book} size="md" className="text-white" />
                    </div>
                    <span className="font-semibold text-slate-900 group-hover:text-cyan-700 transition-colors duration-300">Blog</span>
                    <span className="text-xs text-slate-600 mt-1">/admin/blog</span>
                  </button>

                  {/* Backup */}
                  <button
                    onClick={() => router.push('/admin/backup')}
                    className="flex flex-col items-center p-6 bg-gradient-to-br from-amber-50 to-amber-100 rounded-2xl hover:from-amber-100 hover:to-amber-200 transition-all duration-300 group hover:scale-[1.02] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
                  >
                    <div className="w-10 h-10 bg-amber-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                      <Icon path={Icons.backup} size="md" className="text-white" />
                    </div>
                    <span className="font-semibold text-slate-900 group-hover:text-amber-700 transition-colors duration-300">Backup</span>
                    <span className="text-xs text-slate-600 mt-1">/admin/backup</span>
                  </button>

                  {/* Monitoring */}
                  <button
                    onClick={() => router.push('/admin/monitoring')}
                    className="flex flex-col items-center p-6 bg-gradient-to-br from-red-50 to-red-100 rounded-2xl hover:from-red-100 hover:to-red-200 transition-all duration-300 group hover:scale-[1.02] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                  >
                    <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                      <Icon path={Icons.monitoring} size="md" className="text-white" />
                    </div>
                    <span className="font-semibold text-slate-900 group-hover:text-red-700 transition-colors duration-300">Monitoring</span>
                    <span className="text-xs text-slate-600 mt-1">/admin/monitoring</span>
                  </button>
                </div>
              </div>
            )}



            {activeTab === 'auth-pages' && (
              <div>
                <h2 className="text-xl font-semibold text-slate-700 mb-4">Páginas de Autenticación</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Login */}
                  <button
                    onClick={() => router.push('/auth/login')}
                    className="flex flex-col items-center p-6 bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl hover:from-slate-100 hover:to-slate-200 transition-all duration-300 group hover:scale-[1.02] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
                  >
                    <div className="w-10 h-10 bg-slate-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                      <Icon path={Icons.login} size="md" className="text-white" />
                    </div>
                    <span className="font-semibold text-slate-900 group-hover:text-slate-700 transition-colors duration-300">Login</span>
                    <span className="text-xs text-slate-600 mt-1">/auth/login</span>
                  </button>

                  {/* Callback */}
                  <button
                    onClick={() => router.push('/auth/callback')}
                    className="flex flex-col items-center p-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl hover:from-gray-100 hover:to-gray-200 transition-all duration-300 group hover:scale-[1.02] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                  >
                    <div className="w-10 h-10 bg-gray-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                      <Icon path={Icons.callback} size="md" className="text-white" />
                    </div>
                    <span className="font-semibold text-slate-900 group-hover:text-gray-700 transition-colors duration-300">Callback</span>
                    <span className="text-xs text-slate-600 mt-1">/auth/callback</span>
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'other-pages' && (
              <div>
                <h2 className="text-xl font-semibold text-slate-700 mb-4">Otras Páginas</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Debug Styles */}
                  <button
                    onClick={() => router.push('/debug-styles')}
                    className="flex flex-col items-center p-6 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-2xl hover:from-yellow-100 hover:to-yellow-200 transition-all duration-300 group hover:scale-[1.02] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2"
                  >
                    <div className="w-10 h-10 bg-yellow-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                      <Icon path={Icons.debug} size="md" className="text-white" />
                    </div>
                    <span className="font-semibold text-slate-900 group-hover:text-yellow-700 transition-colors duration-300">Debug Styles</span>
                    <span className="text-xs text-slate-600 mt-1">/debug-styles</span>
                  </button>

                  {/* Works (Dynamic) */}
                  <button
                    onClick={() => router.push('/works')}
                    className="flex flex-col items-center p-6 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl hover:from-emerald-100 hover:to-emerald-200 transition-all duration-300 group hover:scale-[1.02] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                  >
                    <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                      <Icon path={Icons.book} size="md" className="text-white" />
                    </div>
                    <span className="font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors duration-300">Works</span>
                    <span className="text-xs text-slate-600 mt-1">/works/[slug]</span>
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </AdminLayout>
    </AdminGuard>
  );
}