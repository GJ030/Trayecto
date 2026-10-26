/** Generación y saneado de las rutas (points) de los viajes. */
import { parseDate, toMin } from '@/shared/utils/dates';
import { validGeo } from '@/shared/utils/geo';
import { hashStr, sum } from '@/shared/utils/math';
import { norm } from '@/shared/utils/norm';

function rng32(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* Ruta tipo calle entre dos lugares con lat/lng: tramos ortogonales, 20–60 puntos {lat,lng,t,speed}.
   Determinista por id de viaje; el promedio de speed coincide con la velocidad del viaje. Sin coordenadas en algún extremo devuelve [] */
export function tripPoints(t, places) {
  const byName = (n) => places.find((p) => norm(p.name) === norm(n));
  const a = byName(t.origin),
    b = byName(t.destination);
  if (!a || !b || !validGeo(a.lat, a.lng) || !validGeo(b.lat, b.lng)) return [];
  const rnd = rng32(hashStr('trayecto-ruta|' + t.id));
  const A = { lat: a.lat, lng: a.lng },
    B = { lat: b.lat, lng: b.lng };
  const kx = 111.32 * Math.cos((A.lat * Math.PI) / 180),
    ky = 111.2;
  const km = (p, q) => Math.hypot((q.lng - p.lng) * kx, (q.lat - p.lat) * ky);
  const lerp = (p, q, f) => ({
    lat: p.lat + (q.lat - p.lat) * f,
    lng: p.lng + (q.lng - p.lng) * f,
  });
  const dx = (B.lng - A.lng) * kx,
    dy = (B.lat - A.lat) * ky;
  let way = [A];
  if (Math.hypot(dx, dy) < 0.15) {
    const w = 0.004 * (1 + rnd() * 0.5) * (rnd() < 0.5 ? -1 : 1),
      h = 0.003 * (1 + rnd() * 0.5) * (rnd() < 0.5 ? -1 : 1);
    way.push(
      { lat: A.lat, lng: A.lng + w },
      { lat: A.lat + h, lng: A.lng + w },
      { lat: A.lat + h, lng: A.lng },
      B,
    );
  } else {
    const hFirst = Math.abs(dx) >= Math.abs(dy) ? rnd() < 0.75 : rnd() < 0.25,
      steps = 2 + Math.floor(rnd() * 3);
    const split = () => {
      const w = Array.from({ length: steps }, () => 0.35 + rnd()),
        s = sum(w);
      return w.map((x) => x / s);
    };
    const fh = split(),
      fv = split();
    let lat = A.lat,
      lng = A.lng;
    for (let i = 0; i < steps; i++)
      for (const ax of hFirst ? 'hv' : 'vh') {
        if (ax === 'h') lng += (B.lng - A.lng) * fh[i];
        else lat += (B.lat - A.lat) * fv[i];
        way.push({ lat, lng });
      }
    way[way.length - 1] = B;
    if (Math.min(Math.abs(dx), Math.abs(dy)) < 0.6) {
      /* trazo casi recto: un desvío a una calle paralela */
      let j = 0,
        best = -1;
      for (let i = 0; i < way.length - 1; i++) {
        const l = km(way[i], way[i + 1]);
        if (l > best) {
          best = l;
          j = i;
        }
      }
      if (best >= 0.8) {
        const u = way[j],
          v = way[j + 1],
          o = (0.25 + rnd() * 0.35) * (rnd() < 0.5 ? -1 : 1);
        const horiz = Math.abs(v.lng - u.lng) * kx > Math.abs(v.lat - u.lat) * ky;
        const off = (p) =>
          horiz ? { lat: p.lat + o / ky, lng: p.lng } : { lat: p.lat, lng: p.lng + o / kx };
        const s1 = lerp(u, v, 0.3),
          s3 = lerp(u, v, 0.7);
        way.splice(j + 1, 0, s1, off(s1), off(s3), s3);
      }
    }
  }
  const w2 = [way[0]];
  for (let i = 1; i < way.length - 1; i++)
    if (km(w2[w2.length - 1], way[i]) > 0.03) w2.push(way[i]);
  w2.push(way[way.length - 1]);
  const legs = w2.slice(1).map((p, i) => km(w2[i], p)),
    L = sum(legs) || 1;
  const kmT = Math.max(0, +t.odoEnd - +t.odoStart);
  const N = Math.max(w2.length, Math.min(60, Math.max(20, Math.round(12 + kmT * 1.6)))),
    E = N - w2.length;
  const raw = legs.map((l) => (E * l) / L),
    cnt = raw.map(Math.floor);
  raw
    .map((r, i) => [r - cnt[i], i])
    .sort((p, q) => q[0] - p[0] || p[1] - q[1])
    .slice(0, E - sum(cnt))
    .forEach(([, i]) => cnt[i]++);
  const pts = [{ ...w2[0] }];
  legs.forEach((_, j) => {
    const m = cnt[j];
    for (let k = 1; k <= m; k++) {
      const p = lerp(w2[j], w2[j + 1], (k + (rnd() - 0.5) * 0.5) / (m + 1));
      p.lat += (rnd() - 0.5) * 2.4e-5;
      p.lng += (rnd() - 0.5) * 2.4e-5;
      pts.push(p);
    }
    pts.push({ ...w2[j + 1] });
  });
  const n = pts.length;
  /* perfil de velocidad: arranca y frena despacio, ruido suave y algunos semáforos */
  const r = [],
    slow = new Set();
  let nz = 1;
  for (let k = 0, c = 1 + Math.floor(n / 14); k < c; k++) slow.add(2 + Math.floor(rnd() * (n - 4)));
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    nz = 0.55 * nz + 0.45 * (0.6 + rnd() * 0.8);
    r.push(
      Math.max(0.05, Math.min(1, 0.2 + 4 * Math.min(u, 1 - u)) * nz * (slow.has(i) ? 0.3 : 1)),
    );
  }
  /* tiempos: de la hora de salida a la de llegada, repartidos según distancia ÷ velocidad relativa */
  const s0 = parseDate(t.date),
    dm = toMin(t.depart);
  s0.setHours(Math.floor(dm / 60), dm % 60, 0, 0);
  let dur = toMin(t.arrive) - dm;
  if (dur <= 0) dur += 1440;
  const T0 = s0.getTime(),
    cum = [0];
  for (let i = 1; i < n; i++)
    cum.push(cum[i - 1] + (km(pts[i - 1], pts[i]) + 0.005) / Math.max(0.05, (r[i - 1] + r[i]) / 2));
  /* velocidades en décimas de km/h, ajustadas para que su promedio sea exactamente el del viaje */
  const target = kmT / (dur / 60),
    mr = sum(r) / n,
    sp = r.map((x) => Math.round((x / mr) * target * 10));
  let diff = Math.round(target * n * 10) - sum(sp);
  for (let i = 0, g = n * 60; diff !== 0 && g > 0; i++, g--) {
    const j = 1 + (i % (n - 2)),
      st = Math.sign(diff);
    if (sp[j] + st >= 0) {
      sp[j] += st;
      diff -= st;
    }
  }
  return pts.map((p, i) => ({
    lat: +p.lat.toFixed(5),
    lng: +p.lng.toFixed(5),
    t: new Date(
      i === n - 1 ? T0 + dur * 60000 : T0 + Math.round((cum[i] / cum[n - 1]) * dur * 60) * 1000,
    )
      .toISOString()
      .replace('.000Z', 'Z'),
    speed: sp[i] / 10,
  }));
}
/* Puntos válidos de un respaldo: descarta los inválidos y ordena por tiempo; null si no es un arreglo */
function cleanPoints(arr) {
  if (!Array.isArray(arr)) return null;
  return arr
    .filter(
      (p) =>
        p &&
        validGeo(p.lat, p.lng) &&
        typeof p.t === 'string' &&
        isFinite(Date.parse(p.t)) &&
        typeof p.speed === 'number' &&
        isFinite(p.speed) &&
        p.speed >= 0,
    )
    .map((p) => ({ lat: p.lat, lng: p.lng, t: p.t, speed: p.speed }))
    .sort((p, q) => Date.parse(p.t) - Date.parse(q.t));
}
/* Conserva los puntos guardados si son utilizables; si faltan, los genera (o [] si el viaje no tiene coordenadas).
   pointsSource: 'auto' = generados por la app (se regeneran al editar el viaje), 'imported' = ruta ajena (no se sobrescribe).
   Si el origen no se conoce, se compara con lo que generaría la app: idénticos → 'auto', distintos → 'imported' */
export function resolvePoints(t, raw, src, places) {
  const c = cleanPoints(raw);
  if (!c || c.length < 2) return { points: tripPoints(t, places), pointsSource: 'auto' };
  if (src !== 'auto' && src !== 'imported')
    src = JSON.stringify(c) === JSON.stringify(tripPoints(t, places)) ? 'auto' : 'imported';
  return { points: c, pointsSource: src };
}
