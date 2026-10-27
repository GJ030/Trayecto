import { confirmModal, expect, getState, goTo, test } from './fixtures';

test.beforeEach(async ({ app }) => {
  await goTo(app, 'vehiculos', 'Vehículos');
});

test('agregar un vehículo y hacerlo predeterminado', async ({ app }) => {
  const before = await getState(app);
  await app.fill('#vName', 'Auto de prueba');
  await app.fill('#vYear', '2022');
  await app.fill('#vPlate', 'zzz-000');
  await app.selectOption('#vFuel', 'Premium');
  await app.fill('#vTank', '45');
  await app.click('#addVehForm button[type=submit]');
  await expect(app.locator('#pageSub')).toContainText(`${before.vehicles.length + 1} vehículos`);
  const v = (await getState(app)).vehicles.find((x) => x.name === 'Auto de prueba')!;
  expect(v).toMatchObject({ year: 2022, fuel: 'Premium', tank: 45 });
  await app.click(`[data-action=veh-default][data-id="${v.id}"]`);
  expect((await getState(app)).settings.defaultVehicle).toBe(v.id);
});

test('un vehículo sin nombre no se agrega', async ({ app }) => {
  const before = await getState(app);
  await app.click('#addVehForm button[type=submit]');
  expect((await getState(app)).vehicles).toHaveLength(before.vehicles.length);
});

test('eliminar un vehículo elimina sus viajes y cargas, y deja lo de los demás', async ({
  app,
}) => {
  const before = await getState(app);
  const tripsV2 = before.trips.filter((t) => t.vehicleId === 'v2').length;
  const fuelV2 = before.fuel.filter((f) => f.vehicleId === 'v2').length;
  expect(tripsV2 + fuelV2).toBeGreaterThan(0);
  await app.click('[data-action=veh-delete][data-id=v2]');
  await confirmModal(app);
  await expect.poll(async () => (await getState(app)).vehicles.length).toBe(1);
  const s = await getState(app);
  expect(s.trips).toHaveLength(before.trips.length - tripsV2);
  expect(s.fuel).toHaveLength(before.fuel.length - fuelV2);
  expect(s.trips.every((t) => t.vehicleId === 'v1')).toBe(true);
  expect(s.fuel.every((f) => f.vehicleId === 'v1')).toBe(true);
  expect(s.settings.defaultVehicle).toBe('v1');
});

test('si se elimina el vehículo predeterminado, queda otro', async ({ app }) => {
  await app.click('[data-action=veh-delete][data-id=v1]');
  await confirmModal(app);
  await expect.poll(async () => (await getState(app)).vehicles.length).toBe(1);
  const s = await getState(app);
  expect(s.settings.defaultVehicle).toBe('v2');
  expect(s.ui.tf.vehicle).toBe('all');
});
