/**
 * Estado de la aplicación, guardado y eventos de cambio.
 *
 * - `S` es el estado vivo. Solo los repositorios (y las operaciones de este módulo) lo modifican.
 * - Cada modificación avisa con `emitChange`; `app/` escucha esos eventos para guardar y re-renderizar.
 * - `batch` junta varias modificaciones en un solo evento.
 */
import { migrate } from './migrations';
import {
  DATA_VERSION,
  normalize,
  type AppData,
  type BackupData,
  type BackupFile,
  type Raw,
  type Ui,
} from './schema';
import { seed } from './seed';
import { Store } from '@/data/storage/local';

Store.init();
/** Estado vivo de la aplicación. Se reasigna solo con `setS` (los demás módulos lo leen por binding vivo). */
export let S: AppData = Store.load();
if (!S || !Array.isArray(S.trips)) setS(seed() as Raw);
else setS(migrate(S));
setS(normalize(S));
/* El archivo de datos se engancha aquí: save() escribe en localStorage al instante y avisa para que se programe la escritura al archivo */
let afterSave: (() => void) | null = null;
export const save = () => {
  Store.save(S);
  if (afterSave) afterSave();
};
save();
Store.retireLegacy(S);
/* Datos tal como se guardan en un respaldo (también en el archivo de datos): sin ui y con lastBackup en null */
export const snapshot = (): BackupData => ({
  vehicles: S.vehicles,
  places: S.places,
  trips: S.trips,
  fuel: S.fuel,
  settings: { ...S.settings, lastBackup: null },
});
export const backupPayload = (): BackupFile => ({
  app: 'Trayecto',
  version: DATA_VERSION,
  exportedAt: new Date().toISOString(),
  data: snapshot(),
});
export function setS(v: AppData) {
  S = v;
}
export function setAfterSave(f: () => void) {
  afterSave = f;
}

/* ---------------- Eventos de cambio ---------------- */
export type Scope =
  | 'trips'
  | 'fuel'
  | 'places'
  | 'vehicles'
  | 'settings'
  | 'ui'
  /** Cambia el aspecto del menú lateral o de las pistas de teclado. */
  | 'chrome'
  /** Se reemplazaron todos los datos (importar, restablecer, borrar). */
  | 'all'
  /** Solo hay que volver a pintar la pantalla. */
  | 'view';
export interface ChangeEvent {
  scope: Scope[];
  /** ¿Hay que guardar? (localStorage y archivo de datos) */
  persist: boolean;
  /** ¿Hay que volver a pintar la pantalla? */
  render: boolean;
}
type Listener = (e: ChangeEvent) => void;
const listeners = new Set<Listener>();
/** Escucha los cambios del estado; devuelve la función para dejar de escuchar. */
export function onChange(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
let batchDepth = 0;
let pending: ChangeEvent | null = null;
function dispatch(e: ChangeEvent) {
  for (const fn of [...listeners]) fn(e);
}
/** Avisa que el estado cambió. Dentro de `batch` los avisos se juntan en uno. */
export function emitChange(scope: Scope | Scope[], persist = true, render = true) {
  const sc = Array.isArray(scope) ? scope : [scope];
  if (batchDepth > 0) {
    pending = pending
      ? {
          scope: [...new Set([...pending.scope, ...sc])],
          persist: pending.persist || persist,
          render: pending.render || render,
        }
      : { scope: sc, persist, render };
    return;
  }
  dispatch({ scope: sc, persist, render });
}
/** Ejecuta `fn` y emite un solo evento con todo lo que cambió dentro. */
export function batch<T>(fn: () => T): T {
  batchDepth++;
  try {
    return fn();
  } finally {
    batchDepth--;
    if (batchDepth === 0 && pending) {
      const e = pending;
      pending = null;
      dispatch(e);
    }
  }
}
/** Pide volver a pintar la pantalla sin guardar nada. */
export const requestRender = () => emitChange('view', false);
/**
 * Cambia el estado de pantalla (`S.ui`). Por omisión se guarda y se vuelve a pintar;
 * `silent` evita el evento cuando quien llama lo hará por su cuenta.
 */
export function updateUi(
  patch: Partial<Ui>,
  opts: { persist?: boolean; render?: boolean; silent?: boolean; chrome?: boolean } = {},
) {
  Object.assign(S.ui, patch);
  if (!opts.silent)
    emitChange(opts.chrome ? ['ui', 'chrome'] : 'ui', opts.persist ?? true, opts.render ?? true);
}
/** Cambia solo la búsqueda (`S.ui.q`); no se guarda: se limpia al abrir. */
export const setQuery = (q: string, render = true) => updateUi({ q }, { persist: false, render });

/**
 * Reemplaza los datos de la app por unos ya saneados (conserva las preferencias de pantalla;
 * lastBackup solo si se pide). No emite: quien llama decide si guarda.
 */
export function adoptData(data: BackupData, keepLastBackup?: boolean) {
  const ui = {
    ...S.ui,
    selTrip: null,
    selPlace: null,
    selPair: null,
    tf: { tag: 'Todos', vehicle: 'all', from: '', to: '' },
  };
  const settings = Object.assign({}, data.settings, { hints: S.settings.hints });
  if (keepLastBackup) settings.lastBackup = S.settings.lastBackup;
  setS(
    normalize({
      vehicles: data.vehicles,
      places: data.places,
      trips: data.trips,
      fuel: data.fuel,
      settings,
      ui,
    }),
  );
  if (!S.vehicles.find((v) => v.id === S.settings.defaultVehicle))
    S.settings.defaultVehicle = S.vehicles[0]?.id || null;
}
