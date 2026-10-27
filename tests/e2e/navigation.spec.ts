import { expect, getState, goTo, test } from './fixtures';

const SECTIONS: [string, string][] = [
  ['inicio', 'Inicio'],
  ['viajes', 'Viajes'],
  ['gasolina', 'Gasolina'],
  ['lugares', 'Lugares'],
  ['estadisticas', 'Estadísticas'],
  ['vehiculos', 'Vehículos'],
  ['ajustes', 'Ajustes'],
  ['respaldo', 'Respaldo'],
];

test('el menú tiene las 8 secciones y arranca en Inicio con datos de ejemplo', async ({ app }) => {
  await expect(app.locator('.nav-item[data-view]')).toHaveCount(8);
  await expect(app.locator('#pageTitle')).toHaveText('Inicio');
  const s = await getState(app);
  expect(s.version).toBe(2);
  expect(s.trips.length).toBeGreaterThan(10);
});

test('se puede navegar por las 8 secciones', async ({ app }) => {
  for (const [view, title] of [...SECTIONS, ...SECTIONS.slice().reverse()]) {
    await goTo(app, view, title);
    expect((await getState(app)).ui.view).toBe(view);
    await expect(app.locator('.nav-item[data-view="' + view + '"]')).toHaveAttribute(
      'aria-current',
      'page',
    );
  }
});

test('la sección abierta se conserva al recargar', async ({ app }) => {
  await goTo(app, 'gasolina', 'Gasolina');
  await app.reload();
  await expect(app.locator('#pageTitle')).toHaveText('Gasolina');
});

test('el atajo / busca en Viajes y Esc limpia la búsqueda', async ({ app }) => {
  await goTo(app, 'viajes', 'Viajes');
  const rows = app.locator('#content tbody tr');
  const total = await rows.count();
  expect(total).toBeGreaterThan(5);
  await app.keyboard.press('/');
  await app.keyboard.type('gimnasio');
  await expect.poll(() => rows.count()).toBeLessThan(total);
  await expect(rows.first()).toContainText('Gimnasio');
  await app.keyboard.press('Escape');
  await app.keyboard.press('Escape');
  await expect(rows).toHaveCount(total);
});

test('el menú lateral se contrae y se expande, y lo recuerda', async ({ app }) => {
  await goTo(app, 'ajustes', 'Ajustes');
  await app.click('#btnCollapse');
  await expect.poll(async () => (await getState(app)).ui.collapsed).toBe(true);
  await app.reload();
  expect((await getState(app)).ui.collapsed).toBe(true);
  await app.click('#btnCollapse');
  await expect.poll(async () => (await getState(app)).ui.collapsed).toBe(false);
});
