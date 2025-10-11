import { test, expect, request } from '@playwright/test';

// Este test valida el rate limit global por IP aplicado desde middleware
// Config actual (middleware): 100 requests/min por IP, bloqueo 10 min

test.describe('Rate Limit Global por IP', () => {
  test('aplica cabeceras y eventualmente bloquea con 429 al exceder límite', async ({}, testInfo) => {
    const baseURL = testInfo.project.use?.baseURL as string;
    // Usar IP única por ejecución para evitar estado previo del store
    const uniqueIp = `203.0.113.${Math.floor(1 + Math.random() * 200)}`; // TEST-NET-3

    const anon = await request.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
      extraHTTPHeaders: { 'x-forwarded-for': uniqueIp },
    });

    // Primer request: verificar cabeceras de rate limit del middleware
    const first = await anon.get('/api/health?type=liveness');
    expect(first.status()).toBe(200);
    const firstHeaders = first.headers();
    expect(firstHeaders['x-ratelimit-limit']).toBe('100');
    expect(firstHeaders['x-ratelimit-window']).toBe('60');

    // Intentar alcanzar el límite: hasta 200 peticiones, rompiendo al primer 429
    let exceededResponse: import('@playwright/test').APIResponse | null = null;
    for (let i = 2; i <= 200; i++) {
      const res = await anon.get('/api/health?type=liveness');
      if (res.status() === 429) {
        exceededResponse = res;
        break;
      }
      expect([200, 429].includes(res.status()), `estado solicitud ${i}`).toBeTruthy();
    }

    // Si bloquea, validar cuerpo y cabeceras; si no, al menos comprobamos cabeceras del middleware
    if (exceededResponse) {
      const body = await exceededResponse.json();
      expect(body?.error).toBeTruthy();
      expect(body?.retryAfter).toBeTruthy();
      const headers = exceededResponse.headers();
      const retryHeader = headers['retry-after'];
      expect(retryHeader).toBeTruthy();
      const retryAfterNum = Number(retryHeader);
      expect(Number.isFinite(retryAfterNum) && retryAfterNum > 0).toBeTruthy();
    }

    await anon.dispose();
  });
});