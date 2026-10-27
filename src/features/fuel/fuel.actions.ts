/** Acciones de la pantalla Gasolina: alta, edición y eliminación de cargas. */
import { updateUi } from '@/data/store';
import { registerClick } from '@/shared/ui/actions';
import { registerDrawerDelete } from '@/shared/ui/drawer';
import { confirmDialog } from '@/shared/ui/modal';
import { toast } from '@/shared/ui/toast';
import { fmtDate } from '@/shared/utils/dates';
import { MXN } from '@/shared/utils/format';
import { fuelTotal } from './fuel.calc';
import { openFuelPanel } from './fuel.form';
import { fuelRepo } from './fuel.repo';

/** Eliminar con confirmación; devuelve true si se eliminó (lo usa también el pie del panel en modo edición). */
async function deleteFuel(id: string) {
  const f = fuelRepo.get(id);
  if (!f) return false;
  if (
    !(await confirmDialog({
      title: '¿Eliminar esta carga?',
      body: `${f.station}, ${fmtDate(f.date, { day: 'numeric', month: 'long' })} · ${MXN.format(fuelTotal(f))}. El rendimiento de las cargas cercanas se recalculará.`,
      ok: 'Eliminar carga',
    }))
  )
    return false;
  fuelRepo.remove(id);
  toast('Carga eliminada');
  return true;
}

registerClick({
  'new-fuel': () => openFuelPanel(),
  'fuel-veh': (el) => updateUi({ ff: el.dataset.id! }),
  'edit-fuel': (el) => {
    const f = fuelRepo.get(el.dataset.id!);
    if (f) openFuelPanel(f);
  },
  'delete-fuel': (el) => {
    deleteFuel(el.dataset.id!);
  },
});
registerDrawerDelete('fuel', deleteFuel);
