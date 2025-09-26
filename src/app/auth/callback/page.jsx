'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabaseClient';

export default function AuthCallback() {
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
          
          // Intercambiar el código por una sesión
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          
          if (error) {
            console.error('Error al intercambiar código por sesión:', error);
            setStatus('Error en autenticación');
            setTimeout(() => {
              router.push('/auth/login?error=auth_callback_error');
            }, 2000);
            return;
          }
          
          if (data.session && data.user) {
            console.log('Sesión establecida exitosamente:', data.user.email);
            setStatus(`Sesión establecida para ${data.user.email}`);
            
            // Esperar un momento para que la sesión se propague
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Verificar que la sesión persiste
            const { data: sessionCheck } = await supabase.auth.getSession();
            console.log('Verificación de sesión:', sessionCheck.session?.user?.email);
            
            if (sessionCheck.session) {
              setStatus('Redirigiendo al panel de administración...');
              
              // Obtener la URL de redirección guardada
              const redirectUrl = localStorage.getItem('redirectAfterLogin');
              localStorage.removeItem('redirectAfterLogin');
              
              // Redirigir a la URL guardada o al admin por defecto
              router.push(redirectUrl || '/admin');
            } else {
              console.error('La sesión no persiste después del intercambio');
              setStatus('Error: La sesión no persiste');
              setTimeout(() => {
                router.push('/auth/login?error=session_persistence_error');
              }, 2000);
            }
          } else {
            console.error('No se pudo establecer la sesión');
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