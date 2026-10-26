/** Fechas y horas (ISO local, minutos del día, meses). */
export const pad = (n) => String(n).padStart(2, '0');
export const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseDate = (s) => {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
export const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
export const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
export const toMin = (t) => {
  const [h, m] = String(t || '0:0')
    .split(':')
    .map(Number);
  return (h || 0) * 60 + (m || 0);
};
export const fromMin = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const MONTHS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];
const MONTHS_L = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
/* Intl es lo más caro de las tablas grandes: se reutilizan los formateadores y los textos ya calculados */
const DF = new Map(),
  DT = new Map();
export const fmtDate = (s, o) => {
  o = o || { weekday: 'short', day: 'numeric', month: 'short' };
  const k = JSON.stringify(o),
    ck = s + '|' + k;
  let r = DT.get(ck);
  if (r !== undefined) return r;
  let f = DF.get(k);
  if (!f) {
    f = new Intl.DateTimeFormat('es-MX', o);
    DF.set(k, f);
  }
  if (DT.size > 4000) DT.clear();
  r = f.format(parseDate(s));
  DT.set(ck, r);
  return r;
};
export function lastMonths(n) {
  const d = new Date();
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push({ key: monthKey(x), label: MONTHS[x.getMonth()], long: MONTHS_L[x.getMonth()] });
  }
  return out;
}
