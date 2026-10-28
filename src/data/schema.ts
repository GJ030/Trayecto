/**
 * Modelo de datos: fuente única de verdad. Aquí viven los tipos de los registros, sus constantes,
 * el saneado y la validación. El resto de la aplicación importa los tipos de este archivo.
 */
import { decodePolyline, encodePolyline } from './polyline';
import { MAX_WAYPOINTS } from './routing';
import { resolvePoints, syncRoute } from './routes';
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
/** Qué captura el usuario en el formulario de viaje: el odómetro final o la distancia recorrida. */
export const ODO_MODES = ['end', 'dist'] as const;
export type OdoMode = (typeof ODO_MODES)[number];
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
export interface LatLng {
  lat: number;
  lng: number;
}
/** Geometría de una ruta (GeoJSON LineString, puntos como [lng, lat]). */
export interface RouteLine {
  type: 'LineString';
  coordinates: [number, number][];
}
/** 'ok' = ruta calculada; 'pending' = no se pudo calcular (se dibuja la recta punteada y se reintenta). */
export const ROUTE_STATUSES = ['ok', 'pending'] as const;
export type RouteStatus = (typeof ROUTE_STATUSES)[number];
/**
 * Ruta por calles reales de un viaje. La geometría solo se guarda en el archivo de datos (y sus copias):
 * el localStorage conserva únicamente estos datos ligeros. Con `status: 'ok'` y sin `geometry`, la geometría
 * aún no se ha cargado del archivo (no es lo mismo que «pendiente»).
 */
export interface TripRoute {
  status: RouteStatus;
  /** Huella de lo que se pidió (coordenadas de origen, destino y puntos intermedios). */
  sig: string;
  /** Metros y segundos que estimó el servicio de ruteo. */
  distance: number | null;
  duration: number | null;
  /** Número de vértices de la geometría (para compararla sin cargarla). */
  n: number;
  geometry?: RouteLine;
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
  /** Puntos intermedios que fuerzan el camino (opcional). */
  waypoints?: LatLng[];
  /** Ruta por calles reales (opcional: solo con «Rutas por calles reales» activado). */
  route?: TripRoute;
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
  /** Último modo de captura del odómetro usado en el formulario de viaje. */
  odoMode: OdoMode;
  /** «Rutas por calles reales (usa OSRM)»: preferencia de este equipo, apagada por omisión. */
  routing: boolean;
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
    const r = cleanRoute(t.route, false);
    if (r) t.route = r;
    else delete t.route;
    const w = cleanWaypoints(t.waypoints);
    if (w.length) t.waypoints = w;
    else delete t.waypoints;
  });
  o.settings = Object.assign(
    {
      defaultVehicle: o.vehicles[0]?.id || null,
      defaultTag: 'Trabajo',
      hints: true,
      lastBackup: null,
      computerUnit: 'kmpl',
      odoMode: 'end',
      routing: false,
    },
    o.settings || {},
  );
  if (!ODO_MODES.includes(o.settings.odoMode)) o.settings.odoMode = 'end';
  o.settings.routing = o.settings.routing === true;
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
/* ---------------- Rutas por calles reales ---------------- */
const MAX_ROUTE_VERTICES = 200000;
const okLngLat = (c: unknown): c is [number, number] =>
  Array.isArray(c) && c.length >= 2 && validGeo(c[1], c[0]);
/** Puntos intermedios válidos (como máximo MAX_WAYPOINTS). */
export function cleanWaypoints(w: unknown): LatLng[] {
  if (!Array.isArray(w)) return [];
  return w
    .filter((p) => p && validGeo(p.lat, p.lng))
    .slice(0, MAX_WAYPOINTS)
    .map((p) => ({ lat: p.lat, lng: p.lng }));
}
/**
 * Ruta de un viaje ya saneada, o null si no es utilizable. La geometría puede venir como GeoJSON
 * (`geometry`) o como polyline de precisión 1e-6 (`poly`, el formato del archivo).
 * `strict` (archivos e importaciones): se validan todos los vértices y una ruta «ok» sin geometría pasa
 * a «pendiente». Sin `strict` (caché del navegador, que no guarda geometrías) solo se revisa la forma.
 */
export function cleanRoute(r: Raw, strict: boolean): TripRoute | null {
  if (!r || typeof r !== 'object') return null;
  if (!ROUTE_STATUSES.includes(r.status) || typeof r.sig !== 'string' || !r.sig) return null;
  let coords: unknown = null;
  if (r.geometry && r.geometry.type === 'LineString') coords = r.geometry.coordinates;
  else if (typeof r.poly === 'string') {
    try {
      coords = decodePolyline(r.poly, 6);
    } catch (e) {
      coords = null;
    }
  }
  let geometry: RouteLine | undefined;
  if (Array.isArray(coords) && coords.length <= MAX_ROUTE_VERTICES) {
    const c = strict ? coords.filter(okLngLat) : coords;
    if (c.length >= 2 && (strict || okLngLat(c[0])))
      geometry = {
        type: 'LineString',
        coordinates: strict
          ? c.map(([x, y]) => [x, y] as [number, number])
          : (c as [number, number][]),
      };
  }
  const num = (v: unknown) => (typeof v === 'number' && isFinite(v) && v >= 0 ? v : null);
  let status: RouteStatus = r.status;
  if (status === 'ok' && !geometry && strict) status = 'pending';
  const keep = status === 'ok' && geometry;
  return {
    status,
    sig: r.sig,
    distance: status === 'ok' ? num(r.distance) : null,
    duration: status === 'ok' ? num(r.duration) : null,
    n: keep
      ? geometry!.coordinates.length
      : status === 'ok' && Number.isInteger(r.n) && r.n > 0
        ? r.n
        : 0,
    ...(keep ? { geometry } : {}),
  };
}
/**
 * Incorpora a los viajes del estado las geometrías que trae el archivo de datos (por id y huella) y pasa a
 * «pendiente» las rutas «ok» cuya geometría no está en el archivo (`file` null = no hay archivo).
 * Devuelve los viajes tocados.
 */
export function hydrateRoutes(
  mem: Trip[],
  file: Trip[] | null,
): { attached: Trip[]; downgraded: Trip[] } {
  const byId = new Map((file || []).map((t) => [t.id, t]));
  const attached: Trip[] = [],
    downgraded: Trip[] = [];
  for (const t of mem) {
    const r = t.route;
    if (!r || r.status !== 'ok' || r.geometry) continue;
    const g = byId.get(t.id)?.route;
    if (g && g.status === 'ok' && g.geometry && g.sig === r.sig) {
      r.geometry = g.geometry;
      r.n = g.geometry.coordinates.length;
      attached.push(t);
    } else {
      t.route = { status: 'pending', sig: r.sig, distance: null, duration: null, n: 0 };
      downgraded.push(t);
    }
  }
  return { attached, downgraded };
}
/** ¿Hay rutas «ok» cuya geometría aún no se ha cargado del archivo? */
export const hasUnloadedRoutes = (trips: Trip[]) =>
  trips.some((t) => t.route && t.route.status === 'ok' && !t.route.geometry);

/* ---------------- Texto JSON de los datos ---------------- */
export interface StringifyOpts {
  /** 'omit-auto' (por omisión): no escribe los points de las rutas generadas por la app, se regeneran al leer. */
  points?: 'omit-auto' | 'all';
  /** 'omit' (por omisión, caché del navegador): sin geometrías. 'poly': geometría como polyline 1e-6 (archivo y respaldo). */
  routes?: 'omit' | 'poly';
  indent?: number;
}
/* Texto JSON para guardar. La caché del navegador (localStorage) no lleva geometrías ni las rutas generadas por la app
   (points 'auto'); el archivo de datos y el respaldo manual sí llevan la geometría en polyline. */
export function stringifyData(v: unknown, o: StringifyOpts = {}): string {
  const all = o.points === 'all',
    poly = o.routes === 'poly';
  return JSON.stringify(
    v,
    function (this: Raw, key: string, val: Raw) {
      if (key === 'points' && !all && this && this.pointsSource === 'auto') return undefined;
      if (key === 'route' && val && typeof val === 'object' && !Array.isArray(val))
        return {
          ...val,
          geometry: undefined,
          poly: poly && val.geometry ? encodePolyline(val.geometry.coordinates, 6) : undefined,
        };
      return val;
    },
    o.indent,
  );
}
/* Clave para comparar dos versiones de los datos: ignora la geometría (solo vive en el archivo; basta su número de
   vértices) y las preferencias de este equipo (hints, lastBackup, routing) */
export const canonKey = (d: BackupData) =>
  JSON.stringify({
    ...d,
    trips: d.trips.map((t) =>
      t.route?.geometry ? { ...t, route: { ...t.route, geometry: undefined } } : t,
    ),
    settings: { ...d.settings, hints: undefined, lastBackup: undefined, routing: undefined },
  });
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
      const w = cleanWaypoints(t.waypoints),
        r = cleanRoute(t.route, true);
      /* la ruta calculada solo vale si sigue coincidiendo con las ubicaciones actuales; se decide antes de derivar los puntos */
      const h: {
        origin: string;
        destination: string;
        pointsSource: PointsSource;
        waypoints?: LatLng[];
        route?: TripRoute;
      } = {
        origin: c.origin,
        destination: c.destination,
        pointsSource: t.pointsSource === 'imported' ? 'imported' : 'auto',
        ...(w.length ? { waypoints: w } : {}),
        ...(r ? { route: r } : {}),
      };
      syncRoute(h, places, false, false);
      Object.assign(
        c,
        cleanComputer(t.computerKmpl, t.computerUnit),
        h.waypoints ? { waypoints: h.waypoints } : {},
        h.route ? { route: h.route } : {},
      );
      /* los puntos se derivan de la ruta vigente, así que ya debe estar en el viaje */
      const out = Object.assign(c, resolvePoints(c, t.points, t.pointsSource, places)) as Trip;
      return out;
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
> & {
  computerKmpl?: number | null;
  computerUnit?: ComputerUnit | null;
  /** Modo de captura del odómetro con que se llenó el formulario (solo se recuerda como preferencia). */
  odoMode?: OdoMode;
};
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
