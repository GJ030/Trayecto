import type { Page } from '@playwright/test';
import { drawerClosed, expect, getState, goTo, openPanel, test } from './fixtures';

const openTrip = (page: Page) => openPanel(page, 'n', '#tripForm');
const pick = (page: Page, mode: 'end' | 'dist') =>
  page.click(`#tripForm .seg label:has(input[value=${mode}])`);
async function fillBasics(page: Page) {
  await page.fill('#tOrigin', 'Casa');
  await page.fill('#tDest', 'Oficina');
  await page.fill('#tDate', '2024-06-15');
  await page.fill('#tDep', '07:30');
  await page.fill('#tArr', '08:05');
}

test.beforeEach(async ({ app }) => {
  await goTo(app, 'viajes', 'Viajes');
});

test('por omisión se captura el odómetro final, como siempre', async ({ app }) => {
  await openTrip(app);
  await expect(app.locator('input[name=tOdoMode][value=end]')).toBeChecked();
  await expect(app.locator('#tOdoE')).toBeVisible();
  await expect(app.locator('#tDist')).toBeHidden();
  expect((await getState(app)).settings.odoMode).toBe('end');
});

test('con el interruptor en «Distancia del viaje» el final se calcula solo', async ({ app }) => {
  await openTrip(app);
  await fillBasics(app);
  await pick(app, 'dist');
  await expect(app.locator('#tDist')).toBeVisible();
  await expect(app.locator('#tOdoE')).toBeHidden();
  await app.fill('#tOdoS', '50000');
  await app.fill('#tDist', '12.5');
  await expect(app.locator('#tOdoDerived')).toContainText('Odómetro final: 50,012.5 km');
  await expect(app.locator('#cKm')).toContainText('12.5');
  await app.click('button[form=tripForm]');
  await expect(app.locator('#toasts')).toContainText('Viaje guardado');

  const s = await getState(app);
  const t = s.trips.find((x) => x.odoStart === 50000)!;
  expect(t.odoEnd).toBe(50012.5);
  expect(s.settings.odoMode).toBe('dist'); // se recuerda para la próxima vez
});

test('el modo elegido se recuerda al abrir otro viaje y tras recargar', async ({ app }) => {
  await openTrip(app);
  await fillBasics(app);
  await pick(app, 'dist');
  await app.fill('#tOdoS', '50000');
  await app.fill('#tDist', '9');
  await app.click('button[form=tripForm]');
  await expect(app.locator('#toasts')).toContainText('Viaje guardado');
  await app.keyboard.press('Escape');
  await drawerClosed(app);

  await openTrip(app);
  await expect(app.locator('input[name=tOdoMode][value=dist]')).toBeChecked();
  await expect(app.locator('#tDist')).toBeVisible();
  // (Esc cerraría primero la lista de sugerencias de Origen, que tiene el foco)
  await app.click('button[aria-label="Cerrar panel"]');
  await drawerClosed(app);
  await app.reload();
  await openTrip(app);
  await expect(app.locator('input[name=tOdoMode][value=dist]')).toBeChecked();
});

test('al cambiar el odómetro inicial se conserva lo que se está capturando', async ({ app }) => {
  await openTrip(app);
  await app.fill('#tOdoS', '100');
  // modo final: se conserva el final y cambia la distancia
  await app.fill('#tOdoE', '120');
  await app.fill('#tOdoS', '110');
  await expect(app.locator('#tOdoE')).toHaveValue('120');
  await pick(app, 'dist');
  await expect(app.locator('#tDist')).toHaveValue('10');
  // modo distancia: se conserva la distancia y cambia el final
  await app.fill('#tOdoS', '200');
  await expect(app.locator('#tDist')).toHaveValue('10');
  await expect(app.locator('#tOdoDerived')).toContainText('Odómetro final: 210.0 km');
  await pick(app, 'end');
  await expect(app.locator('#tOdoE')).toHaveValue('210');
});

test('al cambiar de modo los dos valores se mantienen coherentes', async ({ app }) => {
  await openTrip(app);
  await app.fill('#tOdoS', '1000');
  await app.fill('#tOdoE', '1017.4');
  await pick(app, 'dist');
  await expect(app.locator('#tDist')).toHaveValue('17.4');
  await app.fill('#tDist', '20.1');
  await pick(app, 'end');
  await expect(app.locator('#tOdoE')).toHaveValue('1020.1');
});

test('la distancia se valida al guardar y no se guarda nada si es inválida', async ({ app }) => {
  const before = await getState(app);
  await openTrip(app);
  await fillBasics(app);
  await pick(app, 'dist');
  await app.fill('#tOdoS', '50000');
  await app.click('button[form=tripForm]');
  await expect(app.locator('[data-err=tDist]')).toContainText('Captura la distancia.');
  await app.fill('#tDist', '0');
  await app.click('button[form=tripForm]');
  await expect(app.locator('[data-err=tDist]')).toContainText('Debe ser mayor a 0.');
  await app.fill('#tDist', '2500');
  await app.click('button[form=tripForm]');
  await expect(app.locator('[data-err=tDist]')).toContainText('demasiado grande');
  await app.fill('#tOdoS', '');
  await app.fill('#tDist', '10');
  await app.click('button[form=tripForm]');
  await expect(app.locator('[data-err=tOdoS]')).toContainText('Captura el odómetro inicial.');
  expect((await getState(app)).trips).toHaveLength(before.trips.length);
});

test('al editar un viaje en modo distancia se ve su distancia y se puede cambiar', async ({
  app,
}) => {
  const before = await getState(app);
  const t0 = before.trips[0];
  await app.click(`#row-${t0.id}`);
  await app.keyboard.press('e');
  await expect(app.locator('#tripForm')).toBeVisible();
  await pick(app, 'dist');
  const km = +(t0.odoEnd - t0.odoStart).toFixed(3);
  await expect(app.locator('#tDist')).toHaveValue(String(km));
  await app.fill('#tDist', '25');
  await app.click('button[form=tripForm]');
  await expect(app.locator('#toasts')).toContainText('Viaje actualizado');
  const t = (await getState(app)).trips.find((x) => x.id === t0.id)!;
  expect(t.odoStart).toBe(t0.odoStart);
  expect(t.odoEnd).toBeCloseTo(t0.odoStart + 25, 6);
});
