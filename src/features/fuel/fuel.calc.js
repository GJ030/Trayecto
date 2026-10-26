import { S } from '@/data/store';

export const fuelTotal = (f) => f.liters * f.price;
export let D = { kmpl: {}, vs: {}, latestPrice: 24.3 };
export function derive() {
  const kmpl = {},
    vs = {};
  let lp = null,
    ld = '';
  for (const f of S.fuel) {
    if (f.date >= ld) {
      ld = f.date;
      lp = f.price;
    }
  }
  for (const v of S.vehicles) {
    const loads = S.fuel
      .filter((f) => f.vehicleId === v.id)
      .sort((a, b) => a.odometer - b.odometer);
    let last = null,
      acc = 0,
      first = null,
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
      ...S.trips.filter((t) => t.vehicleId === v.id).map((t) => +t.odoEnd),
    );
    vs[v.id] = {
      avg: first != null && last > first && lit > 0 ? (last - first) / lit : null,
      lastPrice: byDate[0]?.price ?? null,
      odo,
      loads,
    };
  }
  D = { kmpl, vs, latestPrice: lp ?? 24.3 };
}
export const kmplOf = (vid) => D.vs[vid]?.avg || 12;
export const priceOf = (vid) => D.vs[vid]?.lastPrice || D.latestPrice;
export const cpkOf = (vid) => (D.vs[vid]?.avg ? priceOf(vid) / D.vs[vid].avg : null);
