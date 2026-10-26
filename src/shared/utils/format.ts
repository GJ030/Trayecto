/** Formatos de números, moneda, duración y texto HTML seguro. */
import { pad } from './dates';

const HTML_ESC: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => HTML_ESC[c]);
export const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
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
export const fmtKm = (n: number) => NF1.format(n || 0);
export const fmtDurText = (m: number) =>
  m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${pad(m % 60)} min`;
export const durHTML = (m: number) =>
  m < 60
    ? `${Math.round(m)}<span class="u">min</span>`
    : `${Math.floor(m / 60)}<span class="u">h</span> ${pad(Math.round(m % 60))}<span class="u">min</span>`;
export const money = (v: number, dec?: boolean) =>
  `<span class="u pre">$</span>${(dec ? NF2 : NF0).format(v || 0)}`;
export const fmtWhen = (ms: number) =>
  new Date(ms).toLocaleString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
export const fmtHM = (d: Date) =>
  d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
