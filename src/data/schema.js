/** Modelo de datos: constantes, saneado y validación. */
import { resolvePoints } from './routes';
import { validGeo } from '@/shared/utils/geo';
import { fin } from '@/shared/utils/math';
import { norm } from '@/shared/utils/norm';
import { uid } from '@/shared/utils/uid';

export const DATA_VERSION = 2;
export const PALETTE = ['#FFB020', '#6CA8FF', '#C3A6FF', '#3DDC97', '#FF8A65', '#4DD0E1'];
/* Coordenadas reales (CDMX) de los lugares de ejemplo, por nombre normalizado. x/y = posición que tenían en el mapa SVG de la v1: solo sirven para reconocerlos al migrar */
export const SEED_GEO = {
  casa: { lat: 19.32, lng: -99.11, x: 500, y: 430 },
  oficina: { lat: 19.4, lng: -99.14, x: 300, y: 175 },
  gimnasio: { lat: 19.35, lng: -99.12, x: 420, y: 330 },
  'casa de mis papas': { lat: 19.48, lng: -99.19, x: 135, y: 58 },
  'cliente santa fe': { lat: 19.34, lng: -99.21, x: 88, y: 300 },
};
/* Lugar saneado. Los lugares con lat/lng no guardan x/y (se proyectan); sin coordenadas conservan su posición estimada */
export function cleanPlace(p, legacy) {
  const name = String(p.name),
    sg = SEED_GEO[norm(name)];
  let lat = null,
    lng = null;
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
  const o = {
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
export function cleanComputer(k, u) {
  const v = k == null || k === '' ? NaN : +k;
  return v >= CK_MIN && v <= CK_MAX
    ? { computerKmpl: +v.toFixed(4), computerUnit: u === 'l100' ? 'l100' : 'kmpl' }
    : { computerKmpl: null, computerUnit: null };
}
export function normalize(d) {
  const o = Object.assign(
    { version: DATA_VERSION, vehicles: [], places: [], trips: [], fuel: [], settings: {}, ui: {} },
    d || {},
  );
  o.places.forEach((p) => {
    if (p.lat === undefined) p.lat = null;
    if (p.lng === undefined) p.lng = null;
  });
  o.trips.forEach((t) => {
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
  return o;
}
/* Validación y saneado de un respaldo ya analizado (importar, leer el archivo de datos y validar antes de escribirlo).
   Devuelve {error} o {data:{vehicles,places,trips,fuel,settings}, raw:{conteos originales}}: lo que no pasa el filtro se descarta y se nota en raw */
export function parseBackup(o) {
  const d = o && (o.data || o);
  if (!d || !Array.isArray(d.trips) || !Array.isArray(d.fuel) || !Array.isArray(d.vehicles))
    return { error: 'El archivo no parece un respaldo de Trayecto' };
  const ver = +((o && o.version) || d.version) || 1;
  if (ver > DATA_VERSION) return { error: 'El respaldo es de una versión más nueva de Trayecto' };
  const okDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '').slice(0, 10));
  const okTime = (s) => /^\d{1,2}:\d{2}$/.test(String(s || ''));
  const vehicles = d.vehicles
    .filter((v) => v && v.name)
    .map((v, i) => ({
      id: String(v.id || uid('v')),
      name: String(v.name),
      year: v.year ? +v.year : '',
      plate: String(v.plate || ''),
      fuel: String(v.fuel || 'Magna'),
      tank: +v.tank || '',
      color: String(v.color || PALETTE[i % PALETTE.length]),
    }));
  const places = (Array.isArray(d.places) ? d.places : [])
    .filter((p) => p && p.name)
    .map((p) => cleanPlace(p, ver < DATA_VERSION));
  const trips = d.trips
    .filter(
      (t) =>
        t &&
        okDate(t.date) &&
        okTime(t.depart) &&
        okTime(t.arrive) &&
        isFinite(t.odoStart) &&
        isFinite(t.odoEnd) &&
        t.origin &&
        t.destination,
    )
    .map((t) => {
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
        tag: t.tag === 'Personal' ? 'Personal' : 'Trabajo',
      };
      return Object.assign(
        c,
        cleanComputer(t.computerKmpl, t.computerUnit),
        resolvePoints(c, t.points, t.pointsSource, places),
      );
    });
  const fuel = d.fuel
    .filter(
      (f) => f && okDate(f.date) && isFinite(f.odometer) && isFinite(f.liters) && isFinite(f.price),
    )
    .map((f) => ({
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
