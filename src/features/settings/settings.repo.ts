/**
 * Repositorio de ajustes: preferencias de la app y operaciones que reemplazan todos los datos
 * (restablecer a los datos de ejemplo y borrar todo).
 */
import { normalize, type Settings } from '@/data/schema';
import { seed } from '@/data/seed';
import { S, emitChange, setS } from '@/data/store';

export const settingsRepo = {
  get: (): Readonly<Settings> => S.settings,
  update(patch: Partial<Settings>) {
    Object.assign(S.settings, patch);
    emitChange('settings');
  },

  /* ---- Operaciones propias ---- */
  setDefaultTag(tag: Settings['defaultTag']) {
    this.update({ defaultTag: tag });
  },
  setDefaultVehicle(id: string) {
    this.update({ defaultVehicle: id });
  },
  /** Muestra u oculta las pistas de teclado. */
  toggleHints() {
    S.settings.hints = !S.settings.hints;
    emitChange(['settings', 'chrome']);
  },
  /** Anota la fecha del último respaldo exportado. */
  markBackup(date: Date = new Date()) {
    S.settings.lastBackup = date.toISOString();
    emitChange('settings');
  },
  /** Reemplaza todos los datos por los de ejemplo (conserva las preferencias de pantalla). */
  resetToDemo() {
    const ui = { ...S.ui, selTrip: null, selPlace: null, selPair: null };
    setS(normalize(Object.assign(seed(), { ui })));
    emitChange(['all', 'chrome']);
  },
  /** Borra viajes, cargas, lugares y vehículos (conserva las pistas de teclado y la pantalla). */
  wipeAll() {
    const ui = {
      ...S.ui,
      selTrip: null,
      selPlace: null,
      selPair: null,
      tf: { tag: 'Todos', vehicle: 'all', from: '', to: '' },
    };
    setS(normalize({ settings: { hints: S.settings.hints }, ui }));
    emitChange('all');
  },
};
