import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { routeStops } from '@/data/routes';
import { ROUTING, routeSig } from '@/data/routing';
import {
  distinctRequests,
  onRoutingFinish,
  pendingRoutes,
  resetRoutingQueue,
  routeCounts,
  routingQueue,
  routingStatus,
  setRoutingFetch,
  setRoutingGuard,
  startRoutingQueue,
} from '@/data/routingQueue';
import { S, emitChange } from '@/data/store';
import { tripsRepo } from './trips.repo';
import { clone, place, setState, trip, vehicle } from '@/testing/fixtures';

const SEC = 1000;
/* Un lugar por viaje, con coordenadas distintas: la petición dice de qué viaje es */
const placesFor = () => [
  place('p0', 'Base', 10, 10),
  place('p1', 'Uno', 10.01, 10.01),
  place('p2', 'Dos', 10.02, 10.02),
  place('p3', 'Tres', 10.03, 10.03),
  place('p4', 'Cuatro', 10.04, 10.04),
  place('p5', 'Sin ubicar', null, null),
];
const pend = (t: ReturnType<typeof trip>, places = placesFor()) => ({
  ...t,
  route: {
    status: 'pending' as const,
    sig: routeSig(routeStops(t, places)!),
    distance: null,
    duration: null,
    n: 0,
  },
});
const mk = (id: string, to: string, date: string) =>
  pend(trip({ id, destination: to, origin: 'Base', date }));
const okReply = (url: string) => {
  const coords = url
    .split('/driving/')[1]
    .split('?')[0]
    .split(';')
    .map((c) => c.split(',').map(Number));
  const mid = [
    (coords[0][0] + coords[coords.length - 1][0]) / 2 + 0.001,
    (coords[0][1] + coords[coords.length - 1][1]) / 2,
  ];
  return {
    code: 'Ok',
    routes: [
      {
        distance: 1234.5,
        duration: 99.5,
        geometry: { type: 'LineString', coordinates: [coords[0], mid, coords[coords.length - 1]] },
      },
    ],
  };
};
interface Call {
  at: number;
  to: string;
}
/** fetch simulado: responde `script(n)` (n = número de petición, desde 0) o un OK por omisión. */
function fakeFetch(script?: (n: number, url: string) => Response | Promise<Response> | 'ok') {
  const calls: Call[] = [];
  const f = vi.fn(async (url: string) => {
    const n = calls.length;
    const lastStop = url.split('?')[0].split(';').pop()!;
    calls.push({ at: Date.now(), to: lastStop });
    const r = script ? script(n, url) : 'ok';
    if (r === 'ok') return json(okReply(url));
    return r;
  });
  setRoutingFetch(f as unknown as typeof fetch);
  return { calls, f };
}
const json = (body: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;
const flush = (ms = 0) => vi.advanceTimersByTimeAsync(ms);

function setup(trips: ReturnType<typeof trip>[], routing = true) {
  setState({ vehicles: [vehicle('v1')], places: placesFor(), trips });
  S.settings.routing = routing;
}

beforeEach(() => {
  vi.useFakeTimers();
  resetRoutingQueue();
  setRoutingGuard(() => true);
});
afterEach(() => {
  resetRoutingQueue();
  setRoutingFetch(undefined);
  vi.useRealTimers();
});

describe('pendingRoutes y routeCounts', () => {
  it('del más reciente al más antiguo, solo pendientes sin error y con huella vigente', () => {
    setup([
      mk('a', 'Uno', '2024-06-01'),
      mk('b', 'Dos', '2024-06-03'),
      mk('c', 'Tres', '2024-06-02'),
    ]);
    S.trips.push({
      ...mk('d', 'Cuatro', '2024-06-10'),
      route: { ...mk('d', 'Cuatro', '2024-06-10').route, error: 'noroute' },
    });
    S.trips.push({
      ...mk('e', 'Uno', '2024-06-20'),
      route: { ...mk('e', 'Uno', '2024-06-20').route, sig: 'vieja' },
    });
    S.trips.push(trip({ id: 'f', destination: 'Sin ubicar', date: '2024-06-30' }));
    expect(pendingRoutes().map((t) => t.id)).toEqual(['b', 'c', 'a']);
  });
  it('cuenta calculadas, pendientes y con error (solo viajes de la app)', () => {
    setup([mk('a', 'Uno', '2024-06-01'), mk('b', 'Dos', '2024-06-02')]);
    S.trips[1].route = { ...S.trips[1].route!, error: 'invalid' };
    S.trips.push({
      ...mk('c', 'Tres', '2024-06-03'),
      route: { ...mk('c', 'Tres', '2024-06-03').route, status: 'ok' },
    });
    S.trips.push({ ...trip({ id: 'i', pointsSource: 'imported' }) });
    expect(routeCounts(S.trips)).toEqual({ ok: 1, pending: 1, error: 1 });
  });
});

describe('la cola: ritmo y orden', () => {
  it('pide una ruta por segundo, empezando por el viaje más reciente, y las guarda', async () => {
    setup([
      mk('a', 'Uno', '2024-06-01'),
      mk('b', 'Dos', '2024-06-03'),
      mk('c', 'Tres', '2024-06-02'),
    ]);
    const { calls } = fakeFetch();
    const fin: { done: number; failed: number }[] = [];
    onRoutingFinish((r) => fin.push(r));
    routingQueue.kick();
    await flush(5 * SEC);
    expect(calls.map((c) => c.to)).toEqual(['10.02,10.02', '10.03,10.03', '10.01,10.01']);
    for (let i = 1; i < calls.length; i++)
      expect(calls[i].at - calls[i - 1].at).toBeGreaterThanOrEqual(ROUTING.minIntervalMs);
    expect(S.trips.map((t) => t.route!.status)).toEqual(['ok', 'ok', 'ok']);
    expect(S.trips[1].route!.geometry!.coordinates).toHaveLength(3);
    expect(S.trips[1].route).toMatchObject({ distance: 1234.5, duration: 99.5, n: 3 });
    expect(S.trips[1].points.length).toBeGreaterThanOrEqual(60); // los puntos salen de la geometría
    expect(routingStatus().state).toBe('idle');
    expect(fin).toEqual([{ done: 3, failed: 0 }]);
  });
  it('la petición lleva origen y destino de ese viaje (lng,lat) y pide overview=full + geojson', async () => {
    setup([mk('a', 'Uno', '2024-06-01')]);
    const { f } = fakeFetch();
    routingQueue.kick();
    await flush(SEC);
    expect(f.mock.calls[0][0]).toBe(
      'https://router.project-osrm.org/route/v1/driving/10,10;10.01,10.01?overview=full&geometries=geojson&steps=false',
    );
  });
  it('no hace nada con el ruteo apagado ni cuando no hay pendientes', async () => {
    setup([mk('a', 'Uno', '2024-06-01')], false);
    const { calls } = fakeFetch();
    routingQueue.kick();
    await flush(5 * SEC);
    expect(calls).toHaveLength(0);
    expect(S.trips[0].route!.status).toBe('pending');
    S.settings.routing = true;
    S.trips[0].route = { ...S.trips[0].route!, status: 'ok' };
    routingQueue.kick();
    await flush(5 * SEC);
    expect(calls).toHaveLength(0);
  });
  it('un resultado de un viaje que se editó mientras tanto se descarta y se vuelve a pedir con la huella nueva', async () => {
    setup([mk('a', 'Uno', '2024-06-01')]);
    startRoutingQueue();
    let release!: (r: Response) => void;
    const { calls } = fakeFetch((n, url) =>
      n === 0 ? new Promise<Response>((res) => (release = res)) : json(okReply(url)),
    );
    S.settings.routing = true;
    routingQueue.kick();
    await flush(10);
    expect(calls).toHaveLength(1);
    // se edita el destino durante la petición: la ruta pendiente cambia de huella
    tripsRepo.update('a', {
      date: '2024-06-01',
      depart: '08:00',
      arrive: '08:30',
      origin: 'Base',
      destination: 'Dos',
      odoStart: 1000,
      odoEnd: 1012,
      vehicleId: 'v1',
      tag: 'Trabajo',
    });
    release(json(okReply('https://x/driving/10,10;10.01,10.01?')));
    await flush(3 * SEC);
    expect(calls.map((c) => c.to)).toEqual(['10.01,10.01', '10.02,10.02']);
    expect(S.trips[0].route!.status).toBe('ok');
    expect(S.trips[0].destination).toBe('Dos');
  });
});

describe('viajes con los mismos puntos', () => {
  it('comparten una sola consulta: los demás copian la geometría sin enviar nada', async () => {
    setup([
      mk('a', 'Uno', '2024-06-01'),
      mk('b', 'Uno', '2024-06-02'),
      mk('c', 'Dos', '2024-06-03'),
      mk('d', 'Uno', '2024-06-04'),
    ]);
    const { calls } = fakeFetch();
    expect(distinctRequests()).toBe(2);
    routingQueue.kick();
    await flush(5 * SEC);
    expect(calls.map((c) => c.to)).toEqual(['10.01,10.01', '10.02,10.02']); // dos consultas para cuatro viajes
    expect(S.trips.map((t) => t.route!.status)).toEqual(['ok', 'ok', 'ok', 'ok']);
    const g = (id: string) => S.trips.find((t) => t.id === id)!.route!;
    expect(g('a').geometry).toEqual(g('d').geometry);
    expect(g('b').distance).toBe(g('d').distance);
    expect(g('a').geometry).not.toEqual(g('c').geometry);
    for (const t of S.trips) expect(t.points.length).toBeGreaterThanOrEqual(60);
  });
  it('un viaje nuevo con los mismos puntos que uno ya calculado no envía nada', async () => {
    setup([mk('a', 'Uno', '2024-06-01')]);
    startRoutingQueue();
    const { calls } = fakeFetch();
    routingQueue.kick();
    await flush(2 * SEC);
    expect(calls).toHaveLength(1);
    const t = tripsRepo.create({
      date: '2024-07-01',
      depart: '08:00',
      arrive: '08:30',
      origin: 'Base',
      destination: 'Uno',
      odoStart: 1,
      odoEnd: 10,
      vehicleId: 'v1',
      tag: 'Trabajo',
    });
    await flush(5 * SEC);
    expect(calls).toHaveLength(1);
    expect(t.route!.status).toBe('ok');
  });
  it('«sin camino» vale para todos los viajes con los mismos puntos y se pide una sola vez', async () => {
    setup([
      mk('a', 'Uno', '2024-06-01'),
      mk('b', 'Uno', '2024-06-02'),
      mk('c', 'Dos', '2024-06-03'),
    ]);
    const { calls } = fakeFetch((_n, url) =>
      url.includes(';10.01,10.01') ? json({ code: 'NoRoute' }) : json(okReply(url)),
    );
    routingQueue.kick();
    await flush(6 * SEC);
    expect(calls).toHaveLength(2);
    expect(S.trips.map((t) => [t.route!.status, t.route!.error])).toEqual([
      ['pending', 'noroute'],
      ['pending', 'noroute'],
      ['ok', undefined],
    ]);
    expect(routingStatus().counts).toEqual({ ok: 1, pending: 0, error: 2 });
  });
  it('no cuenta consultas para los viajes con error ni para los que ya coinciden con una ruta calculada', () => {
    setup([
      mk('a', 'Uno', '2024-06-01'),
      mk('b', 'Dos', '2024-06-02'),
      trip({ id: 'c', origin: 'Base', destination: 'Tres' }),
    ]);
    S.trips[1].route = { ...S.trips[1].route!, error: 'noroute' };
    expect(distinctRequests()).toBe(2); // «Uno» y «Tres» (sin ruta aún); «Dos» tiene error
    S.trips[0].route = {
      ...S.trips[0].route!,
      status: 'ok',
      distance: 1,
      duration: 1,
      n: 2,
      geometry: {
        type: 'LineString',
        coordinates: [
          [10, 10],
          [10.01, 10.01],
        ],
      },
    };
    S.trips.push(trip({ id: 'd', origin: 'Base', destination: 'Uno' }));
    expect(distinctRequests()).toBe(1); // solo «Tres»: «Uno» ya está calculado
  });
});

describe('errores', () => {
  it('«sin camino» y respuesta inválida quedan como error definitivo: no se reintentan solos', async () => {
    setup([
      mk('a', 'Uno', '2024-06-01'),
      mk('b', 'Dos', '2024-06-02'),
      mk('c', 'Tres', '2024-06-03'),
    ]);
    const { calls } = fakeFetch((n, url) =>
      n === 0
        ? json({ code: 'NoRoute' })
        : n === 1
          ? json({ code: 'Ok', routes: [] })
          : json(okReply(url)),
    );
    routingQueue.kick();
    await flush(10 * SEC);
    expect(calls).toHaveLength(3);
    expect(S.trips.map((t) => [t.route!.status, t.route!.error])).toEqual([
      ['ok', undefined],
      ['pending', 'invalid'],
      ['pending', 'noroute'],
    ]);
    expect(routingStatus().counts).toEqual({ ok: 1, pending: 0, error: 2 });
    await flush(10 * 60 * SEC);
    routingQueue.kick();
    routingQueue.online();
    await flush(10 * SEC);
    expect(calls).toHaveLength(3);
  });
  it('el reintento manual de los errores los vuelve a pedir', async () => {
    setup([mk('a', 'Uno', '2024-06-01')]);
    const { calls } = fakeFetch((n, url) =>
      n === 0 ? json({ code: 'NoRoute' }) : json(okReply(url)),
    );
    routingQueue.kick();
    await flush(3 * SEC);
    expect(S.trips[0].route!.error).toBe('noroute');
    expect(tripsRepo.retryRouteErrors()).toBe(1);
    await flush(3 * SEC);
    expect(calls).toHaveLength(2);
    expect(S.trips[0].route).toMatchObject({ status: 'ok' });
    expect('error' in S.trips[0].route!).toBe(false);
  });
  it('sin conexión, 5xx y tiempo agotado: espera creciente (5 s, 10 s…) y reintenta hasta lograrlo', async () => {
    setup([mk('a', 'Uno', '2024-06-01')]);
    const { calls } = fakeFetch((n, url) => {
      if (n === 0) throw new TypeError('Failed to fetch');
      if (n === 1) return json({}, 503);
      if (n === 2) return json({}, 500);
      return json(okReply(url));
    });
    routingQueue.kick();
    await flush(60 * SEC);
    expect(calls).toHaveLength(4);
    expect(calls[1].at - calls[0].at).toBe(5 * SEC);
    expect(calls[2].at - calls[1].at).toBe(10 * SEC);
    expect(calls[3].at - calls[2].at).toBe(20 * SEC);
    expect(S.trips[0].route!.status).toBe('ok');
  });
  it('HTTP 429 espera más (30 s) antes de reintentar', async () => {
    setup([mk('a', 'Uno', '2024-06-01')]);
    const { calls } = fakeFetch((n, url) => (n === 0 ? json({}, 429) : json(okReply(url))));
    routingQueue.kick();
    await flush(60 * SEC);
    expect(calls[1].at - calls[0].at).toBe(30 * SEC);
    expect(S.trips[0].route!.status).toBe('ok');
  });
  it('la espera no pasa de 5 minutos y, tras 6 fallos seguidos, la cola se detiene hasta que vuelva la conexión', async () => {
    setup([mk('a', 'Uno', '2024-06-01')]);
    let down = true;
    const { calls } = fakeFetch((_n, url) => {
      if (down) throw new TypeError('Failed to fetch');
      return json(okReply(url));
    });
    routingQueue.kick();
    await flush(20 * 60 * SEC);
    expect(calls).toHaveLength(ROUTING.retry.maxStreak + 1);
    expect(routingStatus().state).toBe('stalled');
    expect(S.trips[0].route).toMatchObject({ status: 'pending' });
    expect('error' in S.trips[0].route!).toBe(false); // sigue siendo recuperable
    const gaps = calls.slice(1).map((c, i) => c.at - calls[i].at);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(ROUTING.retry.maxMs);
    expect(gaps[0]).toBe(5 * SEC);
    expect(gaps[1]).toBe(10 * SEC);
    // vuelve la conexión
    down = false;
    routingQueue.online();
    await flush(3 * SEC);
    expect(S.trips[0].route!.status).toBe('ok');
    expect(routingStatus().state).toBe('idle');
  });
  it('al volver la conexión solo toma los pendientes recuperables, no los que tienen error', async () => {
    setup([mk('a', 'Uno', '2024-06-01'), mk('b', 'Dos', '2024-06-02')]);
    S.trips[1].route = { ...S.trips[1].route!, error: 'noroute' };
    const { calls } = fakeFetch();
    routingQueue.online();
    await flush(5 * SEC);
    expect(calls.map((c) => c.to)).toEqual(['10.01,10.01']);
    expect(S.trips[1].route!.error).toBe('noroute');
  });
  it('un fallo recuperable no marca el viaje con error ni lo descarta', async () => {
    setup([mk('a', 'Uno', '2024-06-01')]);
    fakeFetch(() => {
      throw new TypeError('Failed to fetch');
    });
    routingQueue.kick();
    await flush(6 * SEC);
    expect(S.trips[0].route).toMatchObject({ status: 'pending' });
    expect('error' in S.trips[0].route!).toBe(false);
  });
});

describe('detener, reanudar y apagar', () => {
  it('Detener cancela la petición en curso; lo calculado se queda y Reanudar sigue con los que faltan', async () => {
    setup([
      mk('a', 'Uno', '2024-06-01'),
      mk('b', 'Dos', '2024-06-02'),
      mk('c', 'Tres', '2024-06-03'),
    ]);
    const { calls } = fakeFetch();
    routingQueue.kick();
    await flush(10); // primera petición terminada, la cola espera el segundo
    expect(S.trips[2].route!.status).toBe('ok');
    routingQueue.stop();
    await flush(10 * SEC);
    expect(calls).toHaveLength(1);
    expect(routingStatus().state).toBe('stopped');
    expect(S.trips.map((t) => t.route!.status)).toEqual(['pending', 'pending', 'ok']);
    routingQueue.kick(); // detenida: nada
    routingQueue.online();
    await flush(5 * SEC);
    expect(calls).toHaveLength(1);
    routingQueue.resume();
    await flush(5 * SEC);
    expect(calls).toHaveLength(3);
    expect(S.trips.map((t) => t.route!.status)).toEqual(['ok', 'ok', 'ok']);
  });
  it('Detener durante una petición la aborta y el viaje sigue pendiente (sin error)', async () => {
    setup([mk('a', 'Uno', '2024-06-01')]);
    let signal: AbortSignal | undefined;
    const f = vi.fn(
      (_u: string, init?: RequestInit) =>
        new Promise<Response>((_res, rej) => {
          signal = init?.signal ?? undefined;
          signal?.addEventListener('abort', () => rej(signal!.reason));
        }),
    );
    setRoutingFetch(f as unknown as typeof fetch);
    routingQueue.kick();
    await flush(10);
    expect(routingStatus().state).toBe('running');
    routingQueue.stop();
    await flush(10);
    expect(signal!.aborted).toBe(true);
    expect(routingStatus().state).toBe('stopped');
    expect(S.trips[0].route).toMatchObject({ status: 'pending' });
    expect('error' in S.trips[0].route!).toBe(false);
  });
  it('apagar el interruptor cancela la cola, deja de pedir y no borra las rutas ya calculadas', async () => {
    setup([
      mk('a', 'Uno', '2024-06-01'),
      mk('b', 'Dos', '2024-06-02'),
      mk('c', 'Tres', '2024-06-03'),
    ]);
    startRoutingQueue();
    const { calls } = fakeFetch();
    routingQueue.kick();
    await flush(10);
    const ok = clone(S.trips[2].route);
    S.settings.routing = false;
    emitChange('settings');
    await flush(10 * SEC);
    expect(calls).toHaveLength(1);
    expect(S.trips[2].route).toEqual(ok);
    expect(S.trips[2].route!.geometry).toBeDefined();
    expect(S.trips[0].route!.status).toBe('pending'); // no se borran ni se descartan
    expect(routingStatus().state).toBe('idle');
    // y con el interruptor apagado, un viaje nuevo no queda pendiente ni se pide nada
    const t = tripsRepo.create({
      date: '2024-07-01',
      depart: '08:00',
      arrive: '08:30',
      origin: 'Base',
      destination: 'Cuatro',
      odoStart: 1,
      odoEnd: 10,
      vehicleId: 'v1',
      tag: 'Trabajo',
    });
    await flush(5 * SEC);
    expect('route' in t).toBe(false);
    expect(calls).toHaveLength(1);
  });
  it('la cola detenida no se reactiva sola con un viaje nuevo', async () => {
    setup([mk('a', 'Uno', '2024-06-01')]);
    startRoutingQueue();
    const { calls } = fakeFetch();
    routingQueue.stop();
    tripsRepo.create({
      date: '2024-07-01',
      depart: '08:00',
      arrive: '08:30',
      origin: 'Base',
      destination: 'Dos',
      odoStart: 1,
      odoEnd: 10,
      vehicleId: 'v1',
      tag: 'Trabajo',
    });
    await flush(5 * SEC);
    expect(calls).toHaveLength(0);
    expect(S.trips.filter((t) => t.route?.status === 'pending')).toHaveLength(2);
  });
});

describe('crear y editar con el interruptor encendido', () => {
  const input = (to: string, date = '2024-07-01') => ({
    date,
    depart: '08:00',
    arrive: '08:30',
    origin: 'Base',
    destination: to,
    odoStart: 1,
    odoEnd: 10,
    vehicleId: 'v1',
    tag: 'Trabajo' as const,
  });
  it('el viaje se guarda al instante, queda pendiente y la ruta llega después por la cola', async () => {
    setup([]);
    startRoutingQueue();
    const { calls } = fakeFetch();
    const t = tripsRepo.create(input('Uno'));
    expect(t.route).toMatchObject({ status: 'pending' }); // no esperó a la red
    expect(t.points.length).toBeGreaterThanOrEqual(20); // mientras tanto, la recta
    await flush(2 * SEC);
    expect(calls).toHaveLength(1);
    expect(t.route!.status).toBe('ok');
    expect(t.points.length).toBeGreaterThanOrEqual(60);
  });
  it('varios viajes seguidos respetan una petición por segundo, el más reciente primero', async () => {
    setup([]);
    startRoutingQueue();
    const { calls } = fakeFetch();
    tripsRepo.create(input('Uno', '2024-07-01'));
    tripsRepo.create(input('Dos', '2024-07-03'));
    tripsRepo.create(input('Tres', '2024-07-02'));
    await flush(6 * SEC);
    expect(calls).toHaveLength(3);
    for (let i = 1; i < calls.length; i++)
      expect(calls[i].at - calls[i - 1].at).toBeGreaterThanOrEqual(SEC);
    expect(S.trips.every((t) => t.route!.status === 'ok')).toBe(true);
  });
  it('editar un viaje con ruta calculada cambiando el destino la vuelve a pedir; sin cambiar lugares no', async () => {
    setup([]);
    startRoutingQueue();
    const { calls } = fakeFetch();
    const t = tripsRepo.create(input('Uno'));
    await flush(2 * SEC);
    tripsRepo.update(t.id, { ...input('Uno'), tag: 'Personal' });
    await flush(3 * SEC);
    expect(calls).toHaveLength(1);
    tripsRepo.update(t.id, input('Dos'));
    expect(t.route!.status).toBe('pending');
    await flush(3 * SEC);
    expect(calls).toHaveLength(2);
    expect(t.route!.status).toBe('ok');
  });
});

describe('la carpeta de datos', () => {
  it('sin carpeta disponible para escribir no se pide nada; al volver, sigue', async () => {
    setup([mk('a', 'Uno', '2024-06-01')]);
    let writable = false;
    setRoutingGuard(() => writable);
    const { calls } = fakeFetch();
    routingQueue.kick();
    await flush(5 * SEC);
    expect(calls).toHaveLength(0);
    expect(routingStatus().state).toBe('blocked');
    writable = true;
    routingQueue.kick();
    await flush(3 * SEC);
    expect(calls).toHaveLength(1);
    expect(S.trips[0].route!.status).toBe('ok');
  });
});

describe('tripsRepo: aplicar resultados de la cola', () => {
  const res = {
    distance: 10,
    duration: 5,
    geometry: {
      type: 'LineString' as const,
      coordinates: [
        [10, 10],
        [10.01, 10.01],
      ] as [number, number][],
    },
  };
  it('applyRoute solo vale para un viaje pendiente con la misma huella', () => {
    setup([mk('a', 'Uno', '2024-06-01')]);
    const sig = S.trips[0].route!.sig;
    expect(tripsRepo.applyRoute('a', 'otra', res)).toBe(false);
    expect(tripsRepo.applyRoute('nada', sig, res)).toBe(false);
    expect(tripsRepo.applyRoute('a', sig, res)).toBe(true);
    expect(S.trips[0].route).toMatchObject({ status: 'ok', sig, n: 2, distance: 10, duration: 5 });
    expect(tripsRepo.applyRoute('a', sig, res)).toBe(false); // ya no está pendiente
  });
  it('retryRoute quita el error de un viaje, deja pendiente uno sin ruta y no toca lo demás', () => {
    setup([mk('a', 'Uno', '2024-06-01'), mk('b', 'Dos', '2024-06-02'), trip({ id: 'c' })]);
    S.trips[2] = trip({ id: 'c', origin: 'Base', destination: 'Tres' });
    tripsRepo.failRoute('a', S.trips[0].route!.sig, 'noroute');
    tripsRepo.applyRoute('b', S.trips[1].route!.sig, res);
    expect(tripsRepo.retryRoute('a')).toBe(true);
    expect('error' in S.trips[0].route!).toBe(false);
    expect(S.trips[0].route!.status).toBe('pending');
    expect(tripsRepo.retryRoute('b')).toBe(false); // ya calculada
    expect(tripsRepo.retryRoute('nada')).toBe(false);
    expect(tripsRepo.retryRoute('c')).toBe(true); // sin ruta con el interruptor encendido
    expect(S.trips[2].route!.status).toBe('pending');
    S.settings.routing = false;
    S.trips[2] = trip({ id: 'c', origin: 'Base', destination: 'Tres' });
    expect(tripsRepo.retryRoute('c')).toBe(false); // apagado no se crean pendientes
  });
  it('failRoute marca el error; una edición que cambia la huella lo quita', () => {
    setup([mk('a', 'Uno', '2024-06-01')]);
    const sig = S.trips[0].route!.sig;
    expect(tripsRepo.failRoute('a', sig, 'noroute')).toBe(true);
    expect(S.trips[0].route!.error).toBe('noroute');
    S.settings.routing = true;
    tripsRepo.update('a', {
      date: '2024-06-01',
      depart: '08:00',
      arrive: '08:30',
      origin: 'Base',
      destination: 'Dos',
      odoStart: 1000,
      odoEnd: 1012,
      vehicleId: 'v1',
      tag: 'Trabajo',
    });
    expect(S.trips[0].route!.error).toBeUndefined();
    expect(S.trips[0].route!.status).toBe('pending');
  });
  it('queueMissingRoutes deja pendientes los viajes de la app con ubicación y sin ruta', () => {
    setup(
      [
        trip({ id: 'a', origin: 'Base', destination: 'Uno' }),
        trip({ id: 'b', origin: 'Base', destination: 'Sin ubicar' }),
        trip({ id: 'c', origin: 'Base', destination: 'Dos', pointsSource: 'imported' }),
        mk('d', 'Tres', '2024-06-01'),
      ],
      true,
    );
    expect(tripsRepo.queueMissingRoutes()).toBe(1);
    expect(S.trips[0].route!.status).toBe('pending');
    expect('route' in S.trips[1]).toBe(false);
    expect('route' in S.trips[2]).toBe(false);
    expect(tripsRepo.queueMissingRoutes()).toBe(0);
  });
});
