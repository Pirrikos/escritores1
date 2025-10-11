import React from "react";
import { Icon, Icons } from "@/components/ui";

type ChapterRowProps = {
  title: string;
  slug: string;
  hasPdf: boolean;
  progressRatio?: number;
  isDeleted: boolean;
  onOpen: () => void;
};

export function ChapterRow({ title, slug, hasPdf, progressRatio, isDeleted, onOpen }: ChapterRowProps) {
  return (
    <div key={`chapter:${slug}`} className="mt-3 rounded-xl border border-slate-200 bg-white/60 p-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-slate-800">{title}</h4>
        {isDeleted ? (
          <span className="text-xs rounded-md border border-red-200 bg-red-50 text-red-700 px-2 py-1">
            Este capítulo ha sido borrado por su autor y ya no está disponible.
          </span>
        ) : hasPdf ? (
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-700 hover:bg-indigo-100"
            onClick={onOpen}
          >
            <Icon path={Icons.play} size="sm" />
            {typeof progressRatio === "number" && progressRatio > 0 ? "Continuar" : "Empezar"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default ChapterRow;