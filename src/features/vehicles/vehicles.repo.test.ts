import { beforeEach, describe, expect, it } from 'vitest';
import { vehiclesRepo } from './vehicles.repo';
import { PALETTE, ValidationError } from '@/data/schema';
import { S } from '@/data/store';
import { load, makePlaces, recordEvents, setState, trip, vehicle } from '@/testing/fixtures';

const input = (name: string) => ({
  name,
  year: 2020 as const,
  plate: '',
  fuel: 'Magna',
  tank: 40 as const,
});

describe('vehiclesRepo.create y update', () => {
  beforeEach(() => setState());

  it('crea con color de la paleta y deja el primero como predeterminado', () => {
    const a = vehiclesRepo.create(input('  Uno '));
    const b = vehiclesRepo.create(input('Dos'));
    expect(a).toMatchObject({ name: 'Uno', color: PALETTE[0] });
    expect(b.color).toBe(PALETTE[1]);
    expect(S.settings.defaultVehicle).toBe(a.id);
  });
  it('rechaza un nombre vacío', () => {
    expect(() => vehiclesRepo.create(input('  '))).toThrow(ValidationError);
    expect(S.vehicles).toEqual([]);
  });
  it('update edita en su lugar, valida y devuelve null si no existe', () => {
    const v = vehiclesRepo.create(input('Uno'));
    expect(vehiclesRepo.update(v.id, { name: ' Nuevo ', plate: 'X' })).toBe(v);
    expect(v).toMatchObject({ name: 'Nuevo', plate: 'X' });
    expect(() => vehiclesRepo.update(v.id, { name: '' })).toThrow(ValidationError);
    expect(v.name).toBe('Nuevo');
    expect(vehiclesRepo.update('nada', { name: 'x' })).toBeNull();
  });
  it('setDefault cambia el predeterminado', () => {
    const a = vehiclesRepo.create(input('Uno'));
    const b = vehiclesRepo.create(input('Dos'));
    vehiclesRepo.setDefault(b.id);
    expect(S.settings.defaultVehicle).toBe(b.id);
    expect(a.id).not.toBe(b.id);
  });
});

describe('vehiclesRepo.remove: cascada', () => {
  beforeEach(() => {
    setState({
      vehicles: [vehicle('v1'), vehicle('v2')],
      places: makePlaces(),
      trips: [trip({ id: 'a', vehicleId: 'v1' }), trip({ id: 'b', vehicleId: 'v2' })],
      fuel: [
        load({ id: 'x', vehicleId: 'v1', odometer: 1 }),
        load({ id: 'y', vehicleId: 'v2', odometer: 2 }),
        load({ id: 'z', vehicleId: 'v1', odometer: 3 }),
      ],
    });
    S.settings.defaultVehicle = 'v1';
    S.ui.tf.vehicle = 'v1';
    S.ui.ff = 'v1';
    S.ui.selTrip = 'a';
  });

  it('elimina el vehículo con sus viajes y cargas, y deja intactos los de otros', () => {
    expect(vehiclesRepo.remove('v1')).toBe(true);
    expect(S.vehicles.map((v) => v.id)).toEqual(['v2']);
    expect(S.trips.map((t) => t.id)).toEqual(['b']);
    expect(S.fuel.map((f) => f.id)).toEqual(['y']);
  });
  it('limpia el predeterminado, los filtros y la selección que lo referencian', () => {
    vehiclesRepo.remove('v1');
    expect(S.settings.defaultVehicle).toBe('v2');
    expect(S.ui.tf.vehicle).toBe('all');
    expect(S.ui.ff).toBe('all');
    expect(S.ui.selTrip).toBeNull();
  });
  it('no toca filtros que apuntan a otro vehículo', () => {
    S.ui.tf.vehicle = 'v2';
    S.ui.ff = 'v2';
    S.settings.defaultVehicle = 'v2';
    vehiclesRepo.remove('v1');
    expect([S.ui.tf.vehicle, S.ui.ff, S.settings.defaultVehicle]).toEqual(['v2', 'v2', 'v2']);
  });
  it('al eliminar el último vehículo el predeterminado queda en null', () => {
    vehiclesRepo.remove('v1');
    vehiclesRepo.remove('v2');
    expect(S.settings.defaultVehicle).toBeNull();
    expect([S.trips, S.fuel, S.vehicles]).toEqual([[], [], []]);
  });
  it('emite un solo evento con todos los alcances', () => {
    const { events, stop } = recordEvents();
    vehiclesRepo.remove('v1');
    stop();
    expect(events).toHaveLength(1);
    expect(new Set(events[0].scope)).toEqual(
      new Set(['trips', 'fuel', 'vehicles', 'settings', 'ui']),
    );
  });
  it('un id inexistente devuelve false y no cambia nada', () => {
    const { events, stop } = recordEvents();
    expect(vehiclesRepo.remove('nada')).toBe(false);
    stop();
    expect(events).toEqual([]);
    expect(S.trips).toHaveLength(2);
  });
});
