import { render } from '@/app/nav';
import { S, save } from '@/data/store';
import { fuelTotal } from './fuel.calc';
import { confirmDialog } from '@/shared/ui/modal';
import { toast } from '@/shared/ui/toast';
import { fmtDate } from '@/shared/utils/dates';
import { MXN } from '@/shared/utils/format';

export async function deleteFuel(id) {
  const f = S.fuel.find((x) => x.id === id);
  if (!f) return false;
  if (
    !(await confirmDialog({
      title: '¿Eliminar esta carga?',
      body: `${f.station}, ${fmtDate(f.date, { day: 'numeric', month: 'long' })} · ${MXN.format(fuelTotal(f))}. El rendimiento de las cargas cercanas se recalculará.`,
      ok: 'Eliminar carga',
    }))
  )
    return false;
  S.fuel = S.fuel.filter((x) => x.id !== id);
  save();
  render();
  toast('Carga eliminada');
  return true;
}
