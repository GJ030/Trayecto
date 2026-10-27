/**
 * Modelo de datos: fuente única de verdad. Aquí viven los tipos de los registros, sus constantes,
 * el saneado y la validación. El resto de la aplicación importa los tipos de este archivo.
 */
import { resolvePoints } from './routes';
import { validGeo } from '@/shared/utils/geo';
import { fin } from '@/shared/utils/math';
import { norm } from '@/shared/utils/norm';
import { uid } from '@/shared/utils/uid';

/** Entrada sin confiar (JSON importado, localStorage, archivo de datos): se sanea antes de usarse. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Raw = any;

export const DATA_VERSION = 2;
export const PALETTE = ['#FFB020', '#6CA8FF', '#C3A6FF', '#3DDC97', '#FF8A65', '#4DD0E1'];

/* ---------------- Tipos del modelo (v2) ---------------- */
export const TAGS = ['Trabajo', 'Personal'] as const;
export type Tag = (typeof TAGS)[number];
export const COMPUTER_UNITS = ['kmpl', 'l100'] as const;
export type ComputerUnit = (typeof COMPUTER_UNITS)[number];
export const POINTS_SOURCES = ['auto', 'imported'] as const;
export type PointsSource = (typeof POINTS_SOURCES)[number];
export const VIEW_NAMES = [
  'inicio',
  'viajes',
  'gasolina',
  'lugares',
  'estadisticas',
  'vehiculos',
  'ajustes',
  'respaldo',
] as const;
export type ViewName = (typeof VIEW_NAMES)[number];
export const SORT_KEYS = ['date', 'route', 'tag', 'vehicle', 'km', 'dur', 'speed', 'cost'] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type PlacesLayer = 'lugares' | 'rutas' | 'calor';
export type StatTab = 'km' | 'gasto' | 'rend';

export interface Vehicle {
  id: string;
  name: string;
  year: number | '';
  plate: string;
  fuel: string;
  tank: number | '';
  color: string;
}
/** lat/lng reales; null = sin ubicación. Con lat/lng no se guarda x/y (se proyecta). */
export interface Place {
  id: string;
  name: string;
  area: string;
  lat: number | null;
  lng: number | null;
  kind: string;
  x?: number;
  y?: number;
}
export interface RoutePoint {
  lat: number;
  lng: number;
  t: string;
  speed: number;
}
export interface Trip {
  id: string;
  date: string;
  depart: string;
  arrive: string;
  origin: string;
  destination: string;
  odoStart: number;
  odoEnd: number;
  vehicleId: string;
  tag: Tag;
  points: RoutePoint[];
  pointsSource: PointsSource;
  computerKmpl: number | null;
  computerUnit: ComputerUnit | null;
}
export interface Fuel {
  id: string;
  date: string;
  station: string;
  odometer: number;
  liters: number;
  price: number;
  full: boolean;
  vehicleId: string;
}
export interface Settings {
  defaultVehicle: string | null;
  defaultTag: Tag;
  hints: boolean;
  lastBackup: string | null;
  computerUnit: ComputerUnit;
}
export interface TripFilter {
  tag: 'Todos' | Tag;
  vehicle: string;
  from: string;
  to: string;
}
/** Estado de pantalla que se conserva entre sesiones. */
export interface Ui {
  view: ViewName;
  collapsed: boolean;
  q: string;
  sort: { key: SortKey; dir: 'asc' | 'desc' };
  selTrip: string | null;
  ff: string;
  statTab: StatTab;
  dashVeh: string | null;
  selPlace: string | null;
  selPair: string | null;
  placesLayer: PlacesLayer;
  tf: TripFilter;
}
export interface AppData {
  version: number;
  vehicles: Vehicle[];
  places: Place[];
  trips: Trip[];
  fuel: Fuel[];
  settings: Settings;
  ui: Ui;
}
/** Lo que se guarda en un respaldo y en el archivo de datos (sin `ui`). */
export interface BackupData {
  vehicles: Vehicle[];
  places: Place[];
  trips: Trip[];
  fuel: Fuel[];
  settings: Partial<Settings>;
}
export interface BackupFile {
  app: 'Trayecto';
  version: number;
  exportedAt: string;
  data: BackupData;
}
export type ParsedBackup =
  | { error: string; data?: undefined; raw?: undefined }
  | {
      error?: undefined;
      data: BackupData;
      raw: { trips: number; fuel: number; vehicles: number; places: number };
    };

/* ---------------- Constantes y saneado ---------------- */
interface SeedGeo {
  lat: number;
  lng: number;
  x: number;
  y: number;
}
/* Coordenadas ficticias (zona de CDMX) de los lugares de ejemplo, por nombre normalizado. x/y = posición que tenían en el mapa SVG de la v1: solo sirven para reconocerlos al migrar */
export const SEED_GEO: Record<string, SeedGeo> = {
  casa: { lat: 19.32, lng: -99.11, x: 500, y: 430 },
  oficina: { lat: 19.4, lng: -99.14, x: 300, y: 175 },
  gimnasio: { lat: 19.35, lng: -99.12, x: 420, y: 330 },
  'casa de mis papas': { lat: 19.48, lng: -99.19, x: 135, y: 58 },
  'cliente santa fe': { lat: 19.34, lng: -99.21, x: 88, y: 300 },
};
/* Lugar saneado. Los lugares con lat/lng no guardan x/y (se proyectan); sin coordenadas conservan su posición estimada */
export function cleanPlace(p: Raw, legacy: boolean): Place {
  const name = String(p.name),
    sg = SEED_GEO[norm(name)];
  let lat: number | null = null,
    lng: number | null = null;
  if (validGeo(p.lat, p.lng)) {
    lat = p.lat;
    lng = p.lng;
  } else if (
    legacy &&
    sg &&
    (!fin(p.x) || (Math.abs(p.x - sg.x) < 1 && Math.abs(p.y - sg.y) < 1))
  ) {
    lat = sg.lat;
    lng = sg.lng;
  }
  const o: Place = {
    id: String(p.id || uid('p')),
    name,
    area: String(p.area || ''),
    lat,
    lng,
    kind: String(p.kind || 'other'),
  };
  if (lat == null && fin(p.x) && fin(p.y)) {
    o.x = +p.x;
    o.y = +p.y;
  }
  return o;
}
/* Rendimiento de la computadora del auto (opcional por viaje): se guarda normalizado en km/L (computerKmpl) y la unidad original (computerUnit) solo sirve para mostrarlo como se capturó.
   Fuera de 3–40 km/L (2.5–33.3 L/100 km) se descarta. Se usa al normalizar, importar y validar para que nunca haya valores absurdos */
export const CK_MIN = 3,
  CK_MAX = 40;
export function cleanComputer(k: unknown, u: unknown): Pick<Trip, 'computerKmpl' | 'computerUnit'> {
  const v = k == null || k === '' ? NaN : +(k as number);
  return v >= CK_MIN && v <= CK_MAX
    ? { computerKmpl: +v.toFixed(4), computerUnit: u === 'l100' ? 'l100' : 'kmpl' }
    : { computerKmpl: null, computerUnit: null };
}
export function normalize(d?: Raw): AppData {
  const o: Raw = Object.assign(
    { version: DATA_VERSION, vehicles: [], places: [], trips: [], fuel: [], settings: {}, ui: {} },
    d || {},
  );
  o.places.forEach((p: Place) => {
    if (p.lat === undefined) p.lat = null;
    if (p.lng === undefined) p.lng = null;
  });
  o.trips.forEach((t: Trip) => {
    if (!Array.isArray(t.points)) t.points = [];
    if (t.pointsSource !== 'auto' && t.pointsSource !== 'imported')
      t.pointsSource = t.points.length ? 'imported' : 'auto';
    Object.assign(t, cleanComputer(t.computerKmpl, t.computerUnit));
  });
  o.settings = Object.assign(
    {
      defaultVehicle: o.vehicles[0]?.id || null,
      defaultTag: 'Trabajo',
      hints: true,
      lastBackup: null,
      computerUnit: 'kmpl',
    },
    o.settings || {},
  );
  o.ui = Object.assign(
    {
      view: 'inicio',
      collapsed: false,
      q: '',
      sort: { key: 'date', dir: 'desc' },
      selTrip: null,
      ff: 'all',
      statTab: 'km',
      dashVeh: null,
      selPlace: null,
      selPair: null,
      placesLayer: 'lugares',
    },
    o.ui || {},
  );
  o.ui.tf = Object.assign({ tag: 'Todos', vehicle: 'all', from: '', to: '' }, o.ui.tf || {});
  o.ui.q = '';
  return o as AppData;
}
/* Texto JSON para guardar (localStorage y archivo de datos): las rutas generadas por la app (pointsSource 'auto') no se escriben,
   son deterministas y se regeneran al leer (migrate / parseBackup). Las rutas importadas sí se guardan. */
export function stringifyData(v: unknown, indent?: number): string {
  return JSON.stringify(
    v,
    function (this: Raw, key: string, val: unknown) {
      return key === 'points' && this && this.pointsSource === 'auto' ? undefined : val;
    },
    indent,
  );
}
/* Validación y saneado de un respaldo ya analizado (importar, leer el archivo de datos y validar antes de escribirlo).
   Devuelve {error} o {data:{vehicles,places,trips,fuel,settings}, raw:{conteos originales}}: lo que no pasa el filtro se descarta y se nota en raw */
export function parseBackup(o: Raw): ParsedBackup {
  const d = o && (o.data || o);
  if (!d || !Array.isArray(d.trips) || !Array.isArray(d.fuel) || !Array.isArray(d.vehicles))
    return { error: 'El archivo no parece un respaldo de Trayecto' };
  const ver = +((o && o.version) || d.version) || 1;
  if (ver > DATA_VERSION) return { error: 'El respaldo es de una versión más nueva de Trayecto' };
  const okDate = (s: Raw) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '').slice(0, 10));
  const okTime = (s: Raw) => /^\d{1,2}:\d{2}$/.test(String(s || ''));
  const vehicles: Vehicle[] = d.vehicles
    .filter((v: Raw) => v && v.name)
    .map((v: Raw, i: number) => ({
      id: String(v.id || uid('v')),
      name: String(v.name),
      year: v.year ? +v.year : '',
      plate: String(v.plate || ''),
      fuel: String(v.fuel || 'Magna'),
      tank: +v.tank || '',
      color: String(v.color || PALETTE[i % PALETTE.length]),
    }));
  const places: Place[] = (Array.isArray(d.places) ? d.places : [])
    .filter((p: Raw) => p && p.name)
    .map((p: Raw) => cleanPlace(p, ver < DATA_VERSION));
  const trips: Trip[] = d.trips
    .filter(
      (t: Raw) =>
        t &&
        okDate(t.date) &&
        okTime(t.depart) &&
        okTime(t.arrive) &&
        isFinite(t.odoStart) &&
        isFinite(t.odoEnd) &&
        t.origin &&
        t.destination,
    )
    .map((t: Raw) => {
      const c = {
        id: String(t.id || uid('t')),
        date: String(t.date).slice(0, 10),
        depart: t.depart,
        arrive: t.arrive,
        origin: String(t.origin),
        destination: String(t.destination),
        odoStart: +t.odoStart,
        odoEnd: +t.odoEnd,
        vehicleId: String(t.vehicleId || ''),
        tag: (t.tag === 'Personal' ? 'Personal' : 'Trabajo') as Tag,
      };
      return Object.assign(
        c,
        cleanComputer(t.computerKmpl, t.computerUnit),
        resolvePoints(c, t.points, t.pointsSource, places),
      );
    });
  const fuel: Fuel[] = d.fuel
    .filter(
      (f: Raw) =>
        f && okDate(f.date) && isFinite(f.odometer) && isFinite(f.liters) && isFinite(f.price),
    )
    .map((f: Raw) => ({
      id: String(f.id || uid('f')),
      date: String(f.date).slice(0, 10),
      station: String(f.station || 'Sin nombre'),
      odometer: +f.odometer,
      liters: +f.liters,
      price: +f.price,
      full: f.full !== false,
      vehicleId: String(f.vehicleId || ''),
    }));
  return {
    data: { vehicles, places, trips, fuel, settings: Object.assign({}, d.settings || {}) },
    raw: {
      trips: d.trips.length,
      fuel: d.fuel.length,
      vehicles: d.vehicles.length,
      places: Array.isArray(d.places) ? d.places.length : 0,
    },
  };
}

/* ---------------- Tipos derivados (cálculos sobre el modelo) ---------------- */
/** Resumen de un trayecto origen → destino (clave = nombres normalizados unidos con «→»). */
export interface PairStat {
  key: string;
  from: string;
  to: string;
  n: number;
  min: number;
  km: number;
  avgMin: number;
  avgKm: number;
}

/* ---------------- Validación de registros (la usan los repositorios) ---------------- */
/** Un registro no cumple el modelo: el mensaje es el primer problema encontrado. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
const okDate = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const okTime = (s: unknown) => typeof s === 'string' && /^\d{1,2}:\d{2}$/.test(s);
const num = (v: unknown) => typeof v === 'number' && isFinite(v);

/** Datos para crear o editar un viaje (sin id, ruta ni rendimiento ya saneado). */
export type TripInput = Pick<
  Trip,
  | 'date'
  | 'depart'
  | 'arrive'
  | 'origin'
  | 'destination'
  | 'odoStart'
  | 'odoEnd'
  | 'vehicleId'
  | 'tag'
> & { computerKmpl?: number | null; computerUnit?: ComputerUnit | null };
/** Devuelve el primer problema del viaje, o null si es válido. */
export function checkTrip(t: TripInput): string | null {
  if (!t.origin.trim()) return 'Escribe el lugar de origen.';
  if (!t.destination.trim()) return 'Escribe el lugar de destino.';
  if (!okDate(t.date)) return 'Elige la fecha.';
  if (!okTime(t.depart) || !okTime(t.arrive)) return 'Indica la hora de salida y de llegada.';
  if (t.depart === t.arrive) return 'La llegada debe ser distinta a la salida.';
  if (!num(t.odoStart) || t.odoStart < 0) return 'Captura el odómetro inicial.';
  if (!num(t.odoEnd)) return 'Captura el odómetro final.';
  if (t.odoEnd <= t.odoStart) return 'Debe ser mayor al inicial.';
  if (t.odoEnd - t.odoStart > 2000) return 'La distancia parece demasiado grande.';
  if (!TAGS.includes(t.tag)) return 'La etiqueta no es válida.';
  return null;
}
/** Datos para crear o editar una carga de gasolina. */
export type FuelInput = Omit<Fuel, 'id'>;
export function checkFuel(f: FuelInput): string | null {
  if (!okDate(f.date)) return 'Elige la fecha.';
  if (!f.station.trim()) return 'Escribe la gasolinera.';
  if (!num(f.odometer) || f.odometer <= 0) return 'Captura el odómetro.';
  if (!num(f.liters) || f.liters <= 0) return 'Captura los litros.';
  if (f.liters > 200) return 'Revisa la cantidad de litros.';
  if (!num(f.price) || f.price <= 0) return 'Captura el precio por litro.';
  if (f.price > 100) return 'Revisa el precio por litro.';
  return null;
}
export type VehicleInput = Omit<Vehicle, 'id' | 'color'> & { color?: string };
export function checkVehicle(v: VehicleInput): string | null {
  if (!v.name.trim()) return 'Escribe un nombre para el vehículo.';
  return null;
}
export function checkPlaceName(name: string): string | null {
  if (!name.trim()) return 'Escribe un nombre para el lugar.';
  return null;
}
/** Clave de orden cronológico de un viaje. */
export const tripKey = (t: Pick<Trip, 'date' | 'depart'>) => t.date + ' ' + t.depart;
