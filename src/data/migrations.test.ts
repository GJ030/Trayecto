import { describe, expect, it } from 'vitest';
import { migrate } from './migrations';
import { tripPoints } from './routes';
import { DATA_VERSION, SEED_GEO, type Raw } from './schema';
import { place, routeFor, trip } from '@/testing/fixtures';

/** Datos como los guardaba la v1: lugares con x/y en el mapa esquemático, sin lat/lng ni points. */
const v1 = (): Raw => {
  const { points, pointsSource, computerKmpl, computerUnit, ...t } = trip({
    origin: 'Casa',
    destination: 'Oficina',
  });
  void [points, pointsSource, computerKmpl, computerUnit];
  return {
    version: 1,
    vehicles: [{ id: 'v1', name: 'Auto' }],
    places: [
      { id: 'p1', name: 'Casa', area: 'Zona', x: SEED_GEO['casa'].x, y: SEED_GEO['casa'].y },
      { id: 'p2', name: 'Oficina', area: '', x: SEED_GEO['oficina'].x, y: SEED_GEO['oficina'].y },
      { id: 'p3', name: 'Taller', area: '', x: 321, y: 123 },
    ],
    trips: [t, { ...t, id: 't2', origin: 'Taller' }],
    fuel: [],
    settings: {},
  };
};

describe('migrate v1 → v2', () => {
  it('sube la versión y no pierde registros', () => {
    const d = migrate(v1());
    expect(d.version).toBe(DATA_VERSION);
    expect(d.places).toHaveLength(3);
    expect(d.trips).toHaveLength(2);
    expect(d.vehicles).toEqual(v1().vehicles);
  });
  it('trata los datos sin versión como v1', () => {
    const o = v1();
    delete o.version;
    expect(migrate(o).version).toBe(DATA_VERSION);
  });
  it('los lugares de ejemplo en su posición original reciben lat/lng y pierden x/y', () => {
    const [casa, oficina] = migrate(v1()).places;
    expect(casa).toMatchObject({ lat: SEED_GEO['casa'].lat, lng: SEED_GEO['casa'].lng });
    expect(oficina).toMatchObject({ lat: SEED_GEO['oficina'].lat });
    expect('x' in casa).toBe(false);
  });
  it('un lugar propio conserva su x/y y queda sin ubicación', () => {
    const taller = migrate(v1()).places[2];
    expect(taller).toMatchObject({ lat: null, lng: null, x: 321, y: 123 });
  });
  it('un lugar de ejemplo que el usuario movió no recibe lat/lng', () => {
    const o = v1();
    o.places[0].x += 50;
    expect(migrate(o).places[0].lat).toBeNull();
  });
  it('genera los points que faltan (auto) cuando ambos lugares tienen ubicación', () => {
    const d = migrate(v1());
    const t1 = d.trips[0];
    expect(t1.pointsSource).toBe('auto');
    expect(t1.points.length).toBeGreaterThanOrEqual(20);
    expect(t1.points).toEqual(tripPoints(t1, d.places));
  });
  it('un viaje con un lugar sin ubicación queda con points [] (auto)', () => {
    const t2 = migrate(v1()).trips[1];
    expect(t2).toMatchObject({ points: [], pointsSource: 'auto' });
  });
  it('conserva los points que ya tenía el viaje como imported', () => {
    const o = v1();
    o.trips[0].points = [
      { lat: 1, lng: 1, t: '2024-06-15T08:00:00Z', speed: 5 },
      { lat: 1.1, lng: 1.1, t: '2024-06-15T08:10:00Z', speed: 5 },
    ];
    const t = migrate(o).trips[0];
    expect(t.pointsSource).toBe('imported');
    expect(t.points).toHaveLength(2);
  });
  it('no modifica la entrada', () => {
    const o = v1();
    const copy = structuredClone(o);
    migrate(o);
    expect(o).toEqual(copy);
  });
  it('tolera datos incompletos', () => {
    expect(migrate(null)).toBeNull();
    const d = migrate({ version: 1 });
    expect(d).toMatchObject({ version: DATA_VERSION, places: [], trips: [] });
  });
});

describe('migrate sobre datos v2', () => {
  const v2 = (): Raw => {
    const places = [place('pa', 'Alfa', 10, 10), place('pb', 'Beta', 10.04, 10.05)];
    return { version: 2, places, trips: [trip({ pointsSource: 'auto' })] };
  };
  it('si todos los viajes tienen pointsSource devuelve los mismos datos (misma referencia)', () => {
    const o = v2();
    expect(migrate(o)).toBe(o);
  });
  it('completa pointsSource de los viajes que no lo tienen, sin tocar lugares', () => {
    const o = v2();
    o.trips.push({ ...trip({ id: 't2' }), pointsSource: undefined });
    const d = migrate(o);
    expect(d).not.toBe(o);
    expect(d.places).toBe(o.places);
    expect(d.trips[0]).toBe(o.trips[0]);
    expect(d.trips[1].pointsSource).toBe('auto');
    expect(d.trips[1].points.length).toBeGreaterThanOrEqual(20);
  });
});

describe('migrate: rutas generadas que no se guardaron', () => {
  const places = () => [place('pa', 'Alfa', 10, 10), place('pb', 'Beta', 10.04, 10.05)];
  const stored = (t: Raw): Raw => ({ version: 2, places: places(), trips: [t] });

  it("regenera los points de un viaje 'auto' sin points, idénticos a los originales", () => {
    const full = trip({ pointsSource: 'auto' });
    full.points = tripPoints(full, places());
    const { points, ...slim } = full;
    void points;
    const d = migrate(stored(slim));
    expect(d.trips[0].points).toEqual(full.points);
    expect(d.trips[0].pointsSource).toBe('auto');
  });
  it('un viaje sin lugares ubicados queda con points []', () => {
    const { points, ...slim } = trip({ origin: 'Nadie', pointsSource: 'auto' });
    void points;
    expect(migrate(stored(slim)).trips[0].points).toEqual([]);
  });
  it("no toca los viajes 'imported' ni los 'auto' que ya traen points", () => {
    const pts = [
      { lat: 1, lng: 1, t: '2024-06-15T08:00:00Z', speed: 5 },
      { lat: 1.1, lng: 1.1, t: '2024-06-15T08:10:00Z', speed: 5 },
    ];
    const d = stored(trip({ pointsSource: 'imported', points: pts }));
    expect(migrate(d)).toBe(d);
    const e = stored(trip({ pointsSource: 'auto', points: [] }));
    expect(migrate(e)).toBe(e);
  });
});

describe('migrate: vigencia de la ruta calculada guardada en la caché', () => {
  const places = () => [place('pa', 'Alfa', 10, 10), place('pb', 'Beta', 10.04, 10.05)];
  const cache = (route: unknown): Raw => {
    const { points, ...t } = trip({ route: route as never });
    void points;
    return { version: 2, places: places(), trips: [t] };
  };
  const light = (r: ReturnType<typeof routeFor>) => ({ ...r, geometry: undefined });

  it('una ruta «ok» vigente sin geometría se conserva y el viaje queda sin trazo hasta que llegue la geometría', () => {
    const r = light(routeFor(trip(), places()));
    const t = migrate(cache(r)).trips[0];
    expect(t.route).toEqual(r);
    expect(t.points).toEqual([]);
    expect(t.pointsSource).toBe('auto');
  });
  it('una ruta con huella vieja se descarta y el viaje se dibuja como recta', () => {
    const r = light(routeFor(trip(), places(), [], { sig: 'vieja' }));
    const t = migrate(cache(r)).trips[0];
    expect('route' in t).toBe(false);
    expect(t.points.length).toBeGreaterThanOrEqual(20);
    expect(t.points.length).toBeLessThanOrEqual(60);
  });
  it('una ruta «pendiente» vigente se conserva y se dibuja como recta', () => {
    const r = {
      ...light(routeFor(trip(), places())),
      status: 'pending',
      distance: null,
      duration: null,
      n: 0,
    };
    const t = migrate(cache(r)).trips[0];
    expect(t.route).toEqual(r);
    expect(t.points.length).toBeGreaterThanOrEqual(20);
  });
  it('si se movió un lugar mientras tanto, la ruta ya no vale', () => {
    const r = light(routeFor(trip(), places()));
    const d = cache(r);
    d.places[1].lat = 10.2;
    expect('route' in migrate(d).trips[0]).toBe(false);
  });
});
