/** Acciones de Respaldo: exportar e importar JSON, CSV, tarjeta PNG y carpeta de datos. */
import { fsAction } from '@/data/storage/file';
import { registerChangeById, registerClick } from '@/shared/ui/actions';
import { $ } from '@/shared/ui/dom';
import { registerDrawerActions } from '@/shared/ui/drawer';
import { toast } from '@/shared/ui/toast';
import { tripsRepo } from '@/features/trips/trips.repo';
import { downloadTripPNG } from './backup.card';
import { exportCSV } from './backup.csv';
import { exportJSON, importJSON } from './backup.json';

const downloadCard = (id: string) => {
  const t = tripsRepo.get(id);
  if (t) downloadTripPNG(t);
};

registerClick({
  'export-json': () => exportJSON(),
  'import-json': () => $('#importFile')?.click(),
  'csv-trips': () => exportCSV('trips'),
  'csv-fuel': () => exportCSV('fuel'),
  'download-trip': (el) => downloadCard(el.dataset.id!),
  /* sin await antes: el selector de carpetas y requestPermission exigen el clic del usuario */
  'fs-pick': (el) => void fsAction(el.dataset.action!),
  'fs-reconnect': (el) => void fsAction(el.dataset.action!),
  'fs-forget': (el) => void fsAction(el.dataset.action!),
  'fs-resolve': (el) => void fsAction(el.dataset.action!),
  'fs-create': (el) => void fsAction(el.dataset.action!),
  'fs-replace': (el) => void fsAction(el.dataset.action!),
});
registerChangeById({
  importFile: (el) => {
    const file = el.files && el.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => importJSON(String(r.result));
    r.onerror = () => toast('No se pudo leer el archivo', 'err');
    r.readAsText(file);
    el.value = '';
  },
});
registerDrawerActions({ 'dl-summary': (el) => downloadCard(el.dataset.id!) });
