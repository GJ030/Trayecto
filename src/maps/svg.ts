/** Mapas SVG esquemáticos (respaldo sin conexión). */
import type { PairStat, Place } from '@/data/schema';
import { S } from '@/data/store';
import { ACC } from '@/shared/ui/theme';
import { esc } from '@/shared/utils/format';
import { validGeo } from '@/shared/utils/geo';
import { fin, hashStr } from '@/shared/utils/math';
import { norm } from '@/shared/utils/norm';

/** Punto del lienzo SVG de 800×520. */
export interface XY {
  x: number;
  y: number;
}
const AVENUES = [
  {
    d: 'M118 0 C 150 110, 52 210, 62 320 S 160 480, 330 520',
    n: 'Periférico',
    w: 5,
    lx: 28,
    ly: 236,
  },
  {
    d: 'M262 140 C 330 84, 520 86, 590 168 S 612 360, 530 404 S 302 424, 248 342 S 196 206, 262 140Z',
    n: 'Circuito Interior',
    w: 3.4,
    lx: 470,
    ly: 104,
  },
  { d: 'M388 0 C 392 150, 404 300, 438 520', n: 'Insurgentes', w: 4, lx: 398, ly: 60 },
  { d: 'M0 268 C 250 262, 520 290, 800 262', n: 'Viaducto', w: 4, lx: 680, ly: 258 },
  { d: 'M90 120 L 320 196 L 540 236', n: 'Reforma', w: 3.4, lx: 160, ly: 132 },
  { d: 'M540 236 C 548 330, 568 420, 610 520', n: 'Tlalpan', w: 3.4, lx: 580, ly: 480 },
  { d: 'M0 372 C 200 378, 420 386, 800 420', n: 'Río Churubusco', w: 3, lx: 660, ly: 404 },
  { d: 'M660 0 C 650 140, 676 260, 720 520', n: 'Eje 3 Ote.', w: 2.6, lx: 670, ly: 40 },
];
function mapBase(k = 1) {
  let s = '<rect x="0" y="0" width="800" height="520" fill="#0F0F12"/>';
  s +=
    '<ellipse cx="228" cy="214" rx="52" ry="30" fill="rgba(61,220,151,.06)"/><ellipse cx="468" cy="398" rx="26" ry="15" fill="rgba(61,220,151,.05)"/><path d="M0 468 C 120 450 180 500 260 520 L0 520Z" fill="rgba(108,168,255,.04)"/>';
  s += `<g stroke="rgba(255,255,255,.038)" stroke-width="${k}">`;
  for (let x = 14; x < 800; x += 28) s += `<path d="M${x} 0V520"/>`;
  for (let y = 14; y < 520; y += 28) s += `<path d="M0 ${y}H800"/>`;
  s += '</g><g fill="none" stroke-linecap="round">';
  for (const a of AVENUES)
    s += `<path d="${a.d}" stroke="#26262D" stroke-width="${(a.w * k).toFixed(2)}"/>`;
  s += `</g><g class="map-lbl" font-size="${(9.5 * k).toFixed(1)}">`;
  for (const a of AVENUES) if (a.lx != null) s += `<text x="${a.lx}" y="${a.ly}">${a.n}</text>`;
  return s + '</g>';
}
/* Proyección lineal lat/lng → lienzo SVG de 800×520 sobre el área urbana de la CDMX (estirada al lienzo, como el mapa estilizado) */
const GEO_BOUNDS = { north: 19.53, south: 19.29, west: -99.28, east: -99.08 };
function project(lat: number, lng: number) {
  const B = GEO_BOUNDS,
    c = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
  return {
    x: Math.round(c(((lng - B.west) / (B.east - B.west)) * 800, 40, 760)),
    y: Math.round(c(((B.north - lat) / (B.north - B.south)) * 520, 34, 486)),
  };
}
/* Posición en el SVG: proyectada desde lat/lng; sin coordenadas, la posición estimada guardada (x/y) */
export function placeXY(p: Place): XY | null {
  if (validGeo(p.lat, p.lng)) return project(p.lat as number, p.lng as number);
  return fin(p.x) && fin(p.y) ? { x: +p.x!, y: +p.y! } : null;
}
export function placePos(name: string): XY {
  const p = S.places.find((p) => norm(p.name) === norm(name)),
    q = p && placeXY(p);
  if (q) return q;
  const h = hashStr(norm(name));
  return { x: 70 + (h % 660), y: 50 + ((h >>> 10) % 420) };
}
export function routePts(oN: string, dN: string): XY[] {
  const a = placePos(oN),
    b = placePos(dN);
  const ks = [norm(oN), norm(dN)].sort();
  const rev = ks[0] !== norm(oN);
  const h = hashStr(ks.join('|'));
  const A = rev ? b : a,
    B = rev ? a : b;
  const f1 = 0.25 + (h % 20) / 100,
    f2 = 0.42 + ((h >>> 5) % 18) / 100,
    f3 = 0.62 + ((h >>> 11) % 22) / 100;
  const dx = B.x - A.x,
    dy = B.y - A.y;
  let pts: XY[];
  if (Math.hypot(dx, dy) < 6)
    pts = [
      A,
      { x: A.x + 42, y: A.y },
      { x: A.x + 42, y: A.y - 36 },
      { x: A.x, y: A.y - 36 },
      { x: A.x, y: A.y },
    ];
  else if (Math.abs(dy) > Math.abs(dx))
    pts = [
      A,
      { x: A.x, y: A.y + dy * f1 },
      { x: A.x + dx * f2, y: A.y + dy * f1 },
      { x: A.x + dx * f2, y: A.y + dy * f3 },
      { x: B.x, y: A.y + dy * f3 },
      B,
    ];
  else
    pts = [
      A,
      { x: A.x + dx * f1, y: A.y },
      { x: A.x + dx * f1, y: A.y + dy * f2 },
      { x: A.x + dx * f3, y: A.y + dy * f2 },
      { x: A.x + dx * f3, y: B.y },
      B,
    ];
  return rev ? pts.reverse() : pts;
}
function roundedPath(pts: XY[], r: number) {
  let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i],
      a = pts[i - 1],
      b = pts[i + 1];
    const la = Math.hypot(p.x - a.x, p.y - a.y) || 1,
      lb = Math.hypot(b.x - p.x, b.y - p.y) || 1;
    const rr = Math.min(r, la / 2, lb / 2);
    const s = { x: p.x + ((a.x - p.x) / la) * rr, y: p.y + ((a.y - p.y) / la) * rr },
      e = { x: p.x + ((b.x - p.x) / lb) * rr, y: p.y + ((b.y - p.y) / lb) * rr };
    d += ` L${s.x.toFixed(1)} ${s.y.toFixed(1)} Q${p.x.toFixed(1)} ${p.y.toFixed(1)} ${e.x.toFixed(1)} ${e.y.toFixed(1)}`;
  }
  const l = pts[pts.length - 1];
  return d + ` L${l.x.toFixed(1)} ${l.y.toFixed(1)}`;
}
export function routeMap(o: string, d: string, W: number, H: number) {
  const pts = routePts(o, d),
    xs = pts.map((p) => p.x),
    ys = pts.map((p) => p.y);
  const P = 62;
  let bx = Math.min(...xs) - P,
    by = Math.min(...ys) - P,
    bw = Math.max(...xs) - Math.min(...xs) + P * 2,
    bh = Math.max(...ys) - Math.min(...ys) + P * 2;
  const ar = W / H;
  if (bw / bh > ar) {
    const nh = bw / ar;
    by -= (nh - bh) / 2;
    bh = nh;
  } else {
    const nw = bh * ar;
    bx -= (nw - bw) / 2;
    bw = nw;
  }
  if (bw < 240) {
    const s = 240 / bw;
    bx -= (bw * s - bw) / 2;
    by -= (bh * s - bh) / 2;
    bw *= s;
    bh *= s;
  }
  if (bw <= 800) bx = Math.max(0, Math.min(bx, 800 - bw));
  if (bh <= 520) by = Math.max(0, Math.min(by, 520 - bh));
  const k = bw / W,
    path = roundedPath(pts, 14 * k),
    A = pts[0],
    B = pts[pts.length - 1];
  const others = S.places
    .filter((p) => norm(p.name) !== norm(o) && norm(p.name) !== norm(d))
    .map((p) => {
      const q = placePos(p.name);
      return `<circle cx="${q.x}" cy="${q.y}" r="${3.5 * k}" fill="#3A3A44"/><text x="${q.x}" y="${q.y - 8 * k}" text-anchor="middle" class="pin-lbl muted" font-size="${10 * k}">${esc(p.name)}</text>`;
    })
    .join('');
  const lbl = (p: XY, t: string, dy: number) => {
    if (p.y + dy - by < 14 * k) dy = -dy + 10 * k;
    return `<text x="${p.x}" y="${p.y + dy}" text-anchor="middle" class="pin-lbl" font-size="${11.5 * k}" stroke="#0F0F12" stroke-width="${3.5 * k}" paint-order="stroke">${esc(t)}</text>`;
  };
  return `<svg viewBox="${bx.toFixed(1)} ${by.toFixed(1)} ${bw.toFixed(1)} ${bh.toFixed(1)}" width="${W}" height="${H}" role="img" aria-label="Mapa de la ruta de ${esc(o)} a ${esc(d)}">
    ${mapBase(k)}${others}
    <path d="${path}" fill="none" stroke="${ACC}" stroke-opacity=".16" stroke-width="${11 * k}" stroke-linecap="round" stroke-linejoin="round"/>
    <path class="route-path" pathLength="1" d="${path}" fill="none" stroke="${ACC}" stroke-width="${3.2 * k}" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${A.x}" cy="${A.y}" r="${6 * k}" fill="#0F0F12" stroke="#EDEDF0" stroke-width="${2.4 * k}"/>
    <circle cx="${B.x}" cy="${B.y}" r="${7 * k}" fill="${ACC}" class="pin-pulse"/>
    <circle cx="${B.x}" cy="${B.y}" r="${7 * k}" fill="${ACC}" stroke="#0F0F12" stroke-width="${2.4 * k}"/>
    ${lbl(A, o, -12 * k)}${lbl(B, d, -14 * k)}
  </svg>`;
}
export function placesMap(vis: Record<string, number>, pairs: PairStat[]) {
  const k = 1.15,
    selP = S.places.find((p) => p.id === S.ui.selPlace),
    selPair = pairs.find((p) => p.key === S.ui.selPair);
  let s = `<svg viewBox="0 0 800 520" role="group" aria-label="Mapa estilizado con ${S.places.length} lugares">${mapBase(k)}`;
  for (const pr of pairs) {
    if (pr === selPair) continue;
    const rel = selP && (norm(pr.from) === norm(selP.name) || norm(pr.to) === norm(selP.name));
    if (!rel && pr.n < 2) continue;
    s += `<path d="${roundedPath(routePts(pr.from, pr.to), 14)}" fill="none" stroke="${rel ? 'rgba(255,176,32,.6)' : 'rgba(255,255,255,.15)'}" stroke-width="${(rel ? 2.4 : 1.6) * k}" ${rel ? '' : `stroke-dasharray="${4 * k} ${5 * k}"`} stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  if (selPair) {
    const d = roundedPath(routePts(selPair.from, selPair.to), 14);
    s += `<path d="${d}" fill="none" stroke="${ACC}" stroke-opacity=".18" stroke-width="${12 * k}" stroke-linecap="round" stroke-linejoin="round"/><path class="route-path" pathLength="1" d="${d}" fill="none" stroke="${ACC}" stroke-width="${3.4 * k}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  for (const p of S.places) {
    const q = placePos(p.name),
      v = vis[p.id] || 0,
      r = (5.5 + Math.min(9, v * 0.75)) * k * 0.9;
    const sel =
      p.id === S.ui.selPlace ||
      (selPair && (norm(selPair.from) === norm(p.name) || norm(selPair.to) === norm(p.name)));
    s += `<g class="pin" id="pin-${p.id}" role="button" tabindex="0" aria-label="${esc(p.name)}, ${v} visitas" aria-pressed="${!!sel}" data-action="place-select" data-id="${p.id}" transform="translate(${q.x} ${q.y})">
      ${sel ? `<circle r="${r}" fill="${ACC}" class="pin-pulse"/>` : ''}
      <circle r="${r + 6 * k}" fill="rgba(255,176,32,${sel ? 0.18 : 0.08})"/>
      <circle class="pin-dot" r="${r}" fill="${sel ? ACC : '#1C1C21'}" stroke="${ACC}" stroke-width="${2.2 * k}"/>
      <text y="${r + 16 * k}" text-anchor="middle" class="pin-lbl" font-size="${12 * k}" stroke="#0F0F12" stroke-width="${3.5 * k}" paint-order="stroke">${esc(p.name)}</text>
    </g>`;
  }
  return s + '</svg>';
}
