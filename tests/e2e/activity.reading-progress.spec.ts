import { test, expect, request } from '@playwright/test';
import path from 'path';

const hasCreds = !!process.env.TEST_ADMIN_EMAIL
  && !!process.env.TEST_ADMIN_PASSWORD
  && !!process.env.NEXT_PUBLIC_SUPABASE_URL
  && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const runAuthE2E = process.env.CI === 'true' || process.env.RUN_AUTH_E2E === 'true';

(runAuthE2E ? test.describe : test.describe.skip)('Activity: reading-progress', () => {
  test('POST /api/activity/reading-progress succeeds with valid payload and headers present', async () => {
    test.skip(!hasCreds, 'Admin credentials or Supabase config missing');

    const api = await request.newContext({
      baseURL: process.env.BASE_URL || 'http://localhost:3000',
      storageState: path.resolve(__dirname, '.storage/admin.json'),
    });
    const who = await api.get('/api/whoami');
    if (who.status() !== 200) {
      return;
    }
    const res = await api.post('/api/activity/reading-progress', {
      data: {
        contentType: 'chapter',
        contentSlug: 'sample-chapter',
        bucket: 'chapters',
        filePath: 'chapters/sample-user/sample-chapter.pdf',
        lastPage: 3,
        numPages: 10,
      },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ success: true });
    const headers = res.headers();
    expect(headers['x-ratelimit-limit']).toBeTruthy();
    expect(headers['x-ratelimit-remaining']).toBeTruthy();
    expect(headers['x-ratelimit-reset']).toBeTruthy();
  });

  test('POST /api/activity/reading-progress fails when numPages < lastPage', async () => {
    test.skip(!hasCreds, 'Admin credentials or Supabase config missing');

    const api = await request.newContext({
      baseURL: process.env.BASE_URL || 'http://localhost:3000',
      storageState: path.resolve(__dirname, '.storage/admin.json'),
    });
    const who = await api.get('/api/whoami');
    if (who.status() !== 200) {
      return;
    }
    const res = await api.post('/api/activity/reading-progress', {
      data: {
        contentType: 'work',
        contentSlug: 'sample-work',
        lastPage: 5,
        numPages: 4,
      },
    });
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json).toHaveProperty('error', 'invalid_payload');
  });

  test('POST /api/activity/reading-progress accepts numPages null or omitted', async () => {
    test.skip(!hasCreds, 'Admin credentials or Supabase config missing');

    const api = await request.newContext({
      baseURL: process.env.BASE_URL || 'http://localhost:3000',
      storageState: path.resolve(__dirname, '.storage/admin.json'),
    });
    const who = await api.get('/api/whoami');
    if (who.status() !== 200) {
      return;
    }
    const res1 = await api.post('/api/activity/reading-progress', {
      data: {
        contentType: 'work',
        contentSlug: 'sample-work-2',
        lastPage: 2,
        numPages: null,
      },
    });
    expect(res1.status()).toBe(200);
    const res2 = await api.post('/api/activity/reading-progress', {
      data: {
        contentType: 'work',
        contentSlug: 'sample-work-3',
        lastPage: 1,
      },
    });
    expect(res2.status()).toBe(200);
  });
});