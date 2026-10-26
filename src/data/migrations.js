/** Migraciones del modelo de datos (v1 → v2). */
import { resolvePoints } from './routes';
import { DATA_VERSION, cleanPlace } from './schema';

/* v1 → v2: asigna lat/lng a los lugares de ejemplo (por nombre) y genera los points que faltan; no borra nada.
   También completa pointsSource en los viajes v2 que aún no lo tienen */
export function migrate(d) {
  if (!d) return d;
  const old = (+d.version || 1) < DATA_VERSION,
    ok = (s) => s === 'auto' || s === 'imported';
  if (!old && !(Array.isArray(d.trips) && d.trips.some((t) => t && !ok(t.pointsSource)))) return d;
  const places = old
    ? (Array.isArray(d.places) ? d.places : [])
        .filter((p) => p && p.name)
        .map((p) => cleanPlace(p, true))
    : d.places;
  const trips = (Array.isArray(d.trips) ? d.trips : []).map((t) =>
    old || !ok(t.pointsSource)
      ? { ...t, ...resolvePoints(t, t.points, t.pointsSource, places) }
      : t,
  );
  return { ...d, version: DATA_VERSION, places, trips };
}
