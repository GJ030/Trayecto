import { describe, expect, it } from 'vitest';
import {
  hasRealRoute,
  resolvePoints,
  routeKind,
  routeNote,
  routePlan,
  routeStops,
  syncRoute,
  tripPoints,
} from './routes';
import { routeSig } from './routing';
import type { RoutePoint } from './schema';
import { hashStr } from '@/shared/utils/math';
import { makePlaces, routeFor, trip, windingLine } from '@/testing/fixtures';

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

describe('tripPoints: huella del algoritmo', () => {
  /* Las rutas generadas ya no se guardan, se regeneran al abrir: si el algoritmo cambia, los viajes
     existentes se verían distintos. Si esta prueba falla, decide a propósito si el cambio vale la pena
     (y actualiza la huella). La hora se compara relativa a la salida para no depender de la zona horaria. */
  const fingerprint = (pts: RoutePoint[]) =>
    hashStr(
      pts
        .map((p) => [p.lat, p.lng, Date.parse(p.t) - Date.parse(pts[0].t), p.speed].join(','))
        .join(';'),
    );
  it.each([
    ['viaje normal (recta)', trip(), 907871386],
    [
      'cruza la medianoche',
      trip({ id: 't7', depart: '23:40', arrive: '00:25', odoEnd: 1018 }),
      2479934071,
    ],
    ['recorrido corto (recta)', trip({ id: 't9', odoEnd: 1003 }), 4003168441],
  ])('%s', (_n, t, expected) => {
    expect(fingerprint(tripPoints(t, places))).toBe(expected);
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

/* ---------------- Ruta por calles reales ---------------- */
const KX = 111.32 * Math.cos((10 * Math.PI) / 180),
  KY = 111.2;
const xy = (lat: number, lng: number) => [lng * KX, lat * KY] as const;
/** Distancia (km) de un punto a una polilínea [lng, lat]. */
function distToLine(p: { lat: number; lng: number }, line: [number, number][]) {
  const [px, py] = xy(p.lat, p.lng);
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = xy(line[i - 1][1], line[i - 1][0]),
      [bx, by] = xy(line[i][1], line[i][0]);
    const dx = bx - ax,
      dy = by - ay,
      l2 = dx * dx + dy * dy,
      f = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
    best = Math.min(best, Math.hypot(px - (ax + dx * f), py - (ay + dy * f)));
  }
  return best;
}
const gaps = (pts: RoutePoint[]) =>
  pts
    .slice(1)
    .map((p, i) => Math.hypot(...(xy(p.lat - pts[i].lat, p.lng - pts[i].lng) as [number, number])));

describe('tripPoints con geometría calculada', () => {
  const base = trip();
  const withRoute = (over: Partial<ReturnType<typeof trip>> = {}, geo?: [number, number][]) => {
    const t = trip(over);
    return { ...t, route: routeFor(t, places, geo) };
  };

  it('sigue la geometría: empieza y termina donde ella y todos los puntos caen sobre ella', () => {
    const t = withRoute();
    const line = t.route.geometry!.coordinates;
    const pts = tripPoints(t, places);
    expect(pts[0]).toMatchObject({ lat: line[0][1], lng: line[0][0] });
    expect(pts[pts.length - 1]).toMatchObject({
      lat: line[line.length - 1][1],
      lng: line[line.length - 1][0],
    });
    for (const p of pts) expect(distToLine(p, line)).toBeLessThan(0.001); // < 1 m
  });
  it('remuestrea a pasos uniformes aunque los vértices de la geometría estén muy desiguales', () => {
    const pts = tripPoints(withRoute(), places);
    const g = gaps(pts),
      mean = g.reduce((a, b) => a + b, 0) / g.length;
    expect(pts.length).toBeGreaterThanOrEqual(60);
    for (const x of g) expect(Math.abs(x - mean)).toBeLessThan(mean * 0.35); // la polilínea curva acorta algo los pasos rectos
  });
  it('~25 m entre puntos y hasta 1 200 puntos', () => {
    const a = { lat: 10, lng: 10 },
      far = { lat: 13.5, lng: 10 };
    const largo = routeFor(base, places, windingLine(a, far, 400));
    const pts = tripPoints({ ...base, route: largo }, places);
    expect(pts).toHaveLength(1200);
    const medioLine = windingLine(a, { lat: 10.1, lng: 10 }, 80);
    const km = medioLine
      .slice(1)
      .reduce(
        (sum, c, i) =>
          sum + Math.hypot((c[0] - medioLine[i][0]) * KX, (c[1] - medioLine[i][1]) * KY),
        0,
      );
    const medio = routeFor(base, places, medioLine);
    expect(tripPoints({ ...base, route: medio }, places)).toHaveLength(Math.round(km * 40));
  });
  it('el tiempo se reparte por distancia: sin saltos y el promedio de velocidad es el del viaje', () => {
    const pts = tripPoints(withRoute(), places);
    expect(pts[0].t).toBe(iso(2024, 6, 15, 8, 0));
    expect(pts[pts.length - 1].t).toBe(iso(2024, 6, 15, 8, 30));
    const ms = pts.map((p) => Date.parse(p.t));
    expect([...ms].sort((a, b) => a - b)).toEqual(ms);
    expect(meanSpeed(pts)).toBeCloseTo(12 / 0.5, 1);
    expect(Math.max(...pts.map((p) => p.speed))).toBeLessThan(120);
  });
  it('cruza la medianoche', () => {
    const pts = tripPoints(withRoute({ depart: '23:40', arrive: '00:25', odoEnd: 1018 }), places);
    expect(pts[0].t).toBe(iso(2024, 6, 15, 23, 40));
    expect(pts[pts.length - 1].t).toBe(iso(2024, 6, 16, 0, 25));
    expect(meanSpeed(pts)).toBeCloseTo(18 / 0.75, 1);
  });
  it('es determinista y no depende de Math.random', () => {
    const t = withRoute();
    const a = tripPoints(t, places);
    const real = Math.random;
    Math.random = () => 0.42;
    try {
      expect(tripPoints(t, places)).toEqual(a);
    } finally {
      Math.random = real;
    }
    expect(tripPoints({ ...t, id: 'otro' }, places)).not.toEqual(a);
  });
  it('depende solo de la geometría guardada: otra geometría, otros puntos', () => {
    const a = tripPoints(withRoute(), places);
    const b = tripPoints(
      withRoute({}, windingLine({ lat: 10, lng: 10 }, { lat: 10.04, lng: 10.05 }, 25)),
      places,
    );
    expect(a).not.toEqual(b);
  });
  it('con la geometría aún sin cargar del archivo no hay trazo', () => {
    const t = withRoute();
    const cargando = { ...t, route: { ...t.route, geometry: undefined } };
    expect(tripPoints(cargando, places)).toEqual([]);
  });
  it('pendiente o sin ruta: la recta entre origen y destino', () => {
    const recta = (pts: RoutePoint[]) => {
      const line: [number, number][] = [
        [10, 10],
        [10.05, 10.04],
      ];
      for (const p of pts) expect(distToLine(p, line)).toBeLessThan(0.001);
      expect(pts[0]).toMatchObject({ lat: 10, lng: 10 });
      expect(pts[pts.length - 1]).toMatchObject({ lat: 10.04, lng: 10.05 });
    };
    recta(tripPoints(trip(), places));
    recta(
      tripPoints(
        { ...trip(), route: { status: 'pending', sig: 'x', distance: null, duration: null, n: 0 } },
        places,
      ),
    );
    const pts = tripPoints(trip(), places);
    expect(pts.length).toBeGreaterThanOrEqual(20);
    expect(pts.length).toBeLessThanOrEqual(60);
  });
  it('la recta pasa por los puntos intermedios', () => {
    const w = { lat: 10.03, lng: 10.0 };
    const pts = tripPoints({ ...trip(), waypoints: [w] }, places);
    const line: [number, number][] = [
      [10, 10],
      [w.lng, w.lat],
      [10.05, 10.04],
    ];
    for (const p of pts) expect(distToLine(p, line)).toBeLessThan(0.001);
    const cerca = Math.min(
      ...pts.map((p) => Math.hypot(...(xy(p.lat - w.lat, p.lng - w.lng) as [number, number]))),
    );
    expect(cerca).toBeLessThan(1);
  });
  it('sin ubicación en algún extremo no hay trazo, con o sin ruta', () => {
    expect(tripPoints(trip({ destination: 'Gama' }), places)).toEqual([]);
    const t = withRoute();
    expect(tripPoints({ ...t, destination: 'Gama' }, places)).toEqual([]);
  });
});

describe('routeStops, routeKind y hasRealRoute', () => {
  it('routeStops: origen, intermedios válidos y destino; null si falta una ubicación', () => {
    expect(routeStops(trip(), places)).toEqual([
      { lat: 10, lng: 10 },
      { lat: 10.04, lng: 10.05 },
    ]);
    expect(
      routeStops(
        {
          ...trip(),
          waypoints: [
            { lat: 10.02, lng: 10.01 },
            { lat: 99, lng: 0 },
          ],
        },
        places,
      ),
    ).toHaveLength(3);
    expect(routeStops(trip({ origin: 'Gama' }), places)).toBeNull();
    expect(routeStops(trip({ origin: 'Nadie' }), places)).toBeNull();
    expect(routeStops(trip({ origin: ' ALFA ' }), places)).not.toBeNull();
  });
  it('routeKind distingue geometría, importada, cargando y recta', () => {
    const t = trip();
    const ok = routeFor(t, places);
    expect(routeKind({ pointsSource: 'auto', route: ok })).toBe('geometry');
    expect(routeKind({ pointsSource: 'auto', route: { ...ok, geometry: undefined } })).toBe(
      'loading',
    );
    expect(routeKind({ pointsSource: 'auto', route: { ...ok, status: 'pending' } })).toBe(
      'straight',
    );
    expect(routeKind({ pointsSource: 'auto' })).toBe('straight');
    expect(routeKind({ pointsSource: 'imported' })).toBe('imported');
  });
  it('solo la geometría calculada o importada cuenta como real (calor y trayectos frecuentes)', () => {
    const ok = routeFor(trip(), places);
    expect(hasRealRoute({ pointsSource: 'auto', route: ok })).toBe(true);
    expect(hasRealRoute({ pointsSource: 'imported' })).toBe(true);
    expect(hasRealRoute({ pointsSource: 'auto' })).toBe(false);
    expect(hasRealRoute({ pointsSource: 'auto', route: { ...ok, status: 'pending' } })).toBe(false);
    expect(hasRealRoute({ pointsSource: 'auto', route: { ...ok, geometry: undefined } })).toBe(
      false,
    );
  });
});

describe('routePlan: qué se dibuja', () => {
  const geo = (over = {}) => {
    const t = trip(over);
    t.route = routeFor(t, places);
    t.points = tripPoints(t, places);
    return t;
  };
  it('con geometría calculada: línea sólida, con los marcadores en los extremos de los points', () => {
    const t = geo();
    const p = routePlan(t, places)!;
    expect(p).toMatchObject({ kind: 'geometry', line: 'solid' });
    expect(p.ends[0]).toEqual({ lat: t.points[0].lat, lng: t.points[0].lng });
    expect(p.ends[1]).toEqual({
      lat: t.points[t.points.length - 1].lat,
      lng: t.points[t.points.length - 1].lng,
    });
  });
  it('sin ruta calculada o pendiente: recta punteada', () => {
    const t = trip();
    t.points = tripPoints(t, places);
    expect(routePlan(t, places)).toMatchObject({ kind: 'straight', line: 'dashed' });
    t.route = { ...routeFor(t, places), status: 'pending', geometry: undefined };
    expect(routePlan(t, places)).toMatchObject({ kind: 'straight', line: 'dashed' });
    t.route.error = 'noroute';
    expect(routePlan(t, places)).toMatchObject({ kind: 'straight', line: 'dashed' });
  });
  it('calculada pero sin la geometría cargada: solo marcadores (no hay points) en origen y destino', () => {
    const t = geo();
    t.route = { ...t.route!, geometry: undefined };
    t.points = tripPoints(t, places);
    expect(t.points).toEqual([]);
    expect(routePlan(t, places)).toEqual({
      kind: 'loading',
      line: 'none',
      ends: [
        { lat: 10, lng: 10 },
        { lat: 10.04, lng: 10.05 },
      ],
    });
  });
  it('ruta importada: sólida con sus propios points', () => {
    const t = trip({ pointsSource: 'imported' });
    t.points = tripPoints(trip(), places);
    expect(routePlan(t, places)).toMatchObject({ kind: 'imported', line: 'solid' });
  });
  it('sin ubicación en algún extremo (o sin points) no hay nada que dibujar', () => {
    expect(routePlan(trip({ origin: 'Gama' }), places)).toBeNull();
    expect(routePlan(trip(), places)).toBeNull();
    const t = geo();
    expect(
      routePlan({ ...t, origin: 'Gama', route: { ...t.route!, geometry: undefined } }, places),
    ).toBeNull();
  });
});

describe('routeNote: aviso del detalle del viaje', () => {
  const on = { routingOn: true, folderOff: false };
  const off = { routingOn: false, folderOff: false };
  const base = () => {
    const t = trip();
    return { t, ok: routeFor(t, places) };
  };
  it('calculada con geometría: nada que avisar', () => {
    const { t, ok } = base();
    expect(routeNote({ ...t, route: ok }, places, on)).toBe('none');
  });
  it('pendiente con el interruptor encendido; con él apagado, la invitación a activarlo', () => {
    const { t, ok } = base();
    const pend = { ...t, route: { ...ok, status: 'pending' as const, geometry: undefined } };
    expect(routeNote(pend, places, on)).toBe('pending');
    expect(routeNote(pend, places, off)).toBe('routingOff');
    expect(routeNote(t, places, off)).toBe('routingOff');
    expect(routeNote(t, places, on)).toBe('pending');
  });
  it('un error definitivo se avisa aunque el interruptor esté apagado', () => {
    const { t, ok } = base();
    const e = (error: 'noroute' | 'invalid') => ({
      ...t,
      route: { ...ok, status: 'pending' as const, geometry: undefined, error },
    });
    expect(routeNote(e('noroute'), places, on)).toBe('noroute');
    expect(routeNote(e('invalid'), places, off)).toBe('invalid');
  });
  it('geometría sin cargar: pide reconectar solo si el permiso de la carpeta espera confirmación', () => {
    const { t, ok } = base();
    const loading = { ...t, route: { ...ok, geometry: undefined } };
    expect(routeNote(loading, places, { routingOn: true, folderOff: true })).toBe('reconnect');
    expect(routeNote(loading, places, on)).toBe('none');
  });
  it('rutas importadas o viajes sin ubicación: nada que avisar', () => {
    expect(routeNote(trip({ pointsSource: 'imported' }), places, on)).toBe('none');
    expect(routeNote(trip({ origin: 'Gama' }), places, on)).toBe('none');
  });
});

describe('syncRoute: vigencia de la ruta calculada', () => {
  const holder = (over = {}) => ({ ...trip(), ...over });
  it('con el ruteo activado, un viaje sin ruta queda «pendiente» con la huella de sus puntos', () => {
    const t = holder();
    expect(syncRoute(t, places, true)).toBe(true);
    expect(t.route).toEqual({
      status: 'pending',
      sig: routeSig(routeStops(t, places)!),
      distance: null,
      duration: null,
      n: 0,
    });
  });
  it('con el ruteo apagado no crea nada; con create=false tampoco', () => {
    const t = holder();
    expect(syncRoute(t, places, false)).toBe(false);
    expect('route' in t).toBe(false);
    expect(syncRoute(t, places, true, false)).toBe(false);
    expect('route' in t).toBe(false);
  });
  it('una ruta vigente (misma huella) no se toca', () => {
    const t = holder();
    t.route = routeFor(t, places);
    const antes = t.route;
    expect(syncRoute(t, places, true)).toBe(false);
    expect(t.route).toBe(antes);
  });
  it('si cambia un extremo, la geometría ya no vale: «pendiente» con el ruteo activado, descartada si no', () => {
    const t = holder();
    t.route = routeFor(t, places);
    const movidos = places.map((p) => (p.name === 'Beta' ? { ...p, lat: 10.2 } : p));
    const a = structuredClone(t) as typeof t;
    expect(syncRoute(a, movidos, true)).toBe(true);
    expect(a.route).toMatchObject({ status: 'pending', n: 0 });
    expect(a.route!.geometry).toBeUndefined();
    expect(a.route!.sig).toBe(routeSig(routeStops(a, movidos)!));
    const b = structuredClone(t) as typeof t;
    expect(syncRoute(b, movidos, false)).toBe(true);
    expect('route' in b).toBe(false);
  });
  it('si cambian los puntos intermedios, también', () => {
    const t = holder();
    t.route = routeFor(t, places);
    t.waypoints = [{ lat: 10.02, lng: 10.01 }];
    expect(syncRoute(t, places, true)).toBe(true);
    expect(t.route!.status).toBe('pending');
  });
  it('sin ubicación en algún extremo se descarta la ruta; las importadas no se tocan', () => {
    const t = holder();
    t.route = routeFor(t, places);
    expect(syncRoute({ ...t, destination: 'Gama' }, places, true)).toBe(true);
    const u = holder({ destination: 'Gama' });
    u.route = t.route;
    expect(syncRoute(u, places, true)).toBe(true);
    expect('route' in u).toBe(false);
    const imp = holder({ pointsSource: 'imported' as const });
    imp.route = t.route;
    expect(syncRoute(imp, places, true)).toBe(false);
    expect(imp.route).toBe(t.route);
  });
});
