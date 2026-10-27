/** Cálculos de un viaje: distancia, duración, velocidad, litros y costo. */
import { tripKey, type Fuel, type OdoMode, type SortKey, type Trip } from '@/data/schema';
import { S } from '@/data/store';
import { D, kmplOf, priceOf } from '@/features/fuel/fuel.calc';
import { vehName } from '@/features/vehicles/vehicles.calc';
import type { CompAccuracy } from '@/shared/ui/blocks';
import { fmtDate, toMin } from '@/shared/utils/dates';
import { NF1 } from '@/shared/utils/format';
import { mean } from '@/shared/utils/math';
import { norm } from '@/shared/utils/norm';

/** Duración en minutos; si la llegada es anterior a la salida, el viaje cruza la medianoche. */
export const tripDur = (t: Pick<Trip, 'depart' | 'arrive'>) => {
  let m = toMin(t.arrive) - toMin(t.depart);
  if (m <= 0) m += 1440;
  return m;
};
/** Quita el ruido de coma flotante (0.1 + 0.2) sin perder los 3 decimales que captura el usuario. */
const round3 = (x: number) => Math.round(x * 1000) / 1000;
/**
 * Enlaza el odómetro final con la distancia recorrida. `source` es lo que el usuario está capturando
 * ('end' = odómetro final, 'dist' = distancia de la computadora); el otro valor se deriva del inicial.
 * Devuelve null para lo que no se puede calcular (faltan datos o no tiene sentido).
 */
export function linkOdometer(
  start: number,
  end: number,
  dist: number,
  source: OdoMode,
): { end: number | null; dist: number | null } {
  if (source === 'dist')
    return {
      end: isFinite(start) && isFinite(dist) && dist > 0 ? round3(start + dist) : null,
      dist: isFinite(dist) ? dist : null,
    };
  return {
    end: isFinite(end) ? end : null,
    dist: isFinite(start) && isFinite(end) && end > start ? round3(end - start) : null,
  };
}
export const tripKm = (t: Pick<Trip, 'odoStart' | 'odoEnd'>) =>
  Math.max(0, +t.odoEnd - +t.odoStart);
export const tripSpeed = (t: Trip) => {
  const m = tripDur(t);
  return m ? tripKm(t) / (m / 60) : 0;
};
export const tripsDesc = () => [...S.trips].sort((a, b) => tripKey(b).localeCompare(tripKey(a)));
/* Con rendimiento de la computadora el viaje usa ese valor; sin él, el promedio del vehículo */
export const compOf = (t: Pick<Trip, 'computerKmpl'>) =>
  t.computerKmpl != null && t.computerKmpl > 0 ? t.computerKmpl : null;
export const tripKmpl = (t: Trip) => compOf(t) || kmplOf(t.vehicleId);
export const tripLiters = (t: Trip) => tripKm(t) / tripKmpl(t);
export const tripCost = (t: Trip) => tripLiters(t) * priceOf(t.vehicleId);
export const fmtComp = (t: Trip) =>
  t.computerUnit === 'l100'
    ? `${NF1.format(100 / t.computerKmpl!)} L/100 km`
    : `${NF1.format(t.computerKmpl!)} km/L`;
export function filteredTrips() {
  const { tag, vehicle, from, to } = S.ui.tf,
    q = norm(S.ui.q);
  const arr = S.trips.filter(
    (t) =>
      (tag === 'Todos' || t.tag === tag) &&
      (vehicle === 'all' || t.vehicleId === vehicle) &&
      (!from || t.date >= from) &&
      (!to || t.date <= to) &&
      (!q ||
        norm(
          [
            t.origin,
            t.destination,
            vehName(t.vehicleId),
            t.tag,
            fmtDate(t.date, { day: 'numeric', month: 'long' }),
          ].join(' '),
        ).includes(q)),
  );
  const { key, dir } = S.ui.sort,
    m = dir === 'asc' ? 1 : -1;
  const sorters: Record<SortKey, (t: Trip) => string | number> = {
    date: tripKey,
    route: (t) => norm(t.origin + ' ' + t.destination),
    tag: (t) => t.tag,
    vehicle: (t) => norm(vehName(t.vehicleId)),
    km: tripKm,
    dur: tripDur,
    speed: tripSpeed,
    cost: tripCost,
  };
  const val = sorters[key] || tripKey;
  return arr.sort((a, b) => {
    const x = val(a),
      y = val(b);
    return (x > y ? 1 : x < y ? -1 : 0) * m;
  });
}
/* Precisión de la computadora de un vehículo: promedio de los rendimientos capturados contra el real de las cargas de tanque lleno cuyo intervalo
   (desde la carga llena anterior) toca el periodo de esos viajes. Requiere ≥3 viajes con dato y al menos una carga con rendimiento calculado */
export function compAccuracy(vid: string): CompAccuracy | null {
  const tr = S.trips.filter((t) => t.vehicleId === vid && compOf(t));
  if (tr.length < 3) return null;
  const from = tr.reduce((m, t) => (t.date < m ? t.date : m), tr[0].date),
    to = tr.reduce((m, t) => (t.date > m ? t.date : m), tr[0].date);
  const real: number[] = [];
  let prev: Fuel | null = null;
  for (const f of D.vs[vid]?.loads || []) {
    if (!f.full) continue;
    if (prev && D.kmpl[f.id] != null && f.date >= from && prev.date <= to) real.push(D.kmpl[f.id]);
    prev = f;
  }
  if (!real.length) return null;
  const comp = mean(tr.map((t) => compOf(t) as number)),
    r = mean(real);
  return { n: tr.length, loads: real.length, comp, real: r, pct: ((comp - r) / r) * 100, from, to };
}
