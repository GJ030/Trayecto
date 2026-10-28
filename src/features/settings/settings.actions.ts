/** Acciones de Ajustes: preferencias, restablecer datos de ejemplo y borrar todo. */
import type { Tag } from '@/data/schema';
import { FS, FS_DIR, FS_FILE } from '@/data/storage/file';
import { S, updateUi } from '@/data/store';
import { registerChange, registerClick } from '@/shared/ui/actions';
import { confirmDialog } from '@/shared/ui/modal';
import { toast } from '@/shared/ui/toast';
import { settingsRepo } from './settings.repo';
import { retryRouteErrors, startRoutes, stopRoutes, toggleRouting } from './settings.routing';

registerClick({
  'set-tag': (el) => settingsRepo.setDefaultTag(el.dataset.tag as Tag),
  'toggle-hints': () => settingsRepo.toggleHints(),
  'toggle-routing': () => toggleRouting(),
  'rt-start': () => startRoutes(),
  'rt-stop': () => stopRoutes(),
  'rt-retry-errors': () => retryRouteErrors(),
  'toggle-collapse': () => updateUi({ collapsed: !S.ui.collapsed }, { chrome: true }),
  'reset-demo': async () => {
    if (
      await confirmDialog({
        title: '¿Restablecer datos de ejemplo?',
        body:
          'Tus viajes, cargas, lugares y vehículos actuales se reemplazarán por los datos de muestra.' +
          (FS.handle
            ? ` También se actualizará ${FS_FILE}; la copia diaria de ${FS_DIR}/ conserva el estado anterior.`
            : ''),
        ok: 'Restablecer',
      })
    ) {
      settingsRepo.resetToDemo();
      toast('Datos de ejemplo restablecidos');
    }
  },
  wipe: async () => {
    if (
      await confirmDialog({
        title: '¿Borrar todos los datos?',
        body: `Se eliminarán ${S.trips.length} viajes, ${S.fuel.length} cargas, ${S.places.length} lugares y ${S.vehicles.length} vehículos de este equipo. Te recomendamos exportar un respaldo antes.${FS.handle ? ` También se vaciará ${FS_FILE}; la copia diaria de ${FS_DIR}/ conserva el estado anterior.` : ''}`,
        ok: 'Borrar todo',
      })
    ) {
      settingsRepo.wipeAll();
      toast('Se borraron todos los datos');
    }
  },
});
registerChange({
  'set-veh': (el) => {
    settingsRepo.setDefaultVehicle(el.value);
    toast('Vehículo predeterminado actualizado');
  },
});
