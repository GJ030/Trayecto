import { beforeEach, describe, expect, it } from 'vitest';
import { placesRepo } from './places.repo';
import { tripPoints } from '@/data/routes';
import { ValidationError } from '@/data/schema';
import { S } from '@/data/store';
import {
  clone,
  makePlaces,
  place,
  recordEvents,
  setState,
  trip,
  vehicle,
} from '@/testing/fixtures';

const byName = (n: string) => S.places.find((p) => p.name === n)!;

beforeEach(() => {
  setState({
    vehicles: [vehicle('v1')],
    places: [...makePlaces(), place('pd', 'Delta', 10.2, 10.3)],
    trips: [
      trip({ id: 'a', origin: 'Alfa', destination: 'Beta' }),
      trip({ id: 'b', origin: 'Beta', destination: 'Alfa', pointsSource: 'imported' }),
      trip({ id: 'c', origin: 'Beta', destination: 'Gama' }),
      trip({ id: 'd', origin: 'Delta', destination: 'Alfa' }),
    ],
  });
  for (const t of S.trips) t.points = tripPoints(t, S.places);
});

describe('placesRepo.create y ensure', () => {
  it('crea un lugar sin ubicación con posición estimada', () => {
    const p = placesRepo.create({ name: '  Nuevo   lugar ', area: ' Zona ', kind: 'gym' });
    expect(p).toMatchObject({
      name: 'Nuevo lugar',
      area: 'Zona',
      kind: 'gym',
      lat: null,
      lng: null,
    });
    expect(p.x).toEqual(expect.any(Number));
    expect(S.places).toContain(p);
  });
  it('rechaza nombre vacío y duplicados sin importar mayúsculas ni acentos', () => {
    expect(() => placesRepo.create({ name: '  ' })).toThrow(ValidationError);
    expect(() => placesRepo.create({ name: 'ALFA' })).toThrow('Ese lugar ya existe');
    expect(S.places).toHaveLength(4);
  });
  it('ensure devuelve el nombre canónico del lugar existente sin crear otro', () => {
    const { events, stop } = recordEvents();
    expect(placesRepo.ensure(' alfa ')).toBe('Alfa');
    stop();
    expect(S.places).toHaveLength(4);
    expect(events).toEqual([]);
  });
  it('ensure crea el lugar que no existe', () => {
    const { events, stop } = recordEvents();
    expect(placesRepo.ensure('Sitio  Nuevo', 'Alfa', 10)).toBe('Sitio Nuevo');
    stop();
    expect(S.places).toHaveLength(5);
    expect(S.places[4]).toMatchObject({ name: 'Sitio Nuevo', lat: null, kind: 'other' });
    expect(events).toEqual([{ scope: ['places'], persist: true, render: true }]);
  });
});

describe('placesRepo.update: renombrar con cascada', () => {
  it('reescribe origen y destino de los viajes sin tocar sus puntos', () => {
    const pts = S.trips.map((t) => t.points);
    const k = placesRepo.update('pa', { name: 'Alfa Prime', area: 'Centro', kind: 'home' });
    expect(k).toBe(3);
    expect(byName('Alfa Prime')).toMatchObject({ area: 'Centro', kind: 'home' });
    expect(S.trips.map((t) => [t.origin, t.destination])).toEqual([
      ['Alfa Prime', 'Beta'],
      ['Beta', 'Alfa Prime'],
      ['Beta', 'Gama'],
      ['Delta', 'Alfa Prime'],
    ]);
    expect(S.trips.map((t) => t.points)).toEqual(pts);
  });
  it('reasigna el trayecto seleccionado al nuevo nombre', () => {
    S.ui.selPair = 'alfa→beta';
    placesRepo.update('pa', { name: 'Éxito', area: '', kind: 'other' });
    expect(S.ui.selPair).toBe('exito→beta');
    S.ui.selPair = 'beta→exito';
    placesRepo.update('pa', { name: 'Éxito', area: '', kind: 'other' });
    expect(S.ui.selPair).toBe('beta→exito');
  });
  it('emite un solo evento aunque cambien lugares, viajes y selección', () => {
    const { events, stop } = recordEvents();
    placesRepo.update('pa', { name: 'Otro', area: '', kind: 'other' });
    stop();
    expect(events).toHaveLength(1);
    expect(new Set(events[0].scope)).toEqual(new Set(['places', 'trips', 'ui']));
  });
  it('rechaza un nombre vacío o repetido (sin acentos ni mayúsculas) y no cambia nada', () => {
    const before = clone({ places: S.places, trips: S.trips });
    expect(() => placesRepo.update('pa', { name: ' ', area: '', kind: 'other' })).toThrow(
      ValidationError,
    );
    expect(() => placesRepo.update('pa', { name: 'bétA', area: '', kind: 'other' })).toThrow(
      'Ya existe un lugar llamado «Beta».',
    );
    expect({ places: S.places, trips: S.trips }).toEqual(before);
  });
  it('cambiar solo mayúsculas del propio lugar se permite y alcanza a los viajes', () => {
    expect(placesRepo.update('pa', { name: 'ALFA', area: '', kind: 'other' })).toBe(3);
    expect(byName('ALFA')).toBeDefined();
    expect(S.trips[0].origin).toBe('ALFA');
  });
  it('sin cambiar el nombre solo edita zona e ícono', () => {
    const { events, stop } = recordEvents();
    expect(placesRepo.update('pb', { name: 'Beta', area: ' Norte ', kind: 'work' })).toBe(0);
    stop();
    expect(byName('Beta')).toMatchObject({ area: 'Norte', kind: 'work' });
    expect(events).toHaveLength(1);
  });
  it('un id inexistente devuelve 0', () => {
    expect(placesRepo.update('nada', { name: 'X', area: '', kind: 'other' })).toBe(0);
  });
});

describe('placesRepo.remove', () => {
  it('elimina el lugar pero nunca los viajes', () => {
    const trips = clone(S.trips);
    placesRepo.remove('pa');
    expect(S.places.map((p) => p.id)).toEqual(['pb', 'pc', 'pd']);
    expect(S.trips).toEqual(trips);
  });
  it('limpia la selección del lugar y de los trayectos que lo incluyen', () => {
    S.ui.selPlace = 'pa';
    S.ui.selPair = 'beta→alfa';
    placesRepo.remove('pa');
    expect(S.ui.selPlace).toBeNull();
    expect(S.ui.selPair).toBeNull();
  });
  it('no limpia selecciones de otros lugares', () => {
    S.ui.selPlace = 'pb';
    S.ui.selPair = 'beta→gama';
    placesRepo.remove('pa');
    expect(S.ui.selPlace).toBe('pb');
    expect(S.ui.selPair).toBe('beta→gama');
  });
  it('devuelve null si no existe', () => {
    expect(placesRepo.remove('nada')).toBeNull();
  });
  it('deshacer devuelve el lugar a su posición y restaura la selección', () => {
    S.ui.selPlace = 'pb';
    S.ui.selPair = 'beta→alfa';
    const before = clone({ places: S.places, ui: S.ui });
    const u = placesRepo.remove('pb')!;
    expect(S.ui.selPlace).toBeNull();
    expect(u.undo()).toBe(true);
    expect({ places: S.places, ui: S.ui }).toEqual(before);
  });
  it('deshacer no duplica si entretanto se creó otro lugar con ese nombre', () => {
    const u = placesRepo.remove('pb')!;
    placesRepo.create({ name: 'beta' });
    const n = S.places.length;
    expect(u.undo()).toBe(false);
    expect(S.places).toHaveLength(n);
  });
});

describe('placesRepo.merge', () => {
  it('pasa los viajes al otro nombre, regenera rutas auto y elimina el origen', () => {
    const imported = S.trips[1].points;
    const r = placesRepo.merge('pa', 'pd')!;
    expect(r.moved).toBe(3);
    expect(S.places.map((p) => p.id)).toEqual(['pb', 'pc', 'pd']);
    expect(S.trips.map((t) => [t.origin, t.destination])).toEqual([
      ['Delta', 'Beta'],
      ['Beta', 'Delta'],
      ['Beta', 'Gama'],
      ['Delta', 'Delta'],
    ]);
    expect(S.trips[0].points).toEqual(tripPoints(S.trips[0], S.places));
    expect(S.trips[0].points[0]).toMatchObject({ lat: 10.2, lng: 10.3 });
    expect(S.trips[1].points).toBe(imported); // las rutas ajenas no se tocan
  });
  it('si el destino no tiene ubicación conserva las rutas', () => {
    const pts = S.trips[0].points;
    placesRepo.merge('pa', 'pc');
    expect(S.trips[0].origin).toBe('Gama');
    expect(S.trips[0].points).toBe(pts);
  });
  it('limpia la selección que involucra al lugar fusionado', () => {
    S.ui.selPlace = 'pa';
    S.ui.selPair = 'alfa→beta';
    placesRepo.merge('pa', 'pd');
    expect(S.ui.selPlace).toBeNull();
    expect(S.ui.selPair).toBeNull();
  });
  it('emite un solo evento', () => {
    const { events, stop } = recordEvents();
    placesRepo.merge('pa', 'pd');
    stop();
    expect(events).toHaveLength(1);
    expect(new Set(events[0].scope)).toEqual(new Set(['places', 'trips', 'ui']));
  });
  it('deshacer deja lugares, viajes y selección idénticos al estado previo', () => {
    S.ui.selPlace = 'pa';
    S.ui.selPair = 'alfa→beta';
    const before = clone({ places: S.places, trips: S.trips, ui: S.ui });
    const r = placesRepo.merge('pa', 'pd')!;
    expect({ places: S.places, trips: S.trips }).not.toEqual({
      places: before.places,
      trips: before.trips,
    });
    expect(r.undo()).toBe(true);
    expect({ places: S.places, trips: S.trips, ui: S.ui }).toEqual(before);
  });
  it('deshacer no hace nada si ya existe otro lugar con el nombre del fusionado', () => {
    const r = placesRepo.merge('pa', 'pd')!;
    placesRepo.create({ name: 'Alfa' });
    const trips = clone(S.trips);
    expect(r.undo()).toBe(false);
    expect(S.trips).toEqual(trips);
  });
  it('devuelve null si falta alguno de los dos lugares', () => {
    expect(placesRepo.merge('nada', 'pd')).toBeNull();
    expect(placesRepo.merge('pa', 'nada')).toBeNull();
    expect(S.places).toHaveLength(4);
  });
});

describe('placesRepo.setLocation', () => {
  it('guarda la ubicación, quita x/y y regenera solo las rutas auto de sus viajes', () => {
    const gama = byName('Gama');
    gama.x = 100;
    gama.y = 100;
    const c = S.trips[2];
    expect(c.points).toEqual([]); // sin ubicación no había ruta
    const imported = S.trips[1].points;
    const k = placesRepo.setLocation('pc', 10.123456789, 10.987654321);
    expect(k).toBe(1);
    expect(gama).toMatchObject({ lat: 10.123457, lng: 10.987654 });
    expect('x' in gama || 'y' in gama).toBe(false);
    expect(c.points.length).toBeGreaterThanOrEqual(20);
    expect(c.points).toEqual(tripPoints(c, S.places));
    expect(S.trips[1].points).toBe(imported);
  });
  it('mover un lugar con viajes cambia sus rutas auto', () => {
    const before = S.trips[0].points;
    placesRepo.setLocation('pa', 10.01, 10.02);
    expect(S.trips[0].points).not.toEqual(before);
    expect(S.trips[0].points[0]).toMatchObject({ lat: 10.01, lng: 10.02 });
  });
  it('un lugar inexistente devuelve 0 y no emite', () => {
    const { events, stop } = recordEvents();
    expect(placesRepo.setLocation('nada', 1, 1)).toBe(0);
    stop();
    expect(events).toEqual([]);
  });
});
