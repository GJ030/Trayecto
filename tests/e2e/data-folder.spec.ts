import type { Page } from '@playwright/test';
import {
  LINE,
  SIG_TA,
  expect,
  fsState,
  getState,
  getStored,
  goTo,
  importBackup,
  linkOpfs,
  readDataFile as readFile,
  removeDataFile as removeFile,
  routeBackup,
  test,
  writeDataFile as writeFile,
} from './fixtures';

const ta = async (page: Page) => (await getState(page)).trips.find((t) => t.id === 'ta')!;
async function reload(page: Page) {
  await page.reload();
  await expect(page.locator('#content .view')).toBeVisible();
}

test.beforeEach(async ({ appHttp }) => {
  await linkOpfs(appHttp);
});

test('el archivo guarda la geometría como polyline y el localStorage no', async ({ appHttp }) => {
  await importBackup(appHttp, routeBackup());
  await expect.poll(() => readFile(appHttp)).toContain('"poly"');
  const file = await readFile(appHttp);
  expect(file).not.toContain('coordinates');
  const stored = (await getStored(appHttp))!.trips.find((t) => t.id === 'ta')!;
  expect(stored.route).toEqual({
    status: 'ok',
    sig: SIG_TA,
    distance: 5234.5,
    duration: 612.3,
    n: LINE.length,
  });
  expect(await appHttp.evaluate(() => localStorage.getItem('trayecto:v2'))).not.toContain('"poly"');
});

test('al abrir, las geometrías se cargan del archivo sin avisos ni diálogos', async ({
  appHttp,
}) => {
  await importBackup(appHttp, routeBackup());
  await expect.poll(() => readFile(appHttp)).toContain('"poly"');
  const before = await ta(appHttp);
  await reload(appHttp);
  await expect
    .poll(async () => (await ta(appHttp)).route!.geometry?.coordinates.length)
    .toBe(LINE.length);
  const after = await ta(appHttp);
  expect(after.route).toEqual(before.route);
  expect(after.points).toEqual(before.points);
  expect(await fsState(appHttp)).toBe('ok');
  await expect(appHttp.locator('#toasts .toast')).toHaveCount(0);
  await expect(appHttp.locator('#modalWrap .modal')).toHaveCount(0);
});

test('una escritura posterior conserva las geometrías del archivo (se reincorporan antes de escribir)', async ({
  appHttp,
}) => {
  await importBackup(appHttp, routeBackup());
  await expect.poll(() => readFile(appHttp)).toContain('"poly"');
  const poly = JSON.parse(await readFile(appHttp)).data.trips[0].route.poly;
  await reload(appHttp);
  // un cambio cualquiera de los datos fuerza una escritura del archivo
  await goTo(appHttp, 'gasolina', 'Gasolina');
  await appHttp.keyboard.press('g');
  await expect(appHttp.locator('#fStation')).toBeFocused();
  await appHttp.fill('#fStation', 'Gasolinera de prueba');
  await appHttp.fill('#fOdo', '5000');
  await appHttp.fill('#fLit', '20');
  await appHttp.fill('#fPrice', '20');
  await appHttp.click('button[form=fuelForm]');
  await expect
    .poll(async () => (await readFile(appHttp)).includes('Gasolinera de prueba'))
    .toBe(true);
  const data = JSON.parse(await readFile(appHttp)).data;
  expect(data.trips.find((t: { id: string }) => t.id === 'ta').route.poly).toBe(poly);
});

test('si el archivo marca la ruta como pendiente, la caché sin geometría queda pendiente', async ({
  appHttp,
}) => {
  await importBackup(appHttp, routeBackup());
  await expect.poll(() => readFile(appHttp)).toContain('"poly"');
  const file = JSON.parse(await readFile(appHttp));
  file.data.trips[0].route = {
    status: 'pending',
    sig: SIG_TA,
    distance: null,
    duration: null,
    n: 0,
  };
  await writeFile(appHttp, JSON.stringify(file));
  await reload(appHttp);
  await expect.poll(async () => (await ta(appHttp)).route?.status).toBe('pending');
  expect((await ta(appHttp)).route!.geometry).toBeUndefined();
  expect(await fsState(appHttp)).toBe('ok');
});

test('si el archivo cambió por fuera y ya no trae la ruta, gana el archivo (no hay cambios pendientes)', async ({
  appHttp,
}) => {
  await importBackup(appHttp, routeBackup());
  await expect.poll(() => readFile(appHttp)).toContain('"poly"');
  const file = JSON.parse(await readFile(appHttp));
  delete file.data.trips[0].route;
  await writeFile(appHttp, JSON.stringify(file));
  await reload(appHttp);
  await expect.poll(async () => (await ta(appHttp)).route).toBeUndefined();
  expect((await getState(appHttp)).trips).toHaveLength(2);
});

test('si el archivo desaparece, las rutas sin geometría pasan a «pendiente» y no se pierde ningún viaje', async ({
  appHttp,
}) => {
  await importBackup(appHttp, routeBackup());
  await expect.poll(() => readFile(appHttp)).toContain('"poly"');
  await removeFile(appHttp);
  await reload(appHttp);
  await expect.poll(() => fsState(appHttp)).toBe('nofile');
  expect((await ta(appHttp)).route!.status).toBe('pending');
  expect((await getState(appHttp)).trips).toHaveLength(2);
});

test('con la misma geometría en el archivo y datos iguales no hay conflicto al abrir en otra sesión', async ({
  appHttp,
}) => {
  await importBackup(appHttp, routeBackup());
  await expect.poll(() => readFile(appHttp)).toContain('"poly"');
  for (let i = 0; i < 2; i++) {
    await reload(appHttp);
    await expect
      .poll(async () => (await ta(appHttp)).route!.geometry?.coordinates.length)
      .toBe(LINE.length);
    await expect(appHttp.locator('#modalWrap .modal')).toHaveCount(0);
  }
  expect(await fsState(appHttp)).toBe('ok');
});
