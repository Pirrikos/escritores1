'use client';

import Link from 'next/link';
import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabaseClient';

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    const handleOAuthCallback = async () => {
      // Verificar si hay parámetros de OAuth en la URL
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const urlParams = new URLSearchParams(window.location.search);
      
      const code = urlParams.get('code') || hashParams.get('code');
      const error = urlParams.get('error') || hashParams.get('error');
      
      if (error) {
        console.error('Error OAuth recibido:', error);
        router.push('/auth/login?error=oauth_error');
        return;
      }
      
      if (code) {
        console.log('Código OAuth detectado en página principal, procesando...');
        
        try {
          // Usar getSession() que maneja automáticamente el intercambio PKCE
          const { data, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error('Error al obtener sesión:', error);
            // Intentar manejar el callback manualmente
            const { data: authData, error: authError } = await supabase.auth.getUser();
            if (authError) {
              console.error('Error al obtener usuario:', authError);
              router.push('/auth/login?error=auth_callback_error');
              return;
            }
          }
          
          // Verificar si tenemos una sesión válida
          const { data: sessionData } = await supabase.auth.getSession();
          
          if (sessionData.session && sessionData.session.user) {
            console.log('Sesión establecida exitosamente:', sessionData.session.user.email);
            
            // Limpiar la URL y redirigir al admin
            window.history.replaceState({}, document.title, '/');
            router.push('/admin');
          } else {
            console.error('No se pudo establecer la sesión después del callback');
            router.push('/auth/login?error=session_error');
          }
        } catch (error) {
          console.error('Error en callback de autenticación:', error);
          router.push('/auth/login?error=callback_error');
        }
      }
    };

    // Solo ejecutar si hay parámetros OAuth
    const hasOAuthParams = window.location.search.includes('code') || window.location.hash.includes('code');
    if (hasOAuthParams) {
      handleOAuthCallback();
    }
  }, [router, supabase]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Bienvenido a Escritores
          </h1>
          <p className="text-lg text-gray-700 mb-6">
            Una plataforma para escritores creativos donde puedes compartir tus historias, poemas y ensayos.
          </p>
        </header>
        
        <nav role="navigation" aria-label="Navegación principal">
          <Link 
            href="/admin" 
            className="bg-purple-600 hover:bg-purple-700 focus:bg-purple-700 text-white px-6 py-3 rounded-md text-lg font-medium transition-colors inline-block focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
            aria-describedby="admin-description"
          >
            Ir al Panel de Administración
          </Link>
          <p id="admin-description" className="sr-only">
            Accede al panel de administración para gestionar tu contenido y configuración
          </p>
        </nav>
        
        <footer className="mt-8 text-sm text-gray-600">
          <p>Explora, crea y comparte tu creatividad literaria</p>
        </footer>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center" role="status" aria-live="polite">
        <div 
          className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"
          aria-hidden="true"
        ></div>
        <p className="text-gray-600">Cargando aplicación...</p>
        <span className="sr-only">La aplicación se está cargando, por favor espera</span>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <HomePageContent />
    </Suspense>
  );
}