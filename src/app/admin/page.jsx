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
          {/* Páginas Principales del Proyecto */}
          <section className="bg-white rounded-2xl p-8 shadow-lg shadow-slate-200/50 border border-slate-100">
            <header className="mb-6">
              <h1 className="text-2xl font-bold text-slate-900">Panel de Administración</h1>
              <h2 className="text-xl font-semibold text-slate-700 mt-2">Páginas Principales</h2>
              <p className="text-slate-600 mt-1">Accede rápidamente a las diferentes secciones de la plataforma</p>
            </header>
            
            <nav role="navigation" aria-label="Navegación de páginas principales">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                
                {/* Página Principal */}
                <button
                  onClick={() => window.open('/', '_blank')}
                  className="flex flex-col items-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl hover:from-blue-100 hover:to-blue-200 transition-all duration-300 group hover:scale-[1.02] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  aria-describedby="home-description"
                >
                  <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                    <Icon path={Icons.external} size="md" className="text-white" aria-hidden="true" />
                  </div>
                  <span className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors duration-300">Página Principal</span>
                  <span className="text-xs text-slate-600 mt-1">/ (Home)</span>
                  <span id="home-description" className="sr-only">
                    Abre la página principal de la plataforma en una nueva pestaña
                  </span>
                </button>

                {/* Escribir */}
                <button
                  onClick={() => router.push('/write')}
                  className="flex flex-col items-center p-6 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl hover:from-emerald-100 hover:to-emerald-200 transition-all duration-300 group hover:scale-[1.02] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                  aria-describedby="write-description"
                >
                  <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                    <Icon path={Icons.edit} size="md" className="text-white" aria-hidden="true" />
                  </div>
                  <span className="font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors duration-300">Escribir</span>
                  <span className="text-xs text-slate-600 mt-1">/write</span>
                  <span id="write-description" className="sr-only">
                    Navega a la página de escritura para crear nuevos posts, historias o poemas
                  </span>
                </button>

                {/* Feed Público */}
                <button
                  onClick={() => router.push('/test')}
                  className="flex flex-col items-center p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl hover:from-purple-100 hover:to-purple-200 transition-all duration-300 group hover:scale-[1.02] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                  aria-describedby="feed-description"
                >
                  <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                    <Icon path={Icons.posts} size="md" className="text-white" aria-hidden="true" />
                  </div>
                  <span className="font-semibold text-slate-900 group-hover:text-purple-700 transition-colors duration-300">Feed Público</span>
                  <span className="text-xs text-slate-600 mt-1">/test</span>
                  <span id="feed-description" className="sr-only">
                    Navega al feed público para ver todas las publicaciones de la comunidad
                  </span>
                </button>
              </div>
            </nav>
          </section>

          {/* Información del Sistema - Eliminada */}
        </div>
      </AdminLayout>
    </AdminGuard>
  );
}