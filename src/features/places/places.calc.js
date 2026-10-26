import { S } from '@/data/store';
import { tripDur, tripKm } from '@/features/trips/trips.calc';
import { placePos, placeXY } from '@/maps/svg';
import { hashStr } from '@/shared/utils/math';
import { norm } from '@/shared/utils/norm';

export function placeVisits() {
  const m = {};
  for (const p of S.places) {
    const n = norm(p.name);
    m[p.id] = S.trips.filter((t) => norm(t.origin) === n || norm(t.destination) === n).length;
  }
  return m;
}
export function pairStats() {
  const m = new Map();
  for (const t of S.trips) {
    const k = norm(t.origin) + '→' + norm(t.destination);
    let o = m.get(k);
    if (!o) {
      o = { key: k, from: t.origin, to: t.destination, n: 0, min: 0, km: 0 };
      m.set(k, o);
    }
    o.n++;
    o.min += tripDur(t);
    o.km += tripKm(t);
  }
  return [...m.values()]
    .map((o) => ({ ...o, avgMin: o.min / o.n, avgKm: o.km / o.n }))
    .sort((a, b) => b.n - a.n || a.avgMin - b.avgMin);
}
/* Ubica un lugar nuevo: cerca del lugar de referencia según los km del viaje (~18 px/km) y lejos de los demás pines */
export function newPlacePos(name, anchor, km) {
  const h = hashStr(norm(name)),
    a = anchor ? placePos(anchor) : null;
  let best = null,
    bestD = -1;
  for (let i = 0; i < 48; i++) {
    let x, y;
    if (a && km) {
      const ang = (((h % 360) + i * 37) * Math.PI) / 180,
        r = Math.min(380, Math.max(70, km * 18)) * (1 + (i % 4) * 0.08);
      x = a.x + Math.cos(ang) * r;
      y = a.y + Math.sin(ang) * r;
    } else {
      const hh = hashStr(norm(name) + i);
      x = 70 + (hh % 660);
      y = 50 + ((hh >>> 10) % 420);
    }
    x = Math.max(50, Math.min(750, x));
    y = Math.max(40, Math.min(480, y));
    const d = Math.min(
      9999,
      ...S.places
        .map(placeXY)
        .filter(Boolean)
        .map((q) => Math.hypot(q.x - x, q.y - y)),
    );
    if (d >= 90) return { x: Math.round(x), y: Math.round(y) };
    if (d > bestD) {
      bestD = d;
      best = { x: Math.round(x), y: Math.round(y) };
    }
  }
  return best;
}
/* Los viajes guardan origin/destination como texto y se enlazan por norm(nombre): renombrar o fusionar reescribe ese texto en los viajes (nunca sus points, salvo regenerar las rutas 'auto' al fusionar).
   Eliminar y fusionar se pueden deshacer ~6 s: se guardan solo los campos que cambian y se restauran por referencia. */
export const KINDS = [
  ['home', 'Casa'],
  ['work', 'Trabajo'],
  ['gym', 'Gimnasio'],
  ['family', 'Familia'],
  ['other', 'Otro'],
];
export const tripsOf = (p) => {
  const n = norm(p.name);
  return S.trips.filter((t) => norm(t.origin) === n || norm(t.destination) === n);
};
export const nTrips = (n) => `${n} ${n === 1 ? 'viaje' : 'viajes'}`;
