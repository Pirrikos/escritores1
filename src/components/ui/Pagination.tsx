import React from 'react';
import { cn } from '@/lib/utils';

export interface PaginationProps {
  total: number;
  page: number; // cero-indexado
  pageSize: number;
  onChange: (nextPage: number) => void;
  className?: string;
}

export default function Pagination({ total, page, pageSize, onChange, className }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canPrev = page > 0;
  const canNext = page < totalPages - 1;
  const start = total === 0 ? 0 : page * pageSize + 1;
  const end = Math.min(total, (page + 1) * pageSize);

  const goPrev = () => {
    if (canPrev) onChange(page - 1);
  };
  const goNext = () => {
    if (canNext) onChange(page + 1);
  };

  return (
    <div className={cn('flex items-center justify-between mt-4', className)}>
      <div className="text-sm text-slate-600">
        Mostrando {start}–{end} de {total}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={goPrev}
          disabled={!canPrev}
          className={cn(
            'px-3 py-1.5 rounded-md border text-sm',
            canPrev ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50' : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
          )}
          aria-label="Anterior"
        >
          Anterior
        </button>
        <span className="text-sm text-slate-600">
          Página {page + 1} / {totalPages}
        </span>
        <button
          type="button"
          onClick={goNext}
          disabled={!canNext}
          className={cn(
            'px-3 py-1.5 rounded-md border text-sm',
            canNext ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50' : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
          )}
          aria-label="Siguiente"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}