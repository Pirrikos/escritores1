import { test, expect } from '@playwright/test';

const hasCreds = !!process.env.TEST_ADMIN_EMAIL
  && !!process.env.TEST_ADMIN_PASSWORD
  && !!process.env.NEXT_PUBLIC_SUPABASE_URL
  && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

test.describe('System Init API (admin only)', () => {
  test('GET /api/system/init returns status for admin', async ({ request }) => {
    test.skip(!hasCreds, 'Admin credentials or Supabase config missing');

    const res = await request.get('/api/system/init');
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('success', true);
    expect(json).toHaveProperty('data');
  });

  test('POST /api/system/init initialize (admin)', async ({ request }) => {
    test.skip(!hasCreds, 'Admin credentials or Supabase config missing');

    // Skip if service role key is not present; initialization will fail without it
    test.skip(!process.env.SUPABASE_SERVICE_ROLE_KEY, 'Service role key missing for backup init');

    const res = await request.post('/api/system/init', {
      data: { action: 'initialize' },
    });
    expect([200, 400, 500]).toContain(res.status());
    const json = await res.json();
    // Should not be unauthorized/forbidden if admin cookies are valid
    expect(json).not.toHaveProperty('code', 'UNAUTHORIZED');
    expect(json).not.toHaveProperty('code', 'FORBIDDEN');
  });
});