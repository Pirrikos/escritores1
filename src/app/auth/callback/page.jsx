'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabaseClient';
import { isAdminUser } from '@/lib/adminAuth';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = getSupabaseBrowserClient();
  const [status, setStatus] = useState('Procesando...');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log('Procesando callback de autenticación...');
        setStatus('Procesando autenticación...');
        
        // Obtener el código de la URL
        const code = searchParams.get('code');
        
        if (code) {
          console.log('Código de autorización encontrado:', code);
          setStatus('Intercambiando código por sesión...');
          
          // Usar getSession() que maneja automáticamente el flujo PKCE
          const { data, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error('Error al obtener sesión:', error);
            // Intentar manejar el callback manualmente
            const { data: authData, error: authError } = await supabase.auth.getUser();
            if (authError) {
              console.error('Error al obtener usuario:', authError);
              setStatus('Error en autenticación');
              setTimeout(() => {
                router.push('/auth/login?error=auth_callback_error');
              }, 2000);
              return;
            }
          }
          
          // Verificar si tenemos una sesión válida
          const { data: sessionData } = await supabase.auth.getSession();
          
          if (sessionData.session && sessionData.session.user) {
            console.log('Sesión establecida exitosamente:', sessionData.session.user.email);
            setStatus(`Sesión establecida para ${sessionData.session.user.email}`);
            
            setStatus('Redirigiendo...');
            
            // Obtener la URL de redirección guardada
            const redirectUrl = localStorage.getItem('redirectAfterLogin');
            localStorage.removeItem('redirectAfterLogin');
            
            // Redirección unificada: si hay redirect previo y apunta a /admin, forzar Home
            // En otro caso, usar redirect; por defecto, Home
            if (redirectUrl) {
              if (redirectUrl.startsWith('/admin')) {
                router.push('/home');
              } else {
                router.push(redirectUrl);
              }
            } else {
              router.push('/home');
            }
          } else {
            console.error('No se pudo establecer la sesión después del callback');
            setStatus('Error: No se pudo establecer la sesión');
            setTimeout(() => {
              router.push('/auth/login?error=session_error');
            }, 2000);
          }
        } else {
          console.error('No se encontró código de autorización');
          setStatus('Error: No se encontró código de autorización');
          setTimeout(() => {
            router.push('/auth/login?error=no_code');
          }, 2000);
        }
      } catch (error) {
        console.error('Error en callback de autenticación:', error);
        setStatus(`Error: ${error.message}`);
        setTimeout(() => {
          router.push('/auth/login?error=callback_error');
        }, 2000);
      }
    };

    handleAuthCallback();
  }, [router, supabase, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 mb-2">Procesando autenticación...</p>
        <p className="text-sm text-gray-500">{status}</p>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Cargando...</p>
      </div>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AuthCallbackContent />
    </Suspense>
  );
}