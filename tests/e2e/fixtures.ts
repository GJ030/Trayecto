/**
 * Base de las pruebas E2E: abre `dist/trayecto.html` por file://, sin la CDN de los mapas (la app usa
 * su respaldo SVG) y falla la prueba si la consola registra errores. Cada prueba parte de datos de
 * ejemplo porque cada contexto de Playwright tiene su propio localStorage.
 */
import { expect, test as base, type Download, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { encodePolyline } from '../../src/data/polyline';
import type { AppData } from '../../src/data/schema';

export const APP = pathToFileURL(resolve('dist/trayecto.html')).href;

/** La app servida por http://127.0.0.1 (ver webServer en playwright.config.ts): ahí sí existe OPFS, para probar la carpeta de datos. */
export const APP_HTTP = 'http://127.0.0.1:4173/trayecto.html';

export const test = base.extend<{ app: Page; appHttp: Page }>({
  appHttp: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/Failed to load resource|net::ERR_/.test(m.text()))
        errors.push(m.text());
    });
    await page.route(/unpkg\.com|openfreemap\.org|router\.project-osrm\.org/, (r) => r.abort());
    await page.goto(APP_HTTP);
    await expect(page.locator('#content .view')).toBeVisible();
    await use(page);
    expect(errors).toEqual([]);
  },
  app: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      // Sin la CDN el navegador registra la red caída; la app lo maneja con su respaldo SVG.
      if (m.type() === 'error' && !/Failed to load resource|net::ERR_/.test(m.text()))
        errors.push(m.text());
    });
    await page.route(/unpkg\.com|openfreemap\.org|router\.project-osrm\.org/, (r) => r.abort());
    await page.goto(APP);
    await expect(page.locator('#content .view')).toBeVisible();
    await use(page);
    expect(errors).toEqual([]);
  },
});
export { expect };

/** Copia del estado vivo de la app (`window.__trayecto.state`). */
export const getState = (page: Page) =>
  page.evaluate(
    () => JSON.parse(JSON.stringify((window.__trayecto as { state: AppData }).state)) as AppData,
  );
/** Contenido de lo guardado en localStorage con la clave de datos (v2). */
export const getStored = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('trayecto:v2') || 'null') as AppData | null);

export const goTo = async (page: Page, view: string, title: string) => {
  await page.click(`.nav-item[data-view="${view}"]`);
  await expect(page.locator('#pageTitle')).toHaveText(title);
  await expect(page.locator('#content .view')).toBeVisible();
};
/** Espera a que el panel lateral se cierre (su formulario sigue en el DOM, pero inerte). */
export async function drawerClosed(page: Page) {
  await expect(page.locator('#drawer')).not.toHaveClass(/open/);
  await expect(page.locator('#drawer')).toHaveAttribute('inert', '');
}
/**
 * Espera a que un panel recién abierto esté listo: visible y con el foco en su primer campo. El panel enfoca
 * ese campo en un requestAnimationFrame; si se rellena antes, el foco tardío le roba el texto al campo.
 */
export async function panelReady(page: Page, form: string, focus: string) {
  await expect(page.locator('#drawer')).toHaveClass(/open/);
  await expect(page.locator(form)).toBeVisible();
  await expect(page.locator(focus)).toBeFocused();
}
/** Abre un panel de alta con su atajo de teclado y espera a que esté listo. */
export async function openPanel(page: Page, key: 'n' | 'g', form: string, focus: string) {
  await page.keyboard.press(key);
  await panelReady(page, form, focus);
}
/** Confirma el diálogo modal abierto (botón principal). */
export const confirmModal = (page: Page) => page.click('[data-m="1"]');

/** Hace clic y devuelve el texto del archivo descargado y su nombre. */
export async function downloadText(page: Page, selector: string) {
  const [dl]: [Download, void] = await Promise.all([
    page.waitForEvent('download'),
    page.click(selector),
  ]);
  return { name: dl.suggestedFilename(), text: readFileSync(await dl.path(), 'utf8') };
}

/**
 * Respaldo de prueba con rutas por calles reales (coordenadas ficticias): el viaje «ta» con ruta calculada
 * (geometría en polyline, como en el archivo) y el «tb» pendiente.
 */
export const LINE: [number, number][] = [
  [10.000001, 10.000002],
  [10.01, 10.02],
  [10.03, 10.03],
  [10.050001, 10.040002],
];
export function routeBackup(extraSettings: Record<string, unknown> = {}) {
  const trip = (id: string, over: Record<string, unknown>) => ({
    id,
    date: '2024-06-15',
    depart: '08:00',
    arrive: '08:30',
    origin: 'Alfa',
    destination: 'Beta',
    odoStart: 1000,
    odoEnd: 1012,
    vehicleId: 'v1',
    tag: 'Trabajo',
    ...over,
  });
  return JSON.stringify({
    app: 'Trayecto',
    version: 2,
    exportedAt: '2024-06-15T00:00:00Z',
    data: {
      vehicles: [{ id: 'v1', name: 'Auto de prueba' }],
      places: [
        { id: 'pa', name: 'Alfa', area: '', lat: 10, lng: 10, kind: 'other' },
        { id: 'pb', name: 'Beta', area: '', lat: 10.04, lng: 10.05, kind: 'other' },
      ],
      trips: [
        trip('ta', {
          pointsSource: 'auto',
          route: {
            status: 'ok',
            sig: 'sig-ta',
            distance: 5234.5,
            duration: 612.3,
            n: LINE.length,
            poly: encodePolyline(LINE, 6),
          },
          waypoints: [{ lat: 10.02, lng: 10.02 }],
        }),
        trip('tb', {
          date: '2024-06-16',
          pointsSource: 'auto',
          route: { status: 'pending', sig: 'sig-tb', distance: null, duration: null, n: 0 },
        }),
      ],
      fuel: [],
      settings: { defaultVehicle: 'v1', ...extraSettings },
    },
  });
}
