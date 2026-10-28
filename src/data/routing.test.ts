import { describe, expect, it, vi } from 'vitest';
import { ROUTING, fetchRoute, routeSig, routeUrl, routingHost } from './routing';

const A = { lat: 10, lng: 10 },
  B = { lat: 10.04, lng: 10.05 },
  V = { lat: 10.02, lng: 10.01 };
const okBody = {
  code: 'Ok',
  routes: [
    {
      distance: 5234.5,
      duration: 612.3,
      geometry: {
        type: 'LineString',
        coordinates: [
          [10, 10],
          [10.01, 10.02],
          [10.05, 10.04],
        ],
      },
    },
  ],
};
const reply = (body: unknown, status = 200) =>
  vi.fn(
    async () => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response,
  );

describe('configuración', () => {
  it('apunta al servidor público de OSRM y se puede cambiar en un solo lugar', () => {
    expect(ROUTING.baseUrl).toBe('https://router.project-osrm.org/route/v1');
    expect(routingHost()).toBe('router.project-osrm.org');
    const propio = { ...ROUTING, baseUrl: 'http://localhost:5000/route/v1/' };
    expect(routeUrl([A, B], propio)).toMatch(
      /^http:\/\/localhost:5000\/route\/v1\/driving\/10,10;10.05,10.04\?/,
    );
    expect(routingHost(propio)).toBe('localhost:5000');
  });
  it('respeta el máximo de 1 petición por segundo y la atribución pedida', () => {
    expect(ROUTING.minIntervalMs).toBeGreaterThanOrEqual(1000);
    expect(ROUTING.attribution).toBe('Rutas: OSRM · © OpenStreetMap contributors');
  });
});

describe('routeUrl', () => {
  it('lleva lng,lat, origen → intermedios → destino, geojson y overview=full', () => {
    const u = routeUrl([A, V, B]);
    expect(u).toBe(
      'https://router.project-osrm.org/route/v1/driving/10,10;10.01,10.02;10.05,10.04?overview=full&geometries=geojson&steps=false',
    );
  });
  it('redondea a 6 decimales y nunca usa notación científica', () => {
    const u = routeUrl([
      { lat: 0.0000004, lng: 10.123456789 },
      { lat: -0.00000001, lng: 1e-7 },
    ]);
    expect(u).toContain('/driving/10.123457,0;0,0?');
    expect(u).not.toMatch(/e-/);
  });
});

describe('routeSig', () => {
  it('es estable y cambia si cambia un extremo, un intermedio o el orden', () => {
    expect(routeSig([A, B])).toBe(routeSig([{ ...A }, { ...B }]));
    expect(routeSig([A, B])).not.toBe(routeSig([A, { ...B, lat: 10.0401 }]));
    expect(routeSig([A, B])).not.toBe(routeSig([A, V, B]));
    expect(routeSig([A, V, B])).not.toBe(routeSig([B, V, A]));
  });
  it('ignora diferencias menores a 1e-6', () => {
    expect(routeSig([A, B])).toBe(routeSig([{ lat: 10.0000001, lng: 10 }, B]));
  });
});

describe('fetchRoute', () => {
  it('pide la URL correcta y devuelve geometría completa, distancia y duración', async () => {
    const f = reply(okBody);
    const r = await fetchRoute([A, V, B], { fetch: f });
    expect(f).toHaveBeenCalledTimes(1);
    expect((f.mock.calls[0] as unknown[])[0]).toBe(routeUrl([A, V, B]));
    expect(r.distance).toBe(5234.5);
    expect(r.duration).toBe(612.3);
    expect(r.geometry).toEqual({
      type: 'LineString',
      coordinates: okBody.routes[0].geometry.coordinates,
    });
  });
  it('rechaza entradas inválidas sin hacer ninguna petición', async () => {
    const f = reply(okBody);
    const bad: [string, (typeof A)[]][] = [
      ['un solo punto', [A]],
      ['ninguno', []],
      ['coordenada fuera de rango', [A, { lat: 95, lng: 0 }]],
      [
        'demasiados intermedios',
        [A, ...Array.from({ length: ROUTING.maxWaypoints + 1 }, () => V), B],
      ],
    ];
    for (const [, pts] of bad) {
      await expect(fetchRoute(pts, { fetch: f })).rejects.toMatchObject({ kind: 'input' });
    }
    expect(f).not.toHaveBeenCalled();
  });
  it('distingue sin camino, errores HTTP, red y respuestas inválidas', async () => {
    await expect(fetchRoute([A, B], { fetch: reply({ code: 'NoRoute' }) })).rejects.toMatchObject({
      kind: 'noroute',
    });
    await expect(
      fetchRoute([A, B], { fetch: reply({ code: 'NoSegment' }, 400) }),
    ).rejects.toMatchObject({
      kind: 'noroute',
    });
    await expect(fetchRoute([A, B], { fetch: reply({}, 429) })).rejects.toMatchObject({
      kind: 'http',
      status: 429,
    });
    await expect(fetchRoute([A, B], { fetch: reply({}, 503) })).rejects.toMatchObject({
      kind: 'http',
      status: 503,
    });
    const down = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(
      fetchRoute([A, B], { fetch: down as unknown as typeof fetch }),
    ).rejects.toMatchObject({ kind: 'network' });
    const sinJson = vi.fn(
      async () =>
        ({
          ok: true,
          status: 200,
          json: async () => Promise.reject(new Error('x')),
        }) as unknown as Response,
    );
    await expect(fetchRoute([A, B], { fetch: sinJson })).rejects.toMatchObject({ kind: 'invalid' });
    for (const body of [
      { code: 'Ok', routes: [] },
      {
        code: 'Ok',
        routes: [{ distance: 1, duration: 1, geometry: { type: 'Point', coordinates: [1, 1] } }],
      },
      {
        code: 'Ok',
        routes: [
          { distance: 1, duration: 1, geometry: { type: 'LineString', coordinates: [[1, 1]] } },
        ],
      },
      {
        code: 'Ok',
        routes: [
          {
            distance: 1,
            duration: 1,
            geometry: {
              type: 'LineString',
              coordinates: [
                [1, 1],
                [500, 1],
              ],
            },
          },
        ],
      },
      { code: 'Ok', routes: [{ distance: 'x', duration: 1, geometry: okBody.routes[0].geometry }] },
    ])
      await expect(fetchRoute([A, B], { fetch: reply(body) })).rejects.toMatchObject({
        kind: 'invalid',
      });
  });
  it('corta por tiempo con kind «timeout»', async () => {
    const colgado = vi.fn(
      (_u: string, init?: RequestInit) =>
        new Promise<Response>((_res, rej) =>
          init?.signal?.addEventListener('abort', () => rej(init.signal!.reason)),
        ),
    );
    const t0 = Date.now();
    await expect(
      fetchRoute([A, B], {
        fetch: colgado as unknown as typeof fetch,
        cfg: { ...ROUTING, timeoutMs: 30 },
      }),
    ).rejects.toMatchObject({ kind: 'timeout' });
    expect(Date.now() - t0).toBeLessThan(1000);
  });
  it('se puede cancelar desde fuera', async () => {
    const ctl = new AbortController();
    const colgado = vi.fn(
      (_u: string, init?: RequestInit) =>
        new Promise<Response>((_res, rej) =>
          init?.signal?.addEventListener('abort', () => rej(init.signal!.reason)),
        ),
    );
    const p = fetchRoute([A, B], { fetch: colgado as unknown as typeof fetch, signal: ctl.signal });
    ctl.abort(new Error('cancelado'));
    await expect(p).rejects.toMatchObject({ kind: 'aborted' });
  });
  it('no modifica la geometría recibida', async () => {
    const body = structuredClone(okBody);
    const r = await fetchRoute([A, B], { fetch: reply(body) });
    r.geometry.coordinates[0][0] = 99;
    expect(body.routes[0].geometry.coordinates[0][0]).toBe(10);
  });
});
