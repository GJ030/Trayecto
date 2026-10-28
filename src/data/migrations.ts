/** Migraciones del modelo de datos (v1 → v2). */
import { resolvePoints, syncRoute } from './routes';
import { DATA_VERSION, cleanPlace, type Raw } from './schema';

/* v1 → v2: asigna lat/lng a los lugares de ejemplo (por nombre) y genera los points que faltan; no borra nada.
   También completa pointsSource en los viajes v2 que aún no lo tienen y regenera las rutas 'auto' que no se guardaron (ver stringifyData) */
/* Descarta la ruta calculada de un viaje si ya no coincide con las ubicaciones actuales de sus lugares */
function freshRoute(t: Raw, places: Raw): Raw {
  if (!t || !t.route) return t;
  const h = {
    origin: t.origin,
    destination: t.destination,
    pointsSource: t.pointsSource,
    waypoints: t.waypoints,
    route: t.route,
  };
  syncRoute(h, places, false, false);
  if (h.route === t.route) return t;
  const { route, ...rest } = t;
  void route;
  return h.route ? { ...rest, route: h.route } : rest;
}
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
  const trips = (Array.isArray(d.trips) ? d.trips : []).map((t: Raw) => {
    if (!(old || fix(t))) return t;
    const f = freshRoute(t, places);
    return { ...f, ...resolvePoints(f, f.points, f.pointsSource, places) };
  });
  return { ...d, version: DATA_VERSION, places, trips };
}
