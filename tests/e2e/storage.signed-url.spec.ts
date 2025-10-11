import { test, expect, request } from '@playwright/test';

test.describe('Storage Signed URL', () => {
  test('bloquea anónimo con 401', async ({}, testInfo) => {
    const baseURL = testInfo.project.use?.baseURL as string;
    const anon = await request.newContext({
      baseURL,
      // Asegurar contexto sin cookies ni estado previo
      storageState: { cookies: [], origins: [] },
    });
    const res = await anon.post('/api/storage/signed-url', {
      data: {
        filePath: 'works/nonexistent-file.jpg',
        bucket: 'works',
        expiresIn: 3600,
      },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body).toBeTruthy();
    await anon.dispose();
  });

  test('admin no recibe 401/403 (gating correcto)', async ({ request }) => {
    const res = await request.post('/api/storage/signed-url', {
      data: {
        filePath: 'works/nonexistent-file.jpg',
        bucket: 'works',
        expiresIn: 3600,
      },
    });
    expect([401, 403]).not.toContain(res.status());
    const body = await res.json();
    expect(body).toBeTruthy();
  });

  test('admin recibe 404 cuando el archivo no existe', async ({ request }) => {
    const res = await request.post('/api/storage/signed-url', {
      data: {
        filePath: 'works/nonexistent-file-for-404-check.jpg',
        bucket: 'works',
        expiresIn: 3600,
      },
    });
    expect(res.status()).toBe(404);
    const json = await res.json();
    expect(json?.error?.code).toBe('RESOURCE_NOT_FOUND');
  });
});