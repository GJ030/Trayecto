/** Trazado, línea de tiempo y vigencia de las rutas (points) de los viajes. */
import { routeSig } from './routing';
import type { LatLng, Place, PointsSource, RoutePoint, Trip } from './schema';
import { parseDate, toMin } from '@/shared/utils/dates';
import { validGeo } from '@/shared/utils/geo';
import { hashStr, sum } from '@/shared/utils/math';
import { norm } from '@/shared/utils/norm';

/** Lo mínimo que hace falta de un viaje para trazar su ruta. */
export type RouteTrip = Pick<
  Trip,
  'id' | 'date' | 'depart' | 'arrive' | 'origin' | 'destination' | 'odoStart' | 'odoEnd'
> &
  Partial<Pick<Trip, 'route' | 'waypoints'>>;

function rng32(a: number) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const kmDist = (p: LatLng, q: LatLng, kx: number) =>
  Math.hypot((q.lng - p.lng) * kx, (q.lat - p.lat) * 111.2);
const lngKm = (lat: number) => 111.32 * Math.cos((lat * Math.PI) / 180);

/** Origen, puntos intermedios y destino con ubicación (lo que se le pide al servicio de ruteo); null si falta la de un extremo. */
export function routeStops(
  t: Pick<Trip, 'origin' | 'destination'> & Partial<Pick<Trip, 'waypoints'>>,
  places: Place[],
): LatLng[] | null {
  const byName = (n: string) => places.find((p) => norm(p.name) === norm(n));
  const a = byName(t.origin),
    b = byName(t.destination);
  if (!a || !b || !validGeo(a.lat, a.lng) || !validGeo(b.lat, b.lng)) return null;
  const mid = (t.waypoints || []).filter((w) => validGeo(w.lat, w.lng));
  return [
    { lat: a.lat as number, lng: a.lng as number },
    ...mid.map((w) => ({ lat: w.lat, lng: w.lng })),
    { lat: b.lat as number, lng: b.lng as number },
  ];
}

/* Cómo se dibuja la ruta de un viaje:
   'geometry' = calle por calle (calculada), 'imported' = ruta ajena, 'loading' = calculada pero su geometría aún no llega del
   archivo (solo marcadores, sin línea), 'straight' = sin ruta calculada o pendiente: recta punteada entre los puntos */
export type RouteKind = 'geometry' | 'imported' | 'loading' | 'straight';
export function routeKind(t: Pick<Trip, 'pointsSource' | 'route'>): RouteKind {
  if (t.pointsSource === 'imported') return 'imported';
  if (t.route && t.route.status === 'ok') return t.route.geometry ? 'geometry' : 'loading';
  return 'straight';
}
/** ¿El viaje tiene una geometría real (calculada o importada)? El mapa de calor y los trayectos frecuentes solo usan esos. */
export const hasRealRoute = (t: Pick<Trip, 'pointsSource' | 'route'>) => {
  const k = routeKind(t);
  return k === 'geometry' || k === 'imported';
};

/** ¿Hay que pedir su ruta? Viaje de la app con ruta «pendiente» que no falló de forma definitiva. */
export const needsRoute = (t: Pick<Trip, 'pointsSource' | 'route'>) =>
  t.pointsSource === 'auto' && t.route?.status === 'pending' && !t.route.error;

/** Datos de un viaje que definen su ruta calculada (el resto del viaje no la afecta). */
type RouteHolder = Pick<Trip, 'origin' | 'destination' | 'pointsSource'> &
  Partial<Pick<Trip, 'waypoints' | 'route'>>;
/**
 * Mantiene la ruta calculada de un viaje de la app al día con sus puntos. Si la huella de lo que se pidió ya no coincide
 * (cambió un extremo, un punto intermedio o la ubicación de un lugar) la geometría guardada deja de valer: pasa a
 * «pendiente» con el ruteo activado, o se descarta. Con `create` y el ruteo activado, un viaje sin ruta queda «pendiente».
 * Las rutas importadas no se tocan. Devuelve si cambió algo.
 */
export function syncRoute(t: RouteHolder, places: Place[], routingOn: boolean, create = true) {
  if (t.pointsSource === 'imported') return false;
  const stops = routeStops(t, places),
    r = t.route;
  if (!stops) {
    if (!r) return false;
    delete t.route;
    return true;
  }
  const sig = routeSig(stops);
  if (r && r.sig === sig) return false;
  if (routingOn && (r || create)) {
    t.route = { status: 'pending', sig, distance: null, duration: null, n: 0 };
    return true;
  }
  if (r) {
    delete t.route;
    return true;
  }
  return false;
}

/* Reparte n puntos a distancias iguales a lo largo de la polilínea (incluye el primero y el último) */
function resample(way: LatLng[], n: number): LatLng[] {
  const kx = lngKm(way[0].lat),
    cum = [0];
  for (let i = 1; i < way.length; i++) cum.push(cum[i - 1] + kmDist(way[i - 1], way[i], kx));
  const L = cum[cum.length - 1];
  const out: LatLng[] = [{ ...way[0] }];
  let j = 0;
  for (let k = 1; k < n - 1; k++) {
    const d = (L * k) / (n - 1);
    while (j < way.length - 2 && cum[j + 1] < d) j++;
    const seg = cum[j + 1] - cum[j],
      f = seg > 0 ? (d - cum[j]) / seg : 0;
    out.push({
      lat: way[j].lat + (way[j + 1].lat - way[j].lat) * f,
      lng: way[j].lng + (way[j + 1].lng - way[j].lng) * f,
    });
  }
  out.push({ ...way[way.length - 1] });
  return out;
}

/* Puntos del trazo con hora y velocidad: de la hora de salida a la de llegada, repartidos según distancia ÷ velocidad relativa
   (arranca y frena despacio, ruido suave y algunos semáforos); el promedio de speed es exactamente el del viaje.
   Determinista por id de viaje. */
function timeline(t: RouteTrip, pts: LatLng[]): RoutePoint[] {
  const rnd = rng32(hashStr('trayecto-ruta|' + t.id)),
    n = pts.length,
    kx = lngKm(pts[0].lat);
  const legs = pts.slice(1).map((p, i) => kmDist(pts[i], p, kx)),
    len = sum(legs),
    stepKm = len / Math.max(1, n - 1);
  const kmT = Math.max(0, +t.odoEnd - +t.odoStart);
  /* la correlación del ruido depende de la distancia entre puntos, no de cuántos haya */
  const phi = Math.pow(0.55, Math.max(stepKm, 0.01) / 0.2),
    wide = Math.max(0, Math.round(0.05 / Math.max(stepKm, 0.005)) - 1),
    slow = new Set<number>();
  for (let k = 0, c = Math.min(60, 1 + Math.floor(len / 4)); k < c; k++) {
    const at = 2 + Math.floor(rnd() * (n - 4));
    for (let w = 0; w <= wide && at + w < n - 1; w++) slow.add(at + w);
  }
  const r: number[] = [];
  let nz = 1;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    nz = phi * nz + (1 - phi) * (0.6 + rnd() * 0.8);
    r.push(clamp(0.2 + 4 * Math.min(u, 1 - u), 0, 1) * nz * (slow.has(i) ? 0.3 : 1));
    r[i] = Math.max(0.05, r[i]);
  }
  const s0 = parseDate(t.date),
    dm = toMin(t.depart);
  s0.setHours(Math.floor(dm / 60), dm % 60, 0, 0);
  let dur = toMin(t.arrive) - dm;
  if (dur <= 0) dur += 1440;
  const T0 = s0.getTime(),
    cum = [0];
  for (let i = 1; i < n; i++)
    cum.push(cum[i - 1] + (legs[i - 1] + 0.005) / Math.max(0.05, (r[i - 1] + r[i]) / 2));
  /* velocidades en décimas de km/h, ajustadas para que su promedio sea exactamente el del viaje */
  const target = kmT / (dur / 60),
    mr = sum(r) / n,
    sp = r.map((x) => Math.round((x / mr) * target * 10));
  let diff = Math.round(target * n * 10) - sum(sp);
  for (let i = 0, g = n * 60; diff !== 0 && g > 0; i++, g--) {
    const j = 1 + (i % (n - 2)),
      st = Math.sign(diff);
    if (sp[j] + st >= 0) {
      sp[j] += st;
      diff -= st;
    }
  }
  return pts.map((p, i) => ({
    lat: +p.lat.toFixed(6),
    lng: +p.lng.toFixed(6),
    t: new Date(
      i === n - 1 ? T0 + dur * 60000 : T0 + Math.round((cum[i] / cum[n - 1]) * dur * 60) * 1000,
    )
      .toISOString()
      .replace('.000Z', 'Z'),
    speed: sp[i] / 10,
  }));
}
/* Puntos con hora y velocidad de un viaje de la app, derivados de su ruta:
   - con geometría calculada: la geometría completa, remuestreada a pasos uniformes (~25 m, hasta 1 200 puntos);
   - sin ruta calculada o pendiente: la recta entre origen, puntos intermedios y destino (20–60 puntos);
   - calculada pero con la geometría aún sin cargar del archivo, o sin ubicación en algún extremo: [] (sin trazo).
   Determinista: la misma geometría da siempre los mismos puntos. */
export function tripPoints(t: RouteTrip, places: Place[]): RoutePoint[] {
  const stops = routeStops(t, places);
  if (!stops) return [];
  const kind = routeKind({ pointsSource: 'auto', route: t.route });
  if (kind === 'loading') return [];
  if (kind === 'geometry') {
    const way = t.route!.geometry!.coordinates.map(([lng, lat]) => ({ lat, lng }));
    const kx = lngKm(way[0].lat),
      km = sum(way.slice(1).map((p, i) => kmDist(way[i], p, kx)));
    return timeline(t, resample(way, clamp(Math.round(km * 40), 60, 1200)));
  }
  const kmT = Math.max(0, +t.odoEnd - +t.odoStart);
  return timeline(t, resample(stops, clamp(Math.round(12 + kmT * 1.6), 20, 60)));
}
/* Puntos válidos de un respaldo: descarta los inválidos y ordena por tiempo; null si no es un arreglo */
function cleanPoints(arr: unknown): RoutePoint[] | null {
  if (!Array.isArray(arr)) return null;
  return arr
    .filter(
      (p) =>
        p &&
        validGeo(p.lat, p.lng) &&
        typeof p.t === 'string' &&
        isFinite(Date.parse(p.t)) &&
        typeof p.speed === 'number' &&
        isFinite(p.speed) &&
        p.speed >= 0,
    )
    .map((p) => ({ lat: p.lat, lng: p.lng, t: p.t, speed: p.speed }))
    .sort((p, q) => Date.parse(p.t) - Date.parse(q.t));
}
/* Conserva los puntos guardados si son utilizables; si faltan, los genera (o [] si el viaje no tiene coordenadas).
   pointsSource: 'auto' = generados por la app (se regeneran al editar el viaje), 'imported' = ruta ajena (no se sobrescribe).
   Si el origen no se conoce, se compara con lo que generaría la app: idénticos → 'auto', distintos → 'imported' */
export function resolvePoints(
  t: RouteTrip,
  raw: unknown,
  src: unknown,
  places: Place[],
): { points: RoutePoint[]; pointsSource: PointsSource } {
  const c = cleanPoints(raw);
  if (!c || c.length < 2) return { points: tripPoints(t, places), pointsSource: 'auto' };
  let source: PointsSource;
  if (src === 'auto' || src === 'imported') source = src;
  else source = JSON.stringify(c) === JSON.stringify(tripPoints(t, places)) ? 'auto' : 'imported';
  return { points: c, pointsSource: source };
}
