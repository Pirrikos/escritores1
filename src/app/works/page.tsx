'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import WorksCarousel from '@/components/ui/WorksCarousel';
import { AppHeader } from '@/components/ui';
import CommentsButton from '@/components/ui/CommentsButton';
import CommentsPreview from '@/components/ui/CommentsPreview';

interface Work {
  id: string;
  title: string;
  synopsis?: string;
  author_id: string;
  created_at: string;
  cover_url?: string;
  category?: string;
  profiles: {
    display_name: string;
  };
}

export default function WorksPage() {
  const supabase = createClientComponentClient();
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWorks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Primero: obtener IDs de obras que tienen capítulos (obras seriadas)
      const { data: chRows, error: chErr } = await supabase
        .from('chapters')
        .select('work_id')
        .eq('is_independent', false)
        .not('work_id', 'is', null)
        .limit(1000);
      if (chErr) {
        console.warn('No se pudieron cargar capítulos para filtrar obras por capítulos', chErr);
      }
      const serializedWorkIds = new Set<string>(
        Array.isArray(chRows) ? (chRows.map((c: any) => c.work_id).filter(Boolean) as string[]) : []
      );

      const { data, error } = await supabase
        .from('works')
        .select(`
          id,
          title,
          synopsis,
          author_id,
          created_at,
          cover_url,
          category,
          profiles!works_author_id_fkey (
            display_name
          )
        `)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const normalizeProfile = (p: any): { display_name: string } => {
        if (Array.isArray(p)) {
          return { display_name: p[0]?.display_name ?? 'Autor desconocido' };
        }
        if (p && typeof p === 'object' && 'display_name' in p) {
          return p as { display_name: string };
        }
        return { display_name: 'Autor desconocido' };
      };

      const normalized = (data || []).map((w: any) => ({
        ...w,
        profiles: normalizeProfile(w?.profiles),
      }));
      // Excluir obras que aparecen en la lista de obras por capítulos
      const filtered = (normalized as Work[]).filter((w) => !serializedWorkIds.has(w.id));
      setWorks(filtered);
    } catch (e) {
      console.error('Error cargando obras públicas:', e);
      setError('Error al cargar las obras publicadas');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadWorks();
  }, [loadWorks]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando biblioteca de obras...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <AppHeader className="mb-12" />

        {/* Encabezado de la biblioteca */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200/60 mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Biblioteca de Obras</h1>
          <p className="text-lg text-gray-600">Explora libros y obras completas publicadas por nuestros autores</p>
        </div>

        {/* Contenido */}
        {works.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl shadow-xl border border-slate-200/60">
            <h3 className="text-xl font-medium text-gray-900 mb-2">No hay nada publicado</h3>
            <p className="text-gray-600">Vuelve más tarde para ver nuevas obras.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {[
              'otras',
              'Novela',
              'Cuento',
              'Poesía',
              'Teatro',
              'Ensayo',
              'Fantasía',
              'Ciencia ficción',
              'Romance',
              'Misterio',
              'Terror',
            ].map((cat) => {
              const items = works.filter(w => w.category === cat);
              return (
                <WorksCarousel 
                  key={cat}
                  works={items}
                  title={cat}
                  description=""
                  showStats={false}
                  className="bg-white rounded-2xl shadow-xl p-8 border border-slate-200/60"
                  renderItemFooter={(w) => (
                    <div className="space-y-2">
                      <div className="flex items-center justify-start">
                        <CommentsButton targetType="work" targetId={w.id} />
                      </div>
                      <CommentsPreview targetType="work" targetId={w.id} />
                    </div>
                  )}
                />
              );
            })}
          </div>
        )}

        <footer className="text-center mt-12 text-gray-600">
          <p className="text-lg">Catálogo público de obras</p>
        </footer>
      </div>
    </div>
  );
}