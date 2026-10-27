/** Migraciones del modelo de datos (v1 → v2). */
import { resolvePoints } from './routes';
import { DATA_VERSION, cleanPlace, type Raw } from './schema';

/* v1 → v2: asigna lat/lng a los lugares de ejemplo (por nombre) y genera los points que faltan; no borra nada.
   También completa pointsSource en los viajes v2 que aún no lo tienen y regenera las rutas 'auto' que no se guardaron (ver stringifyData) */
export function migrate(d: Raw): Raw {
  if (!d) return d;
  const old = (+d.version || 1) < DATA_VERSION,
    ok = (s: unknown) => s === 'auto' || s === 'imported',
    fix = (t: Raw) =>
      t && (!ok(t.pointsSource) || (t.pointsSource === 'auto' && !Array.isArray(t.points)));
  if (!old && !(Array.isArray(d.trips) && d.trips.some(fix))) return d;
  const places = old
    ? (Array.isArray(d.places) ? d.places : [])
        .filter((p: Raw) => p && p.name)
        .map((p: Raw) => cleanPlace(p, true))
    : d.places;
  const trips = (Array.isArray(d.trips) ? d.trips : []).map((t: Raw) =>
    old || fix(t) ? { ...t, ...resolvePoints(t, t.points, t.pointsSource, places) } : t,
  );
  return { ...d, version: DATA_VERSION, places, trips };
}
