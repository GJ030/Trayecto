import type { Page } from '@playwright/test';
import { confirmModal, drawerClosed, expect, getState, goTo, test } from './fixtures';

test.beforeEach(async ({ app }) => {
  await goTo(app, 'lugares', 'Lugares');
});

const openMenu = async (page: Page, id: string, action: string) => {
  await page.click(`#pm-${id}`);
  await page.click(`[data-action=${action}][data-id=${id}]`);
};

test('sin conexión el mapa de lugares usa el respaldo SVG', async ({ app }) => {
  await expect(app.locator('#content [data-pmap]')).toBeVisible();
  await expect(app.locator('#content')).toContainText('Mapa sin conexión');
});

test('agregar un lugar sin ubicación', async ({ app }) => {
  const before = await getState(app);
  await app.click('details.add-place summary');
  await app.fill('#plName', 'Parque');
  await app.fill('#plArea', 'Zona norte');
  await app.uncheck('#plLocate');
  await app.click('#addPlaceForm button[type=submit]');
  await expect(app.locator('#pageSub')).toContainText(`${before.places.length + 1} lugares`);
  const p = (await getState(app)).places.find((x) => x.name === 'Parque')!;
  expect(p).toMatchObject({ area: 'Zona norte', lat: null, lng: null });
  // no se puede repetir
  await app.click('details.add-place summary');
  await app.fill('#plName', 'parque');
  await app.click('#addPlaceForm button[type=submit]');
  expect((await getState(app)).places).toHaveLength(before.places.length + 1);
});

test('renombrar un lugar reescribe sus viajes y no toca las rutas', async ({ app }) => {
  const before = await getState(app);
  const gym = before.places.find((p) => p.name === 'Gimnasio')!;
  const used = before.trips.filter((t) => t.origin === 'Gimnasio' || t.destination === 'Gimnasio');
  expect(used.length).toBeGreaterThan(0);

  await openMenu(app, gym.id, 'place-edit');
  await app.fill('#pName', 'Gym Central');
  await app.click('button[form=placeForm]');
  await drawerClosed(app);

  const s = await getState(app);
  expect(s.places.find((p) => p.id === gym.id)!.name).toBe('Gym Central');
  expect(s.trips.some((t) => t.origin === 'Gimnasio' || t.destination === 'Gimnasio')).toBe(false);
  expect(
    s.trips.filter((t) => t.origin === 'Gym Central' || t.destination === 'Gym Central'),
  ).toHaveLength(used.length);
  expect(s.trips.map((t) => t.points)).toEqual(before.trips.map((t) => t.points));
  expect(s.trips).toHaveLength(before.trips.length);
});

test('fusionar dos lugares y deshacer con Ctrl+Z deja todo como estaba', async ({ app }) => {
  const before = await getState(app);
  const [src, dst] = ['Casa de mis papás', 'Casa'].map((n) =>
    before.places.find((p) => p.name === n)!,
  );
  const moved = before.trips.filter(
    (t) => t.origin === src.name || t.destination === src.name,
  ).length;
  expect(moved).toBeGreaterThan(0);

  await openMenu(app, src.id, 'place-merge');
  await app.selectOption('#mergeDst', dst.id);
  await confirmModal(app);
  await expect(app.locator('#toasts')).toContainText('Deshacer');

  const merged = await getState(app);
  expect(merged.places.some((p) => p.id === src.id)).toBe(false);
  expect(merged.trips.some((t) => t.origin === src.name || t.destination === src.name)).toBe(false);
  expect(merged.trips).toHaveLength(before.trips.length);

  await app.keyboard.press('Control+z');
  await expect.poll(async () => (await getState(app)).places.length).toBe(before.places.length);
  const after = await getState(app);
  expect(after.places).toEqual(before.places);
  expect(after.trips).toEqual(before.trips);
});

test('eliminar un lugar con viajes los conserva si se elige «Conservar los viajes»', async ({
  app,
}) => {
  const before = await getState(app);
  const p = before.places.find((x) => x.name === 'Cliente Santa Fe')!;
  await openMenu(app, p.id, 'place-delete');
  await expect(app.locator('#mBody')).toContainText('viaje');
  await app.click('[data-m="0"]'); // Conservar los viajes
  await expect(app.locator('#toasts')).toContainText('eliminado');
  const s = await getState(app);
  expect(s.places.some((x) => x.id === p.id)).toBe(false);
  expect(s.trips).toEqual(before.trips);
});

test('cancelar el diálogo de eliminar no cambia nada', async ({ app }) => {
  const before = await getState(app);
  await openMenu(app, 'p5', 'place-delete');
  await app.click('[data-m="x"]');
  expect((await getState(app)).places).toEqual(before.places);
});

test('seleccionar un lugar y un trayecto actualiza la selección guardada', async ({ app }) => {
  await app.click('#pl-p2');
  expect((await getState(app)).ui.selPlace).toBe('p2');
  await app.locator('[data-action=pair-select]').first().click();
  expect((await getState(app)).ui.selPair).toMatch(/→/);
  await app.click('[data-action=clear-place]');
  expect((await getState(app)).ui.selPlace).toBeNull();
});
