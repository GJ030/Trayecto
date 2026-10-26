import { expect, test } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const APP = pathToFileURL(resolve('dist/trayecto.html')).href;

test('la app construida abre por file:// sin errores en consola', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    // Sin conexión a la CDN de los mapas la app usa su respaldo SVG; el navegador sí registra la red caída.
    if (m.type() === 'error' && !/Failed to load resource|net::ERR_/.test(m.text()))
      errors.push(m.text());
  });
  await page.route(/unpkg\.com|openfreemap\.org/, (r) => r.abort());
  await page.goto(APP);
  await expect(page).toHaveTitle('Trayecto');
  await expect(page.locator('#pageTitle')).toHaveText('Inicio');
  await expect(page.locator('#content .view')).toBeVisible();
  expect(errors).toEqual([]);
});
