import type { Page } from '@playwright/test';
import {
  confirmModal,
  drawerClosed,
  expect,
  getState,
  getStored,
  goTo,
  openPanel,
  test,
} from './fixtures';

interface TripForm {
  origin: string;
  dest: string;
  date: string;
  dep: string;
  arr: string;
  odoS: string;
  odoE: string;
  comp?: string;
  unit?: 'kmpl' | 'l100';
}
async function openNewTrip(page: Page) {
  await openPanel(page, 'n', '#tripForm');
}
async function fillTrip(page: Page, f: TripForm) {
  await page.fill('#tOrigin', f.origin);
  await page.fill('#tDest', f.dest);
  await page.fill('#tDate', f.date);
  await page.fill('#tDep', f.dep);
  await page.fill('#tArr', f.arr);
  await page.fill('#tOdoS', f.odoS);
  await page.fill('#tOdoE', f.odoE);
  if (f.comp) {
    await page.fill('#tComp', f.comp);
    await page.selectOption('#tCompUnit', f.unit ?? 'kmpl');
  }
}
const submit = (page: Page) => page.click('button[form=tripForm]');

const NEW: TripForm = {
  origin: 'Casa',
  dest: 'Escuela nueva',
  date: '2024-06-15',
  dep: '07:30',
  arr: '08:05',
  odoS: '50000',
  odoE: '50012.5',
};

test.beforeEach(async ({ app }) => {
  await goTo(app, 'viajes', 'Viajes');
});

test('crear un viaje: se guarda con ruta generada y crea el lugar nuevo', async ({ app }) => {
  const before = await getState(app);
  await openNewTrip(app);
  await fillTrip(app, NEW);
  await expect(app.locator('#cKm')).toContainText('12.5');
  await expect(app.locator('#cDur')).toContainText('35');
  await submit(app);
  await expect(app.locator('#toasts')).toContainText('Viaje guardado');

  const s = await getState(app);
  expect(s.trips).toHaveLength(before.trips.length + 1);
  const t = s.trips.find((x) => x.destination === 'Escuela nueva')!;
  expect(t).toMatchObject({
    origin: 'Casa',
    date: '2024-06-15',
    depart: '07:30',
    arrive: '08:05',
    odoStart: 50000,
    odoEnd: 50012.5,
    pointsSource: 'auto',
    computerKmpl: null,
  });
  // el lugar nuevo no tiene ubicación, así que no hay ruta que generar
  expect(s.places.find((p) => p.name === 'Escuela nueva')).toMatchObject({ lat: null, lng: null });
  expect(t.points).toEqual([]);
  // al crear un viaje entre lugares ubicados, la ruta sí se genera
  await app.click('[data-dz=another]');
  await expect(app.locator('#tripForm')).toBeVisible();
  await fillTrip(app, { ...NEW, origin: 'Casa', dest: 'Oficina', odoS: '50100', odoE: '50118' });
  await submit(app);
  await expect(app.locator('#toasts')).toContainText('Viaje guardado');
  const s2 = await getState(app);
  const t2 = s2.trips.find((x) => x.odoStart === 50100)!;
  expect(t2.points.length).toBeGreaterThanOrEqual(20);
  expect(t2.points.length).toBeLessThanOrEqual(60);
});

test('un viaje que cruza la medianoche dura lo correcto', async ({ app }) => {
  await openNewTrip(app);
  await fillTrip(app, {
    ...NEW,
    origin: 'Oficina',
    dest: 'Casa',
    dep: '23:40',
    arr: '00:25',
    odoS: '50000',
    odoE: '50018',
  });
  await expect(app.locator('#cDur')).toContainText('45');
  await submit(app);
  await expect(app.locator('#toasts')).toContainText('Viaje guardado');
  const t = (await getState(app)).trips.find((x) => x.odoStart === 50000)!;
  expect(t).toMatchObject({ depart: '23:40', arrive: '00:25' });
  const pts = t.points;
  expect(pts.length).toBeGreaterThanOrEqual(20);
  const span = Date.parse(pts[pts.length - 1].t) - Date.parse(pts[0].t);
  expect(span).toBe(45 * 60 * 1000);
});

test('rendimiento de la computadora en L/100 km se guarda normalizado a km/L', async ({ app }) => {
  await openNewTrip(app);
  await fillTrip(app, { ...NEW, dest: 'Oficina', comp: '7.1', unit: 'l100' });
  await expect(app.locator('#cLit')).not.toHaveText('—');
  await submit(app);
  await expect(app.locator('#toasts')).toContainText('Viaje guardado');
  const t = (await getState(app)).trips.find((x) => x.odoStart === 50000)!;
  expect(t.computerUnit).toBe('l100');
  expect(t.computerKmpl).toBeCloseTo(100 / 7.1, 3);
  expect((await getState(app)).settings.computerUnit).toBe('l100');
});

test('editar un viaje con la tecla E conserva el id y regenera la ruta automática', async ({
  app,
}) => {
  await openNewTrip(app);
  await fillTrip(app, { ...NEW, dest: 'Oficina' });
  await submit(app);
  await app.click('[data-dz=view-trip]');
  const created = (await getState(app)).trips.find((x) => x.odoStart === 50000)!;
  await expect(app.locator(`#row-${created.id}`)).toHaveAttribute('aria-selected', 'true');

  await app.keyboard.press('e');
  await expect(app.locator('#tripForm')).toBeVisible();
  await expect(app.locator('#tArr')).toHaveValue('08:05');
  await app.fill('#tArr', '08:20');
  await app.fill('#tComp', '14.5');
  await app.selectOption('#tCompUnit', 'kmpl');
  await submit(app);
  await expect(app.locator('#toasts')).toContainText('Viaje actualizado');

  const s = await getState(app);
  const t = s.trips.find((x) => x.id === created.id)!;
  expect(s.trips.filter((x) => x.odoStart === 50000)).toHaveLength(1);
  expect(t).toMatchObject({ arrive: '08:20', computerKmpl: 14.5, computerUnit: 'kmpl' });
  expect(t.pointsSource).toBe('auto');
  expect(t.points).not.toEqual(created.points);
  const last = t.points[t.points.length - 1];
  expect(Date.parse(last.t) - Date.parse(t.points[0].t)).toBe(50 * 60 * 1000);
});

test('un formulario incompleto muestra los errores y no guarda nada', async ({ app }) => {
  const before = await getState(app);
  await openNewTrip(app);
  await submit(app);
  await expect(app.locator('#tripForm .err:not(:empty)').first()).toBeVisible();
  await app.fill('#tOrigin', 'Casa');
  await app.fill('#tDest', 'Oficina');
  await app.fill('#tArr', '09:00');
  await app.fill('#tOdoS', '100');
  await app.fill('#tOdoE', '90');
  await submit(app);
  await expect(app.locator('[data-err=tOdoE]')).toContainText('Debe ser mayor al inicial.');
  await app.fill('#tOdoE', '112');
  await app.fill('#tComp', '99'); // fuera de 3–40 km/L
  await submit(app);
  await expect(app.locator('#tripForm')).toBeVisible();
  expect((await getState(app)).trips).toHaveLength(before.trips.length);
  // con datos escritos, Esc pregunta antes de descartar
  await app.keyboard.press('Escape');
  await expect(app.locator('#mTitle')).toHaveText('¿Descartar los cambios?');
  await confirmModal(app);
  await drawerClosed(app);
});

test('eliminar un viaje pide confirmación y se puede cancelar', async ({ app }) => {
  const before = await getState(app);
  const id = before.trips[0].id;
  await app.click(`#row-${id}`);
  await app.click('[data-action=delete-trip]');
  await app.click('[data-m="0"]');
  expect((await getState(app)).trips).toHaveLength(before.trips.length);
  await app.click('[data-action=delete-trip]');
  await confirmModal(app);
  await expect(app.locator(`#row-${id}`)).toHaveCount(0);
  const s = await getState(app);
  expect(s.trips).toHaveLength(before.trips.length - 1);
  expect(s.ui.selTrip).toBeNull();
});

test('los filtros y el orden de la tabla funcionan', async ({ app }) => {
  const state = await getState(app);
  const personal = state.trips.filter((t) => t.tag === 'Personal').length;
  await app.click('[data-action=filter-tag][data-tag=Personal]');
  await expect(app.locator('#content tbody tr')).toHaveCount(personal);
  await app.click('[data-action=clear-filters]');
  await expect(app.locator('#content tbody tr')).toHaveCount(state.trips.length);
  await app.click('[data-action=sort][data-key=km]');
  const first = await app.locator('#content tbody tr').first().getAttribute('id');
  const longest = [...state.trips].sort(
    (a, b) => b.odoEnd - b.odoStart - (a.odoEnd - a.odoStart),
  )[0];
  const shortest = [...state.trips].sort(
    (a, b) => a.odoEnd - a.odoStart - (b.odoEnd - b.odoStart),
  )[0];
  expect([`row-${longest.id}`, `row-${shortest.id}`]).toContain(first);
});

test('los viajes sobreviven a una recarga (localStorage)', async ({ app }) => {
  await openNewTrip(app);
  await fillTrip(app, { ...NEW, dest: 'Oficina' });
  await submit(app);
  await expect(app.locator('#toasts')).toContainText('Viaje guardado');
  const before = await getState(app);
  expect(await getStored(app)).toMatchObject({ version: 2 });
  await app.reload();
  await expect(app.locator('#content .view')).toBeVisible();
  const after = await getState(app);
  expect(after.trips).toEqual(before.trips);
  expect(after.places).toEqual(before.places);
});

test('las rutas generadas no se guardan en localStorage, pero reaparecen idénticas al recargar', async ({
  app,
}) => {
  const before = await getState(app);
  const auto = before.trips.filter((t) => t.pointsSource === 'auto');
  expect(auto.length).toBeGreaterThan(5);
  expect(auto.every((t) => t.points.length >= 20)).toBe(true);

  const stored = await getStored(app);
  expect(stored!.trips.filter((t) => 'points' in t)).toHaveLength(0);
  const bytes = await app.evaluate(() => (localStorage.getItem('trayecto:v2') || '').length);
  expect(bytes).toBeLessThan(JSON.stringify(before).length * 0.4);

  await app.reload();
  await expect(app.locator('#content .view')).toBeVisible();
  const after = await getState(app);
  expect(after.trips).toEqual(before.trips);
});
