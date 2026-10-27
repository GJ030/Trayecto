import { beforeEach, describe, expect, it } from 'vitest';
import { tripsRepo } from './trips.repo';
import { tripPoints } from '@/data/routes';
import { ValidationError, type TripInput } from '@/data/schema';
import { S } from '@/data/store';
import { clone, makePlaces, recordEvents, setState, trip, vehicle } from '@/testing/fixtures';

const input = (over: Partial<TripInput> = {}): TripInput => ({
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

beforeEach(() => {
  setState({ vehicles: [vehicle('v1'), vehicle('v2')], places: makePlaces() });
});

describe('tripsRepo.create', () => {
  it('crea el viaje con su ruta generada (auto) y emite un evento', () => {
    const { events, stop } = recordEvents();
    const t = tripsRepo.create(input());
    stop();
    expect(tripsRepo.list()).toEqual([t]);
    expect(t.id).toMatch(/^t/);
    expect(t.pointsSource).toBe('auto');
    expect(t.points).toEqual(tripPoints(t, S.places));
    expect(t.points.length).toBeGreaterThanOrEqual(20);
    expect(events).toEqual([{ scope: ['trips', 'settings'], persist: true, render: true }]);
  });
  it('sin coordenadas en un lugar, la ruta queda vacía', () => {
    expect(tripsRepo.create(input({ destination: 'Gama' })).points).toEqual([]);
  });
  it('un viaje inválido lanza ValidationError y no cambia nada', () => {
    const { events, stop } = recordEvents();
    expect(() => tripsRepo.create(input({ odoEnd: 900 }))).toThrow(ValidationError);
    expect(() => tripsRepo.create(input({ origin: ' ' }))).toThrow('Escribe el lugar de origen.');
    stop();
    expect(S.trips).toHaveLength(0);
    expect(events).toEqual([]);
  });
  it('sanea el rendimiento de la computadora y recuerda la unidad usada', () => {
    const t = tripsRepo.create(input({ computerKmpl: 12.5, computerUnit: 'l100' }));
    expect(t).toMatchObject({ computerKmpl: 12.5, computerUnit: 'l100' });
    expect(S.settings.computerUnit).toBe('l100');
    const u = tripsRepo.create(input({ computerKmpl: 99, computerUnit: 'kmpl' }));
    expect(u).toMatchObject({ computerKmpl: null, computerUnit: null });
  });
  it('sin rendimiento de la computadora no cambia la unidad recordada', () => {
    S.settings.computerUnit = 'l100';
    tripsRepo.create(input());
    expect(S.settings.computerUnit).toBe('l100');
  });
});

describe('tripsRepo.update', () => {
  it('edita en su lugar (mismo id y misma referencia)', () => {
    const t = tripsRepo.create(input());
    const r = tripsRepo.update(t.id, input({ tag: 'Personal', vehicleId: 'v2' }));
    expect(r).toBe(t);
    expect(t).toMatchObject({ tag: 'Personal', vehicleId: 'v2' });
    expect(S.trips).toHaveLength(1);
  });
  it('si cambia algo que define la ruta, la regenera (auto)', () => {
    const t = tripsRepo.create(input());
    const before = t.points;
    tripsRepo.update(t.id, input({ odoEnd: 1040, arrive: '09:00' }));
    expect(t.points).not.toEqual(before);
    expect(t.points).toEqual(tripPoints(t, S.places));
  });
  it('si no cambia la ruta (solo etiqueta, vehículo o rendimiento), conserva los puntos', () => {
    const t = tripsRepo.create(input());
    const before = t.points;
    tripsRepo.update(t.id, input({ tag: 'Personal', computerKmpl: 15, computerUnit: 'kmpl' }));
    expect(t.points).toBe(before);
    expect(t.computerKmpl).toBe(15);
  });
  it('una ruta importada nunca se sobrescribe', () => {
    const t = tripsRepo.create(input());
    t.pointsSource = 'imported';
    const pts = clone(t.points).slice(0, 3);
    t.points = pts;
    tripsRepo.update(t.id, input({ destination: 'Alfa', odoEnd: 1100 }));
    expect(t.points).toBe(pts);
    expect(t.destination).toBe('Alfa');
  });
  it('quitar el rendimiento de la computadora lo deja en null', () => {
    const t = tripsRepo.create(input({ computerKmpl: 12, computerUnit: 'kmpl' }));
    tripsRepo.update(t.id, input());
    expect(t).toMatchObject({ computerKmpl: null, computerUnit: null });
  });
  it('devuelve null si el viaje ya no existe; un viaje inválido lanza', () => {
    expect(tripsRepo.update('nada', input())).toBeNull();
    const t = tripsRepo.create(input());
    expect(() => tripsRepo.update(t.id, input({ date: '' }))).toThrow(ValidationError);
    expect(t.date).toBe('2024-06-15');
  });
});

describe('tripsRepo.remove', () => {
  it('elimina, limpia la selección y emite', () => {
    const t = tripsRepo.create(input());
    S.ui.selTrip = t.id;
    const { events, stop } = recordEvents();
    expect(tripsRepo.remove(t.id)).toBe(true);
    stop();
    expect(S.trips).toEqual([]);
    expect(S.ui.selTrip).toBeNull();
    expect(events).toEqual([{ scope: ['trips', 'ui'], persist: true, render: true }]);
  });
  it('un id inexistente devuelve false y no emite', () => {
    const { events, stop } = recordEvents();
    expect(tripsRepo.remove('nada')).toBe(false);
    stop();
    expect(events).toEqual([]);
  });
});

describe('cascadas por nombre de lugar', () => {
  beforeEach(() => {
    setState({
      vehicles: [vehicle('v1')],
      places: makePlaces(),
      trips: [
        trip({ id: 'a', origin: 'Alfa', destination: 'Beta' }),
        trip({ id: 'b', origin: 'beta', destination: 'ALFA', pointsSource: 'imported' }),
        trip({ id: 'c', origin: 'Beta', destination: 'Gama' }),
      ],
    });
    for (const t of S.trips) t.points = tripPoints(t, S.places);
  });
  const ids = (ts: readonly { id: string }[]) => ts.map((t) => t.id);

  it('usingPlace encuentra los viajes sin importar mayúsculas ni acentos', () => {
    expect(ids(tripsRepo.usingPlace('alfa'))).toEqual(['a', 'b']);
    expect(ids(tripsRepo.usingPlace('Gama'))).toEqual(['c']);
    expect(tripsRepo.usingPlace('Nadie')).toEqual([]);
  });
  it('renamePlace reescribe origen y destino sin tocar los puntos', () => {
    const pts = S.trips.map((t) => t.points);
    const { events, stop } = recordEvents();
    expect(tripsRepo.renamePlace('Alfa', 'Alfa 2')).toBe(2);
    stop();
    expect(S.trips.map((t) => [t.origin, t.destination])).toEqual([
      ['Alfa 2', 'Beta'],
      ['beta', 'Alfa 2'],
      ['Beta', 'Gama'],
    ]);
    expect(S.trips.map((t) => t.points)).toEqual(pts);
    expect(events).toHaveLength(1);
  });
  it('renamePlace sin viajes afectados no emite', () => {
    const { events, stop } = recordEvents();
    expect(tripsRepo.renamePlace('Nadie', 'Otro')).toBe(0);
    stop();
    expect(events).toEqual([]);
  });
  it('regeneratePoints solo toca las rutas auto de los viajes del lugar', () => {
    S.places[0].lat = 10.2;
    const imported = S.trips[1].points;
    const c = S.trips[2].points;
    expect(tripsRepo.regeneratePoints('Alfa')).toBe(1);
    expect(S.trips[0].points).toEqual(tripPoints(S.trips[0], S.places));
    expect(S.trips[1].points).toBe(imported);
    expect(S.trips[2].points).toBe(c);
  });
  it('retargetPlace pasa los viajes al otro lugar y regenera las rutas auto con sus coordenadas', () => {
    S.places.push({ ...S.places[0], id: 'pz', name: 'Zeta', lat: 10.3, lng: 10.3 });
    const imported = S.trips[1].points;
    const changed = tripsRepo.retargetPlace('Alfa', 'Zeta');
    expect(ids(changed.map((c) => c.trip))).toEqual(['a', 'b']);
    expect(S.trips[0]).toMatchObject({ origin: 'Zeta', destination: 'Beta' });
    expect(S.trips[1]).toMatchObject({ origin: 'beta', destination: 'Zeta' });
    expect(S.trips[0].points).toEqual(tripPoints(S.trips[0], S.places));
    expect(S.trips[0].points[0]).toMatchObject({ lat: 10.3, lng: 10.3 });
    expect(S.trips[1].points).toBe(imported);
  });
  it('si el destino de la fusión no tiene ubicación conserva las rutas anteriores', () => {
    const a = S.trips[0].points;
    tripsRepo.retargetPlace('Alfa', 'Gama');
    expect(S.trips[0].destination).toBe('Beta');
    expect(S.trips[0].origin).toBe('Gama');
    expect(S.trips[0].points).toBe(a);
  });
  it('restoreRetargeted deja los viajes exactamente como estaban', () => {
    S.places.push({ ...S.places[0], id: 'pz', name: 'Zeta', lat: 10.3, lng: 10.3 });
    const before = clone(S.trips);
    const changed = tripsRepo.retargetPlace('Alfa', 'Zeta');
    expect(S.trips).not.toEqual(before);
    tripsRepo.restoreRetargeted(changed);
    expect(S.trips).toEqual(before);
  });
  it('restoreRetargeted ignora los viajes que ya no existen', () => {
    S.places.push({ ...S.places[0], id: 'pz', name: 'Zeta', lat: 10.3, lng: 10.3 });
    const changed = tripsRepo.retargetPlace('Alfa', 'Zeta');
    tripsRepo.remove('a');
    tripsRepo.restoreRetargeted(changed);
    expect(ids(S.trips)).toEqual(['b', 'c']);
    expect(S.trips[0].destination).toBe('ALFA');
  });
  it('removeByVehicle elimina los viajes de ese vehículo', () => {
    S.trips[1].vehicleId = 'v9';
    expect(tripsRepo.removeByVehicle('v9')).toBe(1);
    expect(ids(S.trips)).toEqual(['a', 'c']);
    expect(tripsRepo.removeByVehicle('v9')).toBe(0);
  });
});
