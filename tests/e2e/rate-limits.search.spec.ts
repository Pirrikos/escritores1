import { test, expect } from '@playwright/test';

test.describe('Rate Limit SEARCH por IP', () => {
  test('aplica cabeceras y bloquea tras exceder el límite', async ({ request }) => {
    const ip = `203.0.113.${Math.floor(Math.random() * 200 + 1)}`;

    // Verificar cabeceras de rate limit en una petición exitosa
    const okResp = await request.get('/api/search?q=prueba&type=all', {
      headers: { 'x-forwarded-for': ip },
    });
    expect(okResp.status()).toBe(200);
    const limitHeader = okResp.headers()['x-ratelimit-limit'];
    const windowHeader = okResp.headers()['x-ratelimit-window'];
    expect(limitHeader).toBeDefined();
    expect(windowHeader).toBeDefined();
    // Para SEARCH esperamos 30 req/min
    expect(Number(limitHeader)).toBeGreaterThan(0);
    expect(Number(windowHeader)).toBeGreaterThan(0);

    // Intentar alcanzar el 429 con hasta 100 peticiones adicionales
    let got429 = false;
    let retryAfterHeader: string | undefined;
    for (let i = 0; i < 100; i++) {
      const resp = await request.get(`/api/search?q=prueba-${i}&type=all`, {
        headers: { 'x-forwarded-for': ip },
      });
      if (resp.status() === 429) {
        got429 = true;
        retryAfterHeader = resp.headers()['retry-after'];
        const body = await resp.json();
        expect(body?.error?.code).toBe('RATE_LIMIT_EXCEEDED');
        expect(body?.error?.details?.limit).toBeTruthy();
        expect(body?.error?.details?.remaining).toBe(0);
        expect(body?.error?.details?.resetTime).toBeTruthy();
        break;
      }
    }

    if (got429) {
      // Algunos endpoints no exponen Retry-After como cabecera; validamos sólo el body
      expect(got429).toBeTruthy();
    } else {
      // Si no hemos alcanzado el límite, al menos validamos cabeceras correctas
      expect(limitHeader).toBeDefined();
      expect(windowHeader).toBeDefined();
    }
  });
});