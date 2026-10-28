import { beforeEach, describe, expect, it } from 'vitest';
import { tripsRepo } from './trips.repo';
import { routeStops, tripPoints } from '@/data/routes';
import { routeSig } from '@/data/routing';
import { ValidationError, type TripInput } from '@/data/schema';
import { S } from '@/data/store';
import {
  clone,
  makePlaces,
  place,
  recordEvents,
  routeFor,
  setState,
  trip,
  vehicle,
} from '@/testing/fixtures';

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
  it('recuerda el modo de captura del odómetro usado en el formulario', () => {
    expect(S.settings.odoMode).toBe('end');
    tripsRepo.create(input({ odoMode: 'dist' }));
    expect(S.settings.odoMode).toBe('dist');
    const t = tripsRepo.create(input({ odoStart: 2000, odoEnd: 2010 }));
    expect(S.settings.odoMode).toBe('dist'); // sin odoMode no cambia
    tripsRepo.update(t.id, input({ odoStart: 2000, odoEnd: 2010, odoMode: 'end' }));
    expect(S.settings.odoMode).toBe('end');
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
  it('si el destino de la fusión no tiene ubicación el viaje queda sin trazo, y deshacer lo devuelve', () => {
    const antes = clone(S.trips[0]);
    const changed = tripsRepo.retargetPlace('Alfa', 'Gama');
    expect(S.trips[0].destination).toBe('Beta');
    expect(S.trips[0].origin).toBe('Gama');
    expect(S.trips[0].points).toEqual([]);
    tripsRepo.restoreRetargeted(changed);
    expect(S.trips[0]).toEqual(antes);
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

describe('rutas por calles reales en el repositorio de viajes', () => {
  const pending = (t: { origin: string; destination: string }, places = S.places) => ({
    status: 'pending',
    sig: routeSig(routeStops(t, places)!),
    distance: null,
    duration: null,
    n: 0,
  });
  beforeEach(() => {
    setState({
      vehicles: [vehicle('v1')],
      places: [...makePlaces(), place('pd', 'Delta', 10.2, 10.3)],
    });
  });

  it('con el ruteo apagado un viaje nuevo no tiene ruta y se dibuja como recta', () => {
    const t = tripsRepo.create(input());
    expect('route' in t).toBe(false);
    expect(t.points.length).toBeGreaterThanOrEqual(20);
    expect(t.points.length).toBeLessThanOrEqual(60);
  });
  it('con el ruteo activado un viaje nuevo queda «pendiente» con la huella de sus puntos', () => {
    S.settings.routing = true;
    const t = tripsRepo.create(input());
    expect(t.route).toEqual(pending(t));
    const sinUbicar = tripsRepo.create(
      input({ destination: 'Gama', odoStart: 5000, odoEnd: 5010 }),
    );
    expect('route' in sinUbicar).toBe(false);
    expect(sinUbicar.points).toEqual([]);
  });
  it('editar sin cambiar lugares conserva la ruta calculada y los puntos que salen de ella', () => {
    const t = tripsRepo.create(input());
    t.route = routeFor(t, S.places);
    t.points = tripPoints(t, S.places);
    const ruta = t.route,
      pts = t.points;
    tripsRepo.update(t.id, input({ tag: 'Personal' }));
    expect(t.route).toBe(ruta);
    expect(t.points).toBe(pts);
    tripsRepo.update(t.id, input({ odoEnd: 1020 }));
    expect(t.route).toBe(ruta);
    expect(t.points).not.toBe(pts);
    expect(t.points).toEqual(tripPoints(t, S.places));
    expect(t.points.length).toBeGreaterThanOrEqual(60);
  });
  it('cambiar el origen o el destino invalida la ruta: pendiente con el ruteo activado, descartada si no', () => {
    S.settings.routing = true;
    const t = tripsRepo.create(input());
    t.route = routeFor(t, S.places);
    tripsRepo.update(t.id, input({ destination: 'Delta' }));
    expect(t.route).toEqual(pending(t));
    expect(t.route!.geometry).toBeUndefined();
    expect(t.points[t.points.length - 1]).toMatchObject({ lat: 10.2, lng: 10.3 }); // recta mientras tanto
    S.settings.routing = false;
    t.route = routeFor(t, S.places);
    tripsRepo.update(t.id, input({ destination: 'Beta' }));
    expect('route' in t).toBe(false);
  });
  it('una ruta importada no recibe ruta calculada', () => {
    S.settings.routing = true;
    const t = tripsRepo.create(input());
    t.pointsSource = 'imported';
    delete t.route;
    tripsRepo.update(t.id, input({ destination: 'Delta' }));
    expect('route' in t).toBe(false);
  });
  it('regeneratePoints: si cambia la ubicación de un lugar la ruta de sus viajes ya no vale', () => {
    S.settings.routing = true;
    const t = tripsRepo.create(input());
    t.route = routeFor(t, S.places);
    t.points = tripPoints(t, S.places);
    S.places[1].lat = 10.2;
    expect(tripsRepo.regeneratePoints('Beta')).toBe(1);
    expect(t.route).toEqual(pending(t));
    expect(t.points).toEqual(tripPoints(t, S.places));
    expect(t.points[t.points.length - 1]).toMatchObject({ lat: 10.2 });
  });
  it('retargetPlace invalida la ruta y restoreRetargeted devuelve la ruta y los puntos tal cual', () => {
    S.settings.routing = true;
    const t = tripsRepo.create(input());
    t.route = routeFor(t, S.places);
    t.points = tripPoints(t, S.places);
    const antes = clone(t);
    const changed = tripsRepo.retargetPlace('Alfa', 'Delta');
    expect(t.origin).toBe('Delta');
    expect(t.route).toEqual(pending(t));
    tripsRepo.restoreRetargeted(changed);
    expect(t).toEqual(antes);
  });
  it('renombrar un lugar no toca la ruta (las ubicaciones no cambian)', () => {
    const t = tripsRepo.create(input());
    t.route = routeFor(t, S.places);
    const ruta = t.route;
    tripsRepo.renamePlace('Alfa', 'Alfa 2');
    S.places[0].name = 'Alfa 2';
    expect(tripsRepo.regeneratePoints('Alfa 2')).toBe(1);
    expect(t.route).toBe(ruta);
  });
});
