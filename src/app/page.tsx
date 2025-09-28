'use client';

import Link from 'next/link';
import { useEffect, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabaseClient';
import CoverRenderer, { CoverMode, TemplateId, PaletteId } from '@/components/ui/CoverRenderer';

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = getSupabaseBrowserClient();

  // Estado para el generador de portadas
  const [coverSettings, setCoverSettings] = useState<{
    mode: CoverMode;
    templateId: TemplateId;
    paletteId: PaletteId;
  }>({
    mode: 'template',
    templateId: 'template-1',
    paletteId: 'marino'
  });
  const [bookTitle, setBookTitle] = useState('Mi Nueva Obra');
  const [authorName, setAuthorName] = useState('Autor Ejemplo');

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Bienvenido a Escritores
          </h1>
          <p className="text-xl text-gray-700 mb-8 max-w-2xl mx-auto">
            Una plataforma para escritores creativos donde puedes compartir tus historias, poemas y ensayos.
          </p>
          
          <nav role="navigation" aria-label="Navegación principal">
            <Link 
              href="/admin" 
              className="bg-purple-600 hover:bg-purple-700 focus:bg-purple-700 text-white px-8 py-4 rounded-lg text-lg font-medium transition-colors inline-block focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 shadow-lg"
              aria-describedby="admin-description"
            >
              Ir al Panel de Administración
            </Link>
            <p id="admin-description" className="sr-only">
              Accede al panel de administración para gestionar tu contenido y configuración
            </p>
          </nav>
        </header>

        {/* Generador de Portadas */}
        <section className="max-w-6xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200/60">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Generador de Portadas
              </h2>
              <p className="text-gray-600 text-lg">
                Crea portadas profesionales para tus obras de forma automática
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Configuración */}
              <div className="space-y-6">
                <div>
                  <label htmlFor="book-title" className="block text-sm font-medium text-gray-700 mb-2">
                    Título del libro
                  </label>
                  <input
                    id="book-title"
                    type="text"
                    value={bookTitle}
                    onChange={(e) => setBookTitle(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Ingresa el título de tu obra"
                  />
                </div>

                <div>
                  <label htmlFor="author-name" className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre del autor
                  </label>
                  <input
                    id="author-name"
                    type="text"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Ingresa tu nombre"
                  />
                </div>

                <div>
                  <label htmlFor="template-select" className="block text-sm font-medium text-gray-700 mb-2">
                    Plantilla de diseño
                  </label>
                  <select
                    id="template-select"
                    value={coverSettings.templateId}
                    onChange={(e) => setCoverSettings(prev => ({ ...prev, templateId: e.target.value as TemplateId }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="template-1">Franja Diagonal</option>
                    <option value="template-2">Marco Fino</option>
                    <option value="template-3">Líneas Suaves</option>
                    <option value="template-4">Círculos Decorativos</option>
                    <option value="template-5">Gradiente Sutil</option>
                    <option value="template-6">Formas Geométricas</option>
                    <option value="template-7">Líneas Verticales</option>
                    <option value="template-8">Marco Redondeado</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="palette-select" className="block text-sm font-medium text-gray-700 mb-2">
                    Paleta de colores
                  </label>
                  <select
                    id="palette-select"
                    value={coverSettings.paletteId}
                    onChange={(e) => setCoverSettings(prev => ({ ...prev, paletteId: e.target.value as PaletteId }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="marino">Marino Clásico</option>
                    <option value="rojo">Rojo Profundo</option>
                    <option value="negro">Negro Elegante</option>
                    <option value="verde">Verde Esmeralda</option>
                    <option value="purpura">Púrpura Editorial</option>
                  </select>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-2">¿Cómo funciona?</h3>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Ingresa el título y autor de tu obra</li>
                    <li>• Selecciona una plantilla de diseño</li>
                    <li>• Elige una paleta de colores</li>
                    <li>• La portada se genera automáticamente</li>
                    <li>• Puedes usar esta portada en el panel de administración</li>
                  </ul>
                </div>
              </div>

              {/* Vista previa */}
              <div className="flex flex-col items-center">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Vista previa</h3>
                <div className="bg-gray-50 rounded-lg p-6 flex justify-center">
                  <CoverRenderer
                    mode={coverSettings.mode}
                    templateId={coverSettings.templateId}
                    title={bookTitle}
                    author={authorName}
                    paletteId={coverSettings.paletteId}
                    width={250}
                    height={375}
                    className="shadow-2xl"
                  />
                </div>
                <p className="text-sm text-gray-500 mt-4 text-center">
                  Esta portada se actualizará automáticamente cuando cambies la configuración
                </p>
              </div>
            </div>
          </div>
        </section>
        
        <footer className="text-center mt-12 text-gray-600">
          <p className="text-lg">Explora, crea y comparte tu creatividad literaria</p>
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