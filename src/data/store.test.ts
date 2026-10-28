import { beforeEach, describe, expect, it } from 'vitest';
import { migrate } from './migrations';
import { parseBackup, DATA_VERSION, normalize, stringifyData } from './schema';
import {
  S,
  adoptData,
  backupPayload,
  batch,
  emitChange,
  onChange,
  requestRender,
  setQuery,
  snapshot,
  updateUi,
  type ChangeEvent,
} from './store';
import { tripPoints } from './routes';
import { routeSig } from './routing';
import { routeStops } from './routes';
import { clone, recordEvents, resetState, routeFor } from '@/testing/fixtures';

describe('respaldo JSON: ida y vuelta', () => {
  beforeEach(() => {
    resetState();
    // un viaje con rendimiento de la computadora y otro con ruta importada
    S.trips[0].computerKmpl = 13.5;
    S.trips[0].computerUnit = 'l100';
    S.trips[1].pointsSource = 'imported';
    S.trips[1].points = S.trips[1].points.slice(0, 5);
    S.fuel[3].full = false;
    S.settings.defaultTag = 'Personal';
    S.settings.lastBackup = '2024-01-01T00:00:00.000Z';
  });

  it('el respaldo lleva app, versión, fecha y datos sin ui', () => {
    const p = backupPayload();
    expect(p.app).toBe('Trayecto');
    expect(p.version).toBe(DATA_VERSION);
    expect(Number.isNaN(Date.parse(p.exportedAt))).toBe(false);
    expect(Object.keys(p.data).sort()).toEqual(['fuel', 'places', 'settings', 'trips', 'vehicles']);
    expect(p.data.settings.lastBackup).toBeNull();
  });
  it('backupPayload → JSON → parseBackup devuelve los mismos datos', () => {
    const payload = backupPayload();
    const r = parseBackup(JSON.parse(JSON.stringify(payload, null, 2)));
    expect(r.error).toBeUndefined();
    expect(r.data).toEqual(payload.data);
    expect(r.raw).toEqual({
      trips: S.trips.length,
      fuel: S.fuel.length,
      vehicles: S.vehicles.length,
      places: S.places.length,
    });
  });
  it('importar el respaldo en una app vacía deja los datos idénticos', () => {
    const before = clone(snapshot());
    const r = parseBackup(JSON.parse(JSON.stringify(backupPayload())));
    S.trips.length = 0;
    S.fuel.length = 0;
    adoptData(r.data!);
    expect({ ...snapshot(), settings: { ...S.settings, lastBackup: null } }).toEqual(before);
    expect(S.ui.selTrip).toBeNull();
  });
  it('exportar dos veces seguidas da el mismo contenido (salvo la fecha)', () => {
    const a = backupPayload(),
      b = backupPayload();
    expect(a.data).toEqual(b.data);
  });
  it('un respaldo con ruta importada conserva su origen y sus puntos', () => {
    const r = parseBackup(JSON.parse(JSON.stringify(backupPayload())));
    expect(r.data!.trips[1]).toMatchObject({ pointsSource: 'imported' });
    expect(r.data!.trips[1].points).toHaveLength(5);
    expect(r.data!.trips[0]).toMatchObject({ computerKmpl: 13.5, computerUnit: 'l100' });
  });
});

describe('adoptData', () => {
  beforeEach(resetState);
  it('conserva las pistas y la pantalla, y limpia la selección y los filtros', () => {
    S.ui.view = 'viajes';
    S.ui.selTrip = 't1';
    S.ui.selPlace = 'p1';
    S.ui.selPair = 'a→b';
    S.ui.tf.tag = 'Personal';
    S.settings.hints = false;
    adoptData({ vehicles: [], places: [], trips: [], fuel: [], settings: { hints: true } });
    expect(S.ui.view).toBe('viajes');
    expect([S.ui.selTrip, S.ui.selPlace, S.ui.selPair]).toEqual([null, null, null]);
    expect(S.ui.tf).toEqual({ tag: 'Todos', vehicle: 'all', from: '', to: '' });
    expect(S.settings.hints).toBe(false);
  });
  it('lastBackup solo se conserva si se pide', () => {
    S.settings.lastBackup = '2024-01-01T00:00:00.000Z';
    adoptData({ vehicles: [], places: [], trips: [], fuel: [], settings: { lastBackup: null } });
    expect(S.settings.lastBackup).toBeNull();
    S.settings.lastBackup = '2024-02-02T00:00:00.000Z';
    adoptData({ vehicles: [], places: [], trips: [], fuel: [], settings: {} }, true);
    expect(S.settings.lastBackup).toBe('2024-02-02T00:00:00.000Z');
  });
  it('si el vehículo predeterminado ya no existe, usa el primero', () => {
    const v = {
      id: 'vx',
      name: 'X',
      year: '' as const,
      plate: '',
      fuel: 'Magna',
      tank: '' as const,
      color: '#000',
    };
    adoptData({
      vehicles: [v],
      places: [],
      trips: [],
      fuel: [],
      settings: { defaultVehicle: 'v1' },
    });
    expect(S.settings.defaultVehicle).toBe('vx');
    adoptData({ vehicles: [], places: [], trips: [], fuel: [], settings: {} });
    expect(S.settings.defaultVehicle).toBeNull();
  });
});

describe('eventos de cambio', () => {
  beforeEach(resetState);
  it('emitChange avisa con el alcance, y persistir/pintar por omisión', () => {
    const { events, stop } = recordEvents();
    emitChange('trips');
    emitChange(['fuel', 'ui'], false, false);
    stop();
    expect(events).toEqual<ChangeEvent[]>([
      { scope: ['trips'], persist: true, render: true },
      { scope: ['fuel', 'ui'], persist: false, render: false },
    ]);
  });
  it('batch junta los avisos en uno (alcances únicos; persist y render con OR)', () => {
    const { events, stop } = recordEvents();
    const r = batch(() => {
      emitChange('trips', false, false);
      emitChange(['trips', 'places'], true, false);
      emitChange('ui', false, true);
      return 42;
    });
    stop();
    expect(r).toBe(42);
    expect(events).toEqual([{ scope: ['trips', 'places', 'ui'], persist: true, render: true }]);
  });
  it('los batch anidados emiten una sola vez al salir del más externo', () => {
    const { events, stop } = recordEvents();
    batch(() => {
      batch(() => emitChange('fuel'));
      expect(events).toHaveLength(0);
      emitChange('trips');
    });
    stop();
    expect(events).toHaveLength(1);
    expect(events[0].scope).toEqual(['fuel', 'trips']);
  });
  it('si el batch lanza, igual emite lo acumulado y propaga el error', () => {
    const { events, stop } = recordEvents();
    expect(() =>
      batch(() => {
        emitChange('trips');
        throw new Error('falla');
      }),
    ).toThrow('falla');
    stop();
    expect(events).toHaveLength(1);
  });
  it('un batch sin cambios no emite nada', () => {
    const { events, stop } = recordEvents();
    batch(() => 1);
    stop();
    expect(events).toEqual([]);
  });
  it('onChange devuelve la función para dejar de escuchar', () => {
    const seen: ChangeEvent[] = [];
    const off = onChange((e) => seen.push(e));
    emitChange('trips');
    off();
    emitChange('trips');
    expect(seen).toHaveLength(1);
  });
  it('updateUi, setQuery y requestRender', () => {
    const { events, stop } = recordEvents();
    updateUi({ view: 'viajes' });
    updateUi({ collapsed: true }, { chrome: true, persist: false });
    updateUi({ placesLayer: 'calor' }, { silent: true });
    setQuery('hola');
    requestRender();
    stop();
    expect(S.ui).toMatchObject({
      view: 'viajes',
      collapsed: true,
      placesLayer: 'calor',
      q: 'hola',
    });
    expect(events).toEqual([
      { scope: ['ui'], persist: true, render: true },
      { scope: ['ui', 'chrome'], persist: false, render: true },
      { scope: ['ui'], persist: false, render: true },
      { scope: ['view'], persist: false, render: true },
    ]);
  });
});

describe('guardado sin rutas generadas', () => {
  beforeEach(resetState);

  it('el texto guardado pesa mucho menos y no tiene los points de los viajes auto', () => {
    S.trips[1].pointsSource = 'imported';
    const full = JSON.stringify(S);
    const slim = stringifyData(S);
    expect(slim.length).toBeLessThan(full.length * 0.4);
    const back = JSON.parse(slim);
    expect(back.trips.filter((t: { points?: unknown }) => 'points' in t)).toHaveLength(1);
    expect(back.trips[1].points).toEqual(S.trips[1].points);
  });
  it('al leerlo (migrate + normalize) los datos quedan idénticos a los originales', () => {
    S.trips[0].computerKmpl = 14.2;
    S.trips[0].computerUnit = 'kmpl';
    S.trips[2].pointsSource = 'imported';
    const original = clone(S);
    const loaded = normalize(migrate(JSON.parse(stringifyData(S))));
    expect(loaded).toEqual(original);
  });
  it('el respaldo manual conserva todos los points', () => {
    const payload = JSON.parse(JSON.stringify(backupPayload()));
    expect(payload.data.trips.every((t: { points: unknown[] }) => t.points.length >= 20)).toBe(
      true,
    );
  });
  it('el archivo de datos sin rutas se lee igual que el completo', () => {
    const slim = JSON.parse(stringifyData(backupPayload(), { indent: 2 }));
    const r = parseBackup(slim);
    expect(r.error).toBeUndefined();
    expect(r.data).toEqual(backupPayload().data);
  });
});

describe('rutas por calles reales en el respaldo y en adoptData', () => {
  const line = {
    type: 'LineString' as const,
    coordinates: [
      [10.000001, 10.000002],
      [10.01, 10.02],
      [10.050001, 10.040002],
    ] as [number, number][],
  };
  beforeEach(() => {
    resetState();
    S.trips[0].waypoints = [{ lat: 19.36, lng: -99.12 }];
    S.trips[0].route = routeFor(S.trips[0], S.places, line.coordinates);
    S.trips[1].route = {
      status: 'pending',
      sig: routeSig(routeStops(S.trips[1], S.places)!),
      distance: null,
      duration: null,
      n: 0,
    };
    for (const t of [S.trips[0], S.trips[1]]) t.points = tripPoints(t, S.places);
  });

  it('el respaldo manual (puntos + polyline) vuelve idéntico con ruta y puntos intermedios', () => {
    const text = stringifyData(backupPayload(), { points: 'all', routes: 'poly', indent: 2 });
    const r = parseBackup(JSON.parse(text));
    expect(r.error).toBeUndefined();
    expect(r.data).toEqual(backupPayload().data);
    expect(r.data!.trips[0].route!.geometry).toEqual(line);
    expect(r.data!.trips[1].route!.status).toBe('pending');
  });
  it('importar un respaldo con rutas las incorpora sin consultar a nadie', () => {
    const r = parseBackup(
      JSON.parse(stringifyData(backupPayload(), { points: 'all', routes: 'poly' })),
    );
    S.trips.length = 0;
    adoptData(r.data!);
    expect(S.trips[0].route!.geometry).toEqual(line);
  });
  it('un respaldo o archivo no cambia la preferencia routing de este equipo', () => {
    S.settings.routing = false;
    adoptData({ vehicles: [], places: [], trips: [], fuel: [], settings: { routing: true } });
    expect(S.settings.routing).toBe(false);
    S.settings.routing = true;
    adoptData({ vehicles: [], places: [], trips: [], fuel: [], settings: { routing: false } });
    expect(S.settings.routing).toBe(true);
  });
  it('lo guardado en la caché pasa por migrate + normalize sin geometría y sin perder los datos ligeros', () => {
    const loaded = normalize(migrate(JSON.parse(stringifyData(S))));
    expect(loaded.trips[0].route).toEqual({
      status: 'ok',
      sig: S.trips[0].route!.sig,
      distance: 5234.5,
      duration: 612.3,
      n: 3,
    });
    expect(loaded.trips[0].waypoints).toEqual(S.trips[0].waypoints);
    expect(loaded.trips[1].route).toEqual(S.trips[1].route);
  });
});
