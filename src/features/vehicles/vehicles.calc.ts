/** Vehículos: búsqueda por id y precisión de la computadora de a bordo. */
import { S } from '@/data/store';
import type { Fuel } from '@/data/schema';
import { D } from '@/features/fuel/fuel.calc';
import { compOf } from '@/features/trips/trips.calc';
import { icon } from '@/shared/ui/icons';
import { fmtDate } from '@/shared/utils/dates';
import { NF0, NF1, esc } from '@/shared/utils/format';
import { mean } from '@/shared/utils/math';

export const vehById = (id: string | null | undefined) => S.vehicles.find((v) => v.id === id);
export const vehName = (id: string) => vehById(id)?.name || 'Sin vehículo';
export interface CompAccuracy {
  n: number;
  loads: number;
  comp: number;
  real: number;
  pct: number;
  from: string;
  to: string;
}
/* Precisión de la computadora de un vehículo: promedio de los rendimientos capturados contra el real de las cargas de tanque lleno cuyo intervalo
   (desde la carga llena anterior) toca el periodo de esos viajes. Requiere ≥3 viajes con dato y al menos una carga con rendimiento calculado */
function compAccuracy(vid: string): CompAccuracy | null {
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
export function compAccHTML(vid: string, withName?: boolean) {
  const a = compAccuracy(vid);
  if (!a) return '';
  const v = vehById(vid)!,
    ab = Math.abs(a.pct);
  const msg =
    ab < 0.5
      ? 'La computadora coincide con el real'
      : `La computadora marca ${NF0.format(ab)} % ${a.pct > 0 ? 'más' : 'menos'} que el real`;
  const rng =
    a.from === a.to
      ? fmtDate(a.from, { day: 'numeric', month: 'short' })
      : `${fmtDate(a.from, { day: 'numeric', month: 'short' })} – ${fmtDate(a.to, { day: 'numeric', month: 'short' })}`;
  return `<div class="comp-acc">${withName ? `<div class="veh-h" style="font-weight:600;margin-bottom:6px"><span class="dot" style="background:${esc(v.color)}"></span>${esc(v.name)}</div>` : `<div class="stat-label">${icon('gauge', 13)} Precisión de la computadora</div>`}<b>${msg}</b><small>Computadora ${NF1.format(a.comp)} km/L (${a.n} viajes) · Real ${NF1.format(a.real)} km/L (${a.loads} ${a.loads === 1 ? 'carga' : 'cargas'} de tanque lleno) · ${esc(rng)}</small></div>`;
}
export const vehOptions = (sel: string) =>
  S.vehicles
    .map((v) => `<option value="${v.id}" ${v.id === sel ? 'selected' : ''}>${esc(v.name)}</option>`)
    .join('');
export const defVeh = () =>
  vehById(S.settings.defaultVehicle) ? (S.settings.defaultVehicle as string) : S.vehicles[0].id;
