/** Bloques de interfaz reutilizables. */
import { icon } from './icons';
import { fmtDate } from '@/shared/utils/dates';
import { NF0, NF1, esc } from '@/shared/utils/format';

export const emptyState = (ic: string, title: string, text: string, actions = '', sm?: boolean) =>
  `<div class="empty${sm ? ' sm' : ''}"><div class="e-ico">${icon(ic, 26)}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${actions ? `<div class="e-actions">${actions}</div>` : ''}</div>`;
export const quickBtns = () =>
  `<button class="btn btn-primary" data-action="new-trip">${icon('plus', 16)} Nuevo viaje <kbd class="hint">N</kbd></button><button class="btn" data-action="new-fuel">${icon('fuel', 16)} Nueva carga <kbd class="hint">G</kbd></button>`;

/** Precisión de la computadora de a bordo de un vehículo frente al rendimiento real. */
export interface CompAccuracy {
  n: number;
  loads: number;
  comp: number;
  real: number;
  pct: number;
  from: string;
  to: string;
}
/** Tarjeta «La computadora marca N % más/menos que el real». Sin datos suficientes (`a` nulo) no muestra nada. */
export function compAccHTML(
  a: CompAccuracy | null,
  v: { name: string; color: string },
  withName?: boolean,
) {
  if (!a) return '';
  const ab = Math.abs(a.pct);
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
