import { describe, it, expect } from 'vitest';
import { normalizeBucketAndPath } from '../activityLogger';

describe('activityLogger.normalizeBucketAndPath', () => {
  it('extracts bucket and path from signed Supabase URL', () => {
    const url = 'https://xyz.supabase.co/sign/works/user123/files/sample.pdf';
    const res = normalizeBucketAndPath(url);
    expect(res.bucket).toBe('works');
    expect(res.path).toBe('user123/files/sample.pdf');
  });

  it('returns fallback when not a URL', () => {
    const src = 'works/user123/files/sample.pdf';
    const res = normalizeBucketAndPath(src, { bucket: 'works', path: src });
    expect(res.bucket).toBe('works');
    expect(res.path).toBe(src);
  });

  it('handles malformed URL gracefully', () => {
    const src = 'http:///bad/url';
    const res = normalizeBucketAndPath(src, { bucket: null, path: src });
    expect(res.bucket).toBeNull();
    expect(res.path).toBe(src);
  });
});