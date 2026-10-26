/** Almacenamiento en localStorage. */
const KEY = 'trayecto:v2',
  KEY_V1 = 'trayecto:v1';
export const Store = {
  ok: false,
  mem: null,
  legacy: false,
  init() {
    try {
      const k = '__trayecto_test';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      this.ok = true;
    } catch (e) {
      this.ok = false;
    }
  },
  load() {
    if (this.ok) {
      try {
        const s = localStorage.getItem(KEY);
        if (s) return JSON.parse(s);
        const old = localStorage.getItem(KEY_V1);
        if (old) {
          const o = JSON.parse(old);
          this.legacy = true;
          return o;
        }
        return null;
      } catch (e) {
        return this.mem ? JSON.parse(this.mem) : null;
      }
    }
    return this.mem ? JSON.parse(this.mem) : null;
  },
  /* se serializa una sola vez (con 500 viajes son ~1.6 MB); la copia en memoria es ese mismo texto */
  save(d) {
    const j = JSON.stringify(d);
    this.mem = j;
    if (this.ok) {
      try {
        localStorage.setItem(KEY, j);
      } catch (e) {
        this.ok = false;
      }
    }
  },
  /* Borra la clave v1 solo cuando los datos migrados ya quedaron guardados en la v2 */
  retireLegacy(d) {
    if (!this.legacy || !this.ok) return;
    try {
      if (localStorage.getItem(KEY) === JSON.stringify(d)) localStorage.removeItem(KEY_V1);
    } catch (e) {}
    this.legacy = false;
  },
};
