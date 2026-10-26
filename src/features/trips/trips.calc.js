import { S } from '@/data/store';
import { kmplOf, priceOf } from '@/features/fuel/fuel.calc';
import { vehName } from '@/features/vehicles/vehicles.calc';
import { fmtDate, toMin } from '@/shared/utils/dates';
import { NF1 } from '@/shared/utils/format';
import { norm } from '@/shared/utils/norm';

export const tripDur = (t) => {
  let m = toMin(t.arrive) - toMin(t.depart);
  if (m <= 0) m += 1440;
  return m;
};
export const tripKm = (t) => Math.max(0, +t.odoEnd - +t.odoStart);
export const tripSpeed = (t) => {
  const m = tripDur(t);
  return m ? tripKm(t) / (m / 60) : 0;
};
export const tripKey = (t) => t.date + ' ' + t.depart;
export const tripsDesc = () => [...S.trips].sort((a, b) => tripKey(b).localeCompare(tripKey(a)));
/* Con rendimiento de la computadora el viaje usa ese valor; sin él, el promedio del vehículo */
export const compOf = (t) => (t.computerKmpl > 0 ? t.computerKmpl : null);
export const tripKmpl = (t) => compOf(t) || kmplOf(t.vehicleId);
export const tripLiters = (t) => tripKm(t) / tripKmpl(t);
export const tripCost = (t) => tripLiters(t) * priceOf(t.vehicleId);
export const fmtComp = (t) =>
  t.computerUnit === 'l100'
    ? `${NF1.format(100 / t.computerKmpl)} L/100 km`
    : `${NF1.format(t.computerKmpl)} km/L`;
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
  const val =
    {
      date: tripKey,
      route: (t) => norm(t.origin + ' ' + t.destination),
      tag: (t) => t.tag,
      vehicle: (t) => norm(vehName(t.vehicleId)),
      km: tripKm,
      dur: tripDur,
      speed: tripSpeed,
      cost: tripCost,
    }[key] || tripKey;
  return arr.sort((a, b) => {
    const x = val(a),
      y = val(b);
    return (x > y ? 1 : x < y ? -1 : 0) * m;
  });
}
