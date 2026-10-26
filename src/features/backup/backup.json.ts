import { render } from '@/app/nav';
import { parseBackup } from '@/data/schema';
import { FS } from '@/data/storage/file';
import { S, adoptData, backupPayload, save } from '@/data/store';
import { applyChrome } from '@/shared/ui/chrome';
import { confirmDialog } from '@/shared/ui/modal';
import { toast } from '@/shared/ui/toast';
import { isoDate } from '@/shared/utils/dates';
import { download } from '@/shared/utils/download';

export function exportJSON() {
  const payload = backupPayload();
  download(
    `trayecto-respaldo-${isoDate(new Date())}.json`,
    JSON.stringify(payload, null, 2),
    'application/json',
  );
  S.settings.lastBackup = new Date().toISOString();
  save();
  render();
  toast('Respaldo exportado');
}
export async function importJSON(text: string) {
  let o: unknown;
  try {
    o = JSON.parse(text);
  } catch (_) {
    toast('El archivo no es un JSON válido', 'err');
    return;
  }
  const r = parseBackup(o);
  if (r.error !== undefined) {
    toast(r.error, 'err');
    return;
  }
  const { vehicles, places, trips, fuel } = r.data;
  const ok = await confirmDialog({
    title: '¿Reemplazar tus datos?',
    body: `Se importarán ${trips.length} viajes, ${fuel.length} cargas, ${places.length} lugares y ${vehicles.length} vehículos. Tus datos actuales se reemplazarán.${FS.handle ? ' El archivo de la carpeta de datos también se actualizará.' : ''}`,
    ok: 'Importar',
    danger: false,
  });
  if (!ok) return;
  adoptData(r.data);
  save();
  applyChrome();
  render();
  toast('Respaldo importado');
}
