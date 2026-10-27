/** Acciones de la pantalla Vehículos: alta, predeterminado y eliminación (con sus viajes y cargas). */
import { S } from '@/data/store';
import { registerClick, registerSubmit } from '@/shared/ui/actions';
import { setErr } from '@/shared/ui/combo';
import { req } from '@/shared/ui/dom';
import { closeDrawer, registerDrawerActions } from '@/shared/ui/drawer';
import { confirmDialog } from '@/shared/ui/modal';
import { go } from '@/shared/ui/navigation';
import { toast } from '@/shared/ui/toast';
import { vehById } from './vehicles.calc';
import { vehiclesRepo } from './vehicles.repo';

registerClick({
  'veh-default': (el) => {
    vehiclesRepo.setDefault(el.dataset.id!);
    toast('Vehículo predeterminado actualizado');
  },
  'veh-delete': async (el) => {
    const id = el.dataset.id!;
    const v = vehById(id);
    if (!v) return;
    const nt = S.trips.filter((t) => t.vehicleId === id).length,
      nf = S.fuel.filter((f) => f.vehicleId === id).length;
    if (
      await confirmDialog({
        title: `¿Eliminar ${v.name}?`,
        body:
          nt || nf
            ? `También se eliminarán ${nt} viajes y ${nf} cargas asociadas. Esta acción no se puede deshacer.`
            : 'Esta acción no se puede deshacer.',
        ok: 'Eliminar vehículo',
      })
    ) {
      vehiclesRepo.remove(id);
      toast('Vehículo eliminado');
    }
  },
});
registerSubmit({
  addVehForm: (f) => {
    const n = req<HTMLInputElement>('#vName', f).value.trim();
    setErr(f, 'vName', n ? '' : 'Escribe un nombre para el vehículo.');
    if (!n) {
      req('#vName', f).focus();
      return;
    }
    vehiclesRepo.create({
      name: n,
      year: +req<HTMLInputElement>('#vYear', f).value || '',
      plate: req<HTMLInputElement>('#vPlate', f).value.trim().toUpperCase(),
      fuel: req<HTMLInputElement>('#vFuel', f).value,
      tank: +req<HTMLInputElement>('#vTank', f).value || '',
    });
    toast('Vehículo agregado');
  },
});
/* «Ir a Vehículos» del panel que avisa que falta un vehículo */
registerDrawerActions({
  'go-veh': () => {
    closeDrawer();
    go('vehiculos');
  },
});
