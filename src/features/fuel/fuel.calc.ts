/** Cálculos de combustible: km/L entre tanques llenos, precios y costo por km. */
import type { Fuel, Trip, Vehicle } from '@/data/schema';
import { S } from '@/data/store';

export const fuelTotal = (f: Fuel) => f.liters * f.price;

export interface VehicleStats {
  /** km/L promedio entre el primer y el último tanque lleno (null sin datos suficientes). */
  avg: number | null;
  lastPrice: number | null;
  /** Mayor odómetro conocido (cargas y viajes). */
  odo: number;
  /** Cargas del vehículo ordenadas por odómetro. */
  loads: Fuel[];
}
export interface Derived {
  /** km/L de cada carga de tanque lleno, por id de carga. */
  kmpl: Record<string, number>;
  vs: Record<string, VehicleStats>;
  latestPrice: number;
}
/**
 * Rendimiento entre tanques llenos: los litros de las cargas parciales intermedias se suman a la
 * siguiente carga llena. La primera carga llena solo sirve de referencia.
 */
export function computeDerived(vehicles: Vehicle[], fuel: Fuel[], trips: Trip[]): Derived {
  const kmpl: Record<string, number> = {},
    vs: Record<string, VehicleStats> = {};
  let lp: number | null = null,
    ld = '';
  for (const f of fuel) {
    if (f.date >= ld) {
      ld = f.date;
      lp = f.price;
    }
  }
  for (const v of vehicles) {
    const loads = fuel.filter((f) => f.vehicleId === v.id).sort((a, b) => a.odometer - b.odometer);
    let last: number | null = null,
      acc = 0,
      first: number | null = null,
      lit = 0;
    for (const f of loads) {
      acc += +f.liters;
      if (f.full) {
        if (last == null) {
          first = f.odometer;
        } else if (f.odometer > last) {
          kmpl[f.id] = (f.odometer - last) / acc;
          lit += acc;
        }
        last = f.odometer;
        acc = 0;
      }
    }
    const byDate = [...loads].sort(
      (a, b) => b.date.localeCompare(a.date) || b.odometer - a.odometer,
    );
    const odo = Math.max(
      0,
      ...loads.map((f) => +f.odometer),
      ...trips.filter((t) => t.vehicleId === v.id).map((t) => +t.odoEnd),
    );
    vs[v.id] = {
      avg: first != null && last != null && last > first && lit > 0 ? (last - first) / lit : null,
      lastPrice: byDate[0]?.price ?? null,
      odo,
      loads,
    };
  }
  return { kmpl, vs, latestPrice: lp ?? 24.3 };
}
export let D: Derived = { kmpl: {}, vs: {}, latestPrice: 24.3 };
export function derive() {
  D = computeDerived(S.vehicles, S.fuel, S.trips);
}
export const kmplOf = (vid: string) => D.vs[vid]?.avg || 12;
export const priceOf = (vid: string) => D.vs[vid]?.lastPrice || D.latestPrice;
export const cpkOf = (vid: string) => {
  const avg = D.vs[vid]?.avg;
  return avg ? priceOf(vid) / avg : null;
};
