"use client";
import Link from "next/link";
import Image from "next/image";
import { Icon, Icons } from "@/components/ui";
import CoverRenderer from "@/components/ui/CoverRenderer";
import { parsePreviewCover } from "@/lib/utils";
import SignedWorkCover from "@/components/ui/SignedWorkCover";
import { PublishedChapterRow } from "@/components/ui/PublishedChapterRow";

type Item = {
  type: "work" | "chapter";
  slug: string;
  title: string;
  lastPage?: number;
  numPages?: number | null;
  updatedAt: Date;
  coverUrl?: string | null;
  authorName?: string;
  hasSerializedChapters?: boolean;
};

type ChapterSummary = { slug: string; title: string; hasPdf: boolean; chapter_number: number | null; file_type?: string | null };
type FallbackInfo = { firstSlug?: string; firstTitle?: string; firstHasPdf?: boolean; firstProgressRatio?: number | null };

export default function WorkCard({
  item,
  isDeleted,
  chapters = [],
  fallback,
  isSerializedWork,
  onOpenItem,
  onRemove,
  chapterProgressBySlug = {},
}: {
  item: Item;
  isDeleted: boolean;
  chapters?: ChapterSummary[];
  fallback?: FallbackInfo;
  isSerializedWork: boolean;
  onOpenItem: (itm: any) => void;
  onRemove: () => void;
  chapterProgressBySlug?: Record<string, number>;
}) {
  const percent = (typeof item.lastPage === 'number' && typeof item.numPages === 'number' && item.numPages! > 0)
    ? Math.round((item.lastPage! / item.numPages!) * 100)
    : null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/70 p-4">
      <div className="mb-4 flex justify-center">
        <div className="transform transition-transform duration-300">
          {(() => {
            const meta = parsePreviewCover(
              item.coverUrl || undefined,
              item.title,
              item.authorName || 'Autor Desconocido'
            );
            if ((meta as any).mode === 'template') {
              const tpl = (meta as any);
              const validTemplateIds = ['template-1','template-2','template-3'] as const;
              const validPaletteIds = ['marino','rojo','negro','verde','purpura'] as const;
              const safeTemplateId = (validTemplateIds as readonly string[]).includes(tpl.templateId) ? tpl.templateId : 'template-1';
              const normalizePalette = (p?: string) => {
                const synonyms: Record<string, string> = { morado: 'purpura' };
                const candidate = synonyms[p || ''] || p;
                return (validPaletteIds as readonly string[]).includes(candidate as string)
                  ? (candidate as typeof validPaletteIds[number])
                  : 'marino';
              };
              const safePaletteId = normalizePalette(tpl.paletteId);
              return (
                <CoverRenderer
                  mode="template"
                  templateId={safeTemplateId as any}
                  title={tpl.title}
                  author={tpl.author}
                  paletteId={safePaletteId as any}
                  width={180}
                  height={270}
                  className="shadow-md rounded-sm"
                />
              );
            }
            if ((meta as any).mode === 'image') {
              const url = (meta as any).url as string;
              const isHttp = /^https?:\/\//.test(url);
              return (
                <div className="w-[180px] h-[270px] bg-gray-200 rounded overflow-hidden shadow-md">
                  {isHttp ? (
                    <Image
                      src={url}
                      alt={`Portada de ${item.title}`}
                      width={180}
                      height={270}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <SignedWorkCover coverPath={url} title={item.title} />
                  )}
                </div>
              );
            }
            return (
              <CoverRenderer
                mode="auto"
                title={item.title}
                author={item.authorName || 'Autor Desconocido'}
                paletteId="marino"
                width={180}
                height={270}
                className="shadow-md rounded-sm"
              />
            );
          })()}
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-500">Obra</span>
        <span className="text-xs text-slate-400">{new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(item.updatedAt)}</span>
      </div>
      <h3 className="text-sm font-semibold text-slate-800 mb-1">{item.title}</h3>
      {isDeleted ? (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">Esta obra ha sido borrada por su autor y ya no está disponible.</p>
        </div>
      ) : null}
      {percent != null && (
        <div className="mb-3">
          <p className="text-xs text-slate-600 mb-1">{percent}% leído</p>
          <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Progreso de lectura">
            <div className="h-full bg-indigo-500" style={{ width: `${percent}%` }} />
          </div>
        </div>
      )}
      <div className="flex gap-3">
        {!isDeleted ? (
          <Link href={`/works/${item.slug}`} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
            Ver ficha
          </Link>
        ) : null}
        {!isDeleted && (
          item.type === 'work' && !item.hasSerializedChapters
        ) ? (
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-700 hover:bg-indigo-100"
            onClick={() => onOpenItem(item)}
          >
            <Icon path={Icons.play} size="sm" />
            Ver
          </button>
        ) : null}
        <button
          className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100"
          onClick={onRemove}
        >
          <Icon path={Icons.trash} size="sm" />
          Dejar de leer
        </button>
      </div>

      {/* Capítulos anidados dentro de la tarjeta */}
      {!isDeleted && chapters.length > 0 && (
        <div className="mt-3">
          {chapters.map(ch => {
            const pr = chapterProgressBySlug[ch.slug];
            return (
              <PublishedChapterRow
                key={`chapter-pub:${ch.slug}`}
                slug={ch.slug}
                title={ch.title}
                chapterNumber={typeof ch.chapter_number === 'number' ? ch.chapter_number : undefined}
                hasPdf={!!ch.hasPdf}
                onOpen={() => onOpenItem({
                  type: 'chapter',
                  slug: ch.slug,
                  title: ch.title,
                  bucket: 'chapters',
                  filePath: '',
                  lastPage: typeof pr === 'number' && pr > 0 ? Math.round((pr || 0) * (1000)) : null,
                  numPages: null,
                  updatedAt: new Date().toISOString() as any,
                  coverUrl: null,
                  authorName: 'Autor Desconocido',
                  progressRatio: typeof pr === 'number' ? pr : null,
                  hasPdf: true,
                } as any)}
              />
            );
          })}
        </div>
      )}
      {!isDeleted && (!chapters || chapters.length === 0) && fallback?.firstSlug && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white/60 p-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-slate-800">{fallback?.firstTitle || 'Capítulo'}</h4>
            {fallback?.firstHasPdf ? (
              <button
                className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-700 hover:bg-indigo-100"
                onClick={() => onOpenItem({
                  type: 'chapter',
                  slug: fallback!.firstSlug!,
                  title: fallback?.firstTitle || 'Capítulo',
                  bucket: 'chapters',
                  filePath: '',
                  lastPage: null,
                  numPages: null,
                  updatedAt: new Date().toISOString() as any,
                  coverUrl: null,
                  authorName: 'Autor Desconocido',
                  progressRatio: typeof fallback?.firstProgressRatio === 'number' ? fallback?.firstProgressRatio : null,
                  hasPdf: true,
                } as any)}
              >
                <Icon path={Icons.play} size="sm" />
                {typeof fallback?.firstProgressRatio === 'number' && (fallback?.firstProgressRatio as number) > 0 ? 'Continuar' : 'Empezar'}
              </button>
            ) : null}
          </div>
        </div>
      )}
      {!isDeleted && (!chapters || chapters.length === 0) && !fallback?.firstSlug && isSerializedWork && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white/60 p-3">
          <p className="text-sm text-slate-700">Esta obra no tiene capítulos publicados todavía.</p>
        </div>
      )}
    </div>
  );
}