import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KEY, KEY_V1, Store } from './local';

class FakeStorage {
  private m = new Map<string, string>();
  getItem = (k: string) => this.m.get(k) ?? null;
  setItem = (k: string, v: string) => {
    this.m.set(k, String(v));
  };
  removeItem = (k: string) => {
    this.m.delete(k);
  };
}

describe('Store (localStorage)', () => {
  let ls: FakeStorage;
  beforeEach(() => {
    ls = new FakeStorage();
    vi.stubGlobal('localStorage', ls);
    Object.assign(Store, { ok: false, mem: null, legacy: false });
    Store.init();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    Object.assign(Store, { ok: false, mem: null, legacy: false });
  });

  it('las claves son las de las versiones anteriores', () => {
    expect(KEY).toBe('trayecto:v2');
    expect(KEY_V1).toBe('trayecto:v1');
  });
  it('guarda en trayecto:v2 y lo recupera', () => {
    Store.save({ a: 1 });
    expect(JSON.parse(ls.getItem('trayecto:v2')!)).toEqual({ a: 1 });
    expect(Store.load()).toEqual({ a: 1 });
  });
  it('sin datos devuelve null', () => {
    expect(Store.load()).toBeNull();
  });
  it('no guarda las rutas generadas por la app, solo las importadas', () => {
    const pts = [{ lat: 1, lng: 1, t: '2024-06-15T08:00:00Z', speed: 5 }];
    Store.save({
      trips: [
        { id: 'a', pointsSource: 'auto', points: pts },
        { id: 'b', pointsSource: 'imported', points: pts },
      ],
    });
    const back = Store.load();
    expect('points' in back.trips[0]).toBe(false);
    expect(back.trips[0].pointsSource).toBe('auto');
    expect(back.trips[1].points).toEqual(pts);
  });
  it('no guarda la geometría de las rutas (solo vive en el archivo), pero sí sus datos ligeros', () => {
    const route = {
      status: 'ok',
      sig: 'abc',
      distance: 100,
      duration: 20,
      n: 2,
      geometry: {
        type: 'LineString',
        coordinates: [
          [10, 10],
          [10.1, 10.1],
        ],
      },
    };
    Store.save({ trips: [{ id: 'a', pointsSource: 'imported', points: [], route }] });
    expect(ls.getItem('trayecto:v2')).not.toContain('coordinates');
    const back = Store.load();
    expect(back.trips[0].route).toEqual({
      status: 'ok',
      sig: 'abc',
      distance: 100,
      duration: 20,
      n: 2,
    });
  });
  it('lee trayecto:v1 si no hay v2 y lo marca como heredado', () => {
    ls.setItem('trayecto:v1', JSON.stringify({ version: 1 }));
    expect(Store.load()).toEqual({ version: 1 });
    expect(Store.legacy).toBe(true);
  });
  it('v2 tiene prioridad sobre v1', () => {
    ls.setItem('trayecto:v1', JSON.stringify({ version: 1 }));
    ls.setItem('trayecto:v2', JSON.stringify({ version: 2 }));
    expect(Store.load()).toEqual({ version: 2 });
    expect(Store.legacy).toBe(false);
  });
  it('trayecto:v1 se borra solo cuando los datos migrados ya quedaron en v2', () => {
    ls.setItem('trayecto:v1', JSON.stringify({ version: 1 }));
    Store.load();
    const migrated = { version: 2, trips: [] };
    Store.retireLegacy(migrated);
    expect(ls.getItem('trayecto:v1')).not.toBeNull(); // v2 aún no se guardó
    Store.legacy = true;
    Store.save(migrated);
    Store.retireLegacy(migrated);
    expect(ls.getItem('trayecto:v1')).toBeNull();
    expect(Store.legacy).toBe(false);
  });
  it('si v2 guardado difiere de lo migrado, v1 se conserva', () => {
    ls.setItem('trayecto:v1', JSON.stringify({ version: 1 }));
    Store.load();
    Store.save({ version: 2, trips: [1] });
    Store.retireLegacy({ version: 2, trips: [] });
    expect(ls.getItem('trayecto:v1')).not.toBeNull();
  });
  it('si localStorage falla al guardar, sigue funcionando en memoria', () => {
    ls.setItem = () => {
      throw new Error('cuota');
    };
    Store.save({ a: 2 });
    expect(Store.ok).toBe(false);
    expect(Store.load()).toEqual({ a: 2 });
  });
  it('sin localStorage disponible queda en memoria', () => {
    vi.stubGlobal('localStorage', undefined);
    Store.init();
    expect(Store.ok).toBe(false);
    Store.save({ b: 3 });
    expect(Store.load()).toEqual({ b: 3 });
  });
  it('JSON dañado en v2 no revienta: usa la copia en memoria o null', () => {
    ls.setItem('trayecto:v2', '{no es json');
    expect(Store.load()).toBeNull();
  });
});
