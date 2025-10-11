import { z } from 'zod';

export const ViewPdfSchema = z.object({
  contentType: z.enum(['work', 'chapter']),
  contentSlug: z.string().min(1),
  bucket: z.string().min(1).optional(),
  filePath: z.string().min(1).optional(),
});

export const ReadingProgressSchema = z.object({
  contentType: z.enum(['work', 'chapter']),
  contentSlug: z.string().min(1),
  bucket: z.string().min(1).optional(),
  filePath: z.string().min(1).optional(),
  lastPage: z.preprocess((v) => {
    const n = parseInt(String(v), 10);
    return Number.isFinite(n) ? n : v;
  }, z.number().int().min(1)),
  numPages: z.union([
    z.null(),
    z.preprocess((v) => {
      if (v == null) return v;
      const n = parseInt(String(v), 10);
      return Number.isFinite(n) ? n : v;
    }, z.number().int().min(1)),
  ]).optional(),
}).refine((data) => {
  // Si numPages es número, debe ser >= lastPage
  return typeof data.numPages !== 'number' || data.numPages >= data.lastPage;
}, {
  message: 'numPages_must_be_greater_or_equal_to_lastPage',
  path: ['numPages'],
});