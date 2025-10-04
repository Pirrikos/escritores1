import { test, expect, request } from '@playwright/test';
import path from 'path';

const hasCreds = !!process.env.TEST_ADMIN_EMAIL
  && !!process.env.TEST_ADMIN_PASSWORD
  && !!process.env.NEXT_PUBLIC_SUPABASE_URL
  && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

test.describe('Whoami (auth smoke)', () => {
  test('GET /api/whoami returns user with admin storageState', async () => {
    test.skip(!hasCreds, 'Admin credentials or Supabase config missing');

    const api = await request.newContext({
      baseURL: process.env.BASE_URL || 'http://localhost:3000',
      storageState: path.resolve(__dirname, '.storage/admin.json'),
    });
    const res = await api.get('/api/whoami');
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('success', true);
    expect(json).toHaveProperty('user.email');
    expect(json.user.email).toBe(process.env.TEST_ADMIN_EMAIL);
  });
});