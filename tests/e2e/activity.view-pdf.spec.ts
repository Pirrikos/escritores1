import { test, expect, request } from '@playwright/test';
import path from 'path';

const hasCreds = !!process.env.TEST_ADMIN_EMAIL
  && !!process.env.TEST_ADMIN_PASSWORD
  && !!process.env.NEXT_PUBLIC_SUPABASE_URL
  && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const runAuthE2E = process.env.CI === 'true' || process.env.RUN_AUTH_E2E === 'true';

(runAuthE2E ? test.describe : test.describe.skip)('Activity: view-pdf', () => {
  test('POST /api/activity/view-pdf succeeds for valid payload and sets rate limit headers', async () => {
    test.skip(!hasCreds, 'Admin credentials or Supabase config missing');

    const api = await request.newContext({
      baseURL: process.env.BASE_URL || 'http://localhost:3000',
      storageState: path.resolve(__dirname, '.storage/admin.json'),
    });
    // Ensure auth is functional
    const who = await api.get('/api/whoami');
    if (who.status() !== 200) {
      // Bail out in local envs without working auth
      return;
    }
    const res = await api.post('/api/activity/view-pdf', {
      data: {
        contentType: 'work',
        contentSlug: 'sample-slug',
        bucket: 'works',
        filePath: 'works/sample-user/sample.pdf',
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

  test('POST /api/activity/view-pdf returns 400 for invalid payload', async () => {
    test.skip(!hasCreds, 'Admin credentials or Supabase config missing');

    const api = await request.newContext({
      baseURL: process.env.BASE_URL || 'http://localhost:3000',
      storageState: path.resolve(__dirname, '.storage/admin.json'),
    });
    const who = await api.get('/api/whoami');
    if (who.status() !== 200) {
      return;
    }
    const res = await api.post('/api/activity/view-pdf', {
      data: {
        contentType: 'invalid',
        contentSlug: '',
      },
    });
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json).toHaveProperty('error', 'invalid_payload');
  });
});