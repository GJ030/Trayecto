/** Identificadores de registros nuevos. */
export const uid = (p) =>
  (p || 'id') + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
