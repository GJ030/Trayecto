import { expect, goTo, test } from './fixtures';

const CDN = /unpkg\.com|openfreemap\.org/;

test.beforeEach(async ({ app }) => {
  await goTo(app, 'lugares', 'Lugares');
});

test('sin conexión el aviso del mapa ofrece Reintentar y reintenta de verdad', async ({ app }) => {
  const retry = app.locator('#content .map-retry');
  await expect(retry).toBeVisible();
  await expect(retry).toContainText('Mapa sin conexión');

  let requests = 0;
  app.on('request', (r) => {
    if (CDN.test(r.url())) requests++;
  });
  await retry.click();
  // sigue sin conexión, así que vuelve a fallar, pero la app sí volvió a pedir el mapa
  await expect.poll(() => requests).toBeGreaterThan(0);
  await expect(app.locator('#content .map-retry')).toBeVisible();
});

test('el aviso de «Ubicar en el mapa» no se apila al pulsarlo varias veces', async ({ app }) => {
  await app.click('details.add-place summary');
  await app.fill('#plName', 'Sitio sin ubicar');
  await app.uncheck('#plLocate');
  await app.click('#addPlaceForm button[type=submit]');
  const locate = app.locator('[data-action=locate-start]').filter({ hasText: 'Ubicar en el mapa' });
  await expect(locate).toHaveCount(1);
  for (let i = 0; i < 4; i++) await locate.click();
  await expect(app.locator('#toasts .toast').filter({ hasText: 'Reintentar' })).toHaveCount(1);
});

test('los mapas fallidos no impiden usar el resto de la pantalla', async ({ app }) => {
  await goTo(app, 'inicio', 'Inicio');
  await expect(app.locator('#content .map-retry')).toBeVisible();
  await app.locator('#content .map-retry').click();
  await expect(app.locator('#content .view')).toBeVisible();
  await goTo(app, 'viajes', 'Viajes');
});
