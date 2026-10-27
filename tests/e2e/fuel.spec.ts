import { confirmModal, drawerClosed, expect, getState, goTo, openPanel, test } from './fixtures';

const openFuel = (page: Parameters<typeof openPanel>[0]) => openPanel(page, 'g', '#fuelForm');

test.beforeEach(async ({ app }) => {
  await goTo(app, 'gasolina', 'Gasolina');
});

test('registrar cargas: la parcial suma sus litros al siguiente tanque lleno', async ({ app }) => {
  const before = await getState(app);
  // carga parcial
  await openFuel(app);
  await app.fill('#fStation', 'Pemex Nueva');
  await app.fill('#fOdo', '49800');
  await app.fill('#fLit', '12.5');
  await app.click('#fFull');
  await expect(app.locator('#fFull')).toHaveAttribute('aria-checked', 'false');
  await app.click('button[form=fuelForm]');
  await drawerClosed(app);
  await expect(app.locator('#toasts')).toContainText('Carga guardada');

  // tanque lleno
  await openFuel(app);
  await app.fill('#fStation', 'Pemex Nueva');
  await app.fill('#fOdo', '50005');
  await app.fill('#fLit', '20');
  await app.click('button[form=fuelForm]');
  await drawerClosed(app);
  await expect(app.locator('#toasts')).toContainText('Carga guardada · 15.4 km/L');

  const s = await getState(app);
  expect(s.fuel).toHaveLength(before.fuel.length + 2);
  expect(s.fuel.find((f) => f.odometer === 49800)).toMatchObject({
    full: false,
    liters: 12.5,
    station: 'Pemex Nueva',
  });
  expect(s.fuel.find((f) => f.odometer === 50005)).toMatchObject({ full: true, liters: 20 });
  // (50005 − 49505) km ÷ (12.5 + 20) L = 15.4 km/L; la última carga llena anterior estaba en 49505
  const row = app.locator('#content tbody tr').filter({ hasText: /50,?005/ });
  await expect(row).toContainText('15.4');
  await expect(app.locator('#pageSub')).toContainText(`${before.fuel.length + 2} cargas`);
});

test('editar una carga con el lápiz', async ({ app }) => {
  const before = await getState(app);
  await openFuel(app);
  await app.fill('#fStation', 'Pemex Nueva');
  await app.fill('#fOdo', '50005');
  await app.fill('#fLit', '30');
  await app.click('button[form=fuelForm]');
  await drawerClosed(app);
  const created = (await getState(app)).fuel.find((f) => f.odometer === 50005)!;

  await app.click(`[data-action=edit-fuel][data-id="${created.id}"]`);
  await expect(app.locator('#fLit')).toHaveValue('30');
  await app.fill('#fLit', '31.2');
  await app.click('button[form=fuelForm]');
  await drawerClosed(app);
  const s = await getState(app);
  expect(s.fuel).toHaveLength(before.fuel.length + 1);
  expect(s.fuel.find((f) => f.id === created.id)).toMatchObject({ liters: 31.2 });
});

test('una carga incompleta o con odómetro repetido no se guarda', async ({ app }) => {
  const before = await getState(app);
  const taken = before.fuel[0];
  await openFuel(app);
  await app.click('button[form=fuelForm]');
  await expect(app.locator('#fuelForm .err:not(:empty)').first()).toBeVisible();
  await app.fill('#fStation', 'Pemex Nueva');
  await app.fill('#fOdo', String(taken.odometer));
  await app.selectOption('#fVeh', taken.vehicleId);
  await app.fill('#fLit', '10');
  await app.click('button[form=fuelForm]');
  await expect(app.locator('[data-err=fOdo]')).toContainText('Ya hay una carga con ese odómetro.');
  await expect(app.locator('#fuelForm')).toBeVisible();
  expect((await getState(app)).fuel).toHaveLength(before.fuel.length);
});

test('eliminar una carga pide confirmación', async ({ app }) => {
  const before = await getState(app);
  await app.locator('[data-action=delete-fuel]').first().click();
  await app.click('[data-m="0"]');
  expect((await getState(app)).fuel).toHaveLength(before.fuel.length);
  await app.locator('[data-action=delete-fuel]').first().click();
  await confirmModal(app);
  await expect.poll(async () => (await getState(app)).fuel.length).toBe(before.fuel.length - 1);
});

test('el filtro por vehículo muestra solo sus cargas', async ({ app }) => {
  const s = await getState(app);
  const v2 = s.fuel.filter((f) => f.vehicleId === 'v2').length;
  expect(v2).toBeGreaterThan(0);
  await app.click('[data-action=fuel-veh][data-id=v2]');
  await expect(app.locator('#content tbody tr')).toHaveCount(v2);
  await app.click('[data-action=fuel-veh][data-id=all]');
  await expect(app.locator('#content tbody tr')).toHaveCount(s.fuel.length);
});
