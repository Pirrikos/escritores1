import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Cover parsing helpers
export type PreviewCoverMeta = {
  mode: 'template';
  templateId: string;
  paletteId: string;
  title: string;
  author: string;
};

export type ImageCoverMeta = {
  mode: 'image';
  url: string;
};

export type AutoCoverMeta = {
  mode: 'auto';
};

function safeDecode(value?: string, fallback?: string) {
  if (!value || value.length === 0) return fallback || '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Parse a chapter/work cover_url into rendering metadata.
 * Supported formats:
 * - preview:<templateId>:<paletteId>:<encodedTitle>:<encodedAuthor>
 * - any other string => treated as direct image URL
 * - undefined/empty => auto cover
 */
export function parsePreviewCover(
  coverUrl?: string,
  titleFallback?: string,
  authorFallback?: string
): PreviewCoverMeta | ImageCoverMeta | AutoCoverMeta {
  if (!coverUrl) {
    return { mode: 'auto' };
  }

  if (coverUrl.startsWith('preview:')) {
    const parts = coverUrl.split(':');
    const templateId = parts[1] || 'template-1';
    const paletteId = parts[2] || 'marino';
    const encodedTitle = parts[3];
    const encodedAuthor = parts[4];

    return {
      mode: 'template',
      templateId,
      paletteId,
      title: safeDecode(encodedTitle, titleFallback),
      author: safeDecode(encodedAuthor, authorFallback),
    };
  }

  return { mode: 'image', url: coverUrl };
}