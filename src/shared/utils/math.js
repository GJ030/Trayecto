/** Sumas, promedios y hash. */
export const sum = (a, f) => a.reduce((s, x) => s + (f ? f(x) : x), 0);
export const mean = (a) => (a.length ? sum(a) / a.length : 0);
export const hashStr = (s) => {
  let h = 2166136261;
  for (const c of s) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};
export const fin = (v) =>
  (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && isFinite(+v);
