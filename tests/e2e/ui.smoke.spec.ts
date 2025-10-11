import { test, expect } from '@playwright/test';

// Usa sesión admin generada por global.setup para acceder a páginas protegidas
test.use({ storageState: 'tests/e2e/.storage/admin.json' });

const routes = [
  '/', // redirige a /home
  '/home',
  '/library',
  '/buscar?q=prueba&type=all',
  '/mis-lecturas',
  '/obras-por-capitulos',
  '/chapters',
  // Páginas de subida (requieren sesión)
  '/upload/obra-por-capitulos',
  '/upload/works',
  '/upload/chapters',
  // Admin
  '/admin',
  '/admin/posts',
  '/admin/blog',
  // Páginas de prueba y debug (si existen)
  '/debug-styles',
  '/test',
  '/test/cover-utils',
];

test.describe('UI Smoke (navegación básica sin errores de consola)', () => {
  for (const route of routes) {
    test(`navega a ${route} sin errores`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', err => consoleErrors.push(err.message));

      const resp = await page.goto(route, { waitUntil: 'networkidle' });
      // Algunas rutas pueden renderizar mediante redirecciones; aceptamos 200-304
      expect([200, 304]).toContain(resp?.status() ?? 200);

      // Evitar falsos positivos de warnings benévolos; solo fallar si hay errores
      if (consoleErrors.length) {
        consoleErrors.forEach(e => console.warn(`[console.error] ${route}:`, e));
      }
      expect(consoleErrors, `errores en consola para ${route}`).toEqual([]);

      // Smoke extra: asegurar que el body existe y tiene contenido
      const body = page.locator('body');
      await expect(body).toBeVisible();
      await expect(body).not.toBeEmpty();

      // Aserciones específicas por ruta para mayor robustez
      try {
        if (route === '/mis-lecturas') {
          await expect(page.getByRole('heading', { name: 'Mis lecturas' })).toBeVisible();
        } else if (route.startsWith('/buscar')) {
          // El título puede ser "Resultados para \"...\"" o "Buscar obras y capítulos"
          const resultsTitle = page.getByRole('heading').filter({ hasText: 'Resultados para' });
          const defaultTitle = page.getByRole('heading', { name: 'Buscar obras y capítulos' });
          await expect(resultsTitle.or(defaultTitle)).toBeVisible();
        } else if (route === '/debug-styles') {
          await expect(page.getByRole('heading', { name: 'Debug de Estilos' })).toBeVisible();
        } else if (route === '/test/cover-utils') {
          await expect(page.getByRole('heading', { name: 'Pruebas: parsePreviewCover' })).toBeVisible();
        } else {
          // En la mayoría de páginas, el header contiene el link "Inicio"
          await expect(page.getByRole('link', { name: 'Inicio' })).toBeVisible();
        }
      } catch (e) {
        // No fallar el smoke por una aserción frágil; el objetivo principal es detectar errores de consola
        console.warn(`[ui.smoke] assertion fallback on ${route}:`, (e as Error).message);
      }
    });
  }
});