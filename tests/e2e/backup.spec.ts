import { test, expect } from '@playwright/test';

const hasCreds = !!process.env.TEST_ADMIN_EMAIL
  && !!process.env.TEST_ADMIN_PASSWORD
  && !!process.env.NEXT_PUBLIC_SUPABASE_URL
  && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

test.describe('Backup API (admin only)', () => {
  test('GET /api/backup?action=statistics returns stats for admin', async ({ request }) => {
    test.skip(!hasCreds, 'Admin credentials or Supabase config missing');

    const res = await request.get('/api/backup?action=statistics');
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('success', true);
    expect(json).toHaveProperty('data');
  });

  test('GET /api/backup?action=list returns list for admin', async ({ request }) => {
    test.skip(!hasCreds, 'Admin credentials or Supabase config missing');

    const res = await request.get('/api/backup?action=list');
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('success', true);
    expect(json?.data).toHaveProperty('tables');
    expect(Array.isArray(json?.data?.tables)).toBeTruthy();
    // Ensure allowed tables are present
    for (const t of ['posts', 'profiles', 'follows', 'works']) {
      expect(json.data.tables).toContain(t);
    }
  });
});