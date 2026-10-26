/** Sumas, promedios y hash. */
export function sum(a: number[]): number;
export function sum<T>(a: T[], f: (x: T) => number): number;
export function sum<T>(a: T[], f?: (x: T) => number) {
  return a.reduce((s, x) => s + (f ? f(x) : (x as unknown as number)), 0);
}
export const mean = (a: number[]) => (a.length ? sum(a) / a.length : 0);
export const hashStr = (s: string) => {
  let h = 2166136261;
  for (const c of s) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};
/** ¿Es un número finito (o un texto no vacío que lo representa)? */
export const fin = (v: unknown) =>
  (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && isFinite(+v);
