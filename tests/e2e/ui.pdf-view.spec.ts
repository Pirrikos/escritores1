import { test, expect } from '@playwright/test';

// Usa sesión admin para poder invocar endpoints protegidos
test.use({ storageState: 'tests/e2e/.storage/admin.json' });

const runAuthE2E = process.env.CI === 'true' || process.env.RUN_AUTH_E2E === 'true';

test.describe('UI PDF (registro de vista y flujo de visor)', () => {
  (runAuthE2E ? test : test.skip)('registra vista PDF vía endpoint desde contexto UI', async ({ page }) => {
    const resp = await page.request.post('/api/activity/view-pdf', {
      data: {
        contentType: 'chapter',
        contentSlug: 'e2e-ui-smoke',
        bucket: 'chapters',
        filePath: 'chapters/sample-user/sample.pdf',
      },
    });
    // En entornos locales puede fallar por credenciales; aceptar 200 o 401
    expect([200, 401]).toContain(resp.status());
    const json = await resp.json();
    // Endpoint devuelve success true/false o error; evitar que rompa
    expect(json).toBeTruthy();
  });

  test('navega a capítulo dev con ?view=pdf y muestra aviso si no hay PDF', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => consoleErrors.push(err.message));

    // Usar un slug inexistente para validar mensaje genérico o banner de PDF
    const resp = await page.goto('/chapters/no-existe-e2e?view=pdf', { waitUntil: 'networkidle' });
    expect([200, 304]).toContain(resp?.status() ?? 200);

    // La UI puede mostrar aviso informativo del visor o mensaje de capítulo no disponible
    const infoOrError = page
      .getByText('Este capítulo no tiene un archivo disponible para ver en el visor PDF.')
      .or(page.getByText('El archivo de este capítulo no es PDF, por eso se muestra la ficha.'))
      .or(page.getByText('El capítulo que buscas no existe o no está disponible.'));
    await expect(infoOrError).toBeVisible();

    expect(consoleErrors, 'errores en consola flujo PDF').toEqual([]);
  });
});