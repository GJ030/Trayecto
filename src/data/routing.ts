/**
 * Servicio de ruteo por calles reales (OSRM). Es lo único de la app que envía datos de los viajes a un servicio
 * externo: las coordenadas de origen, destino y puntos intermedios. Solo se usa con «Rutas por calles reales»
 * activado en Ajustes.
 */
import type { LatLng, RouteLine } from './schema';
import { validGeo } from '@/shared/utils/geo';
import { hashStr } from '@/shared/utils/math';

/** Máximo de puntos intermedios por viaje. */
export const MAX_WAYPOINTS = 20;
/** Configuración del servicio de ruteo: cambia aquí la URL para usar otro servicio o un OSRM propio. */
export const ROUTING = {
  /** Servidor público de demostración de OSRM (pide como máximo 1 petición por segundo y atribución). */
  baseUrl: 'https://router.project-osrm.org/route/v1',
  profile: 'driving',
  /** Separación mínima entre dos peticiones. */
  minIntervalMs: 1000,
  /** Margen extra sobre la separación mínima, por la imprecisión de los temporizadores (no pasar nunca de 1 petición por segundo). */
  safetyMs: 50,
  timeoutMs: 15000,
  attribution: 'Rutas: OSRM · © OpenStreetMap contributors',
  /** Espera creciente (duplica en cada fallo) ante fallos recuperables: sin conexión, tiempo agotado, HTTP 429 o 5xx. */
  retry: {
    baseMs: 5000,
    /** HTTP 429 (exceso de peticiones): se espera más. */
    rateLimitBaseMs: 30000,
    maxMs: 300000,
    /** Tras tantos fallos seguidos la cola se detiene y espera a que vuelva la conexión o a que se lance a mano. */
    maxStreak: 6,
  },
  maxWaypoints: MAX_WAYPOINTS,
};
/** Servidor al que se envían las coordenadas (para el texto de privacidad). */
export const routingHost = (cfg = ROUTING) => {
  try {
    return new URL(cfg.baseUrl).host;
  } catch (e) {
    return cfg.baseUrl;
  }
};

export type RoutingErrorKind =
  /** Datos de entrada inválidos: no se hizo ninguna petición. */
  | 'input'
  /** Sin conexión o petición fallida. */
  | 'network'
  | 'timeout'
  /** El servicio respondió con un error HTTP (p. ej. 429 por exceso de peticiones). */
  | 'http'
  /** El servicio no encontró un camino entre los puntos. */
  | 'noroute'
  /** Respuesta que no se entiende. */
  | 'invalid'
  /** Cancelada desde fuera (no es un fallo del servicio). */
  | 'aborted';
export class RoutingError extends Error {
  constructor(
    public kind: RoutingErrorKind,
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'RoutingError';
  }
}
/** Resultado de una consulta: la geometría completa (sin simplificar), metros y segundos. */
export interface RouteResult {
  geometry: RouteLine;
  distance: number;
  duration: number;
}
/* Coordenadas con 6 decimales (la precisión de OSRM) y sin notación científica */
const fmt = (n: number) => String(+n.toFixed(6));
/** Huella de lo que se pide al servicio: si cambia un extremo o un punto intermedio, la ruta guardada ya no vale. */
export const routeSig = (pts: LatLng[]) =>
  hashStr(pts.map((p) => fmt(p.lat) + ',' + fmt(p.lng)).join(';')).toString(36);

/** URL de la consulta: origen, puntos intermedios y destino, en ese orden (OSRM espera lng,lat). */
export function routeUrl(pts: LatLng[], cfg = ROUTING) {
  const path = pts.map((p) => `${fmt(p.lng)},${fmt(p.lat)}`).join(';');
  return `${cfg.baseUrl.replace(/\/+$/, '')}/${cfg.profile}/${path}?overview=full&geometries=geojson&steps=false`;
}
export interface FetchRouteOpts {
  cfg?: typeof ROUTING;
  fetch?: typeof fetch;
  signal?: AbortSignal;
}
/**
 * Pide la ruta por calles entre `pts` (origen, puntos intermedios, destino). No limita la frecuencia: eso lo hace
 * la cola de la aplicación. Lanza RoutingError con `kind` para decidir si reintentar.
 */
export async function fetchRoute(pts: LatLng[], opts: FetchRouteOpts = {}): Promise<RouteResult> {
  const cfg = opts.cfg ?? ROUTING;
  if (
    pts.length < 2 ||
    pts.length > 2 + cfg.maxWaypoints ||
    !pts.every((p) => validGeo(p.lat, p.lng))
  )
    throw new RoutingError('input', 'Hacen falta un origen y un destino con ubicación.');
  const ctl = new AbortController();
  const timer = setTimeout(
    () => ctl.abort(new RoutingError('timeout', 'El servicio tardó demasiado')),
    cfg.timeoutMs,
  );
  const onAbort = () => ctl.abort(opts.signal!.reason);
  opts.signal?.addEventListener('abort', onAbort);
  try {
    let res: Response;
    try {
      res = await (opts.fetch ?? fetch)(routeUrl(pts, cfg), { signal: ctl.signal });
    } catch (e) {
      const reason = ctl.signal.aborted ? ctl.signal.reason : null;
      if (reason instanceof RoutingError) throw reason;
      if (opts.signal?.aborted) throw new RoutingError('aborted', 'Cancelada');
      throw new RoutingError('network', (e as Error)?.message || 'Sin conexión');
    }
    let body: unknown = null;
    try {
      body = await res.json();
    } catch (e) {
      /* sin cuerpo JSON: se decide por el estado HTTP */
    }
    const b = body as {
      code?: string;
      routes?: { geometry?: RouteLine; distance?: number; duration?: number }[];
    } | null;
    if (b && (b.code === 'NoRoute' || b.code === 'NoSegment'))
      throw new RoutingError('noroute', 'No hay un camino entre esos puntos', res.status);
    if (!res.ok) throw new RoutingError('http', `El servicio respondió ${res.status}`, res.status);
    const r = b && b.code === 'Ok' ? b.routes?.[0] : undefined;
    const g = r?.geometry;
    if (
      !r ||
      !g ||
      g.type !== 'LineString' ||
      !Array.isArray(g.coordinates) ||
      g.coordinates.length < 2 ||
      !g.coordinates.every((c) => Array.isArray(c) && validGeo(c[1], c[0])) ||
      typeof r.distance !== 'number' ||
      !isFinite(r.distance) ||
      typeof r.duration !== 'number' ||
      !isFinite(r.duration)
    )
      throw new RoutingError('invalid', 'Respuesta inesperada del servicio');
    return {
      geometry: { type: 'LineString', coordinates: g.coordinates.map(([x, y]) => [x, y]) },
      distance: r.distance,
      duration: r.duration,
    };
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onAbort);
  }
}
