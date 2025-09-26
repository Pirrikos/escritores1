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
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando panel de administración...</p>
        </div>
      </div>
    );
  }

  return (
    <AdminGuard session={session}>
      <AdminLayout activeTab="dashboard">
        <div className="space-y-8">
          {/* Páginas Principales del Proyecto */}
          <div className="bg-white rounded-2xl p-8 shadow-lg shadow-slate-200/50 border border-slate-100">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Páginas Principales</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              
              {/* Página Principal */}
              <button
                onClick={() => window.open('/', '_blank')}
                className="flex flex-col items-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl hover:from-blue-100 hover:to-blue-200 transition-all duration-300 group hover:scale-[1.02] hover:shadow-lg"
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
                className="flex flex-col items-center p-6 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl hover:from-emerald-100 hover:to-emerald-200 transition-all duration-300 group hover:scale-[1.02] hover:shadow-lg"
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
                className="flex flex-col items-center p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl hover:from-purple-100 hover:to-purple-200 transition-all duration-300 group hover:scale-[1.02] hover:shadow-lg"
              >
                <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                  <Icon path={Icons.posts} size="md" className="text-white" />
                </div>
                <span className="font-semibold text-slate-900 group-hover:text-purple-700 transition-colors duration-300">Feed Público</span>
                <span className="text-xs text-slate-600 mt-1">/test</span>
              </button>
            </div>
          </div>

          {/* Información del Sistema - Eliminada */}
        </div>
      </AdminLayout>
    </AdminGuard>
  );
}