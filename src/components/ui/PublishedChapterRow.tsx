import React from "react";
import Link from "next/link";

type PublishedChapterRowProps = {
  slug: string;
  title: string;
  chapterNumber?: number | null;
  hasPdf: boolean;
  onOpen: () => void;
};

export function PublishedChapterRow({ slug, title, chapterNumber, hasPdf, onOpen }: PublishedChapterRowProps) {
  return (
    <div key={`chapter-pub:${slug}`} className="mt-3 rounded-xl border border-slate-200 bg-white/60 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {typeof chapterNumber === 'number' ? (
            <span className="text-xs font-medium text-slate-700">Capítulo {chapterNumber}</span>
          ) : null}
          <h4 className="text-sm font-medium text-slate-800">{title}</h4>
        </div>
        <div className="flex items-center gap-2">
          {hasPdf ? (
            <button
              className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm"
              onClick={onOpen}
            >
              Ver
            </button>
          ) : null}
          <Link
            className="px-3 py-1 rounded bg-gray-100 text-gray-800 hover:bg-gray-200 text-sm"
            href={`/chapters/${slug}`}
          >
            Ir al capítulo
          </Link>
        </div>
      </div>
    </div>
  );
}

export default PublishedChapterRow;