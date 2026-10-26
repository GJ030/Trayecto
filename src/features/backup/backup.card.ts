import type { Trip } from '@/data/schema';
import { compOf, fmtComp, tripCost, tripDur, tripKm, tripSpeed } from '@/features/trips/trips.calc';
import { vehName } from '@/features/vehicles/vehicles.calc';
import { smoothSpeeds, speedColor } from '@/maps/geo';
import { routePts } from '@/maps/svg';
import { ACC } from '@/shared/ui/theme';
import { toast } from '@/shared/ui/toast';
import { fmtDate, pad } from '@/shared/utils/dates';
import { download } from '@/shared/utils/download';
import { NF0, NF1, NF2, cap, fmtKm } from '@/shared/utils/format';
import { norm } from '@/shared/utils/norm';

function rr(x: CanvasRenderingContext2D, X: number, Y: number, W: number, H: number, r: number) {
  x.beginPath();
  x.moveTo(X + r, Y);
  x.arcTo(X + W, Y, X + W, Y + H, r);
  x.arcTo(X + W, Y + H, X, Y + H, r);
  x.arcTo(X, Y + H, X, Y, r);
  x.arcTo(X, Y, X + W, Y, r);
  x.closePath();
}
function tripCanvas(t: Trip) {
  const W = 1200,
    H = 630,
    c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d')!;
  const F = '"Inter","Segoe UI",system-ui,-apple-system,sans-serif';
  x.fillStyle = '#0B0B0D';
  x.fillRect(0, 0, W, H);
  const gr = x.createRadialGradient(1020, 60, 10, 1020, 60, 560);
  gr.addColorStop(0, 'rgba(255,176,32,.18)');
  gr.addColorStop(1, 'rgba(255,176,32,0)');
  x.fillStyle = gr;
  x.fillRect(0, 0, W, H);
  rr(x, 36, 36, W - 72, H - 72, 28);
  x.fillStyle = '#16161A';
  x.fill();
  x.strokeStyle = 'rgba(255,255,255,.08)';
  x.lineWidth = 2;
  x.stroke();
  rr(x, 76, 74, 42, 42, 12);
  x.fillStyle = ACC;
  x.fill();
  x.strokeStyle = '#1A1206';
  x.lineWidth = 3.4;
  x.lineCap = 'round';
  x.beginPath();
  x.moveTo(87, 108);
  x.lineTo(94, 82);
  x.moveTo(107, 108);
  x.lineTo(100, 82);
  x.moveTo(97, 87);
  x.lineTo(97, 89);
  x.moveTo(97, 94);
  x.lineTo(97, 97);
  x.moveTo(97, 102);
  x.lineTo(97, 105);
  x.stroke();
  x.textBaseline = 'middle';
  x.fillStyle = '#EDEDF0';
  x.font = `700 24px ${F}`;
  x.fillText('Trayecto', 132, 96);
  x.textAlign = 'right';
  x.fillStyle = '#8A8A96';
  x.font = `500 20px ${F}`;
  x.fillText(
    `${cap(fmtDate(t.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))} · ${t.depart}–${t.arrive}`,
    W - 76,
    96,
  );
  x.textAlign = 'left';
  let size = 54;
  const measure = () => {
    x.font = `700 ${size}px ${F}`;
    return x.measureText(t.origin).width + x.measureText(t.destination).width + size * 1.6;
  };
  while (measure() > 620 && size > 28) size -= 2;
  x.font = `700 ${size}px ${F}`;
  x.fillStyle = '#EDEDF0';
  let cx = 76;
  const ry = 196;
  x.fillText(t.origin, cx, ry);
  cx += x.measureText(t.origin).width + size * 0.3;
  x.strokeStyle = ACC;
  x.lineWidth = Math.max(3, size * 0.08);
  x.beginPath();
  x.moveTo(cx, ry);
  x.lineTo(cx + size * 0.8, ry);
  x.moveTo(cx + size * 0.55, ry - size * 0.22);
  x.lineTo(cx + size * 0.8, ry);
  x.lineTo(cx + size * 0.55, ry + size * 0.22);
  x.stroke();
  cx += size * 1.1;
  x.fillText(t.destination, cx, ry);
  const tagCol = t.tag === 'Personal' ? '#C3A6FF' : '#7DB3FF';
  x.font = `600 18px ${F}`;
  const tw = x.measureText(t.tag).width;
  rr(x, 76, 248, tw + 44, 34, 17);
  x.fillStyle = t.tag === 'Personal' ? 'rgba(182,156,255,.14)' : 'rgba(108,168,255,.14)';
  x.fill();
  x.fillStyle = tagCol;
  x.beginPath();
  x.arc(94, 265, 4, 0, Math.PI * 2);
  x.fill();
  x.fillText(t.tag, 106, 266);
  x.fillStyle = '#8A8A96';
  x.font = `500 19px ${F}`;
  x.fillText(
    `${vehName(t.vehicleId)} · odómetro ${NF1.format(t.odoStart)} → ${NF1.format(t.odoEnd)} km`,
    76,
    316,
  );
  if (compOf(t)) {
    x.fillStyle = ACC;
    x.font = `600 19px ${F}`;
    x.fillText(`Rendimiento (computadora): ${fmtComp(t)}`, 76, 350);
  }
  const MX = 760,
    MY = 136,
    MW = 364,
    MH = 210;
  rr(x, MX, MY, MW, MH, 18);
  x.fillStyle = '#0F0F12';
  x.fill();
  x.save();
  rr(x, MX, MY, MW, MH, 18);
  x.clip();
  x.strokeStyle = 'rgba(255,255,255,.045)';
  x.lineWidth = 1;
  for (let i = MX + 11; i < MX + MW; i += 22) {
    x.beginPath();
    x.moveTo(i, MY);
    x.lineTo(i, MY + MH);
    x.stroke();
  }
  for (let j = MY + 11; j < MY + MH; j += 22) {
    x.beginPath();
    x.moveTo(MX, j);
    x.lineTo(MX + MW, j);
    x.stroke();
  }
  const real = Array.isArray(t.points) && t.points.length >= 2;
  let tp: { x: number; y: number }[],
    cols: string[] | null = null;
  if (real) {
    /* ruta real: lat/lng a km (con la corrección por latitud), encuadrada en el recuadro sin deformarla */
    const kx = 111.32 * Math.cos((t.points[0].lat * Math.PI) / 180),
      q = t.points.map((p) => ({ x: p.lng * kx, y: -p.lat * 111.2 }));
    const x0 = Math.min(...q.map((p) => p.x)),
      x1 = Math.max(...q.map((p) => p.x)),
      y0 = Math.min(...q.map((p) => p.y)),
      y1 = Math.max(...q.map((p) => p.y));
    const bw = Math.max(0.2, x1 - x0),
      bh = Math.max(0.2, y1 - y0),
      sc = Math.min((MW - 90) / bw, (MH - 80) / bh);
    tp = q.map((p) => ({
      x: MX + MW / 2 + (p.x - (x0 + x1) / 2) * sc,
      y: MY + MH / 2 + (p.y - (y0 + y1) / 2) * sc,
    }));
    cols = smoothSpeeds(t.points).map(speedColor);
  } else {
    const pts = routePts(t.origin, t.destination),
      xs = pts.map((p) => p.x),
      ys = pts.map((p) => p.y);
    const bw = Math.max(40, Math.max(...xs) - Math.min(...xs)),
      bh = Math.max(40, Math.max(...ys) - Math.min(...ys));
    const sc = Math.min((MW - 90) / bw, (MH - 80) / bh),
      ox = MX + MW / 2 - (Math.min(...xs) + bw / 2) * sc,
      oy = MY + MH / 2 - (Math.min(...ys) + bh / 2) * sc;
    tp = pts.map((p) => ({ x: p.x * sc + ox, y: p.y * sc + oy }));
  }
  const line = (w: number, col: string) => {
    x.strokeStyle = col;
    x.lineWidth = w;
    x.lineJoin = 'round';
    x.lineCap = 'round';
    x.beginPath();
    tp.forEach((p, i) => (i ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y)));
    x.stroke();
  };
  line(14, 'rgba(255,176,32,.18)');
  if (cols) {
    /* degradado de velocidad: cada tramo va del color de un punto al del siguiente */
    x.lineWidth = 4.5;
    x.lineCap = 'round';
    for (let i = 1; i < tp.length; i++) {
      const g = x.createLinearGradient(tp[i - 1].x, tp[i - 1].y, tp[i].x, tp[i].y);
      g.addColorStop(0, cols[i - 1]);
      g.addColorStop(1, cols[i]);
      x.strokeStyle = g;
      x.beginPath();
      x.moveTo(tp[i - 1].x, tp[i - 1].y);
      x.lineTo(tp[i].x, tp[i].y);
      x.stroke();
    }
  } else line(4.5, ACC);
  const a = tp[0],
    b = tp[tp.length - 1];
  x.fillStyle = '#0F0F12';
  x.strokeStyle = '#EDEDF0';
  x.lineWidth = 3;
  x.beginPath();
  x.arc(a.x, a.y, 7, 0, Math.PI * 2);
  x.fill();
  x.stroke();
  x.fillStyle = 'rgba(255,176,32,.25)';
  x.beginPath();
  x.arc(b.x, b.y, 15, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = ACC;
  x.beginPath();
  x.arc(b.x, b.y, 8, 0, Math.PI * 2);
  x.fill();
  x.restore();
  if (real) {
    const ly = MY + MH + 19,
      lg = x.createLinearGradient(MX + 20, 0, MX + 78, 0);
    lg.addColorStop(0, speedColor(0));
    lg.addColorStop(0.5, speedColor(20));
    lg.addColorStop(1, speedColor(40));
    x.font = `600 13px ${F}`;
    x.fillStyle = '#8A8A96';
    x.textAlign = 'left';
    x.fillText('0', MX, ly);
    rr(x, MX + 20, ly - 3, 58, 6, 3);
    x.fillStyle = lg;
    x.fill();
    x.fillStyle = '#8A8A96';
    x.fillText('40+ km/h', MX + 86, ly);
    x.textAlign = 'right';
    x.fillText(
      `Vel. máx. ${NF0.format(Math.max(...t.points.map((p) => p.speed)))} km/h`,
      MX + MW,
      ly,
    );
    x.textAlign = 'left';
  }
  x.strokeStyle = 'rgba(255,255,255,.08)';
  x.lineWidth = 2;
  x.beginPath();
  x.moveTo(76, 384);
  x.lineTo(W - 76, 384);
  x.stroke();
  const dur = tripDur(t),
    stats: [string, string, string][] = [
      ['DISTANCIA', fmtKm(tripKm(t)), 'km'],
      [
        'DURACIÓN',
        dur < 60 ? String(dur) : `${Math.floor(dur / 60)}:${pad(dur % 60)}`,
        dur < 60 ? 'min' : 'h',
      ],
      ['VEL. PROMEDIO', NF0.format(tripSpeed(t)), 'km/h'],
      ['COSTO EST.', '$' + NF2.format(tripCost(t)), 'MXN'],
    ];
  const colW = (W - 152) / 4;
  stats.forEach(([l, v, u], i) => {
    const sx = 76 + colW * i;
    x.fillStyle = '#8B8B97';
    x.font = `650 15px ${F}`;
    x.fillText(l, sx, 428);
    x.fillStyle = i === 3 ? ACC : '#EDEDF0';
    x.font = `700 58px ${F}`;
    x.fillText(v, sx, 490);
    const vw = x.measureText(v).width;
    x.fillStyle = '#A6A6B0';
    x.font = `500 22px ${F}`;
    x.fillText(u, sx + vw + 8, 498);
  });
  x.fillStyle = '#6E6E7A';
  x.font = `500 16px ${F}`;
  x.fillText('Registrado sin conexión con Trayecto', 76, 556);
  return c;
}
export function downloadTripPNG(t: Trip) {
  try {
    const c = tripCanvas(t);
    const name = `trayecto-${norm(t.origin).replace(/\W+/g, '-')}-${norm(t.destination).replace(/\W+/g, '-')}-${t.date}.png`;
    if (c.toBlob)
      c.toBlob((b) => {
        if (b) {
          download(name, b);
          toast('Tarjeta descargada');
        } else toast('No se pudo generar la imagen', 'err');
      }, 'image/png');
    else {
      const a = document.createElement('a');
      a.href = c.toDataURL('image/png');
      a.download = name;
      a.click();
    }
  } catch (e) {
    toast('No se pudo generar la imagen', 'err');
  }
}
