/** Normalización de texto para comparar nombres (sin acentos ni mayúsculas). */
export const norm = (s: unknown) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
