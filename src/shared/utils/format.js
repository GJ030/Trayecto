/** Formatos de números, moneda, duración y texto HTML seguro. */
import { pad } from './dates';

export const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
export const NF0 = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });
export const NF1 = new Intl.NumberFormat('es-MX', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
export const NF2 = new Intl.NumberFormat('es-MX', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
export const MXN = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
export const fmtKm = (n) => NF1.format(n || 0);
export const fmtDurText = (m) =>
  m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${pad(m % 60)} min`;
export const durHTML = (m) =>
  m < 60
    ? `${Math.round(m)}<span class="u">min</span>`
    : `${Math.floor(m / 60)}<span class="u">h</span> ${pad(Math.round(m % 60))}<span class="u">min</span>`;
export const money = (v, dec) => `<span class="u pre">$</span>${(dec ? NF2 : NF0).format(v || 0)}`;
export const fmtWhen = (ms) =>
  new Date(ms).toLocaleString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
export const fmtHM = (d) => d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
