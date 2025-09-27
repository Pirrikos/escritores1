"use client";
import { useEffect, useState } from "react";
import { Card, CardHeader, CardBody, Button } from "@/components/ui";

export default function TestPage() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  const loadFeed = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await fetch("/api/feed", { cache: "no-store" });
      const json = await res.json();
      
      if (!res.ok) {
        throw new Error(json.error || `Error ${res.status}: ${res.statusText}`);
      }
      
      setItems(json.data || []);
    } catch (e) {
      console.error("Error loading feed:", e);
      setError({
        message: e.message,
        type: e.name === 'TypeError' ? 'network' : 'server',
        canRetry: true
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    loadFeed();
  };

  useEffect(() => {
    loadFeed();
  }, []);

  // Loading state
  if (loading) {
    return (
      <main className="max-w-3xl mx-auto p-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Feed publicado</h1>
        <Card>
          <CardBody>
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
              <span className="ml-3 text-gray-600">
                Cargando publicaciones...
              </span>
            </div>
          </CardBody>
        </Card>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Feed publicado</h1>
      
      {/* Error state */}
      {error && (
        <Card className="border-red-200 bg-red-50 mb-6">
          <CardBody>
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800">
                  {error.type === 'network' ? 'Error de conexión' : 'Error del servidor'}
                </h3>
                <p className="mt-1 text-sm text-red-700">
                  {error.type === 'network' 
                    ? 'No se pudo conectar al servidor. Verifica tu conexión a internet.'
                    : `Error al cargar las publicaciones: ${error.message}`
                  }
                </p>
                {error.canRetry && (
                  <div className="mt-3">
                    <Button
                      onClick={handleRetry}
                      size="sm"
                      variant="outline"
                      className="border-red-300 text-red-700 hover:bg-red-100"
                    >
                      Intentar de nuevo
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardBody>
        </Card>
      )}
      
      {/* Empty state */}
      {!error && items.length === 0 ? (
        <Card>
          <CardBody>
            <div className="text-center py-12">
              <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No hay publicaciones aún
              </h3>
              <p className="text-gray-600 mb-6 max-w-sm mx-auto">
                Cuando los escritores publiquen sus trabajos, aparecerán aquí para que puedas leerlos.
              </p>
              <div className="space-y-2">
                <Button
                  onClick={handleRetry}
                  variant="outline"
                  size="sm"
                >
                  Actualizar feed
                </Button>
                <p className="text-xs text-gray-500">
                  ¿Eres escritor? <a href="/write" className="text-blue-600 hover:text-blue-800 underline">Publica tu primer post</a>
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      ) : (
        /* Posts list */
        !error && (
          <div className="space-y-4">
            {items.map(p => (
              <Card key={p.id} variant="outlined" hover>
                <CardBody>
                  <article className="space-y-3">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 m-0">
                      {p.title}
                    </h3>
                    {p.display_name && (
                      <p className="text-sm text-gray-500">
                        por <span className="font-medium">{p.display_name}</span>
                      </p>
                    )}
                    {p.content && (
                      <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300 leading-relaxed">
                        {p.content}
                      </p>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                      {p.published_at && (
                        <p className="text-xs text-gray-400">
                          Publicado el {new Date(p.published_at).toLocaleDateString('es-ES', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      )}
                      {p.type && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {p.type === 'story' ? 'Historia' : 
                           p.type === 'poem' ? 'Poema' : 
                           p.type === 'essay' ? 'Ensayo' : 
                           p.type}
                        </span>
                      )}
                    </div>
                  </article>
                </CardBody>
              </Card>
            ))}
            
            {/* Load more hint */}
            {items.length > 0 && (
              <Card className="bg-gray-50">
                <CardBody>
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-600 mb-3">
                      {items.length === 1 ? 'Mostrando 1 publicación' : `Mostrando ${items.length} publicaciones`}
                    </p>
                    <Button
                      onClick={handleRetry}
                      variant="ghost"
                      size="sm"
                      className="text-gray-600 hover:text-gray-800"
                    >
                      Actualizar feed
                    </Button>
                  </div>
                </CardBody>
              </Card>
            )}
          </div>
        )
      )}
    </main>
  );
}
