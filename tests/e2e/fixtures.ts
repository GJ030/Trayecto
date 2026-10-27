/**
 * Base de las pruebas E2E: abre `dist/trayecto.html` por file://, sin la CDN de los mapas (la app usa
 * su respaldo SVG) y falla la prueba si la consola registra errores. Cada prueba parte de datos de
 * ejemplo porque cada contexto de Playwright tiene su propio localStorage.
 */
import { expect, test as base, type Download, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { AppData } from '../../src/data/schema';

export const APP = pathToFileURL(resolve('dist/trayecto.html')).href;

export const test = base.extend<{ app: Page }>({
  app: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      // Sin la CDN el navegador registra la red caída; la app lo maneja con su respaldo SVG.
      if (m.type() === 'error' && !/Failed to load resource|net::ERR_/.test(m.text()))
        errors.push(m.text());
    });
    await page.route(/unpkg\.com|openfreemap\.org/, (r) => r.abort());
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
/** Abre un panel con su atajo de teclado y espera a que el formulario esté listo. */
export async function openPanel(page: Page, key: 'n' | 'g', form: string) {
  await page.keyboard.press(key);
  await expect(page.locator('#drawer')).toHaveClass(/open/);
  await expect(page.locator(form)).toBeVisible();
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
