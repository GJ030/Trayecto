import type { Page } from '@playwright/test';
import {
  confirmModal,
  downloadText,
  drawerClosed,
  expect,
  getState,
  getStored,
  goTo,
  test,
} from './fixtures';

const importFile = (page: Page, name: string, text: string) =>
  page.setInputFiles('#importFile', {
    name,
    mimeType: 'application/json',
    buffer: Buffer.from(text),
  });
/** Los datos de un respaldo (sin pantalla ni la fecha del último respaldo). */
const dataOf = (s: Awaited<ReturnType<typeof getState>>) => ({
  vehicles: s.vehicles,
  places: s.places,
  trips: s.trips,
  fuel: s.fuel,
  settings: { ...s.settings, lastBackup: null },
});

test('exportar → borrar todo → importar deja los datos idénticos', async ({ app }) => {
  await goTo(app, 'respaldo', 'Respaldo');
  const { name, text } = await downloadText(app, '[data-action=export-json]');
  expect(name).toMatch(/^trayecto-respaldo-\d{4}-\d{2}-\d{2}\.json$/);
  const file = JSON.parse(text);
  expect(file).toMatchObject({ app: 'Trayecto', version: 2 });
  expect(Object.keys(file.data).sort()).toEqual([
    'fuel',
    'places',
    'settings',
    'trips',
    'vehicles',
  ]);
  expect(file.data.settings.lastBackup).toBeNull();
  const original = dataOf(await getState(app));
  expect(original.trips.length).toBeGreaterThan(10);
  expect((await getState(app)).settings.lastBackup).not.toBeNull(); // se anotó el respaldo

  await goTo(app, 'ajustes', 'Ajustes');
  await app.click('[data-action=wipe]');
  await confirmModal(app);
  await expect.poll(async () => (await getState(app)).trips.length).toBe(0);
  const wiped = await getState(app);
  expect([wiped.vehicles, wiped.places, wiped.fuel]).toEqual([[], [], []]);

  await goTo(app, 'respaldo', 'Respaldo');
  await importFile(app, 'respaldo.json', text);
  await expect(app.locator('#mBody')).toContainText(
    `${original.trips.length} viajes, ${original.fuel.length} cargas`,
  );
  await confirmModal(app);
  await expect(app.locator('#toasts')).toContainText('Respaldo importado');

  const restored = await getState(app);
  expect(dataOf(restored)).toEqual(original);
  expect(restored.ui.selTrip).toBeNull();

  // y queda guardado: sobrevive a una recarga
  expect(dataOf((await getStored(app))!)).toEqual(original);
  await app.reload();
  await expect(app.locator('#content .view')).toBeVisible();
  expect(dataOf(await getState(app))).toEqual(original);
});

test('el respaldo conserva el rendimiento de la computadora y los viajes que cruzan la medianoche', async ({
  app,
}) => {
  await goTo(app, 'viajes', 'Viajes');
  await app.keyboard.press('n');
  await expect(app.locator('#tripForm')).toBeVisible();
  await app.fill('#tOrigin', 'Casa');
  await app.fill('#tDest', 'Oficina');
  await app.fill('#tDate', '2024-06-15');
  await app.fill('#tDep', '23:50');
  await app.fill('#tArr', '00:20');
  await app.fill('#tOdoS', '50000');
  await app.fill('#tOdoE', '50011');
  await app.fill('#tComp', '8');
  await app.selectOption('#tCompUnit', 'l100');
  await app.click('button[form=tripForm]');
  await expect(app.locator('#toasts')).toContainText('Viaje guardado');
  await app.keyboard.press('Escape'); // cierra el resumen del viaje
  await drawerClosed(app);
  const original = dataOf(await getState(app));

  await goTo(app, 'respaldo', 'Respaldo');
  const { text } = await downloadText(app, '[data-action=export-json]');
  await goTo(app, 'ajustes', 'Ajustes');
  await app.click('[data-action=reset-demo]');
  await confirmModal(app);
  await expect
    .poll(async () => (await getState(app)).trips.length)
    .toBeLessThan(original.trips.length);

  await goTo(app, 'respaldo', 'Respaldo');
  await importFile(app, 'respaldo.json', text);
  await confirmModal(app);
  await expect(app.locator('#toasts')).toContainText('Respaldo importado');
  const s = await getState(app);
  expect(dataOf(s)).toEqual(original);
  const t = s.trips.find((x) => x.odoStart === 50000)!;
  expect(t).toMatchObject({ computerUnit: 'l100', depart: '23:50', arrive: '00:20' });
  expect(t.computerKmpl).toBeCloseTo(12.5, 3);
});

test('importar un archivo inválido o de una versión futura no toca los datos', async ({ app }) => {
  await goTo(app, 'respaldo', 'Respaldo');
  const before = dataOf(await getState(app));
  await importFile(app, 'malo.json', '{no es json');
  await expect(app.locator('#toasts')).toContainText('El archivo no es un JSON válido');
  await importFile(app, 'otro.json', JSON.stringify({ hola: 'mundo' }));
  await expect(app.locator('#toasts')).toContainText('no parece un respaldo de Trayecto');
  await importFile(
    app,
    'futuro.json',
    JSON.stringify({ version: 3, data: { trips: [], fuel: [], vehicles: [] } }),
  );
  await expect(app.locator('#toasts')).toContainText('versión más nueva');
  expect(dataOf(await getState(app))).toEqual(before);
});

test('cancelar la confirmación de importar conserva los datos actuales', async ({ app }) => {
  await goTo(app, 'respaldo', 'Respaldo');
  const { text } = await downloadText(app, '[data-action=export-json]');
  const empty = JSON.stringify({
    ...JSON.parse(text),
    data: { vehicles: [], places: [], trips: [], fuel: [], settings: {} },
  });
  const before = dataOf(await getState(app));
  await importFile(app, 'vacio.json', empty);
  await app.click('[data-m="0"]');
  expect(dataOf(await getState(app))).toEqual(before);
});

test('el CSV de viajes y el de cargas llevan BOM, encabezado y una fila por registro', async ({
  app,
}) => {
  await goTo(app, 'respaldo', 'Respaldo');
  const s = await getState(app);
  const trips = await downloadText(app, '[data-action=csv-trips]');
  expect(trips.name).toMatch(/^trayecto-viajes-\d{4}-\d{2}-\d{2}\.csv$/);
  expect(trips.text.charCodeAt(0)).toBe(0xfeff);
  const tl = trips.text.slice(1).split('\r\n');
  expect(tl[0].startsWith('fecha,salida,llegada,origen,destino')).toBe(true);
  expect(tl[0].endsWith('rendimiento_computadora_km_l')).toBe(true);
  expect(tl).toHaveLength(s.trips.length + 1);

  const fuel = await downloadText(app, '[data-action=csv-fuel]');
  const fl = fuel.text.slice(1).split('\r\n');
  expect(fl[0]).toBe(
    'fecha,vehiculo,gasolinera,odometro,litros,precio_litro,total_mxn,tanque_lleno,km_l',
  );
  expect(fl).toHaveLength(s.fuel.length + 1);
});

test('restablecer los datos de ejemplo y borrar todo piden confirmación', async ({ app }) => {
  await goTo(app, 'ajustes', 'Ajustes');
  const before = dataOf(await getState(app));
  await app.click('[data-action=wipe]');
  await app.click('[data-m="0"]');
  expect(dataOf(await getState(app))).toEqual(before);
  await app.click('[data-action=wipe]');
  await confirmModal(app);
  await expect.poll(async () => (await getState(app)).trips.length).toBe(0);
  await goTo(app, 'inicio', 'Inicio');
  await goTo(app, 'ajustes', 'Ajustes');
  await app.click('[data-action=reset-demo]');
  await confirmModal(app);
  await expect.poll(async () => (await getState(app)).trips.length).toBeGreaterThan(10);
});

test('datos guardados por la v1 se migran a v2 al abrir y trayecto:v1 se retira', async ({
  app,
}) => {
  await app.evaluate(() => {
    const v1 = {
      version: 1,
      vehicles: [
        {
          id: 'v1',
          name: 'Auto viejo',
          year: 2010,
          plate: '',
          fuel: 'Magna',
          tank: 40,
          color: '#FFB020',
        },
      ],
      places: [
        { id: 'p1', name: 'Casa', area: 'Zona', x: 500, y: 430, kind: 'home' },
        { id: 'p2', name: 'Oficina', area: '', x: 300, y: 175, kind: 'work' },
        { id: 'p3', name: 'Otro', area: '', x: 100, y: 100, kind: 'other' },
      ],
      trips: [
        {
          id: 't1',
          date: '2024-06-15',
          depart: '08:00',
          arrive: '08:40',
          origin: 'Casa',
          destination: 'Oficina',
          odoStart: 100,
          odoEnd: 118,
          vehicleId: 'v1',
          tag: 'Trabajo',
        },
        {
          id: 't2',
          date: '2024-06-16',
          depart: '08:00',
          arrive: '08:40',
          origin: 'Casa',
          destination: 'Otro',
          odoStart: 118,
          odoEnd: 130,
          vehicleId: 'v1',
          tag: 'Personal',
        },
      ],
      fuel: [
        {
          id: 'f1',
          date: '2024-06-15',
          station: 'Shell',
          odometer: 120,
          liters: 30,
          price: 24,
          full: true,
          vehicleId: 'v1',
        },
      ],
      settings: { defaultVehicle: 'v1', defaultTag: 'Trabajo', hints: true, lastBackup: null },
      ui: {},
    };
    localStorage.clear();
    localStorage.setItem('trayecto:v1', JSON.stringify(v1));
  });
  await app.reload();
  await expect(app.locator('#content .view')).toBeVisible();

  const s = await getState(app);
  expect(s.version).toBe(2);
  expect(s.trips).toHaveLength(2);
  const [casa, oficina, otro] = s.places;
  expect(typeof casa.lat).toBe('number');
  expect(typeof oficina.lng).toBe('number');
  expect('x' in casa).toBe(false);
  expect(otro).toMatchObject({ lat: null, lng: null, x: 100, y: 100 });
  expect(s.trips[0].pointsSource).toBe('auto');
  expect(s.trips[0].points.length).toBeGreaterThanOrEqual(20);
  expect(s.trips[1].points).toEqual([]);
  expect(s.trips[0]).toMatchObject({ computerKmpl: null, computerUnit: null });

  const keys = await app.evaluate(() => Object.keys(localStorage));
  expect(keys).toContain('trayecto:v2');
  expect(keys).not.toContain('trayecto:v1');
});
