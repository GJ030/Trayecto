/**
 * Repositorio de viajes: único lugar que modifica `S.trips`.
 * Valida con data/schema.ts, aplica las cascadas y emite el evento de cambio.
 */
import { syncRoute, tripPoints } from '@/data/routes';
import { setRouteSink } from '@/data/routingQueue';
import type { RouteResult } from '@/data/routing';
import {
  ValidationError,
  checkTrip,
  cleanComputer,
  type RouteError,
  type RoutePoint,
  type Trip,
  type TripInput,
} from '@/data/schema';
import { S, emitChange } from '@/data/store';
import { fromMin, toMin } from '@/shared/utils/dates';
import { norm } from '@/shared/utils/norm';
import { uid } from '@/shared/utils/uid';

type TripCore = Omit<Trip, 'points' | 'pointsSource'>;

function core(input: TripInput, id: string): TripCore {
  const problem = checkTrip(input);
  if (problem) throw new ValidationError(problem);
  return {
    id,
    date: input.date,
    depart: input.depart,
    arrive: input.arrive,
    origin: input.origin,
    destination: input.destination,
    odoStart: input.odoStart,
    odoEnd: input.odoEnd,
    vehicleId: input.vehicleId,
    tag: input.tag,
    ...cleanComputer(input.computerKmpl, input.computerUnit),
  };
}
/** Lo que define la ruta de un viaje: si cambia, una ruta generada por la app se regenera. */
const routeKey = (x: TripCore) =>
  [
    x.date,
    fromMin(toMin(x.depart)),
    fromMin(toMin(x.arrive)),
    x.origin,
    x.destination,
    +x.odoStart,
    +x.odoEnd,
  ].join('|');
/** Recuerda las últimas preferencias del formulario: unidad del rendimiento de la computadora y modo de captura del odómetro. */
function rememberUnit(input: TripInput) {
  if (input.computerKmpl) S.settings.computerUnit = input.computerUnit === 'l100' ? 'l100' : 'kmpl';
  if (input.odoMode) S.settings.odoMode = input.odoMode === 'dist' ? 'dist' : 'end';
}

export interface RetargetedTrip {
  trip: Trip;
  origin: string;
  destination: string;
  points: RoutePoint[];
  route: Trip['route'];
}

export const tripsRepo = {
  list: (): readonly Trip[] => S.trips,
  get: (id: string) => S.trips.find((x) => x.id === id),
  /** Crea un viaje con su ruta generada ('auto'). */
  create(input: TripInput): Trip {
    const t = core(input, uid('t'));
    rememberUnit(input);
    const nt: Trip = Object.assign(t, {
      points: [] as RoutePoint[],
      pointsSource: 'auto' as const,
    });
    syncRoute(nt, S.places, S.settings.routing);
    nt.points = tripPoints(nt, S.places);
    S.trips.push(nt);
    emitChange(['trips', 'settings']);
    return nt;
  },
  /** Edita un viaje en su lugar (mismo id). La ruta se regenera solo si la generó la app y cambió algo que la define. Devuelve null si ya no existe. */
  update(id: string, input: TripInput): Trip | null {
    const t = core(input, id);
    rememberUnit(input);
    const cur = S.trips.find((x) => x.id === id);
    if (!cur) return null;
    const moved = routeKey(cur) !== routeKey(t);
    Object.assign(cur, { ...t, id: cur.id });
    if (cur.pointsSource === 'auto') {
      /* la ruta calculada deja de valer si cambió un extremo; los puntos se derivan de la ruta vigente (o de la recta) */
      const changed = syncRoute(cur, S.places, S.settings.routing);
      if (moved || changed) cur.points = tripPoints(cur, S.places);
    }
    emitChange(['trips', 'settings']);
    return cur;
  },
  /** Elimina un viaje y limpia la selección. */
  remove(id: string): boolean {
    if (!S.trips.some((x) => x.id === id)) return false;
    S.trips = S.trips.filter((x) => x.id !== id);
    S.ui.selTrip = null;
    emitChange(['trips', 'ui']);
    return true;
  },

  /* ---- Operaciones propias (cascadas de lugares y vehículos) ---- */
  /** Cuántos viajes usan un lugar (por nombre normalizado) como origen o destino. */
  usingPlace(name: string): Trip[] {
    const n = norm(name);
    return S.trips.filter((t) => norm(t.origin) === n || norm(t.destination) === n);
  },
  /** Reescribe origen/destino de los viajes de un lugar sin tocar sus rutas. Devuelve cuántos viajes cambiaron. */
  renamePlace(oldName: string, newName: string): number {
    const on = norm(oldName);
    let k = 0;
    S.trips.forEach((t) => {
      let ch = false;
      if (norm(t.origin) === on) {
        t.origin = newName;
        ch = true;
      }
      if (norm(t.destination) === on) {
        t.destination = newName;
        ch = true;
      }
      if (ch) k++;
    });
    if (k) emitChange('trips');
    return k;
  },
  /** Regenera las rutas generadas por la app de los viajes que usan un lugar (p. ej. al ubicarlo). */
  regeneratePoints(placeName: string): number {
    const n = norm(placeName);
    let k = 0;
    S.trips.forEach((t) => {
      if (t.pointsSource === 'auto' && (norm(t.origin) === n || norm(t.destination) === n)) {
        syncRoute(t, S.places, S.settings.routing);
        t.points = tripPoints(t, S.places);
        k++;
      }
    });
    if (k) emitChange('trips');
    return k;
  },
  /**
   * Pasa los viajes de un lugar a otro (fusión). Las rutas generadas por la app se rehacen con las
   * coordenadas del destino; si no tiene ubicación (o la ruta ya era ajena) se conservan.
   */
  retargetPlace(fromName: string, toName: string): RetargetedTrip[] {
    const sn = norm(fromName);
    const changed: RetargetedTrip[] = [];
    S.trips.forEach((t) => {
      const o = norm(t.origin) === sn,
        d = norm(t.destination) === sn;
      if (!o && !d) return;
      changed.push({
        trip: t,
        origin: t.origin,
        destination: t.destination,
        points: t.points,
        route: t.route,
      });
      if (o) t.origin = toName;
      if (d) t.destination = toName;
    });
    changed.forEach((c) => {
      if (c.trip.pointsSource === 'auto') {
        syncRoute(c.trip, S.places, S.settings.routing);
        c.trip.points = tripPoints(c.trip, S.places);
      }
    });
    if (changed.length) emitChange('trips');
    return changed;
  },
  /** Deshace `retargetPlace` (solo los viajes que siguen existiendo). */
  restoreRetargeted(changed: RetargetedTrip[]) {
    changed.forEach((c) => {
      if (S.trips.includes(c.trip)) {
        c.trip.origin = c.origin;
        c.trip.destination = c.destination;
        c.trip.points = c.points;
        if (c.route) c.trip.route = c.route;
        else delete c.trip.route;
      }
    });
    if (changed.length) emitChange('trips');
  },
  /* ---- Rutas por calles reales (las usa la cola de data/routingQueue) ---- */
  /** Guarda la ruta calculada de un viaje si sigue pendiente y con la misma huella (si se editó mientras tanto, se descarta). */
  applyRoute(id: string, sig: string, r: RouteResult): boolean {
    const t = S.trips.find((x) => x.id === id);
    if (!t || t.pointsSource !== 'auto' || t.route?.status !== 'pending' || t.route.sig !== sig)
      return false;
    t.route = {
      status: 'ok',
      sig,
      distance: r.distance,
      duration: r.duration,
      n: r.geometry.coordinates.length,
      geometry: r.geometry,
    };
    t.points = tripPoints(t, S.places);
    emitChange('trips');
    return true;
  },
  /** Marca una ruta pendiente como fallida de forma definitiva (no se reintenta sola). */
  failRoute(id: string, sig: string, error: RouteError): boolean {
    const t = S.trips.find((x) => x.id === id);
    if (!t || t.pointsSource !== 'auto' || t.route?.status !== 'pending' || t.route.sig !== sig)
      return false;
    t.route = { ...t.route, error };
    emitChange('trips');
    return true;
  },
  /** Deja «pendientes» los viajes de la app con ubicación que aún no tienen ruta (al activar el ruteo). Devuelve cuántos. */
  queueMissingRoutes(): number {
    let k = 0;
    for (const t of S.trips) if (!t.route && syncRoute(t, S.places, true)) k++;
    if (k) emitChange('trips');
    return k;
  },
  /** Quita la marca de error a las rutas que fallaron para que se reintenten. Devuelve cuántas. */
  retryRouteErrors(): number {
    let k = 0;
    for (const t of S.trips)
      if (t.route?.status === 'pending' && t.route.error) {
        t.route = { ...t.route };
        delete t.route.error;
        k++;
      }
    if (k) emitChange('trips');
    return k;
  },
  /** Elimina todos los viajes de un vehículo. */
  removeByVehicle(vehicleId: string): number {
    const before = S.trips.length;
    S.trips = S.trips.filter((t) => t.vehicleId !== vehicleId);
    if (S.trips.length !== before) emitChange('trips');
    return before - S.trips.length;
  },
};

/* La cola de rutas (data/routingQueue) aplica sus resultados a través de este repositorio */
setRouteSink({
  apply: (id, sig, r) => tripsRepo.applyRoute(id, sig, r),
  fail: (id, sig, e) => tripsRepo.failRoute(id, sig, e),
});
