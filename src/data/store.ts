/** Estado de la aplicación y guardado. */
import { migrate } from './migrations';
import {
  DATA_VERSION,
  normalize,
  type AppData,
  type BackupData,
  type BackupFile,
  type Raw,
} from './schema';
import { seed } from './seed';
import { Store } from '@/data/storage/local';
import { vehById } from '@/features/vehicles/vehicles.calc';

Store.init();
/** Estado vivo de la aplicación. Se reasigna solo con `setS` (los demás módulos lo leen por binding vivo). */
export let S: AppData = Store.load();
if (!S || !Array.isArray(S.trips)) setS(seed() as Raw);
else setS(migrate(S));
setS(normalize(S));
/* El archivo de datos (sección "Archivo de datos") se engancha aquí: save() escribe en localStorage al instante y avisa para que se programe la escritura al archivo */
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
/* Reemplaza los datos de la app por unos ya saneados (conserva las preferencias de pantalla; lastBackup solo si se pide) */
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
  if (!vehById(S.settings.defaultVehicle)) S.settings.defaultVehicle = S.vehicles[0]?.id || null;
}
export function setS(v: AppData) {
  S = v;
}
export function setAfterSave(f: () => void) {
  afterSave = f;
}
