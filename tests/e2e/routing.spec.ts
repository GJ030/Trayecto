import type { Page } from '@playwright/test';
import type { AppData, Trip } from '../../src/data/schema';
import {
  confirmModal,
  drawerClosed,
  expect,
  getState,
  getStored,
  goTo,
  linkOpfs,
  openPanel,
  readDataFile,
  test,
} from './fixtures';

/* ---- OSRM simulado ---- */
type Mode = 'ok' | 'noroute' | '503' | '429' | 'abort' | 'invalid';
interface Osrm {
  requests: { url: string; at: number }[];
  mode: (n: number) => Mode;
  delay: number;
}
async function stubOsrm(page: Page, over: Partial<Osrm> = {}) {
  const osrm: Osrm = { requests: [], mode: () => 'ok', delay: 0, ...over };
  await page.route(/router\.project-osrm\.org/, async (route) => {
    const url = route.request().url(),
      n = osrm.requests.length;
    osrm.requests.push({ url, at: Date.now() });
    if (osrm.delay) await new Promise((r) => setTimeout(r, osrm.delay));
    const headers = { 'access-control-allow-origin': '*' };
    const mode = osrm.mode(n);
    if (mode === 'abort') return route.abort('connectionrefused');
    if (mode === '503') return route.fulfill({ status: 503, headers, body: 'x' });
    if (mode === '429') return route.fulfill({ status: 429, headers, body: 'x' });
    if (mode === 'noroute')
      return route.fulfill({
        status: 200,
        headers,
        contentType: 'application/json',
        body: '{"code":"NoRoute"}',
      });
    if (mode === 'invalid')
      return route.fulfill({
        status: 200,
        headers,
        contentType: 'application/json',
        body: '{"code":"Ok","routes":[]}',
      });
    const c = url
      .split('/driving/')[1]
      .split('?')[0]
      .split(';')
      .map((p) => p.split(',').map(Number));
    const a = c[0],
      b = c[c.length - 1];
    const body = {
      code: 'Ok',
      routes: [
        {
          distance: 4321.5,
          duration: 321.5,
          geometry: {
            type: 'LineString',
            coordinates: [a, [(a[0] + b[0]) / 2 + 0.001, (a[1] + b[1]) / 2], b],
          },
        },
      ],
    };
    return route.fulfill({
      status: 200,
      headers,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
  return osrm;
}
/** Acelera la cola para las pruebas (la configuración real es 1 petición por segundo y esperas de 5 s). */
const fast = (page: Page, ms = 40) =>
  page.evaluate((m) => {
    const c = (window.__trayecto as { routing: { config: Record<string, unknown> } }).routing
      .config as {
      minIntervalMs: number;
      retry: { baseMs: number; rateLimitBaseMs: number; maxStreak: number };
    };
    c.minIntervalMs = m;
    c.retry.baseMs = 20;
    c.retry.rateLimitBaseMs = 60;
  }, ms);
const tripKey = (t: Trip) => t.date + ' ' + t.depart;
const routes = async (page: Page) => (await getState(page)).trips.map((t) => t.route);
const countOk = async (page: Page) => (await routes(page)).filter((r) => r?.status === 'ok').length;
const N = async (page: Page) => (await getState(page)).trips.length;

/** Activa el interruptor y elige «calcular los viajes registrados». */
async function enableAll(page: Page) {
  await goTo(page, 'ajustes', 'Ajustes');
  await page.click('#rtSwitch');
  await expect(page.locator('#mTitle')).toHaveText('¿Activar rutas por calles reales?');
  await page.click('.choice[data-m="0"]');
}

test.describe('con carpeta de datos', () => {
  test.beforeEach(async ({ appHttp }) => {
    await linkOpfs(appHttp);
  });

  test('el texto de privacidad dice qué se envía y a dónde; el interruptor parte apagado', async ({
    appHttp,
  }) => {
    await goTo(appHttp, 'ajustes', 'Ajustes');
    const card = appHttp.locator('#rtCard');
    await expect(card).toContainText('coordenadas de origen, destino y puntos intermedios');
    await expect(card).toContainText('router.project-osrm.org');
    await expect(card).toContainText('No se envía nada más');
    await expect(appHttp.locator('#rtSwitch')).toHaveAttribute('aria-checked', 'false');
    await expect(appHttp.locator('#rtSwitch')).toBeEnabled();
    expect((await getState(appHttp)).settings.routing).toBe(false);
    await expect(appHttp.locator('.card', { hasText: 'Acerca de Trayecto' })).toContainText(
      'router.project-osrm.org',
    );
  });

  test('la confirmación dice cuántos viajes, qué se envía, a dónde y el tiempo aproximado', async ({
    appHttp,
  }) => {
    const osrm = await stubOsrm(appHttp);
    const total = await N(appHttp);
    await goTo(appHttp, 'ajustes', 'Ajustes');
    await appHttp.click('#rtSwitch');
    const body = appHttp.locator('#mBody');
    await expect(body).toContainText('coordenadas de origen, destino y puntos intermedios');
    await expect(body).toContainText('router.project-osrm.org');
    const all = appHttp.locator('.choice[data-m="0"]');
    await expect(all).toContainText(`${total} viajes registrados`);
    await expect(all).toContainText(`unos ${total} s`); // a una petición por segundo
    await expect(all).toContainText('más recientes');
    await appHttp.click('[data-m="x"]'); // cancelar: no se activa ni se envía nada
    expect((await getState(appHttp)).settings.routing).toBe(false);
    await appHttp.waitForTimeout(300);
    expect(osrm.requests).toHaveLength(0);
  });

  test('lote: calcula todos del más reciente al más antiguo, a una petición por segundo, y guarda en el archivo', async ({
    appHttp,
  }) => {
    const osrm = await stubOsrm(appHttp, { delay: 60 });
    await fast(appHttp);
    const total = await N(appHttp);
    await enableAll(appHttp);
    await expect(appHttp.locator('#rtStatus')).toContainText(/Calculando rutas… \d+ de \d+/);
    await expect.poll(() => countOk(appHttp), { timeout: 30000 }).toBe(total);
    await expect(appHttp.locator('#rtStatus')).toHaveText('Todo al día.');
    await expect(appHttp.locator('#rtCounts')).toContainText(
      `${total} calculadas · 0 pendientes · 0 con error`,
    );
    await expect(appHttp.locator('#toasts')).toContainText(`Rutas calculadas: ${total}`);

    // formato de la petición, orden y ritmo
    expect(osrm.requests).toHaveLength(total);
    for (const r of osrm.requests)
      expect(r.url).toMatch(
        /\/route\/v1\/driving\/-?[\d.]+,-?[\d.]+;-?[\d.]+,-?[\d.]+\?overview=full&geometries=geojson&steps=false$/,
      );
    for (let i = 1; i < osrm.requests.length; i++)
      expect(osrm.requests[i].at - osrm.requests[i - 1].at).toBeGreaterThanOrEqual(35);
    const s = await getState(appHttp);
    const newest = [...s.trips].sort((a, b) => tripKey(b).localeCompare(tripKey(a)))[0];
    const p = (name: string) => s.places.find((x) => x.name === newest[name as 'origin'])!;
    const o = p('origin'),
      d = p('destination');
    expect(osrm.requests[0].url).toContain(`/driving/${o.lng},${o.lat};${d.lng},${d.lat}?`);

    // guardado: geometría en el archivo (polyline), solo datos ligeros en el navegador
    await expect
      .poll(async () => ((await readDataFile(appHttp)).match(/"poly"/g) || []).length)
      .toBe(total);
    const stored = (await getStored(appHttp)) as AppData;
    expect(stored.trips.every((t) => t.route!.status === 'ok' && !t.route!.geometry)).toBe(true);
    expect(await appHttp.evaluate(() => localStorage.getItem('trayecto:v2'))).not.toContain(
      '"poly"',
    );
    expect(s.trips.every((t) => t.points.length >= 60)).toBe(true); // los puntos salen de la geometría
  });

  test('«solo para los viajes nuevos y editados» no envía los ya registrados', async ({
    appHttp,
  }) => {
    const osrm = await stubOsrm(appHttp);
    await fast(appHttp);
    await goTo(appHttp, 'ajustes', 'Ajustes');
    await appHttp.click('#rtSwitch');
    await appHttp.click('.choice[data-m="1"]');
    await expect(appHttp.locator('#rtSwitch')).toHaveAttribute('aria-checked', 'true');
    expect((await getState(appHttp)).settings.routing).toBe(true);
    await appHttp.waitForTimeout(400);
    expect(osrm.requests).toHaveLength(0);
    expect((await routes(appHttp)).every((r) => r === undefined)).toBe(true);
  });

  test('Detener cancela la tanda, lo calculado se queda y al relanzar sigue con los que faltan', async ({
    appHttp,
  }) => {
    await stubOsrm(appHttp, { delay: 250 });
    await fast(appHttp, 40);
    const total = await N(appHttp);
    await enableAll(appHttp);
    await expect.poll(() => countOk(appHttp), { timeout: 20000 }).toBeGreaterThanOrEqual(2);
    await appHttp.click('[data-action=rt-stop]');
    await expect(appHttp.locator('#rtStatus')).toContainText('Detenido. Faltan');
    const done = await countOk(appHttp);
    await appHttp.waitForTimeout(800);
    expect(await countOk(appHttp)).toBe(done); // ya no pide nada
    expect(done).toBeLessThan(total);
    // al relanzar (con confirmación) sigue con los que faltan
    await appHttp.click('[data-action=rt-start]');
    await expect(appHttp.locator('#mTitle')).toContainText(`${total - done} rutas`);
    await confirmModal(appHttp);
    await expect.poll(() => countOk(appHttp), { timeout: 30000 }).toBe(total);
  });

  test('«sin camino» queda como error con reintento manual: no se reintenta solo, ni al volver la conexión ni al recargar', async ({
    appHttp,
  }) => {
    const osrm = await stubOsrm(appHttp, { mode: (n) => (n === 1 ? 'noroute' : 'ok') });
    await fast(appHttp);
    const total = await N(appHttp);
    await enableAll(appHttp);
    await expect.poll(() => countOk(appHttp), { timeout: 30000 }).toBe(total - 1);
    await expect(appHttp.locator('#rtCounts')).toContainText('1 con error');
    const withError = (await getState(appHttp)).trips.filter((t) => t.route?.error);
    expect(withError).toHaveLength(1);
    expect(withError[0].route).toMatchObject({ status: 'pending', error: 'noroute' });
    expect(osrm.requests).toHaveLength(total);
    // volver la conexión y recargar no lo reintentan
    await appHttp.evaluate(() => window.dispatchEvent(new Event('online')));
    await appHttp.waitForTimeout(300);
    expect(osrm.requests).toHaveLength(total);
    await appHttp.reload();
    await expect(appHttp.locator('#content .view')).toBeVisible();
    await appHttp.waitForTimeout(300);
    expect(osrm.requests).toHaveLength(total);
    expect(
      (await getState(appHttp)).trips.filter((t) => t.route?.error === 'noroute'),
    ).toHaveLength(1);
    // reintento manual
    osrm.mode = () => 'ok';
    await fast(appHttp);
    await goTo(appHttp, 'ajustes', 'Ajustes');
    await appHttp.click('[data-action=rt-retry-errors]');
    await confirmModal(appHttp);
    await expect.poll(() => countOk(appHttp), { timeout: 15000 }).toBe(total);
    expect(osrm.requests).toHaveLength(total + 1);
  });

  test('sin conexión, 429 y 5xx se reintentan con espera creciente hasta lograrlo', async ({
    appHttp,
  }) => {
    const osrm = await stubOsrm(appHttp, {
      mode: (n) => (n === 0 ? '503' : n === 1 ? '429' : n === 2 ? 'abort' : 'ok'),
    });
    await fast(appHttp);
    const total = await N(appHttp);
    await enableAll(appHttp);
    await expect.poll(() => countOk(appHttp), { timeout: 30000 }).toBe(total);
    expect(osrm.requests.length).toBe(total + 3); // 3 reintentos
    const gaps = osrm.requests.slice(1, 4).map((r, i) => r.at - osrm.requests[i].at);
    expect(gaps[1]).toBeGreaterThan(gaps[0]); // la espera crece
    expect((await getState(appHttp)).trips.some((t) => t.route?.error)).toBe(false); // nada quedó como error definitivo
  });

  test('sin conexión la cola se detiene y al volver la conexión toma solo los pendientes recuperables', async ({
    appHttp,
  }) => {
    let down = true;
    const osrm = await stubOsrm(appHttp, {
      mode: (n) => (down ? 'abort' : n % 7 === 6 ? 'noroute' : 'ok'),
    });
    await fast(appHttp);
    const total = await N(appHttp);
    await enableAll(appHttp);
    await expect(appHttp.locator('#rtStatus')).toContainText(
      'Sin conexión o servicio no disponible',
      {
        timeout: 15000,
      },
    );
    expect(await countOk(appHttp)).toBe(0);
    const failedRequests = osrm.requests.length;
    await appHttp.waitForTimeout(300);
    expect(osrm.requests.length).toBe(failedRequests); // ya no insiste
    down = false;
    await appHttp.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect
      .poll(() => osrm.requests.length, { timeout: 15000 })
      .toBeGreaterThan(failedRequests + 3);
    await expect
      .poll(
        async () =>
          (await countOk(appHttp)) +
          (await getState(appHttp)).trips.filter((t) => t.route?.error).length,
        {
          timeout: 30000,
        },
      )
      .toBe(total);
  });

  test('apagar el interruptor deja de pedir y no borra las rutas ya calculadas, que se siguen mostrando desde el archivo', async ({
    appHttp,
  }) => {
    const osrm = await stubOsrm(appHttp, { delay: 200 });
    await fast(appHttp);
    const total = await N(appHttp);
    await enableAll(appHttp);
    await expect.poll(() => countOk(appHttp), { timeout: 20000 }).toBeGreaterThanOrEqual(3);
    await appHttp.click('#rtSwitch'); // apagar
    await expect(appHttp.locator('#rtSwitch')).toHaveAttribute('aria-checked', 'false');
    const asked = osrm.requests.length,
      ok = await countOk(appHttp);
    await appHttp.waitForTimeout(800);
    expect(osrm.requests.length).toBe(asked);
    expect(await countOk(appHttp)).toBe(ok);
    expect(ok).toBeLessThan(total);
    await expect(appHttp.locator('#rtCard')).toContainText('se siguen mostrando');
    // no marca viajes nuevos como pendientes
    await goTo(appHttp, 'viajes', 'Viajes');
    await openPanel(appHttp, 'n', '#tripForm', '#tOrigin');
    await appHttp.fill('#tOrigin', 'Casa');
    await appHttp.fill('#tDest', 'Oficina');
    await appHttp.fill('#tDate', '2024-08-01');
    await appHttp.fill('#tDep', '07:30');
    await appHttp.fill('#tArr', '08:05');
    await appHttp.fill('#tOdoS', '90000');
    await appHttp.fill('#tOdoE', '90012');
    await appHttp.click('button[form=tripForm]');
    await expect(appHttp.locator('#toasts')).toContainText('Viaje guardado');
    const nuevo = (await getState(appHttp)).trips.find((t) => t.odoStart === 90000)!;
    expect(nuevo.route).toBeUndefined();
    expect(osrm.requests.length).toBe(asked);
    // las ya calculadas siguen ahí tras recargar (se leen del archivo)
    await expect
      .poll(async () => ((await readDataFile(appHttp)).match(/"poly"/g) || []).length)
      .toBe(ok);
    await appHttp.reload();
    await expect(appHttp.locator('#content .view')).toBeVisible();
    await expect
      .poll(async () => (await routes(appHttp)).filter((r) => r?.geometry).length)
      .toBe(ok);
    expect((await getState(appHttp)).settings.routing).toBe(false);
  });

  test('al crear un viaje con el interruptor encendido, guardar no espera a la red y la ruta llega por la cola', async ({
    appHttp,
  }) => {
    await goTo(appHttp, 'ajustes', 'Ajustes');
    await appHttp.click('#rtSwitch');
    await expect(appHttp.locator('#mTitle')).toHaveText('¿Activar rutas por calles reales?');
    await appHttp.click('.choice[data-m="1"]');
    const osrm = await stubOsrm(appHttp, { delay: 1200 });
    await fast(appHttp);
    await goTo(appHttp, 'viajes', 'Viajes');
    await openPanel(appHttp, 'n', '#tripForm', '#tOrigin');
    await appHttp.fill('#tOrigin', 'Casa');
    await appHttp.fill('#tDest', 'Oficina');
    await appHttp.fill('#tDate', '2024-08-01');
    await appHttp.fill('#tDep', '07:30');
    await appHttp.fill('#tArr', '08:05');
    await appHttp.fill('#tOdoS', '90000');
    await appHttp.fill('#tOdoE', '90012');
    await appHttp.click('button[form=tripForm]');
    await expect(appHttp.locator('#toasts')).toContainText('Viaje guardado');
    // se guardó y quedó pendiente mientras la petición sigue en vuelo (1,2 s de retraso simulado)
    await expect.poll(() => osrm.requests.length).toBe(1);
    const t0 = (await getState(appHttp)).trips.find((t) => t.odoStart === 90000)!;
    expect(t0.route).toMatchObject({ status: 'pending' });
    expect(t0.route!.error).toBeUndefined();
    await appHttp.keyboard.press('Escape'); // el panel no está bloqueado esperando la ruta
    await drawerClosed(appHttp);
    await expect
      .poll(
        async () =>
          (await getState(appHttp)).trips.find((t) => t.odoStart === 90000)!.route?.status,
        {
          timeout: 15000,
        },
      )
      .toBe('ok');
    expect(osrm.requests).toHaveLength(1);
  });
});

test('sin carpeta de datos el interruptor está desactivado y explica por qué', async ({
  appHttp,
}) => {
  await goTo(appHttp, 'ajustes', 'Ajustes');
  await expect(appHttp.locator('#rtSwitch')).toBeDisabled();
  await expect(appHttp.locator('#rtWhy')).toBeVisible();
  await expect(appHttp.locator('#rtWhy')).toContainText(
    'Primero elige una carpeta de datos en Respaldo',
  );
  expect((await getState(appHttp)).settings.routing).toBe(false);
});
