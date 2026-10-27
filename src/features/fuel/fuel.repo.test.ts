import { beforeEach, describe, expect, it } from 'vitest';
import { fuelRepo } from './fuel.repo';
import { ValidationError, type FuelInput } from '@/data/schema';
import { S } from '@/data/store';
import { load, recordEvents, setState, vehicle } from '@/testing/fixtures';

const input = (over: Partial<FuelInput> = {}): FuelInput => {
  const { id, ...f } = load();
  void id;
  return { ...f, ...over };
};

beforeEach(() => {
  setState({ vehicles: [vehicle('v1'), vehicle('v2')] });
});

describe('fuelRepo', () => {
  it('create guarda la carga, redondea litros y precio a 2 decimales y emite', () => {
    const { events, stop } = recordEvents();
    const f = fuelRepo.create(input({ liters: 30.456, price: 22.999 }));
    stop();
    expect(f.id).toMatch(/^f/);
    expect(f).toMatchObject({ liters: 30.46, price: 23 });
    expect(S.fuel).toEqual([f]);
    expect(events).toEqual([{ scope: ['fuel'], persist: true, render: true }]);
  });
  it('limpia espacios de la gasolinera y reutiliza el nombre ya escrito', () => {
    fuelRepo.create(input({ station: 'Shell  Sur' }));
    const f = fuelRepo.create(input({ station: '  shell sur ', odometer: 1500 }));
    expect(f.station).toBe('Shell Sur');
  });
  it('valida con las reglas de schema.ts', () => {
    expect(() => fuelRepo.create(input({ liters: 0 }))).toThrow(ValidationError);
    expect(() => fuelRepo.create(input({ station: ' ' }))).toThrow('Escribe la gasolinera.');
    expect(S.fuel).toEqual([]);
  });
  it('rechaza un odómetro repetido del mismo vehículo, pero no de otro', () => {
    fuelRepo.create(input());
    expect(() => fuelRepo.create(input({ odometer: 1000.3 }))).toThrow(
      'Ya hay una carga con ese odómetro.',
    );
    expect(() => fuelRepo.create(input({ vehicleId: 'v2' }))).not.toThrow();
  });
  it('update edita en su lugar y permite conservar el propio odómetro', () => {
    const f = fuelRepo.create(input());
    const r = fuelRepo.update(f.id, input({ liters: 10, full: false }));
    expect(r).toBe(f);
    expect(f).toMatchObject({ liters: 10, full: false, odometer: 1000 });
  });
  it('update con odómetro de otra carga del vehículo lanza y no cambia nada', () => {
    const a = fuelRepo.create(input());
    const b = fuelRepo.create(input({ odometer: 1500 }));
    expect(() => fuelRepo.update(b.id, input({ odometer: 1000 }))).toThrow(ValidationError);
    expect(b.odometer).toBe(1500);
    expect(a.odometer).toBe(1000);
  });
  it('update devuelve null si no existe', () => {
    expect(fuelRepo.update('nada', input())).toBeNull();
  });
  it('remove y removeByVehicle', () => {
    const a = fuelRepo.create(input());
    fuelRepo.create(input({ vehicleId: 'v2', odometer: 5 }));
    fuelRepo.create(input({ vehicleId: 'v2', odometer: 6 }));
    expect(fuelRepo.remove('nada')).toBe(false);
    expect(fuelRepo.remove(a.id)).toBe(true);
    expect(fuelRepo.removeByVehicle('v2')).toBe(2);
    expect(S.fuel).toEqual([]);
    const { events, stop } = recordEvents();
    expect(fuelRepo.removeByVehicle('v2')).toBe(0);
    stop();
    expect(events).toEqual([]);
  });
});
