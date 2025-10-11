import { test, expect } from '@playwright/test';

test.describe('Rate Limits Monitoring', () => {
  test.use({ storageState: 'tests/e2e/.storage/admin.json' });

  test('admin recibe 429 cuando supera el límite en /api/monitoring/rate-limits', async ({ page }) => {
    // El límite ADMIN es 20 solicitudes/5 min; validamos comportamiento sin asumir estado previo
    const maxAttempts = 25;
    let exceededResponse: import('@playwright/test').APIResponse | null = null;

    for (let i = 1; i <= maxAttempts; i++) {
      const res = await page.request.get('/api/monitoring/rate-limits');
      if (res.status() === 429) {
        exceededResponse = res;
        break;
      }
      expect([200, 429].includes(res.status()), `estado solicitud ${i}`).toBeTruthy();
    }

    expect(exceededResponse, 'debe observarse al menos un 429').toBeTruthy();
    const body = await exceededResponse!.json();
    expect(body?.error?.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(body?.error?.details?.limit).toBeTruthy();
  });
});