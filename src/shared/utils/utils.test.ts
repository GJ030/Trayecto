import { describe, expect, it } from 'vitest';
import {
  addDays,
  fmtDate,
  fromMin,
  isoDate,
  lastMonths,
  pad,
  parseDate,
  startOfToday,
  toMin,
} from './dates';
import { cap, esc, fmtDurText, money } from './format';
import { validGeo } from './geo';
import { fin, hashStr, mean, sum } from './math';
import { norm } from './norm';
import { uid } from './uid';

describe('fechas y horas', () => {
  it('pad', () => {
    expect(pad(5)).toBe('05');
    expect(pad('12')).toBe('12');
  });
  it('toMin / fromMin son inversas y fromMin pasa de 24 h a 00:00', () => {
    expect(toMin('08:05')).toBe(485);
    expect(toMin('0:00')).toBe(0);
    expect(toMin(null)).toBe(0);
    expect(toMin('x')).toBe(0);
    expect(fromMin(485)).toBe('08:05');
    expect(fromMin(24 * 60 + 5)).toBe('00:05');
    for (const m of [0, 59, 60, 725, 1439]) expect(toMin(fromMin(m))).toBe(m);
  });
  it('isoDate y parseDate son inversas (hora local)', () => {
    expect(isoDate(new Date(2024, 0, 5))).toBe('2024-01-05');
    expect(isoDate(parseDate('2024-12-31'))).toBe('2024-12-31');
    expect(parseDate('2024-03-09').getDate()).toBe(9);
  });
  it('addDays cruza meses y años sin modificar el original', () => {
    const d = new Date(2024, 11, 31);
    expect(isoDate(addDays(d, 1))).toBe('2025-01-01');
    expect(isoDate(addDays(d, -31))).toBe('2024-11-30');
    expect(isoDate(d)).toBe('2024-12-31');
  });
  it('startOfToday es la medianoche de hoy', () => {
    const d = startOfToday();
    expect([d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([0, 0, 0]);
  });
  it('lastMonths devuelve n meses consecutivos terminando en el actual', () => {
    const m = lastMonths(3);
    expect(m).toHaveLength(3);
    expect(m[2].key).toBe(isoDate(new Date()).slice(0, 7));
    expect(m[0].key < m[1].key && m[1].key < m[2].key).toBe(true);
  });
  it('fmtDate da lo mismo en llamadas repetidas (caché)', () => {
    expect(fmtDate('2024-06-15', { day: 'numeric', month: 'long' })).toBe(
      fmtDate('2024-06-15', { day: 'numeric', month: 'long' }),
    );
    expect(fmtDate('2024-06-15', { day: 'numeric', month: 'long' })).toMatch(/15.*junio/);
  });
});

describe('texto y formatos', () => {
  it('norm quita acentos y mayúsculas', () => {
    expect(norm('  ÁRBOL Ñandú ')).toBe('arbol nandu');
    expect(norm(null)).toBe('');
    expect(norm('Casa de mis papás')).toBe(norm('CASA DE MIS PAPAS'));
  });
  it('esc escapa HTML', () => {
    expect(esc('<a href="x">&\'</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
    expect(esc(null)).toBe('');
    expect(esc(5)).toBe('5');
  });
  it('cap, fmtDurText y money', () => {
    expect(cap('hola')).toBe('Hola');
    expect(cap('')).toBe('');
    expect(fmtDurText(45)).toBe('45 min');
    expect(fmtDurText(125)).toBe('2 h 05 min');
    expect(money(1234.5, true)).toContain('1,234.50');
    expect(money(0)).toContain('>0');
  });
  it('uid lleva el prefijo y no se repite', () => {
    expect(uid('t')).toMatch(/^t/);
    expect(uid()).toMatch(/^id/);
    expect(new Set(Array.from({ length: 200 }, () => uid('t'))).size).toBe(200);
  });
});

describe('matemáticas y coordenadas', () => {
  it('sum y mean', () => {
    expect(sum([1, 2, 3])).toBe(6);
    expect(sum([{ n: 2 }, { n: 5 }], (x) => x.n)).toBe(7);
    expect(mean([2, 4])).toBe(3);
    expect(mean([])).toBe(0);
  });
  it('hashStr es estable', () => {
    expect(hashStr('trayecto')).toBe(hashStr('trayecto'));
    expect(hashStr('a')).not.toBe(hashStr('b'));
    expect(hashStr('')).toBe(2166136261);
  });
  it('fin acepta números y textos numéricos', () => {
    expect(fin(3)).toBe(true);
    expect(fin('3.5')).toBe(true);
    expect([
      fin(''),
      fin(' '),
      fin('x'),
      fin(NaN),
      fin(Infinity),
      fin(null),
      fin(undefined),
    ]).toEqual(Array(7).fill(false));
  });
  it('validGeo exige números dentro de rango', () => {
    expect(validGeo(0, 0)).toBe(true);
    expect(validGeo(90, 180)).toBe(true);
    expect(validGeo(-90, -180)).toBe(true);
    expect([
      validGeo(91, 0),
      validGeo(0, 181),
      validGeo('1', 1),
      validGeo(null, null),
      validGeo(NaN, 1),
    ]).toEqual([false, false, false, false, false]);
  });
});
