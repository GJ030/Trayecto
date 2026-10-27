/**
 * Repositorio de viajes: único lugar que modifica `S.trips`.
 * Valida con data/schema.ts, aplica las cascadas y emite el evento de cambio.
 */
import { tripPoints } from '@/data/routes';
import {
  ValidationError,
  checkTrip,
  cleanComputer,
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
const routeSig = (x: TripCore) =>
  [
    x.date,
    fromMin(toMin(x.depart)),
    fromMin(toMin(x.arrive)),
    x.origin,
    x.destination,
    +x.odoStart,
    +x.odoEnd,
  ].join('|');
/** Recuerda la última unidad del rendimiento de la computadora usada en el formulario. */
function rememberUnit(input: TripInput) {
  if (input.computerKmpl) S.settings.computerUnit = input.computerUnit === 'l100' ? 'l100' : 'kmpl';
}

export interface RetargetedTrip {
  trip: Trip;
  origin: string;
  destination: string;
  points: RoutePoint[];
}

export const tripsRepo = {
  list: (): readonly Trip[] => S.trips,
  get: (id: string) => S.trips.find((x) => x.id === id),
  /** Crea un viaje con su ruta generada ('auto'). */
  create(input: TripInput): Trip {
    const t = core(input, uid('t'));
    rememberUnit(input);
    const nt: Trip = Object.assign(t, {
      points: tripPoints(t, S.places),
      pointsSource: 'auto' as const,
    });
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
    const moved = routeSig(cur) !== routeSig(t);
    Object.assign(cur, { ...t, id: cur.id });
    if (cur.pointsSource === 'auto' && moved) cur.points = tripPoints(cur, S.places);
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
      changed.push({ trip: t, origin: t.origin, destination: t.destination, points: t.points });
      if (o) t.origin = toName;
      if (d) t.destination = toName;
    });
    changed.forEach((c) => {
      if (c.trip.pointsSource === 'auto') {
        const pts = tripPoints(c.trip, S.places);
        if (pts.length) c.trip.points = pts;
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
      }
    });
    if (changed.length) emitChange('trips');
  },
  /** Elimina todos los viajes de un vehículo. */
  removeByVehicle(vehicleId: string): number {
    const before = S.trips.length;
    S.trips = S.trips.filter((t) => t.vehicleId !== vehicleId);
    if (S.trips.length !== before) emitChange('trips');
    return before - S.trips.length;
  },
};
