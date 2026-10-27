import { beforeEach, describe, expect, it } from 'vitest';
import { D, computeDerived, cpkOf, derive, fuelTotal, kmplOf, priceOf } from './fuel.calc';
import { load, setState, trip, vehicle } from '@/testing/fixtures';

const v1 = vehicle('v1'),
  v2 = vehicle('v2');

describe('computeDerived: km/L entre tanques llenos', () => {
  it('km/L = km entre dos tanques llenos ÷ litros de la segunda carga', () => {
    const d = computeDerived(
      [v1],
      [
        load({ id: 'a', odometer: 1000, liters: 30 }),
        load({ id: 'b', odometer: 1500, liters: 25, date: '2024-06-10' }),
      ],
      [],
    );
    expect(d.kmpl).toEqual({ b: 20 });
    expect(d.vs.v1.avg).toBe(20);
  });
  it('la primera carga llena solo es referencia (no tiene km/L)', () => {
    const d = computeDerived([v1], [load({ id: 'a' })], []);
    expect(d.kmpl).toEqual({});
    expect(d.vs.v1.avg).toBeNull();
  });
  it('las cargas parciales intermedias suman sus litros a la siguiente carga llena', () => {
    const d = computeDerived(
      [v1],
      [
        load({ id: 'a', odometer: 1000, liters: 30 }),
        load({ id: 'p', odometer: 1200, liters: 10, full: false }),
        load({ id: 'b', odometer: 1500, liters: 20 }),
      ],
      [],
    );
    expect(d.kmpl.p).toBeUndefined();
    expect(d.kmpl.b).toBeCloseTo(500 / 30, 10); // (1500-1000) / (10+20), no 500/20
    expect(d.vs.v1.avg).toBeCloseTo(500 / 30, 10);
  });
  it('varias parciales seguidas', () => {
    const d = computeDerived(
      [v1],
      [
        load({ id: 'a', odometer: 1000 }),
        load({ id: 'p1', odometer: 1100, liters: 5, full: false }),
        load({ id: 'p2', odometer: 1200, liters: 7, full: false }),
        load({ id: 'p3', odometer: 1300, liters: 8, full: false }),
        load({ id: 'b', odometer: 1400, liters: 10 }),
      ],
      [],
    );
    expect(d.kmpl.b).toBeCloseTo(400 / 30, 10);
  });
  it('los litros de parciales anteriores al primer tanque lleno no cuentan', () => {
    const d = computeDerived(
      [v1],
      [
        load({ id: 'p0', odometer: 900, liters: 40, full: false }),
        load({ id: 'a', odometer: 1000, liters: 30 }),
        load({ id: 'b', odometer: 1300, liters: 20 }),
      ],
      [],
    );
    expect(d.kmpl.b).toBe(15);
  });
  it('una parcial al final (sin tanque lleno posterior) no afecta el promedio', () => {
    const d = computeDerived(
      [v1],
      [
        load({ id: 'a', odometer: 1000 }),
        load({ id: 'b', odometer: 1300, liters: 20 }),
        load({ id: 'p', odometer: 1350, liters: 9, full: false }),
      ],
      [],
    );
    expect(d.vs.v1.avg).toBe(15);
    expect(d.vs.v1.odo).toBe(1350);
  });
  it('ordena por odómetro aunque lleguen desordenadas', () => {
    const d = computeDerived(
      [v1],
      [
        load({ id: 'b', odometer: 1300, liters: 20, date: '2024-06-20' }),
        load({ id: 'a', odometer: 1000, date: '2024-06-01' }),
      ],
      [],
    );
    expect(d.kmpl).toEqual({ b: 15 });
    expect(d.vs.v1.loads.map((f) => f.id)).toEqual(['a', 'b']);
  });
  it('el promedio del vehículo es km totales ÷ litros totales, no el promedio de los km/L', () => {
    const d = computeDerived(
      [v1],
      [
        load({ id: 'a', odometer: 1000 }),
        load({ id: 'b', odometer: 1100, liters: 10 }), // 10 km/L
        load({ id: 'c', odometer: 1400, liters: 20 }), // 15 km/L
      ],
      [],
    );
    expect(d.kmpl).toEqual({ b: 10, c: 15 });
    expect(d.vs.v1.avg).toBeCloseTo(400 / 30, 10); // 13.33, no 12.5
  });
  it('odómetro repetido o que retrocede no genera km/L', () => {
    const d = computeDerived(
      [v1],
      [load({ id: 'a', odometer: 1000 }), load({ id: 'b', odometer: 1000, liters: 20 })],
      [],
    );
    expect(d.kmpl).toEqual({});
    expect(d.vs.v1.avg).toBeNull();
  });
  it('cada vehículo se calcula por separado', () => {
    const d = computeDerived(
      [v1, v2],
      [
        load({ id: 'a1', odometer: 1000 }),
        load({ id: 'a2', odometer: 5000, vehicleId: 'v2' }),
        load({ id: 'b2', odometer: 5100, vehicleId: 'v2', liters: 10 }),
        load({ id: 'b1', odometer: 1300, liters: 20 }),
      ],
      [],
    );
    expect(d.kmpl).toEqual({ b1: 15, b2: 10 });
    expect(d.vs.v1.avg).toBe(15);
    expect(d.vs.v2.avg).toBe(10);
  });
  it('odo es el mayor odómetro entre cargas y viajes del vehículo', () => {
    const d = computeDerived(
      [v1, v2],
      [load({ odometer: 1000 })],
      [trip({ odoEnd: 1500 }), trip({ id: 't2', vehicleId: 'v2', odoEnd: 9000 })],
    );
    expect(d.vs.v1.odo).toBe(1500);
    expect(d.vs.v2.odo).toBe(9000);
  });
  it('precio del vehículo: el de la carga más reciente (por fecha, luego odómetro)', () => {
    const d = computeDerived(
      [v1],
      [
        load({ id: 'a', odometer: 1000, date: '2024-06-01', price: 20 }),
        load({ id: 'b', odometer: 1300, date: '2024-06-20', price: 22 }),
        load({ id: 'c', odometer: 1100, date: '2024-06-20', price: 21 }),
      ],
      [],
    );
    expect(d.vs.v1.lastPrice).toBe(22);
  });
  it('precio general: el de la carga más reciente de cualquier vehículo', () => {
    const d = computeDerived(
      [v1, v2],
      [
        load({ id: 'a', date: '2024-06-01', price: 20 }),
        load({ id: 'b', odometer: 5000, vehicleId: 'v2', date: '2024-06-25', price: 23 }),
        load({ id: 'c', odometer: 1300, date: '2024-06-10', price: 21 }),
      ],
      [],
    );
    expect(d.latestPrice).toBe(23);
  });
  it('sin cargas: promedio y precio nulos, precio general 24.3', () => {
    const d = computeDerived([v1], [], []);
    expect(d.vs.v1).toMatchObject({ avg: null, lastPrice: null, odo: 0, loads: [] });
    expect(d.latestPrice).toBe(24.3);
  });
});

describe('derive y accesos', () => {
  beforeEach(() => {
    setState({
      vehicles: [v1, v2],
      fuel: [
        load({ id: 'a', odometer: 1000, price: 20 }),
        load({ id: 'b', odometer: 1300, liters: 20, date: '2024-06-20', price: 22 }),
      ],
    });
    derive();
  });
  it('derive deja el resultado en D', () => {
    expect(D.kmpl).toEqual({ b: 15 });
  });
  it('kmplOf usa 12 km/L si el vehículo no tiene promedio', () => {
    expect(kmplOf('v1')).toBe(15);
    expect(kmplOf('v2')).toBe(12);
    expect(kmplOf('nadie')).toBe(12);
  });
  it('priceOf cae al último precio general', () => {
    expect(priceOf('v1')).toBe(22);
    expect(priceOf('v2')).toBe(22);
  });
  it('cpkOf = precio ÷ rendimiento (null sin promedio)', () => {
    expect(cpkOf('v1')).toBeCloseTo(22 / 15, 10);
    expect(cpkOf('v2')).toBeNull();
  });
  it('fuelTotal = litros × precio', () => {
    expect(fuelTotal(load({ liters: 20, price: 22 }))).toBe(440);
  });
});
