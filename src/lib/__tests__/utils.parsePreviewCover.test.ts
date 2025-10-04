import { describe, it, expect } from 'vitest';
import { parsePreviewCover } from '../utils';

describe('parsePreviewCover', () => {
  it('returns auto mode when coverUrl is undefined', () => {
    const meta = parsePreviewCover(undefined);
    expect(meta).toEqual({ mode: 'auto' });
  });

  it('parses preview: template with encoded title and author', () => {
    const title = encodeURIComponent('El título con acentos: Canción');
    const author = encodeURIComponent('Autor Ñandú');
    const meta = parsePreviewCover(`preview:template-2:rojo:${title}:${author}`);
    expect(meta).toEqual({
      mode: 'template',
      templateId: 'template-2',
      paletteId: 'rojo',
      title: 'El título con acentos: Canción',
      author: 'Autor Ñandú',
    });
  });

  it('uses fallbacks when title/author are missing', () => {
    const meta = parsePreviewCover('preview:template-3:verde', 'Fallback Title', 'Fallback Author');
    expect(meta).toEqual({
      mode: 'template',
      templateId: 'template-3',
      paletteId: 'verde',
      title: 'Fallback Title',
      author: 'Fallback Author',
    });
  });

  it('returns image mode when coverUrl is a direct URL', () => {
    const meta = parsePreviewCover('https://example.com/image.jpg');
    expect(meta).toEqual({ mode: 'image', url: 'https://example.com/image.jpg' });
  });
});