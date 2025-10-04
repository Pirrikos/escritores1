"use client";

import { parsePreviewCover } from '@/lib/utils';

type Sample = {
  name: string;
  input?: string;
  titleFallback: string;
  authorFallback: string;
  expect: {
    mode: 'template' | 'image' | 'auto';
    templateId?: string;
    paletteId?: string;
  };
};

const samples: Sample[] = [
  {
    name: 'Preview completo',
    input:
      'preview:template-3:rojo:se%20ve%20bien%20la%20portada%3F:ISRAEL%20QUILON%20SANCHEZ',
    titleFallback: 'Fallback Title',
    authorFallback: 'Fallback Author',
    expect: { mode: 'template', templateId: 'template-3', paletteId: 'rojo' },
  },
  {
    name: 'URL de imagen',
    input: 'https://example.com/image.jpg',
    titleFallback: 'Img Title',
    authorFallback: 'Img Author',
    expect: { mode: 'image' },
  },
  {
    name: 'Sin cover_url',
    input: undefined,
    titleFallback: 'Auto Title',
    authorFallback: 'Auto Author',
    expect: { mode: 'auto' },
  },
];


function ResultRow({ name, input, titleFallback, authorFallback, expect }: Sample) {
  const meta = parsePreviewCover(input, titleFallback, authorFallback);
  const pass = meta.mode === expect.mode &&
    (meta.mode !== 'template' ||
      (meta.templateId === expect.templateId && meta.paletteId === expect.paletteId));
  return (
    <div className="flex items-center justify-between border-b py-2">
      <div>
        <div className="font-medium">{name}</div>
        <div className="text-xs text-gray-500 break-all">Entrada: {String(input)}</div>
        <div className="text-xs text-gray-500">Salida: {JSON.stringify(meta)}</div>
      </div>
      <span className={`px-2 py-1 rounded text-xs ${pass ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
        {pass ? 'PASS' : 'FAIL'}
      </span>
    </div>
  );
}

export default function CoverUtilsTestPage() {
  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Pruebas: parsePreviewCover</h1>
      <div className="rounded border bg-white p-4 space-y-3">
        {samples.map((s, i) => (
          <ResultRow key={i} {...s} />
        ))}
      </div>
      <p className="mt-4 text-sm text-gray-600">
        Estas pruebas ligeras verifican el modo y metadatos básicos sin framework.
      </p>
    </div>
  );
}