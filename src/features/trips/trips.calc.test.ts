import { beforeEach, describe, expect, it } from 'vitest';
import {
  compAccuracy,
  compOf,
  filteredTrips,
  fmtComp,
  tripCost,
  tripDur,
  tripKm,
  tripKmpl,
  tripLiters,
  tripSpeed,
  tripsDesc,
} from './trips.calc';
import { derive } from '@/features/fuel/fuel.calc';
import { S } from '@/data/store';
import { load, makePlaces, setState, trip, vehicle } from '@/testing/fixtures';

describe('tripDur: duración en minutos', () => {
  it('llegada posterior a la salida', () => {
    expect(tripDur({ depart: '08:00', arrive: '08:45' })).toBe(45);
    expect(tripDur({ depart: '07:50', arrive: '10:05' })).toBe(135);
  });
  it('cruza la medianoche: la llegada es menor que la salida', () => {
    expect(tripDur({ depart: '23:50', arrive: '00:20' })).toBe(30);
    expect(tripDur({ depart: '22:00', arrive: '06:00' })).toBe(8 * 60);
    expect(tripDur({ depart: '23:59', arrive: '00:00' })).toBe(1);
  });
  it('salida y llegada iguales se toman como 24 h', () => {
    expect(tripDur({ depart: '09:00', arrive: '09:00' })).toBe(1440);
  });
  it('horas de un dígito', () => {
    expect(tripDur({ depart: '8:05', arrive: '9:35' })).toBe(90);
  });
});

describe('distancia y velocidad', () => {
  it('tripKm es la diferencia de odómetro y nunca negativa', () => {
    expect(tripKm({ odoStart: 100, odoEnd: 112.5 })).toBe(12.5);
    expect(tripKm({ odoStart: 100, odoEnd: 90 })).toBe(0);
  });
  it('tripSpeed = km ÷ horas, incluso cruzando la medianoche', () => {
    expect(tripSpeed(trip({ odoStart: 0, odoEnd: 30, depart: '08:00', arrive: '08:30' }))).toBe(60);
    expect(tripSpeed(trip({ odoStart: 0, odoEnd: 15, depart: '23:45', arrive: '00:15' }))).toBe(30);
  });
});

describe('costo por viaje', () => {
  beforeEach(() => {
    // v1: 15 km/L y $22/L (dos tanques llenos); v2 sin cargas: 12 km/L por omisión
    setState({
      vehicles: [vehicle('v1'), vehicle('v2')],
      fuel: [
        load({ id: 'a', odometer: 1000, price: 20 }),
        load({ id: 'b', odometer: 1300, liters: 20, date: '2024-06-20', price: 22 }),
      ],
    });
    derive();
  });
  const t30 = (over = {}) => trip({ odoStart: 2000, odoEnd: 2030, ...over });

  it('sin rendimiento de la computadora usa el promedio del vehículo', () => {
    const t = t30();
    expect(compOf(t)).toBeNull();
    expect(tripKmpl(t)).toBe(15);
    expect(tripLiters(t)).toBe(2);
    expect(tripCost(t)).toBe(44);
  });
  it('con rendimiento de la computadora usa ese valor para litros y costo', () => {
    const t = t30({ computerKmpl: 10, computerUnit: 'kmpl' });
    expect(compOf(t)).toBe(10);
    expect(tripKmpl(t)).toBe(10);
    expect(tripLiters(t)).toBe(3);
    expect(tripCost(t)).toBe(66);
  });
  it('el precio sigue siendo el del vehículo aunque use la computadora', () => {
    expect(tripCost(t30({ computerKmpl: 20 }))).toBe((30 / 20) * 22);
  });
  it('vehículo sin cargas: 12 km/L y el último precio general', () => {
    const t = t30({ vehicleId: 'v2' });
    expect(tripKmpl(t)).toBe(12);
    expect(tripLiters(t)).toBe(2.5);
    expect(tripCost(t)).toBe(2.5 * 22);
  });
  it('vehículo inexistente cae a los valores por omisión', () => {
    expect(tripCost(t30({ vehicleId: 'zz' }))).toBe(2.5 * 22);
  });
  it('un rendimiento de la computadora de 0 o nulo se ignora', () => {
    expect(compOf({ computerKmpl: 0 })).toBeNull();
    expect(compOf({ computerKmpl: null })).toBeNull();
    expect(tripKmpl(t30({ computerKmpl: 0 }))).toBe(15);
  });
  it('un viaje sin distancia no cuesta nada', () => {
    expect(tripCost(t30({ odoEnd: 2000 }))).toBe(0);
  });
});

describe('fmtComp', () => {
  it('muestra el valor en la unidad en que se capturó', () => {
    expect(fmtComp(trip({ computerKmpl: 12.5, computerUnit: 'kmpl' }))).toBe('12.5 km/L');
    expect(fmtComp(trip({ computerKmpl: 12.5, computerUnit: 'l100' }))).toBe('8.0 L/100 km');
  });
});

describe('tripsDesc y filteredTrips', () => {
  beforeEach(() => {
    setState({
      vehicles: [vehicle('v1', 'Sedán'), vehicle('v2', 'Compacto')],
      places: makePlaces(),
      trips: [
        trip({ id: 'a', date: '2024-06-01', odoStart: 0, odoEnd: 10, vehicleId: 'v1' }),
        trip({
          id: 'b',
          date: '2024-06-03',
          odoStart: 0,
          odoEnd: 30,
          vehicleId: 'v2',
          tag: 'Personal',
          origin: 'Beta',
          destination: 'Gama',
        }),
        trip({ id: 'c', date: '2024-06-02', odoStart: 0, odoEnd: 20, vehicleId: 'v1' }),
      ],
    });
    derive();
  });
  const ids = () => filteredTrips().map((t) => t.id);

  it('tripsDesc ordena del más reciente al más antiguo sin alterar el estado', () => {
    expect(tripsDesc().map((t) => t.id)).toEqual(['b', 'c', 'a']);
    expect(S.trips.map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });
  it('por omisión: fecha descendente', () => {
    expect(ids()).toEqual(['b', 'c', 'a']);
  });
  it('ordena por otras columnas y dirección', () => {
    S.ui.sort = { key: 'km', dir: 'asc' };
    expect(ids()).toEqual(['a', 'c', 'b']);
    S.ui.sort = { key: 'vehicle', dir: 'asc' };
    expect(ids()[0]).toBe('b'); // «Compacto» antes que «Sedán»
    S.ui.sort = { key: 'cost', dir: 'desc' };
    expect(ids()[0]).toBe('b');
  });
  it('filtra por etiqueta, vehículo y rango de fechas', () => {
    S.ui.tf = { tag: 'Personal', vehicle: 'all', from: '', to: '' };
    expect(ids()).toEqual(['b']);
    S.ui.tf = { tag: 'Todos', vehicle: 'v1', from: '', to: '' };
    expect(ids()).toEqual(['c', 'a']);
    S.ui.tf = { tag: 'Todos', vehicle: 'all', from: '2024-06-02', to: '2024-06-02' };
    expect(ids()).toEqual(['c']);
  });
  it('la búsqueda ignora mayúsculas y acentos y mira lugares, vehículo y etiqueta', () => {
    S.ui.q = 'GAMA';
    expect(ids()).toEqual(['b']);
    S.ui.q = 'sedan';
    expect(ids()).toEqual(['c', 'a']);
    S.ui.q = 'personal';
    expect(ids()).toEqual(['b']);
    S.ui.q = 'nada que ver';
    expect(ids()).toEqual([]);
  });
});

describe('compAccuracy: precisión de la computadora', () => {
  const base = () =>
    setState({
      vehicles: [vehicle('v1')],
      fuel: [
        load({ id: 'a', odometer: 1000, date: '2024-06-01' }),
        load({ id: 'b', odometer: 1300, liters: 20, date: '2024-06-20' }), // 15 km/L reales
      ],
      trips: [
        trip({ id: 't1', date: '2024-06-05', computerKmpl: 16, computerUnit: 'kmpl' }),
        trip({ id: 't2', date: '2024-06-10', computerKmpl: 17, computerUnit: 'kmpl' }),
        trip({ id: 't3', date: '2024-06-15', computerKmpl: 18, computerUnit: 'kmpl' }),
      ],
    });
  it('compara el promedio de la computadora con el real', () => {
    base();
    derive();
    const a = compAccuracy('v1')!;
    expect(a).toMatchObject({ n: 3, loads: 1, from: '2024-06-05', to: '2024-06-15' });
    expect(a.comp).toBe(17);
    expect(a.real).toBe(15);
    expect(a.pct).toBeCloseTo((2 / 15) * 100, 10);
  });
  it('con menos de 3 viajes con dato no hay resultado', () => {
    base();
    S.trips[2].computerKmpl = null;
    derive();
    expect(compAccuracy('v1')).toBeNull();
  });
  it('si ninguna carga llena toca el periodo de los viajes no hay resultado', () => {
    base();
    S.trips.forEach((t, i) => (t.date = `2024-07-0${i + 1}`)); // todos después de la última carga
    derive();
    expect(compAccuracy('v1')).toBeNull();
  });
  it('sin cargas con rendimiento calculado no hay resultado', () => {
    base();
    S.fuel.length = 1;
    derive();
    expect(compAccuracy('v1')).toBeNull();
  });
});
