import { focusSearch, render } from './nav';
import { S, save } from '@/data/store';
import { openFuelPanel } from '@/features/fuel/fuel.form';
import { closePlaceMenu, placeUi, runUndo } from '@/features/places/places.actions';
import { openTripPanel } from '@/features/trips/trips.form';
import { cancelLocate, locState } from '@/maps/placesMap';
import { closeMenu, menu } from '@/shared/ui/chrome';
import { qEl } from '@/shared/ui/dom';
import { drawerState, requestCloseDrawer } from '@/shared/ui/drawer';
import { modalState } from '@/shared/ui/modal';

document.addEventListener('keydown', (e) => {
  if (modalState.open) return;
  const t = e.target,
    typing =
      t instanceof HTMLElement && (t.matches('input,textarea,select') || t.isContentEditable);
  if (!typing && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && placeUi.undo) {
    e.preventDefault();
    runUndo();
    return;
  }
  if (e.key === 'Escape') {
    if (placeUi.menu) {
      e.preventDefault();
      closePlaceMenu(true);
      return;
    }
    if (!menu.hidden) {
      e.preventDefault();
      closeMenu(true);
      return;
    }
    if (drawerState.open) {
      e.preventDefault();
      requestCloseDrawer();
      return;
    }
    if (locState.cur) {
      e.preventDefault();
      cancelLocate();
      return;
    }
    if (t === qEl) {
      if (qEl.value) {
        qEl.value = '';
        S.ui.q = '';
        render();
      } else qEl.blur();
      return;
    }
    if (S.ui.view === 'viajes' && S.ui.selTrip) {
      const id = S.ui.selTrip;
      S.ui.selTrip = null;
      save();
      render();
      document.getElementById('row-' + id)?.focus({ preventScroll: true });
      return;
    }
    if (S.ui.view === 'lugares' && (S.ui.selPlace || S.ui.selPair)) {
      S.ui.selPlace = null;
      S.ui.selPair = null;
      render();
      return;
    }
    return;
  }
  if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (drawerState.guard && drawerState.guard() && k.length === 1 && 'nge'.includes(k))
    return; /* con cambios sin guardar en un panel, N/G/E no lo reemplazan */
  if (k === 'n') {
    e.preventDefault();
    openTripPanel();
  } else if (k === 'g') {
    e.preventDefault();
    openFuelPanel();
  } else if (k === 'e') {
    const t =
      !drawerState.open && S.ui.view === 'viajes' && S.trips.find((x) => x.id === S.ui.selTrip);
    if (t) {
      e.preventDefault();
      openTripPanel(t);
    }
  } else if (e.key === '/') {
    e.preventDefault();
    focusSearch();
  }
});
