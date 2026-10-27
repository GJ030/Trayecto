import { describe, expect, it } from 'vitest';
import { resolvePoints, tripPoints } from './routes';
import type { RoutePoint } from './schema';
import { makePlaces, trip } from '@/testing/fixtures';

const places = makePlaces();
const iso = (y: number, m: number, d: number, h: number, mi: number) =>
  new Date(y, m - 1, d, h, mi, 0, 0).toISOString().replace('.000Z', 'Z');
const meanSpeed = (pts: RoutePoint[]) => pts.reduce((s, p) => s + p.speed, 0) / pts.length;

describe('tripPoints', () => {
  it('es determinista: mismo viaje y lugares dan exactamente la misma ruta', () => {
    const a = tripPoints(trip(), places);
    const b = tripPoints(trip(), makePlaces());
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  it('la semilla es el id del viaje: otro id da otra ruta', () => {
    expect(tripPoints(trip({ id: 't1' }), places)).not.toEqual(
      tripPoints(trip({ id: 't2' }), places),
    );
  });
  it('no depende de Math.random ni del reloj', () => {
    const real = Math.random;
    Math.random = () => 0.123;
    try {
      const a = tripPoints(trip(), places);
      Math.random = () => 0.987;
      expect(tripPoints(trip(), places)).toEqual(a);
    } finally {
      Math.random = real;
    }
  });
  it('devuelve entre 20 y 60 puntos, del origen al destino', () => {
    for (const km of [0.5, 3, 12, 80, 400]) {
      const pts = tripPoints(trip({ odoEnd: 1000 + km }), places);
      expect(pts.length).toBeGreaterThanOrEqual(20);
      expect(pts.length).toBeLessThanOrEqual(60);
    }
    const pts = tripPoints(trip(), places);
    expect(pts[0]).toMatchObject({ lat: 10, lng: 10 });
    expect(pts[pts.length - 1]).toMatchObject({ lat: 10.04, lng: 10.05 });
  });
  it('cada punto tiene lat/lng válidos, hora ISO y velocidad no negativa', () => {
    for (const p of tripPoints(trip(), places)) {
      expect(Math.abs(p.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(p.lng)).toBeLessThanOrEqual(180);
      expect(p.t).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
      expect(p.speed).toBeGreaterThanOrEqual(0);
    }
  });
  it('las horas van de la salida a la llegada y no retroceden', () => {
    const pts = tripPoints(trip(), places);
    expect(pts[0].t).toBe(iso(2024, 6, 15, 8, 0));
    expect(pts[pts.length - 1].t).toBe(iso(2024, 6, 15, 8, 30));
    const ms = pts.map((p) => Date.parse(p.t));
    expect([...ms].sort((a, b) => a - b)).toEqual(ms);
  });
  it('el promedio de velocidad coincide con la velocidad del viaje (km ÷ horas)', () => {
    const pts = tripPoints(trip({ odoEnd: 1012 }), places);
    expect(meanSpeed(pts)).toBeCloseTo(12 / 0.5, 1);
    const largo = tripPoints(
      trip({ id: 't9', depart: '10:00', arrive: '11:15', odoEnd: 1048 }),
      places,
    );
    expect(meanSpeed(largo)).toBeCloseTo(48 / 1.25, 1);
  });
  it('un viaje que cruza la medianoche termina al día siguiente', () => {
    const pts = tripPoints(trip({ depart: '23:40', arrive: '00:10', odoEnd: 1010 }), places);
    expect(pts[0].t).toBe(iso(2024, 6, 15, 23, 40));
    expect(pts[pts.length - 1].t).toBe(iso(2024, 6, 16, 0, 10));
    expect(meanSpeed(pts)).toBeCloseTo(10 / 0.5, 1);
  });
  it('lugares casi iguales: da un recorrido corto alrededor de la manzana', () => {
    const near = [
      { ...places[0], id: 'x', name: 'Cerca A' },
      { ...places[0], id: 'y', name: 'Cerca B', lng: 10.0005 },
    ];
    const pts = tripPoints(trip({ origin: 'Cerca A', destination: 'Cerca B', odoEnd: 1001 }), near);
    expect(pts.length).toBeGreaterThanOrEqual(20);
  });
  it('encuentra los lugares sin importar mayúsculas ni acentos', () => {
    const a = tripPoints(trip({ origin: 'ALFA', destination: 'beta' }), places);
    expect(a).toEqual(tripPoints(trip(), places));
  });
  it('sin coordenadas en algún extremo, o con un lugar inexistente, devuelve []', () => {
    expect(tripPoints(trip({ destination: 'Gama' }), places)).toEqual([]);
    expect(tripPoints(trip({ origin: 'Gama' }), places)).toEqual([]);
    expect(tripPoints(trip({ origin: 'Nadie' }), places)).toEqual([]);
    expect(tripPoints(trip(), [])).toEqual([]);
  });
});

describe('resolvePoints', () => {
  const t = trip();
  const generated = () => tripPoints(t, places);
  const pt = (lat: number, min: number, speed = 10): RoutePoint => ({
    lat,
    lng: 10,
    t: iso(2024, 6, 15, 8, min),
    speed,
  });

  it('sin puntos guardados genera los de la app', () => {
    for (const raw of [undefined, null, [], 'x', [pt(10, 0)]]) {
      const r = resolvePoints(t, raw, undefined, places);
      expect(r.pointsSource).toBe('auto');
      expect(r.points).toEqual(generated());
    }
  });
  it('sin coordenadas en el viaje y sin puntos devuelve [] (auto)', () => {
    expect(resolvePoints(trip({ origin: 'Gama' }), undefined, undefined, places)).toEqual({
      points: [],
      pointsSource: 'auto',
    });
  });
  it('conserva los puntos válidos ordenados por hora y descarta los demás', () => {
    const raw = [
      pt(10.3, 30),
      pt(10.1, 10),
      { ...pt(10.2, 20), lat: 'x' },
      { ...pt(10.2, 20), speed: -3 },
      { ...pt(10.2, 20), t: 'ayer' },
      null,
      pt(10, 0),
    ];
    const r = resolvePoints(t, raw, 'imported', places);
    expect(r.points.map((p) => p.lat)).toEqual([10, 10.1, 10.3]);
    expect(r.pointsSource).toBe('imported');
  });
  it('respeta pointsSource cuando es válido', () => {
    const raw = [pt(10, 0), pt(10.1, 10)];
    expect(resolvePoints(t, raw, 'auto', places).pointsSource).toBe('auto');
    expect(resolvePoints(t, raw, 'imported', places).pointsSource).toBe('imported');
  });
  it('sin pointsSource: idéntica a la generada → auto; distinta → imported', () => {
    expect(resolvePoints(t, generated(), undefined, places).pointsSource).toBe('auto');
    expect(resolvePoints(t, generated(), 'raro', places).pointsSource).toBe('auto');
    expect(resolvePoints(t, [pt(10, 0), pt(10.1, 10)], undefined, places).pointsSource).toBe(
      'imported',
    );
  });
  it('solo conserva lat, lng, t y speed de cada punto', () => {
    const r = resolvePoints(t, [{ ...pt(10, 0), extra: 1 }, pt(10.1, 10)], 'imported', places);
    expect(Object.keys(r.points[0])).toEqual(['lat', 'lng', 't', 'speed']);
  });
});
