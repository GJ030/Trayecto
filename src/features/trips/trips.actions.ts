/** Acciones de la pantalla Viajes: selección, orden, filtros, edición y eliminación. */
import { S, updateUi } from '@/data/store';
import { registerClick, registerChange, registerKeydown } from '@/shared/ui/actions';
import { closeDrawer, registerDrawerActions, registerDrawerDelete } from '@/shared/ui/drawer';
import { qEl, req } from '@/shared/ui/dom';
import { go } from '@/shared/ui/navigation';
import { confirmDialog } from '@/shared/ui/modal';
import { toast } from '@/shared/ui/toast';
import { fmtDate } from '@/shared/utils/dates';
import type { SortKey, Tag } from '@/data/schema';
import { openTripPanel } from './trips.form';
import { tripsRepo } from './trips.repo';

const NO_FILTERS = { tag: 'Todos', vehicle: 'all', from: '', to: '' } as const;

/** Eliminar con confirmación; devuelve true si se eliminó (lo usa también el pie del panel en modo edición). */
async function deleteTrip(id: string) {
  const t = tripsRepo.get(id);
  if (!t) return false;
  if (
    !(await confirmDialog({
      title: '¿Eliminar este viaje?',
      body: `${t.origin} → ${t.destination}, ${fmtDate(t.date, { day: 'numeric', month: 'long' })}. Esta acción no se puede deshacer.`,
      ok: 'Eliminar viaje',
    }))
  )
    return false;
  tripsRepo.remove(id);
  toast('Viaje eliminado');
  return true;
}

registerClick({
  'new-trip': () => openTripPanel(),
  'open-trip': (el) => {
    updateUi({ selTrip: el.dataset.id! }, { silent: true });
    go('viajes');
  },
  sort: (el) => {
    const k = el.dataset.key as SortKey,
      s = S.ui.sort;
    updateUi({
      sort:
        s.key === k
          ? { key: k, dir: s.dir === 'asc' ? 'desc' : 'asc' }
          : { key: k, dir: ['route', 'tag', 'vehicle'].includes(k) ? 'asc' : 'desc' },
    });
  },
  'select-trip': (el) => {
    const id = el.dataset.id!;
    updateUi({ selTrip: S.ui.selTrip === id ? null : id });
    document.getElementById('row-' + id)?.focus({ preventScroll: true });
  },
  'close-detail': () => {
    const sid = S.ui.selTrip;
    updateUi({ selTrip: null });
    document.getElementById('row-' + sid)?.focus({ preventScroll: true });
  },
  'filter-tag': (el) => updateUi({ tf: { ...S.ui.tf, tag: el.dataset.tag as 'Todos' | Tag } }),
  'clear-filters': () => {
    qEl.value = '';
    updateUi({ tf: { ...NO_FILTERS }, q: '' });
  },
  'edit-trip': (el) => {
    const t = tripsRepo.get(el.dataset.id!);
    if (t) openTripPanel(t);
  },
  'delete-trip': (el) => {
    deleteTrip(el.dataset.id!);
  },
});
registerChange({
  'f-veh': (el) => updateUi({ tf: { ...S.ui.tf, vehicle: el.value } }),
  'f-from': (el) => updateUi({ tf: { ...S.ui.tf, from: el.value } }),
  'f-to': (el) => updateUi({ tf: { ...S.ui.tf, to: el.value } }),
});
/* ↑ ↓ mueven la selección entre las filas de la tabla */
registerKeydown((e, el) => {
  if (!el.matches('tr[data-id]') || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return false;
  e.preventDefault();
  const sib = (
    e.key === 'ArrowDown' ? el.nextElementSibling : el.previousElementSibling
  ) as HTMLElement | null;
  if (sib) {
    if (S.ui.selTrip) {
      updateUi({ selTrip: sib.dataset.id! });
      document.getElementById('row-' + sib.dataset.id)?.focus();
    } else sib.focus();
  }
  return true;
});
registerDrawerDelete('trip', deleteTrip);
registerDrawerActions({
  swap: () => {
    const o = req<HTMLInputElement>('#tOrigin'),
      d = req<HTMLInputElement>('#tDest');
    [o.value, d.value] = [d.value, o.value];
    o.dispatchEvent(new Event('change', { bubbles: true }));
  },
  'view-trip': (el) => {
    updateUi({ selTrip: el.dataset.id!, tf: { ...NO_FILTERS } }, { silent: true });
    closeDrawer();
    go('viajes');
    document.getElementById('row-' + el.dataset.id)?.scrollIntoView({ block: 'nearest' });
  },
  another: () => openTripPanel(),
});
