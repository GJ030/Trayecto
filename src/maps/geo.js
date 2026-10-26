/** Utilidades geográficas y de color de los mapas. */
import { ACC } from '@/shared/ui/theme';
import { mean } from '@/shared/utils/math';

export function speedColor(v) {
  const st = [
    [0, [255, 107, 107]],
    [20, [255, 176, 32]],
    [40, [61, 220, 151]],
  ];
  if (v <= st[0][0]) return `rgb(${st[0][1]})`;
  for (let i = 1; i < st.length; i++)
    if (v <= st[i][0]) {
      const [a, ca] = st[i - 1],
        [b, cb] = st[i],
        f = (v - a) / (b - a);
      return `rgb(${ca.map((c, k) => Math.round(c + (cb[k] - c) * f))})`;
    }
  return `rgb(${st[st.length - 1][1]})`;
}
export const smoothSpeeds = (pts) =>
  pts.map((p, i) => mean(pts.slice(Math.max(0, i - 3), i + 4).map((q) => q.speed)));
/* line-gradient: color por velocidad (suavizada) en cada parada de line-progress = distancia acumulada / distancia total */
export function speedGradient(pts) {
  const kx = 111.32 * Math.cos((pts[0].lat * Math.PI) / 180),
    n = pts.length,
    cum = [0];
  for (let i = 1; i < n; i++)
    cum.push(
      cum[i - 1] +
        Math.hypot((pts[i].lng - pts[i - 1].lng) * kx, (pts[i].lat - pts[i - 1].lat) * 111.2),
    );
  const tot = cum[n - 1],
    sp = smoothSpeeds(pts);
  const stops = [];
  let last = -1;
  pts.forEach((p, i) => {
    const f = i === 0 ? 0 : i === n - 1 ? 1 : cum[i] / (tot || 1);
    if (f > last + 1e-6) {
      stops.push(f, speedColor(sp[i]));
      last = f;
    }
  });
  if (stops.length < 4) return ['interpolate', ['linear'], ['line-progress'], 0, ACC, 1, ACC];
  return ['interpolate', ['linear'], ['line-progress'], ...stops];
}
export const EMPTY_FC = { type: 'FeatureCollection', features: [] };
export const llOf = (p) => [p.lng, p.lat];
export function boundsOf(ll) {
  const xs = ll.map((p) => p[0]),
    ys = ll.map((p) => p[1]);
  return [
    [Math.min(...xs), Math.min(...ys)],
    [Math.max(...xs), Math.max(...ys)],
  ];
}
