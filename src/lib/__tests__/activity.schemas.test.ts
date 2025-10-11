import { describe, it, expect } from 'vitest';
import { ViewPdfSchema, ReadingProgressSchema } from '../../app/api/activity/schemas';

describe('Activity Schemas', () => {
  it('ViewPdfSchema accepts valid payloads', () => {
    const res = ViewPdfSchema.safeParse({
      contentType: 'work',
      contentSlug: 'abc',
      bucket: 'works',
      filePath: 'works/u/file.pdf',
    });
    expect(res.success).toBe(true);
  });

  it('ViewPdfSchema rejects invalid payloads', () => {
    const res = ViewPdfSchema.safeParse({
      contentType: 'invalid' as any,
      contentSlug: '',
    });
    expect(res.success).toBe(false);
  });

  it('ReadingProgressSchema accepts numPages omitted or null', () => {
    const r1 = ReadingProgressSchema.safeParse({
      contentType: 'work',
      contentSlug: 'xyz',
      lastPage: 2,
      numPages: null,
    });
    const r2 = ReadingProgressSchema.safeParse({
      contentType: 'work',
      contentSlug: 'xyz',
      lastPage: 2,
    });
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
  });

  it('ReadingProgressSchema rejects numPages < lastPage', () => {
    const res = ReadingProgressSchema.safeParse({
      contentType: 'work',
      contentSlug: 'xyz',
      lastPage: 5,
      numPages: 4,
    });
    expect(res.success).toBe(false);
  });
});