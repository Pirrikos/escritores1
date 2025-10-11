'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppHeader, Icon, Icons, Card, CardHeader, CardBody, CardFooter, Pagination } from '@/components/ui';
import CoverRenderer from '@/components/ui/CoverRenderer';
import { parsePreviewCover } from '@/lib/utils';
import Image from 'next/image';
import Link from 'next/link';
import { generateSlug } from '@/lib/slugUtils';

type Work = {
  id: string;
  title: string;
  cover_url?: string | null;
  profiles?: { display_name: string } | null;
  slug?: string;
};

type Chapter = {
  id: string;
  title: string;
  slug?: string;
  work_id?: string | null;
  profiles?: { display_name: string } | null;
};

type ProfileObj = { display_name: string };
type ApiWorkRow = Omit<Work, 'profiles'> & { profiles?: ProfileObj | ProfileObj[] | null };
type ApiChapterRow = Omit<Chapter, 'profiles'> & { profiles?: ProfileObj | ProfileObj[] | null };

function normalizeProfile(p: ProfileObj | ProfileObj[] | null | undefined): { display_name: string } | null {
  if (!p) return null;
  if (Array.isArray(p)) {
    const first = p[0];
    return { display_name: first?.display_name ?? 'Autor' };
  }
  return p;
}

function SearchContent() {
  const params = useSearchParams();
  const q = (params.get('q') || '').trim();
  const type = (params.get('type') || 'all') as 'all' | 'works' | 'chapters' | 'serialized';
  const pageSizeParam = params.get('pageSize');
  const PAGE_SIZE = useMemo(() => {
    const n = pageSizeParam ? Number(pageSizeParam) : 12;
    if (!Number.isInteger(n)) return 12;
    return Math.min(100, Math.max(6, n));
  }, [pageSizeParam]);

  const [loading, setLoading] = useState(false);
  const [works, setWorks] = useState<Work[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [serializedWorks, setSerializedWorks] = useState<Work[]>([]);
  const [worksPage, setWorksPage] = useState(0);
  const [chaptersPage, setChaptersPage] = useState(0);
  const [serializedPage, setSerializedPage] = useState(0);
  const [worksTotal, setWorksTotal] = useState(0);
  const [chaptersTotal, setChaptersTotal] = useState(0);
  const [serializedTotal, setSerializedTotal] = useState(0);

  // Resetear páginas al cambiar búsqueda/selección
  useEffect(() => {
    setWorksPage(0);
    setChaptersPage(0);
    setSerializedPage(0);
  }, [q, type]);

  // Cargar datos desde la API con paginación por sección
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const base = `/api/search`;
        const qParam = q ? `&q=${encodeURIComponent(q)}` : '';

        if (type === 'all' || type === 'works') {
          const res = await fetch(`${base}?type=works&limit=${PAGE_SIZE}&offset=${worksPage * PAGE_SIZE}${qParam}`);
          const json = await res.json();
          const arr: ApiWorkRow[] = Array.isArray(json?.data?.works) ? (json.data.works as ApiWorkRow[]) : [];
          setWorks(arr.map((w) => ({
            ...w,
            profiles: normalizeProfile(w.profiles)
          })));
          setWorksTotal(Number(json?.counts?.works ?? 0));
        } else {
          setWorks([]);
          setWorksTotal(0);
        }

        if (type === 'all' || type === 'chapters') {
          const res = await fetch(`${base}?type=chapters&limit=${PAGE_SIZE}&offset=${chaptersPage * PAGE_SIZE}${qParam}`);
          const json = await res.json();
          const arr: ApiChapterRow[] = Array.isArray(json?.data?.chapters) ? (json.data.chapters as ApiChapterRow[]) : [];
          setChapters(arr.map((c) => ({
            ...c,
            profiles: normalizeProfile(c.profiles)
          })));
          setChaptersTotal(Number(json?.counts?.chapters ?? 0));
        } else {
          setChapters([]);
          setChaptersTotal(0);
        }

        if (type === 'all' || type === 'serialized') {
          const res = await fetch(`${base}?type=serialized&limit=${PAGE_SIZE}&offset=${serializedPage * PAGE_SIZE}${qParam}`);
          const json = await res.json();
          const arr: ApiWorkRow[] = Array.isArray(json?.data?.serializedWorks) ? (json.data.serializedWorks as ApiWorkRow[]) : [];
          setSerializedWorks(arr.map((w) => ({
            ...w,
            profiles: normalizeProfile(w.profiles)
          })));
          setSerializedTotal(Number(json?.counts?.serializedWorks ?? 0));
        } else {
          setSerializedWorks([]);
          setSerializedTotal(0);
        }
      } catch (e) {
        setWorks([]);
        setWorksTotal(0);
        setChapters([]);
        setChaptersTotal(0);
        setSerializedWorks([]);
        setSerializedTotal(0);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [q, type, worksPage, chaptersPage, serializedPage]);

  const title = useMemo(() => {
    if (!q) return 'Buscar obras y capítulos';
    return `Resultados para "${q}"`;
  }, [q]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <AppHeader className="mb-8" />

        <div className="bg-white rounded-2xl shadow-xl p-6 border border-slate-200/60 mb-6">
          <div className="flex items-center gap-2">
            <Icon path={Icons.search} size="md" />
            <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
          </div>
          {q && (
            <p className="text-gray-600 mt-2">Tipo: {type === 'all' ? 'Todos' : type === 'works' ? 'Obras' : type === 'chapters' ? 'Capítulos' : 'Obras por capítulos'}</p>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Buscando...</p>
          </div>
        ) : (
          <div className="space-y-8">
            {(type === 'all' || type === 'works') && (
              <section className="bg-white rounded-2xl shadow-xl p-6 border border-slate-200/60">
                <h2 className="text-xl font-semibold mb-4">Obras</h2>
                {works.length === 0 ? (
                  <p className="text-gray-600">No se encontraron obras.</p>
                ) : (
                  <>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {works
                        .slice(worksPage * PAGE_SIZE, (worksPage + 1) * PAGE_SIZE)
                        .map((w) => (
                          <li key={w.id}>
                            <Link
                              href={`/works/${w.slug || generateSlug(w.title)}`}
                              className="block cursor-pointer"
                            >
                              <Card hover variant="elevated" className="h-full">
                              <div className="flex justify-center mb-4">
                                {(() => {
                                  const meta = parsePreviewCover(w.cover_url || undefined, w.title, w.profiles?.display_name || 'Autor');
                                  if (meta.mode === 'image') {
                                    return (
                                      <div className="w-[180px] h-[270px] bg-gray-200 rounded overflow-hidden shadow-md">
                                        <Image
                                          src={meta.url}
                                          alt={`Portada de ${w.title}`}
                                          width={180}
                                          height={270}
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                    );
                                  }
                                  if (meta.mode === 'template') {
                                    const validTemplateIds = ['template-1','template-2','template-3','template-4','template-5','template-6','template-7','template-8'] as const;
                                    const validPaletteIds = ['marino','rojo','negro','verde','purpura'] as const;
                                    const safeTemplateId = (validTemplateIds as readonly string[]).includes(meta.templateId) ? meta.templateId as typeof validTemplateIds[number] : 'template-1';
                                    const safePaletteId = (validPaletteIds as readonly string[]).includes(meta.paletteId) ? meta.paletteId as typeof validPaletteIds[number] : 'marino';
                                    return (
                                      <CoverRenderer
                                        mode="template"
                                        templateId={safeTemplateId}
                                        title={meta.title}
                                        author={meta.author}
                                        paletteId={safePaletteId}
                                        width={180}
                                        height={270}
                                        className="shadow-md rounded-sm"
                                      />
                                    );
                                  }
                                  return (
                                    <CoverRenderer
                                      mode="auto"
                                      title={w.title}
                                      author={w.profiles?.display_name || 'Autor'}
                                      paletteId="marino"
                                      width={180}
                                      height={270}
                                      className="shadow-md rounded-sm"
                                    />
                                  );
                                })()}
                              </div>
                              <CardHeader
                                title={w.title}
                                subtitle={w.profiles?.display_name || 'Autor'}
                                action={
                                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    <Icon path={Icons.book} size="xs" /> Obra
                                  </span>
                                }
                              />
                              <CardBody>
                                <p className="text-sm text-slate-700">Obra completa publicada</p>
                              </CardBody>
                              <CardFooter align="between" className="mt-2">
                                <span className="text-indigo-700">Ver ficha</span>
                              </CardFooter>
                              </Card>
                            </Link>
                          </li>
                        ))}
                    </ul>
                    {worksTotal > PAGE_SIZE && (
                      <Pagination
                        total={worksTotal}
                        page={worksPage}
                        pageSize={PAGE_SIZE}
                        onChange={setWorksPage}
                      />
                    )}
                  </>
                )}
              </section>
            )}

            {(type === 'all' || type === 'chapters') && (
              <section className="bg-white rounded-2xl shadow-xl p-6 border border-slate-200/60">
                <h2 className="text-xl font-semibold mb-4">Capítulos</h2>
                {chapters.length === 0 ? (
                  <p className="text-gray-600">No se encontraron capítulos.</p>
                ) : (
                  <>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {chapters
                        .slice(chaptersPage * PAGE_SIZE, (chaptersPage + 1) * PAGE_SIZE)
                        .map((c) => (
                          <li key={c.id}>
                            <Card hover variant="elevated" className="h-full">
                              <div className="flex justify-center mb-4">
                                {(() => {
                                  const meta = parsePreviewCover(undefined, c.title, c.profiles?.display_name || 'Autor');
                                  if (meta.mode === 'template') {
                                    const validTemplateIds = ['template-1','template-2','template-3','template-4','template-5','template-6','template-7','template-8'] as const;
                                    const validPaletteIds = ['marino','rojo','negro','verde','purpura'] as const;
                                    const safeTemplateId = (validTemplateIds as readonly string[]).includes(meta.templateId) ? meta.templateId as typeof validTemplateIds[number] : 'template-1';
                                    const safePaletteId = (validPaletteIds as readonly string[]).includes(meta.paletteId) ? meta.paletteId as typeof validPaletteIds[number] : 'marino';
                                    return (
                                      <CoverRenderer
                                        mode="template"
                                        templateId={safeTemplateId}
                                        title={meta.title}
                                        author={meta.author}
                                        paletteId={safePaletteId}
                                        width={180}
                                        height={270}
                                        className="shadow-md rounded-sm"
                                      />
                                    );
                                  }
                                  if (meta.mode === 'image') {
                                    return (
                                      <div className="w-[180px] h-[270px] bg-gray-200 rounded overflow-hidden shadow-md">
                                        <Image
                                          src={meta.url}
                                          alt={`Portada de ${c.title}`}
                                          width={180}
                                          height={270}
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                    );
                                  }
                                  return (
                                    <CoverRenderer
                                      mode="auto"
                                      title={c.title}
                                      author={c.profiles?.display_name || 'Autor'}
                                      paletteId="marino"
                                      width={180}
                                      height={270}
                                      className="shadow-md rounded-sm"
                                    />
                                  );
                                })()}
                              </div>
                              <CardHeader
                                title={c.title}
                                subtitle={c.profiles?.display_name || 'Autor'}
                                action={
                                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-green-50 text-green-700 border border-green-200">
                                    <Icon path={Icons.play} size="xs" /> Capítulo
                                  </span>
                                }
                              />
                              <CardBody>
                                <p className="text-sm text-slate-700">Capítulo publicado</p>
                              </CardBody>
                              <CardFooter align="between" className="mt-2">
                                <Link href={`/chapters/${c.slug || generateSlug(c.title)}`} className="text-indigo-700 hover:underline">
                                  Ver ficha
                                </Link>
                              </CardFooter>
                            </Card>
                          </li>
                        ))}
                    </ul>
                    {chaptersTotal > PAGE_SIZE && (
                      <Pagination
                        total={chaptersTotal}
                        page={chaptersPage}
                        pageSize={PAGE_SIZE}
                        onChange={setChaptersPage}
                      />
                    )}
                  </>
                )}
              </section>
            )}

            {(type === 'all' || type === 'serialized') && (
              <section className="bg-white rounded-2xl shadow-xl p-6 border border-slate-200/60">
                <h2 className="text-xl font-semibold mb-4">Obras por capítulos</h2>
                {serializedWorks.length === 0 ? (
                  <p className="text-gray-600">No se encontraron obras por capítulos.</p>
                ) : (
                  <>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {serializedWorks
                        .slice(serializedPage * PAGE_SIZE, (serializedPage + 1) * PAGE_SIZE)
                        .map((w) => (
                          <li key={w.id}>
                            <Link
                              href={`/works/${w.slug || generateSlug(w.title)}`}
                              className="block cursor-pointer"
                            >
                              <Card hover variant="elevated" className="h-full">
                              <div className="flex justify-center mb-4">
                                {(() => {
                                  const meta = parsePreviewCover(w.cover_url || undefined, w.title, w.profiles?.display_name || 'Autor');
                                  if (meta.mode === 'image') {
                                    return (
                                      <div className="w-[180px] h-[270px] bg-gray-200 rounded overflow-hidden shadow-md">
                                        <Image
                                          src={meta.url}
                                          alt={`Portada de ${w.title}`}
                                          width={180}
                                          height={270}
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                    );
                                  }
                                  if (meta.mode === 'template') {
                                    const validTemplateIds = ['template-1','template-2','template-3','template-4','template-5','template-6','template-7','template-8'] as const;
                                    const validPaletteIds = ['marino','rojo','negro','verde','purpura'] as const;
                                    const safeTemplateId = (validTemplateIds as readonly string[]).includes(meta.templateId) ? meta.templateId as typeof validTemplateIds[number] : 'template-1';
                                    const safePaletteId = (validPaletteIds as readonly string[]).includes(meta.paletteId) ? meta.paletteId as typeof validPaletteIds[number] : 'marino';
                                    return (
                                      <CoverRenderer
                                        mode="template"
                                        templateId={safeTemplateId}
                                        title={meta.title}
                                        author={meta.author}
                                        paletteId={safePaletteId}
                                        width={180}
                                        height={270}
                                        className="shadow-md rounded-sm"
                                      />
                                    );
                                  }
                                  return (
                                    <CoverRenderer
                                      mode="auto"
                                      title={w.title}
                                      author={w.profiles?.display_name || 'Autor'}
                                      paletteId="marino"
                                      width={180}
                                      height={270}
                                      className="shadow-md rounded-sm"
                                    />
                                  );
                                })()}
                              </div>
                              <CardHeader
                                title={w.title}
                                subtitle={w.profiles?.display_name || 'Autor'}
                                action={
                                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-purple-50 text-purple-700 border border-purple-200">
                                    <Icon path={Icons.library} size="xs" /> Serie
                                  </span>
                                }
                              />
                              <CardBody>
                                <p className="text-sm text-slate-700">Obra seriada</p>
                              </CardBody>
                              <CardFooter align="between" className="mt-2">
                                <span className="text-indigo-700">{w.slug ? 'Ver obra' : 'Slug no disponible'}</span>
                              </CardFooter>
                              </Card>
                            </Link>
                          </li>
                        ))}
                    </ul>
                    {serializedTotal > PAGE_SIZE && (
                      <Pagination
                        total={serializedTotal}
                        page={serializedPage}
                        pageSize={PAGE_SIZE}
                        onChange={setSerializedPage}
                      />
                    )}
                  </>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-8"><p className="text-gray-600">Cargando búsqueda...</p></div>}>
      <SearchContent />
    </Suspense>
  );
}