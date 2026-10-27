/**
 * Datos y utilidades compartidas por las pruebas. No forma parte de la aplicación: solo lo importan
 * los archivos `*.test.ts`. Las coordenadas son ficticias.
 */
import { normalize, type Fuel, type Place, type Trip, type Vehicle } from '@/data/schema';
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
