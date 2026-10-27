/** Datos de ejemplo. */
import { tripPoints } from './routes';
import {
  DATA_VERSION,
  SEED_GEO,
  type AppData,
  type Fuel,
  type Place,
  type Tag,
  type Trip,
  type Ui,
  type Vehicle,
} from './schema';
import { addDays, fromMin, isoDate, startOfToday, toMin } from '@/shared/utils/dates';
import { norm } from '@/shared/utils/norm';

/** Datos de ejemplo; `ui` va vacío y se completa al normalizar. */
export type SeedData = Omit<AppData, 'ui'> & { ui: Partial<Ui> };
export function seed(): SeedData {
  const T = startOfToday(),
    d = (a: number) => isoDate(addDays(T, -a));
  const vehicles: Vehicle[] = [
    {
      id: 'v1',
      name: 'Mazda 3 Sedán',
      year: 2021,
      plate: 'NXR-482-A',
      fuel: 'Magna',
      tank: 51,
      color: '#FFB020',
    },
    {
      id: 'v2',
      name: 'Nissan March',
      year: 2019,
      plate: 'PLM-217-B',
      fuel: 'Magna',
      tank: 41,
      color: '#6CA8FF',
    },
  ];
  const geo = (n: string) => ({ lat: SEED_GEO[norm(n)].lat, lng: SEED_GEO[norm(n)].lng });
  const places: Place[] = [
    { id: 'p1', name: 'Casa', area: 'Coyoacán', ...geo('Casa'), kind: 'home' },
    { id: 'p2', name: 'Oficina', area: 'Polanco', ...geo('Oficina'), kind: 'work' },
    { id: 'p3', name: 'Gimnasio', area: 'Del Valle', ...geo('Gimnasio'), kind: 'gym' },
    {
      id: 'p4',
      name: 'Casa de mis papás',
      area: 'Ciudad Satélite',
      ...geo('Casa de mis papás'),
      kind: 'family',
    },
    {
      id: 'p5',
      name: 'Cliente Santa Fe',
      area: 'Santa Fe',
      ...geo('Cliente Santa Fe'),
      kind: 'work',
    },
  ];
  const TR: [number, string, number, string, string, number, string, Tag, number][] = [
    [41, '08:05', 48, 'Casa', 'Oficina', 17.4, 'v1', 'Trabajo', 48702],
    [38, '18:40', 52, 'Oficina', 'Casa', 17.9, 'v1', 'Trabajo', 48790],
    [34, '10:15', 72, 'Casa', 'Casa de mis papás', 31.2, 'v1', 'Personal', 48880],
    [33, '12:00', 22, 'Casa', 'Gimnasio', 6.1, 'v2', 'Personal', 61580],
    [30, '09:00', 38, 'Oficina', 'Cliente Santa Fe', 12.6, 'v1', 'Trabajo', 48990],
    [25, '07:55', 44, 'Casa', 'Oficina', 17.2, 'v1', 'Trabajo', 49120],
    [21, '19:20', 17, 'Casa', 'Gimnasio', 5.8, 'v1', 'Personal', 49240],
    [15, '08:10', 51, 'Casa', 'Oficina', 17.6, 'v1', 'Trabajo', 49380],
    [12, '16:30', 35, 'Gimnasio', 'Oficina', 11.2, 'v2', 'Trabajo', 61850],
    [8, '08:00', 46, 'Casa', 'Oficina', 17.3, 'v1', 'Trabajo', 49560],
    [6, '13:30', 55, 'Casa', 'Cliente Santa Fe', 20.4, 'v1', 'Trabajo', 49610],
    [4, '07:50', 43, 'Casa', 'Oficina', 17.1, 'v1', 'Trabajo', 49680],
    [3, '18:50', 58, 'Oficina', 'Casa', 18.2, 'v1', 'Trabajo', 49720],
    [2, '20:05', 16, 'Casa', 'Gimnasio', 5.9, 'v1', 'Personal', 49760],
    [1, '11:20', 74, 'Casa', 'Casa de mis papás', 30.8, 'v1', 'Personal', 49790],
  ];
  const trips: Trip[] = TR.map(([a, dep, dur, o, de, km, v, tag, odo], i) => ({
    id: 't' + (i + 1),
    date: d(a),
    depart: dep,
    arrive: fromMin(toMin(dep) + dur),
    origin: o,
    destination: de,
    odoStart: odo,
    odoEnd: +(odo + km).toFixed(1),
    vehicleId: v,
    tag,
    points: [],
    pointsSource: 'auto',
    computerKmpl: null,
    computerUnit: null,
  }));
  trips.forEach((t) => {
    t.points = tripPoints(t, places);
    t.pointsSource = 'auto';
  });
  const FU: [number, string, number, number, number, boolean, string][] = [
    [100, 'Pemex Av. Universidad', 47640, 33.0, 23.69, true, 'v1'],
    [82, 'Shell Insurgentes Sur', 48080, 34.2, 23.89, true, 'v1'],
    [70, 'BP Río Churubusco', 61420, 28.0, 23.79, true, 'v2'],
    [64, 'G500 Miguel Ángel de Quevedo', 48360, 15.0, 24.05, false, 'v1'],
    [46, 'Pemex Av. Universidad', 48610, 26.8, 24.19, true, 'v1'],
    [28, 'Mobil Periférico Sur', 49055, 33.9, 24.29, true, 'v1'],
    [20, 'BP Río Churubusco', 61815, 26.3, 24.29, true, 'v2'],
    [10, 'Shell Insurgentes Sur', 49505, 35.6, 24.35, true, 'v1'],
  ];
  const fuel: Fuel[] = FU.map(([a, st, odo, l, p, full, v], i) => ({
    id: 'f' + (i + 1),
    date: d(a),
    station: st,
    odometer: odo,
    liters: l,
    price: p,
    full,
    vehicleId: v,
  }));
  return {
    version: DATA_VERSION,
    vehicles,
    places,
    trips,
    fuel,
    settings: {
      defaultVehicle: 'v1',
      defaultTag: 'Trabajo',
      hints: true,
      lastBackup: null,
      computerUnit: 'kmpl',
      odoMode: 'end',
    },
    ui: {},
  };
}
