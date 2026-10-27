import { describe, expect, it } from 'vitest';
import {
  CK_MAX,
  CK_MIN,
  DATA_VERSION,
  SEED_GEO,
  ValidationError,
  checkFuel,
  checkPlaceName,
  checkTrip,
  checkVehicle,
  cleanComputer,
  cleanPlace,
  normalize,
  parseBackup,
  tripKey,
  type FuelInput,
  type TripInput,
} from './schema';
import { load, makePlaces, trip } from '@/testing/fixtures';

const tripInput = (over: Partial<TripInput> = {}): TripInput => {
  const { id, points, pointsSource, computerKmpl, computerUnit, ...base } = trip();
  void [id, points, pointsSource, computerKmpl, computerUnit];
  return { ...base, ...over };
};
const fuelInput = (over: Partial<FuelInput> = {}): FuelInput => {
  const { id, ...base } = load();
  void id;
  return { ...base, ...over };
};

describe('checkTrip', () => {
  it('acepta un viaje válido', () => {
    expect(checkTrip(tripInput())).toBeNull();
  });
  it.each<[string, Partial<TripInput>, string]>([
    ['origen vacío', { origin: '  ' }, 'Escribe el lugar de origen.'],
    ['destino vacío', { destination: '' }, 'Escribe el lugar de destino.'],
    ['fecha inválida', { date: '15/06/2024' }, 'Elige la fecha.'],
    ['hora de salida inválida', { depart: '' }, 'Indica la hora de salida y de llegada.'],
    ['hora de llegada inválida', { arrive: '8h' }, 'Indica la hora de salida y de llegada.'],
    [
      'salida igual a llegada',
      { depart: '08:00', arrive: '08:00' },
      'La llegada debe ser distinta a la salida.',
    ],
    ['odómetro inicial negativo', { odoStart: -1 }, 'Captura el odómetro inicial.'],
    ['odómetro inicial NaN', { odoStart: NaN }, 'Captura el odómetro inicial.'],
    ['odómetro final NaN', { odoEnd: NaN }, 'Captura el odómetro final.'],
    ['final igual al inicial', { odoStart: 10, odoEnd: 10 }, 'Debe ser mayor al inicial.'],
    ['final menor al inicial', { odoStart: 10, odoEnd: 5 }, 'Debe ser mayor al inicial.'],
    ['distancia enorme', { odoStart: 0, odoEnd: 2001 }, 'La distancia parece demasiado grande.'],
    ['etiqueta desconocida', { tag: 'Otra' as never }, 'La etiqueta no es válida.'],
  ])('rechaza: %s', (_n, over, msg) => {
    expect(checkTrip(tripInput(over))).toBe(msg);
  });
  it('permite exactamente 2000 km y la medianoche (llegada menor que salida)', () => {
    expect(checkTrip(tripInput({ odoStart: 0, odoEnd: 2000 }))).toBeNull();
    expect(checkTrip(tripInput({ depart: '23:50', arrive: '00:20' }))).toBeNull();
  });
});

describe('checkFuel', () => {
  it('acepta una carga válida', () => {
    expect(checkFuel(fuelInput())).toBeNull();
  });
  it.each<[string, Partial<FuelInput>, string]>([
    ['fecha inválida', { date: '' }, 'Elige la fecha.'],
    ['gasolinera vacía', { station: ' ' }, 'Escribe la gasolinera.'],
    ['odómetro en cero', { odometer: 0 }, 'Captura el odómetro.'],
    ['litros en cero', { liters: 0 }, 'Captura los litros.'],
    ['litros NaN', { liters: NaN }, 'Captura los litros.'],
    ['demasiados litros', { liters: 200.5 }, 'Revisa la cantidad de litros.'],
    ['precio en cero', { price: 0 }, 'Captura el precio por litro.'],
    ['precio absurdo', { price: 101 }, 'Revisa el precio por litro.'],
  ])('rechaza: %s', (_n, over, msg) => {
    expect(checkFuel(fuelInput(over))).toBe(msg);
  });
  it('permite los límites (200 L, $100/L)', () => {
    expect(checkFuel(fuelInput({ liters: 200, price: 100 }))).toBeNull();
  });
});

describe('checkVehicle y checkPlaceName', () => {
  it('exigen un nombre', () => {
    expect(checkVehicle({ name: ' ', year: '', plate: '', fuel: 'Magna', tank: '' })).toMatch(
      /nombre/,
    );
    expect(checkVehicle({ name: 'Auto', year: '', plate: '', fuel: 'Magna', tank: '' })).toBeNull();
    expect(checkPlaceName('   ')).toMatch(/nombre/);
    expect(checkPlaceName('Alfa')).toBeNull();
  });
  it('ValidationError es un Error con nombre propio', () => {
    const e = new ValidationError('x');
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('ValidationError');
    expect(e.message).toBe('x');
  });
});

describe('cleanComputer', () => {
  it('conserva los valores dentro de 3–40 km/L (límites incluidos) y la unidad', () => {
    expect(cleanComputer(CK_MIN, 'kmpl')).toEqual({ computerKmpl: 3, computerUnit: 'kmpl' });
    expect(cleanComputer(CK_MAX, 'l100')).toEqual({ computerKmpl: 40, computerUnit: 'l100' });
    expect(cleanComputer('14.25', 'l100')).toEqual({ computerKmpl: 14.25, computerUnit: 'l100' });
  });
  it('unidad desconocida se toma como km/L', () => {
    expect(cleanComputer(10, 'mpg')).toEqual({ computerKmpl: 10, computerUnit: 'kmpl' });
  });
  it('redondea a 4 decimales', () => {
    expect(cleanComputer(100 / 7, 'l100').computerKmpl).toBe(14.2857);
  });
  it.each([[2.99], [40.01], [0], [-5], [NaN], [null], [undefined], [''], ['abc']])(
    'descarta %s',
    (v) => {
      expect(cleanComputer(v, 'kmpl')).toEqual({ computerKmpl: null, computerUnit: null });
    },
  );
});

describe('cleanPlace', () => {
  it('conserva lat/lng válidos y no guarda x/y', () => {
    const p = cleanPlace({ id: 'p9', name: 'Zeta', lat: 10.5, lng: 20.5, x: 1, y: 2 }, false);
    expect(p).toEqual({ id: 'p9', name: 'Zeta', area: '', lat: 10.5, lng: 20.5, kind: 'other' });
    expect('x' in p).toBe(false);
  });
  it('descarta coordenadas fuera de rango y conserva x/y estimados', () => {
    const p = cleanPlace({ id: 'p9', name: 'Zeta', lat: 95, lng: 20, x: 10, y: 20 }, false);
    expect(p.lat).toBeNull();
    expect(p.lng).toBeNull();
    expect(p).toMatchObject({ x: 10, y: 20 });
  });
  it('un lugar de ejemplo v1 en su posición original recibe lat/lng por nombre', () => {
    const sg = SEED_GEO['casa'];
    const p = cleanPlace({ id: 'p1', name: 'Casa', x: sg.x, y: sg.y }, true);
    expect(p).toMatchObject({ lat: sg.lat, lng: sg.lng });
    expect('x' in p).toBe(false);
  });
  it('un lugar de ejemplo v1 sin x/y también (se reconoce por nombre)', () => {
    const p = cleanPlace({ id: 'p1', name: 'OFICINA' }, true);
    expect(p.lat).toBe(SEED_GEO['oficina'].lat);
  });
  it('un lugar de ejemplo movido por el usuario conserva su x/y y queda sin ubicación', () => {
    const sg = SEED_GEO['casa'];
    const p = cleanPlace({ id: 'p1', name: 'Casa', x: sg.x + 40, y: sg.y }, true);
    expect(p.lat).toBeNull();
    expect(p).toMatchObject({ x: sg.x + 40, y: sg.y });
  });
  it('sin legacy no se asigna ubicación por nombre', () => {
    const sg = SEED_GEO['casa'];
    expect(cleanPlace({ id: 'p1', name: 'Casa', x: sg.x, y: sg.y }, false).lat).toBeNull();
  });
  it('genera id y usa valores por omisión', () => {
    const p = cleanPlace({ name: 'Nuevo' }, false);
    expect(p.id).toMatch(/^p/);
    expect(p).toMatchObject({ area: '', kind: 'other', lat: null, lng: null });
  });
});

describe('normalize', () => {
  it('completa ajustes y estado de pantalla por omisión', () => {
    const d = normalize({ vehicles: [{ id: 'v1', name: 'A' }] });
    expect(d.version).toBe(DATA_VERSION);
    expect(d.settings).toEqual({
      defaultVehicle: 'v1',
      defaultTag: 'Trabajo',
      hints: true,
      lastBackup: null,
      computerUnit: 'kmpl',
      odoMode: 'end',
    });
    expect(d.ui).toMatchObject({ view: 'inicio', placesLayer: 'lugares', q: '' });
    expect(d.ui.tf).toEqual({ tag: 'Todos', vehicle: 'all', from: '', to: '' });
  });
  it('odoMode: conserva uno válido y corrige uno inválido', () => {
    expect(normalize({ settings: { odoMode: 'dist' } }).settings.odoMode).toBe('dist');
    expect(normalize({ settings: { odoMode: 'raro' } }).settings.odoMode).toBe('end');
    expect(normalize({ settings: { odoMode: null } }).settings.odoMode).toBe('end');
  });
  it('respeta lo guardado pero limpia la búsqueda', () => {
    const d = normalize({ ui: { view: 'viajes', q: 'algo', tf: { tag: 'Personal' } } });
    expect(d.ui.view).toBe('viajes');
    expect(d.ui.q).toBe('');
    expect(d.ui.tf).toEqual({ tag: 'Personal', vehicle: 'all', from: '', to: '' });
  });
  it('sin datos devuelve un estado vacío válido', () => {
    const d = normalize();
    expect([d.vehicles, d.places, d.trips, d.fuel]).toEqual([[], [], [], []]);
    expect(d.settings.defaultVehicle).toBeNull();
  });
  it('completa lat/lng de los lugares, points y pointsSource de los viajes', () => {
    const d = normalize({
      places: [{ id: 'p', name: 'X' }],
      trips: [
        trip({ id: 'a', points: undefined as never, pointsSource: undefined as never }),
        trip({
          id: 'b',
          pointsSource: undefined as never,
          points: [{ lat: 1, lng: 1, t: '2024-06-15T08:00:00Z', speed: 1 }],
        }),
      ],
    });
    expect(d.places[0]).toMatchObject({ lat: null, lng: null });
    expect(d.trips[0]).toMatchObject({ points: [], pointsSource: 'auto' });
    expect(d.trips[1].pointsSource).toBe('imported');
  });
  it('sanea el rendimiento de la computadora guardado', () => {
    const d = normalize({
      trips: [
        trip({ id: 'a', computerKmpl: 1 as never, computerUnit: 'l100' }),
        trip({ id: 'b', computerKmpl: 12, computerUnit: 'l100' }),
      ],
    });
    expect(d.trips[0]).toMatchObject({ computerKmpl: null, computerUnit: null });
    expect(d.trips[1]).toMatchObject({ computerKmpl: 12, computerUnit: 'l100' });
  });
});

describe('parseBackup', () => {
  const file = (data: unknown, version: unknown = DATA_VERSION) => ({
    app: 'Trayecto',
    version,
    exportedAt: '2024-06-15T00:00:00Z',
    data,
  });
  const goodData = () => ({
    vehicles: [{ id: 'v1', name: 'Auto' }],
    places: makePlaces(),
    trips: [trip()],
    fuel: [load()],
    settings: { hints: false },
  });

  it.each([[null], [undefined], [{}], [{ data: { trips: [] } }], [[]], ['texto']])(
    'rechaza lo que no parece un respaldo (%j)',
    (v) => {
      expect(parseBackup(v)).toEqual({ error: 'El archivo no parece un respaldo de Trayecto' });
    },
  );
  it('rechaza una versión más nueva', () => {
    expect(parseBackup(file(goodData(), DATA_VERSION + 1))).toEqual({
      error: 'El respaldo es de una versión más nueva de Trayecto',
    });
  });
  it('acepta el contenido sin envoltorio y la versión de d.version', () => {
    const r = parseBackup({ ...goodData(), version: 2 });
    expect(r.error).toBeUndefined();
    expect(r.data?.trips).toHaveLength(1);
  });
  it('descarta registros inválidos y lo anota en raw', () => {
    const d = goodData();
    d.vehicles.push({ id: 'v0', name: '' });
    d.trips.push(
      trip({ id: 'x1', date: 'ayer' }),
      trip({ id: 'x2', depart: '8' }),
      trip({ id: 'x3', origin: '' }),
      trip({ id: 'x4', odoEnd: NaN }),
    );
    d.fuel.push(load({ id: 'y1', date: '' }), load({ id: 'y2', liters: NaN }));
    const r = parseBackup(file(d));
    expect(r.error).toBeUndefined();
    expect(r.raw).toEqual({ trips: 5, fuel: 3, vehicles: 2, places: 3 });
    expect(r.data!.trips.map((t) => t.id)).toEqual(['t1']);
    expect(r.data!.fuel.map((f) => f.id)).toEqual(['f1']);
    expect(r.data!.vehicles.map((v) => v.id)).toEqual(['v1']);
  });
  it('sanea el rendimiento de la computadora y la etiqueta', () => {
    const d = goodData();
    d.trips = [
      trip({ id: 'a', computerKmpl: 99 as never, computerUnit: 'l100' }),
      trip({ id: 'b', computerKmpl: 15, computerUnit: 'l100', tag: 'Rara' as never }),
    ];
    const r = parseBackup(file(d));
    expect(r.data!.trips[0]).toMatchObject({ computerKmpl: null, computerUnit: null });
    expect(r.data!.trips[1]).toMatchObject({
      computerKmpl: 15,
      computerUnit: 'l100',
      tag: 'Trabajo',
    });
  });
  it('valida lat/lng de los lugares y descarta puntos inválidos de las rutas', () => {
    const d = goodData();
    d.places = [{ ...makePlaces()[0], lat: 120 }, makePlaces()[1], makePlaces()[2]];
    d.trips = [
      trip({
        id: 'a',
        pointsSource: 'imported',
        points: [
          { lat: 10, lng: 10, t: '2024-06-15T08:00:00Z', speed: 5 },
          { lat: 999, lng: 10, t: '2024-06-15T08:10:00Z', speed: 5 },
          { lat: 10.1, lng: 10.1, t: 'no-fecha', speed: 5 },
          { lat: 10.2, lng: 10.2, t: '2024-06-15T08:20:00Z', speed: -1 },
          { lat: 10.3, lng: 10.3, t: '2024-06-15T08:30:00Z', speed: 7 },
        ],
      }),
    ];
    const r = parseBackup(file(d));
    expect(r.data!.places[0].lat).toBeNull();
    expect(r.data!.trips[0].points.map((p) => p.lat)).toEqual([10, 10.3]);
    expect(r.data!.trips[0].pointsSource).toBe('imported');
  });
  it('regenera las rutas que faltan y los viajes sin coordenadas quedan sin ruta', () => {
    const d = goodData();
    d.trips = [trip({ id: 'a' }), trip({ id: 'b', origin: 'Gama' })];
    const r = parseBackup(file(d));
    expect(r.data!.trips[0].points.length).toBeGreaterThanOrEqual(20);
    expect(r.data!.trips[0].pointsSource).toBe('auto');
    expect(r.data!.trips[1].points).toEqual([]);
  });
  it('rellena valores por omisión de vehículos y cargas', () => {
    const r = parseBackup(
      file({
        vehicles: [{ name: 'A' }, { name: 'B', color: '#000' }],
        places: [],
        trips: [],
        fuel: [{ date: '2024-06-01', odometer: 5, liters: 1, price: 2 }],
      }),
    );
    expect(r.data!.vehicles[0]).toMatchObject({ fuel: 'Magna', year: '', tank: '' });
    expect(r.data!.vehicles[0].color).toMatch(/^#/);
    expect(r.data!.vehicles[1].color).toBe('#000');
    expect(r.data!.fuel[0]).toMatchObject({ station: 'Sin nombre', full: true, vehicleId: '' });
  });
  it('una carga con full:false se conserva como parcial', () => {
    const d = goodData();
    d.fuel = [load({ full: false })];
    expect(parseBackup(file(d)).data!.fuel[0].full).toBe(false);
  });
});

describe('tripKey', () => {
  it('ordena por fecha y hora de salida', () => {
    const a = tripKey({ date: '2024-06-15', depart: '08:00' });
    const b = tripKey({ date: '2024-06-15', depart: '09:00' });
    const c = tripKey({ date: '2024-06-16', depart: '07:00' });
    expect([c, a, b].sort()).toEqual([a, b, c]);
  });
});
