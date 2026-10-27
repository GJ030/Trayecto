/** Almacenamiento en localStorage (claves compatibles con las versiones anteriores). */
import { stringifyData, type Raw } from '../schema';

export const KEY = 'trayecto:v2',
  KEY_V1 = 'trayecto:v1';
export const Store = {
  ok: false,
  mem: null as string | null,
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
  load(): Raw | null {
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
  /* se serializa una sola vez; la copia en memoria es ese mismo texto. Sin las rutas generadas por la app (ver stringifyData) */
  save(d: unknown) {
    const j = stringifyData(d);
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
  retireLegacy(d: unknown) {
    if (!this.legacy || !this.ok) return;
    try {
      if (localStorage.getItem(KEY) === stringifyData(d)) localStorage.removeItem(KEY_V1);
    } catch (e) {}
    this.legacy = false;
  },
};
