import type { Page } from '@playwright/test';
import { expect, getState, goTo, test } from './fixtures';

/* Detalle del viaje: el aviso bajo el mapa según el estado de la ruta (la CDN está bloqueada, así que el mapa en sí
   se comprueba a mano y con capturas; aquí se prueba lo que decide qué se dibuja y qué se avisa). */

/** Selecciona el primer viaje de la tabla y devuelve su id. */
async function openFirstTrip(page: Page) {
  await goTo(page, 'viajes', 'Viajes');
  await page.locator('tbody tr').first().click();
  await expect(page.locator('.detail')).toBeVisible();
  return (await getState(page)).ui.selTrip!;
}
/** Cambia la ruta del viaje en el estado vivo y repinta. */
const setRoute = (page: Page, id: string, patch: Record<string, unknown> | null) =>
  page.evaluate(
    ([tid, p]) => {
      const t = window.__trayecto as {
        state: { trips: { id: string; route?: unknown }[] };
        render(): void;
      };
      const trip = t.state.trips.find((x) => x.id === tid)!;
      if (p === null) delete trip.route;
      else trip.route = p;
      t.render();
    },
    [id, patch] as const,
  );
const note = (page: Page) => page.locator('.detail .route-note');

test('con el interruptor apagado el detalle avisa que la ruta es aproximada y cómo activarla', async ({
  app,
}) => {
  await openFirstTrip(app);
  await expect(note(app)).toHaveAttribute('data-route-note', 'routingOff');
  await expect(note(app)).toContainText('Activa «Rutas por calles reales» en Ajustes');
  await expect(note(app).locator('button')).toHaveCount(0);
});

test('ruta pendiente con el interruptor encendido: aviso con Reintentar', async ({ app }) => {
  const id = await openFirstTrip(app);
  await app.evaluate(() => {
    (window.__trayecto as { state: { settings: { routing: boolean } } }).state.settings.routing =
      true;
  });
  await setRoute(app, id, {
    status: 'pending',
    sig: 'x',
    distance: null,
    duration: null,
    n: 0,
  });
  await expect(note(app)).toHaveAttribute('data-route-note', 'pending');
  await expect(note(app).getByRole('button', { name: 'Reintentar' })).toBeVisible();
});

test('«sin camino» y respuesta inválida se avisan con el interruptor apagado y el reintento quita el error', async ({
  app,
}) => {
  const id = await openFirstTrip(app);
  const route = (error: string) => ({
    status: 'pending',
    sig: 'x',
    distance: null,
    duration: null,
    n: 0,
    error,
  });
  await setRoute(app, id, route('noroute'));
  await expect(note(app)).toHaveAttribute('data-route-note', 'noroute');
  await expect(note(app)).toContainText('Sin camino entre esos puntos');
  await setRoute(app, id, route('invalid'));
  await expect(note(app)).toHaveAttribute('data-route-note', 'invalid');
  await expect(note(app)).toContainText('respuesta inválida');
  /* con el interruptor encendido, reintentar quita el error y deja la ruta pendiente */
  await app.evaluate(() => {
    (window.__trayecto as { state: { settings: { routing: boolean } } }).state.settings.routing =
      true;
  });
  await note(app).getByRole('button', { name: 'Reintentar' }).click();
  const t = (await getState(app)).trips.find((x) => x.id === id)!;
  expect(t.route?.status).toBe('pending');
  expect(t.route && 'error' in t.route).toBe(false);
  await expect(note(app)).toHaveAttribute('data-route-note', 'pending');
});

test('reintentar un viaje sin ruta lo deja pendiente y, sin carpeta de datos, avisa que no hay dónde guardar', async ({
  app,
}) => {
  const id = await openFirstTrip(app);
  await app.evaluate(() => {
    (window.__trayecto as { state: { settings: { routing: boolean } } }).state.settings.routing =
      true;
  });
  await setRoute(app, id, null);
  await expect(note(app)).toHaveAttribute('data-route-note', 'pending');
  await note(app).getByRole('button', { name: 'Reintentar' }).click();
  await expect(app.locator('#toasts')).toContainText('La carpeta de datos no está disponible');
  expect((await getState(app)).trips.find((x) => x.id === id)!.route?.status).toBe('pending');
});

test('geometría aún sin cargar: sin aviso ni reproducción, solo se pintan los marcadores', async ({
  app,
}) => {
  const id = await openFirstTrip(app);
  await expect(app.locator('.detail .play-bar')).toHaveCount(1);
  await app.evaluate((tid) => {
    const t = window.__trayecto as {
      state: { trips: { id: string; points: unknown[]; route?: unknown }[] };
      render(): void;
    };
    const trip = t.state.trips.find((x) => x.id === tid)!;
    trip.route = { status: 'ok', sig: 'x', distance: 1, duration: 1, n: 2 };
    trip.points = [];
    t.render();
  }, id);
  await expect(app.locator('.detail')).toBeVisible();
  await expect(app.locator('.detail .play-bar')).toHaveCount(0);
  await expect(note(app)).toHaveCount(0);
  /* el contenedor del mapa sigue (los marcadores se pintan con MapLibre sobre el SVG): no depende de points */
  await expect(app.locator('.detail .map[data-tmap]')).toHaveCount(1);
});
