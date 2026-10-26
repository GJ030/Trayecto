/** Normalización de texto para comparar nombres (sin acentos ni mayúsculas). */
export const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
