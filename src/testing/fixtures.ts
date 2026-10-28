/**
 * Datos y utilidades compartidas por las pruebas. No forma parte de la aplicación: solo lo importan
 * los archivos `*.test.ts`. Las coordenadas son ficticias.
 */
import { routeStops } from '@/data/routes';
import { routeSig } from '@/data/routing';
import {
  normalize,
  type Fuel,
  type LatLng,
  type Place,
  type Trip,
  type TripRoute,
  type Vehicle,
} from '@/data/schema';
import { seed } from '@/data/seed';
import { onChange, setS, type ChangeEvent } from '@/data/store';

export const place = (id: string, name: string, lat: number | null, lng: number | null): Place => ({
  id,
  name,
  area: '',
  lat,
  lng,
  kind: 'other',
});
/** Dos lugares con ubicación (separados ~6 km) y uno sin ubicación. */
export const makePlaces = (): Place[] => [
  place('pa', 'Alfa', 10.0, 10.0),
  place('pb', 'Beta', 10.04, 10.05),
  place('pc', 'Gama', null, null),
];
export const vehicle = (id: string, name = id): Vehicle => ({
  id,
  name,
  year: 2020,
  plate: '',
  fuel: 'Magna',
  tank: 40,
  color: '#FFB020',
});
export const trip = (over: Partial<Trip> = {}): Trip => ({
  id: 't1',
  date: '2024-06-15',
  depart: '08:00',
  arrive: '08:30',
  origin: 'Alfa',
  destination: 'Beta',
  odoStart: 1000,
  odoEnd: 1012,
  vehicleId: 'v1',
  tag: 'Trabajo',
  points: [],
  pointsSource: 'auto',
  computerKmpl: null,
  computerUnit: null,
  ...over,
});
export const load = (over: Partial<Fuel> = {}): Fuel => ({
  id: 'f1',
  date: '2024-06-01',
  station: 'Gasolinera',
  odometer: 1000,
  liters: 30,
  price: 20,
  full: true,
  vehicleId: 'v1',
  ...over,
});

/** Parte de datos de ejemplo conocidos (sin guardar nada). Devuelve el estado normalizado. */
export function resetState() {
  const d = normalize(seed());
  setS(d);
  return d;
}
/** Parte de un estado vacío con los vehículos, lugares, viajes y cargas indicados. */
export function setState(
  p: { vehicles?: Vehicle[]; places?: Place[]; trips?: Trip[]; fuel?: Fuel[] } = {},
) {
  const d = normalize({
    vehicles: p.vehicles ?? [],
    places: p.places ?? [],
    trips: p.trips ?? [],
    fuel: p.fuel ?? [],
    settings: { defaultVehicle: p.vehicles?.[0]?.id ?? null },
  });
  setS(d);
  return d;
}
/** Registra los eventos de cambio hasta llamar a `stop()`. */
export function recordEvents() {
  const events: ChangeEvent[] = [];
  const stop = onChange((e) => events.push(e));
  return { events, stop };
}
export const clone = <T>(v: T): T => structuredClone(v);

/** Geometría ficticia que serpentea entre dos puntos (n vértices, espaciado irregular), como la que devolvería un servicio de ruteo. */
export function windingLine(a: LatLng, b: LatLng, n = 30): [number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const f = (i / (n - 1)) ** 1.3;
    return [
      +(a.lng + (b.lng - a.lng) * f + Math.sin(i / 2) * 0.002).toFixed(6),
      +(a.lat + (b.lat - a.lat) * f + Math.cos(i / 3) * 0.0015).toFixed(6),
    ] as [number, number];
  });
}
/** Ruta calculada «ok» con la huella que le corresponde al viaje en esos lugares. */
export function routeFor(
  t: Pick<Trip, 'origin' | 'destination'> & Partial<Pick<Trip, 'waypoints'>>,
  places: Place[],
  coordinates: [number, number][] = [],
  over: Partial<TripRoute> = {},
): TripRoute {
  const stops = routeStops(t, places)!;
  const coords = coordinates.length ? coordinates : windingLine(stops[0], stops[stops.length - 1]);
  return {
    status: 'ok',
    sig: routeSig(stops),
    distance: 5234.5,
    duration: 612.3,
    n: coords.length,
    geometry: { type: 'LineString', coordinates: coords },
    ...over,
  };
}
