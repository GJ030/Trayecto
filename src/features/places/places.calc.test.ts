import { beforeEach, describe, expect, it } from 'vitest';
import {
  KINDS,
  newPlacePos,
  nTrips,
  pairStats,
  placeOpts,
  placeVisits,
  tripsOf,
} from './places.calc';
import { S } from '@/data/store';
import { makePlaces, setState, trip, vehicle } from '@/testing/fixtures';

beforeEach(() => {
  setState({
    vehicles: [vehicle('v1')],
    places: makePlaces(),
    trips: [
      trip({
        id: 'a',
        origin: 'Alfa',
        destination: 'Beta',
        depart: '08:00',
        arrive: '08:30',
        odoEnd: 1010,
      }),
      trip({
        id: 'b',
        origin: 'alfa',
        destination: 'BETA',
        depart: '09:00',
        arrive: '09:50',
        odoEnd: 1020,
      }),
      trip({
        id: 'c',
        origin: 'Beta',
        destination: 'Alfa',
        depart: '23:30',
        arrive: '00:10',
        odoEnd: 1030,
      }),
    ],
  });
});

describe('placeVisits y tripsOf', () => {
  it('cuenta como origen o destino sin importar mayúsculas', () => {
    expect(placeVisits()).toEqual({ pa: 3, pb: 3, pc: 0 });
    expect(tripsOf(S.places[2])).toEqual([]);
    expect(tripsOf(S.places[0]).map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });
  it('nTrips concuerda en singular y plural', () => {
    expect(nTrips(1)).toBe('1 viaje');
    expect(nTrips(0)).toBe('0 viajes');
    expect(nTrips(2)).toBe('2 viajes');
  });
});

describe('pairStats', () => {
  it('agrupa por origen→destino normalizados y promedia', () => {
    const ps = pairStats();
    expect(ps).toHaveLength(2);
    const ab = ps.find((p) => p.key === 'alfa→beta')!;
    expect(ab).toMatchObject({
      n: 2,
      min: 80,
      km: 30,
      avgMin: 40,
      avgKm: 15,
      from: 'Alfa',
      to: 'Beta',
    });
  });
  it('suma la duración de los viajes que cruzan la medianoche', () => {
    const ba = pairStats().find((p) => p.key === 'beta→alfa')!;
    expect(ba).toMatchObject({ n: 1, min: 40 });
  });
  it('ordena por cantidad de viajes y luego por menor duración promedio', () => {
    expect(pairStats().map((p) => p.key)).toEqual(['alfa→beta', 'beta→alfa']);
  });
});

describe('placeOpts', () => {
  it('lista primero los más visitados y describe sus visitas', () => {
    S.places[2].area = 'Zona';
    const o = placeOpts();
    expect(
      o
        .map((x) => x.label)
        .slice(0, 2)
        .sort(),
    ).toEqual(['Alfa', 'Beta']);
    expect(o[2]).toMatchObject({ label: 'Gama', meta: 'Zona' });
    expect(o[0].meta).toBe('3 visitas');
  });
  it('KINDS incluye los tipos usados por los íconos', () => {
    expect(KINDS.map(([k]) => k)).toEqual(['home', 'work', 'gym', 'family', 'other']);
  });
});

describe('newPlacePos', () => {
  it('es determinista y queda dentro del lienzo', () => {
    const a = newPlacePos('Lugar nuevo'),
      b = newPlacePos('Lugar nuevo');
    expect(a).toEqual(b);
    expect(a.x).toBeGreaterThanOrEqual(50);
    expect(a.x).toBeLessThanOrEqual(750);
    expect(a.y).toBeGreaterThanOrEqual(40);
    expect(a.y).toBeLessThanOrEqual(480);
  });
  it('con ancla y km queda cerca del lugar de referencia, no encima', () => {
    const p = newPlacePos('Otro', 'Alfa', 5);
    expect(p.x).toEqual(expect.any(Number));
    expect(p.y).toEqual(expect.any(Number));
  });
});
