import { render } from '@/app/nav';
import { S, save } from '@/data/store';
import { confirmDialog } from '@/shared/ui/modal';
import { toast } from '@/shared/ui/toast';
import { fmtDate } from '@/shared/utils/dates';

/* Eliminar con confirmación; devuelven true si se eliminó (los usa también el pie del panel en modo edición) */
export async function deleteTrip(id: string) {
  const t = S.trips.find((x) => x.id === id);
  if (!t) return false;
  if (
    !(await confirmDialog({
      title: '¿Eliminar este viaje?',
      body: `${t.origin} → ${t.destination}, ${fmtDate(t.date, { day: 'numeric', month: 'long' })}. Esta acción no se puede deshacer.`,
      ok: 'Eliminar viaje',
    }))
  )
    return false;
  S.trips = S.trips.filter((x) => x.id !== id);
  S.ui.selTrip = null;
  save();
  render();
  toast('Viaje eliminado');
  return true;
}
