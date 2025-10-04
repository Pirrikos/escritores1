import { test, expect, request } from '@playwright/test';

test.describe('Debug Insert', () => {
  test('bloquea anónimo con 401', async ({}, testInfo) => {
    const baseURL = testInfo.project.use?.baseURL as string;
    const anon = await request.newContext({
      baseURL,
      // Asegurar contexto sin cookies ni estado previo
      storageState: { cookies: [], origins: [] },
    });
    const res = await anon.get('/api/debug-insert');
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body).toBeTruthy();
    await anon.dispose();
  });

  test('admin puede acceder (no 401/403)', async ({ request }) => {
    const res = await request.get('/api/debug-insert');
    expect([401, 403]).not.toContain(res.status());
    const body = await res.json();
    expect(body).toBeTruthy();
  });
});