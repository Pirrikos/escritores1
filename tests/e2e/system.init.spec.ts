import { test, expect, request } from '@playwright/test';
import path from 'path';

const hasCreds = !!process.env.TEST_ADMIN_EMAIL
  && !!process.env.TEST_ADMIN_PASSWORD
  && !!process.env.NEXT_PUBLIC_SUPABASE_URL
  && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

test.describe('System Init API (admin only)', () => {
  test('GET /api/system/init returns status for admin', async () => {
    test.skip(!hasCreds, 'Admin credentials or Supabase config missing');

    const api = await request.newContext({
      baseURL: process.env.BASE_URL || 'http://localhost:3000',
      storageState: path.resolve(__dirname, '.storage/admin.json'),
    });
    const res = await api.get('/api/system/init');
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('success', true);
    expect(json).toHaveProperty('data');
  });

  test('POST /api/system/init initialize (admin)', async () => {
    test.skip(!hasCreds, 'Admin credentials or Supabase config missing');

    // Skip if service role key is not present; initialization will fail without it
    test.skip(!process.env.SUPABASE_SERVICE_ROLE_KEY, 'Service role key missing for backup init');

    const api = await request.newContext({
      baseURL: process.env.BASE_URL || 'http://localhost:3000',
      storageState: path.resolve(__dirname, '.storage/admin.json'),
    });
    const res = await api.post('/api/system/init', {
      data: { action: 'initialize' },
    });
    expect([200, 400, 500]).toContain(res.status());
    const json = await res.json();
    // Should not be unauthorized/forbidden if admin cookies are valid
    expect(json).not.toHaveProperty('code', 'UNAUTHORIZED');
    expect(json).not.toHaveProperty('code', 'FORBIDDEN');
  });
});