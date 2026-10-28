import type { Page } from '@playwright/test';
import {
  LINE,
  confirmModal,
  downloadText,
  expect,
  getState,
  getStored,
  goTo,
  routeBackup,
  test,
} from './fixtures';

async function importBackup(page: Page, text: string) {
  await goTo(page, 'respaldo', 'Respaldo');
  await page.setInputFiles('#importFile', {
    name: 'respaldo.json',
    mimeType: 'application/json',
    buffer: Buffer.from(text),
  });
  await confirmModal(page);
  await expect(page.locator('#toasts')).toContainText('Respaldo importado');
}

test('importar un respaldo con rutas las conserva en memoria sin consultar a ningún servicio', async ({
  app,
}) => {
  const osrm: string[] = [];
  app.on('request', (r) => {
    if (/osrm/.test(r.url())) osrm.push(r.url());
  });
  await importBackup(app, routeBackup());
  const s = await getState(app);
  const ta = s.trips.find((t) => t.id === 'ta')!;
  expect(ta.route).toMatchObject({
    status: 'ok',
    distance: 5234.5,
    duration: 612.3,
    n: LINE.length,
  });
  expect(ta.route!.geometry!.coordinates).toEqual(LINE);
  expect(ta.waypoints).toEqual([{ lat: 10.02, lng: 10.02 }]);
  expect(s.trips.find((t) => t.id === 'tb')!.route).toMatchObject({ status: 'pending' });
  expect(osrm).toEqual([]);
});

test('el localStorage solo guarda los datos ligeros de la ruta, nunca la geometría', async ({
  app,
}) => {
  await importBackup(app, routeBackup());
  const stored = await getStored(app);
  const ta = stored!.trips.find((t) => t.id === 'ta')!;
  expect(ta.route).toEqual({
    status: 'ok',
    sig: 'sig-ta',
    distance: 5234.5,
    duration: 612.3,
    n: LINE.length,
  });
  expect(ta.waypoints).toEqual([{ lat: 10.02, lng: 10.02 }]);
  const raw = await app.evaluate(() => localStorage.getItem('trayecto:v2') || '');
  expect(raw).not.toContain('coordinates');
  expect(raw).not.toContain('"poly"');
});

test('Exportar JSON lleva las rutas como polyline', async ({ app }) => {
  await importBackup(app, routeBackup());
  const { text } = await downloadText(app, '[data-action=export-json]');
  const file = JSON.parse(text);
  const ta = file.data.trips.find((t: { id: string }) => t.id === 'ta');
  expect(ta.route.poly).toEqual(expect.any(String));
  expect(ta.route.geometry).toBeUndefined();
  expect(text).not.toContain('coordinates');
  expect(ta.route).toMatchObject({ status: 'ok', sig: 'sig-ta', n: LINE.length });
  expect(ta.waypoints).toEqual([{ lat: 10.02, lng: 10.02 }]);
});

test('lo exportado se vuelve a importar sin perder la ruta', async ({ app }) => {
  await importBackup(app, routeBackup());
  const before = (await getState(app)).trips.find((t) => t.id === 'ta')!;
  const { text } = await downloadText(app, '[data-action=export-json]');
  await goTo(app, 'ajustes', 'Ajustes');
  await app.click('[data-action=wipe]');
  await confirmModal(app);
  await expect.poll(async () => (await getState(app)).trips.length).toBe(0);
  await importBackup(app, text);
  const after = (await getState(app)).trips.find((t) => t.id === 'ta')!;
  expect(after.route).toEqual(before.route);
});

test('sin carpeta de datos la geometría no sobrevive a una recarga: la ruta queda pendiente', async ({
  app,
}) => {
  await importBackup(app, routeBackup());
  await app.reload();
  await expect(app.locator('#content .view')).toBeVisible();
  await expect
    .poll(async () => (await getState(app)).trips.find((t) => t.id === 'ta')!.route!.status)
    .toBe('pending');
  const ta = (await getState(app)).trips.find((t) => t.id === 'ta')!;
  expect(ta.route!.geometry).toBeUndefined();
  expect(ta.waypoints).toEqual([{ lat: 10.02, lng: 10.02 }]);
});

test('un respaldo no puede activar «Rutas por calles reales» en este equipo', async ({ app }) => {
  await importBackup(app, routeBackup({ routing: true }));
  expect((await getState(app)).settings.routing).toBe(false);
});
