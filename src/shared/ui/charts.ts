/** Gráficas SVG. */
import { ACC, GREEN } from './theme';
import { NF0, NF1, esc } from '@/shared/utils/format';

export interface BarChartOptions {
  values: number[];
  labels: string[];
  w?: number;
  h?: number;
  highlight?: number;
  fmt?: (v: number) => string;
  colors?: string[] | null;
  avg?: number | null;
  avgLabel?: string;
  title?: string;
}
export function barChart({
  values,
  labels,
  w = 560,
  h = 180,
  highlight = -1,
  fmt = (v) => NF0.format(v),
  colors = null,
  avg = null,
  avgLabel = '',
  title = '',
}: BarChartOptions) {
  const P = { l: 10, r: 10, t: 26, b: 28 },
    n = values.length || 1;
  const maxV = Math.max(1, ...values.map((v) => v || 0), avg || 0) * 1.14;
  const iw = w - P.l - P.r,
    ih = h - P.t - P.b,
    bw = iw / n,
    barW = Math.max(8, Math.min(46, bw * 0.58));
  let s = `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img" aria-label="${esc(title)}">`;
  for (let i = 0; i < 3; i++) {
    const gy = P.t + (ih * i) / 3;
    s += `<line x1="${P.l}" x2="${w - P.r}" y1="${gy}" y2="${gy}" stroke="rgba(255,255,255,.045)"/>`;
  }
  s += `<line x1="${P.l}" x2="${w - P.r}" y1="${P.t + ih}" y2="${P.t + ih}" stroke="rgba(255,255,255,.09)"/>`;
  values.forEach((v, i) => {
    const val = v || 0,
      cx = P.l + bw * i + bw / 2,
      x = cx - barW / 2,
      bh = val ? Math.max(3, (val / maxV) * ih) : 2,
      y = P.t + ih - bh;
    const col = colors ? colors[i] : i === highlight ? ACC : '#2E2E36';
    s += `<rect class="bar" style="animation-delay:${i * 35}ms" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" rx="${Math.min(6, barW / 3).toFixed(1)}" fill="${val ? col : '#1F1F25'}"><title>${esc(labels[i])}: ${val ? esc(fmt(val)) : 'Sin datos'}</title></rect>`;
    if (val)
      s += `<text x="${cx.toFixed(1)}" y="${(y - 8).toFixed(1)}" text-anchor="middle" class="bar-val${i === highlight ? ' hl' : ''}">${esc(fmt(val))}</text>`;
    s += `<text x="${cx.toFixed(1)}" y="${h - 8}" text-anchor="middle" class="bar-lbl${i === highlight ? ' hl' : ''}">${esc(labels[i])}</text>`;
  });
  if (avg) {
    const ay = P.t + ih - (avg / maxV) * ih;
    s += `<line x1="${P.l}" x2="${w - P.r}" y1="${ay.toFixed(1)}" y2="${ay.toFixed(1)}" stroke="${GREEN}" stroke-dasharray="4 5" stroke-opacity=".75"/><text x="${w - P.r}" y="${(ay - 6).toFixed(1)}" text-anchor="end" class="avg-lbl">${esc(avgLabel)}</text>`;
  }
  return s + '</svg>';
}
let gid = 0;
export interface LineChartOptions {
  values: (number | null)[];
  labels: string[];
  w?: number;
  h?: number;
  fmt?: (v: number) => string;
  title?: string;
  highlight?: number;
}
export function lineChart({
  values,
  labels,
  w = 900,
  h = 240,
  fmt = (v) => NF1.format(v),
  title = '',
  highlight = -1,
}: LineChartOptions) {
  const P = { l: 16, r: 16, t: 34, b: 30 },
    n = values.length,
    iw = w - P.l - P.r,
    ih = h - P.t - P.b;
  const vals = values.filter((v): v is number => v != null);
  if (!vals.length)
    return `<div class="empty sm"><p>Aún no hay suficientes cargas de tanque lleno para calcular el rendimiento.</p></div>`;
  let mn = Math.min(...vals),
    mx = Math.max(...vals);
  const sp = Math.max(1, mx - mn);
  mn -= sp * 0.6;
  mx += sp * 0.5;
  const X = (i: number) => P.l + (iw * (i + 0.5)) / n,
    Y = (v: number) => P.t + ih - ((v - mn) / (mx - mn)) * ih;
  const pts = values.map((v, i) => (v == null ? null : { x: X(i), y: Y(v), v, i }));
  const id = 'lg' + ++gid;
  let s = `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img" aria-label="${esc(title)}"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${ACC}" stop-opacity=".28"/><stop offset="1" stop-color="${ACC}" stop-opacity="0"/></linearGradient></defs>`;
  for (let i = 0; i < 3; i++) {
    const gy = P.t + (ih * i) / 3;
    s += `<line x1="${P.l}" x2="${w - P.r}" y1="${gy}" y2="${gy}" stroke="rgba(255,255,255,.045)"/>`;
  }
  const seq = pts.filter((p): p is NonNullable<typeof p> => p != null);
  if (seq.length > 1) {
    const d = seq.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    s += `<path d="${d} L${seq[seq.length - 1].x.toFixed(1)} ${P.t + ih} L${seq[0].x.toFixed(1)} ${P.t + ih}Z" fill="url(#${id})"/>`;
    s += `<path class="route-path" pathLength="1" d="${d}" fill="none" stroke="${ACC}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
  }
  seq.forEach((p) => {
    const hl = p.i === highlight || p === seq[seq.length - 1];
    s += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${hl ? 5 : 4}" fill="${hl ? ACC : '#16161A'}" stroke="${ACC}" stroke-width="2"><title>${esc(labels[p.i])}: ${esc(fmt(p.v))}</title></circle><text x="${p.x.toFixed(1)}" y="${(p.y - 12).toFixed(1)}" text-anchor="middle" class="bar-val${hl ? ' hl' : ''}">${esc(fmt(p.v))}</text>`;
  });
  labels.forEach((l, i) => {
    s += `<text x="${X(i).toFixed(1)}" y="${h - 8}" text-anchor="middle" class="bar-lbl${i === highlight ? ' hl' : ''}">${esc(l)}</text>`;
  });
  return s + '</svg>';
}
export function sparkline(values: number[], w = 300, h = 64) {
  if (values.length < 2)
    return `<p class="muted-xs">Registra al menos tres cargas de tanque lleno para ver la tendencia.</p>`;
  const mn = Math.min(...values),
    mx = Math.max(...values),
    sp = Math.max(0.5, mx - mn);
  const X = (i: number) => 6 + ((w - 12) * i) / (values.length - 1),
    Y = (v: number) => h - 8 - ((v - mn) / sp) * (h - 20);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ');
  const id = 'sp' + ++gid,
    l = values.length - 1;
  return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img" aria-label="Tendencia de rendimiento por carga"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${ACC}" stop-opacity=".25"/><stop offset="1" stop-color="${ACC}" stop-opacity="0"/></linearGradient></defs><path d="${d} L${X(l)} ${h} L${X(0)} ${h}Z" fill="url(#${id})"/><path class="route-path" pathLength="1" d="${d}" fill="none" stroke="${ACC}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${X(l)}" cy="${Y(values[l])}" r="4" fill="${ACC}"/></svg>`;
}
export function deltaHTML(
  cur: number,
  prev: number,
  { good = null, suffix = 'vs. semana pasada' }: { good?: boolean | null; suffix?: string } = {},
) {
  if (!prev) return `<span class="delta flat">Sin datos previos</span>`;
  const pct = ((cur - prev) / prev) * 100,
    up = pct >= 0;
  const cls = Math.abs(pct) < 0.5 || good == null ? 'flat' : up === good ? 'good' : 'bad';
  return `<span class="delta ${cls}">${up ? '▲' : '▼'} ${NF0.format(Math.abs(pct))}% <span class="d-sfx">${esc(suffix)}</span></span>`;
}
