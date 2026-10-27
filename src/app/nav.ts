import type { ViewName } from '@/data/schema';
import { S, save, updateUi } from '@/data/store';
import { renderRespaldo } from '@/features/backup/backup.view';
import { renderInicio } from '@/features/dashboard/dashboard.view';
import { derive } from '@/features/fuel/fuel.calc';
import { renderGasolina } from '@/features/fuel/fuel.view';
import { renderLugares } from '@/features/places/places.view';
import { renderAjustes } from '@/features/settings/settings.view';
import { renderEstadisticas } from '@/features/stats/stats.view';
import { renderViajes } from '@/features/trips/trips.view';
import { renderVehiculos } from '@/features/vehicles/vehicles.view';
import { locState } from '@/maps/placesMap';
import { syncPlay } from '@/maps/play';
import { mountMaps, parkMaps } from '@/maps/registry';
import { $$, contentEl, qEl, req } from '@/shared/ui/dom';
import { drawerState } from '@/shared/ui/drawer';

const greet = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
};
interface ViewDef {
  title: string;
  sub: () => string;
  render: () => string;
  ph?: string;
}
const VIEWS: Record<ViewName, ViewDef> = {
  inicio: {
    title: 'Inicio',
    sub: () => `${greet()} · así van tus trayectos`,
    render: renderInicio,
  },
  viajes: {
    title: 'Viajes',
    sub: () =>
      `${S.trips.length} ${S.trips.length === 1 ? 'viaje registrado' : 'viajes registrados'}`,
    render: renderViajes,
    ph: 'Buscar por lugar, vehículo o fecha…',
  },
  gasolina: {
    title: 'Gasolina',
    sub: () =>
      `${S.fuel.length} ${S.fuel.length === 1 ? 'carga registrada' : 'cargas registradas'}`,
    render: renderGasolina,
    ph: 'Buscar gasolinera o vehículo…',
  },
  lugares: {
    title: 'Lugares',
    sub: () =>
      `${S.places.length} ${S.places.length === 1 ? 'lugar guardado' : 'lugares guardados'}`,
    render: renderLugares,
    ph: 'Buscar lugares…',
  },
  estadisticas: {
    title: 'Estadísticas',
    sub: () => 'Tendencias de los últimos 6 meses',
    render: renderEstadisticas,
  },
  vehiculos: {
    title: 'Vehículos',
    sub: () => `${S.vehicles.length} ${S.vehicles.length === 1 ? 'vehículo' : 'vehículos'}`,
    render: renderVehiculos,
  },
  ajustes: { title: 'Ajustes', sub: () => 'Preferencias de la aplicación', render: renderAjustes },
  respaldo: {
    title: 'Respaldo',
    sub: () => 'Tus datos viven solo en este equipo',
    render: renderRespaldo,
  },
};
const SEARCHABLE: ViewName[] = ['viajes', 'gasolina', 'lugares'];
export function render(viewChanged?: boolean) {
  derive();
  const v = VIEWS[S.ui.view] || VIEWS.inicio;
  const ae = document.activeElement as HTMLInputElement | null;
  let rid: string | null = null,
    sel: [number, number] | null = null;
  if (ae && contentEl.contains(ae) && ae.id) {
    rid = ae.id;
    try {
      if (typeof ae.selectionStart === 'number')
        sel = [ae.selectionStart, ae.selectionEnd as number];
    } catch (_) {}
  }
  req('#pageTitle').textContent = v.title;
  req('#pageSub').textContent = v.sub();
  qEl.placeholder = v.ph || 'Buscar viajes…';
  $$('.nav-item[data-view]').forEach((b) =>
    b.dataset.view === S.ui.view
      ? b.setAttribute('aria-current', 'page')
      : b.removeAttribute('aria-current'),
  );
  if (locState.cur && S.ui.view !== 'lugares') locState.cur = null;
  parkMaps(contentEl);
  contentEl.innerHTML = v.render();
  mountMaps(contentEl);
  syncPlay();
  if (viewChanged) contentEl.firstElementChild?.classList.add('fade');
  if (rid) {
    const el = document.getElementById(rid) as HTMLInputElement | null;
    if (el) {
      el.focus({ preventScroll: true });
      if (sel)
        try {
          el.setSelectionRange(sel[0], sel[1]);
        } catch (_) {}
    }
  }
}
export function go(view: ViewName, keepQ?: boolean) {
  if (!VIEWS[view]) return;
  const changed = S.ui.view !== view;
  updateUi(keepQ ? { view } : { view, q: '' }, { silent: true });
  if (!keepQ) qEl.value = '';
  save();
  render(changed);
  if (changed) window.scrollTo({ top: 0 });
}
/* ---- Búsqueda ---- */
qEl.addEventListener('input', () => {
  if (!SEARCHABLE.includes(S.ui.view)) {
    updateUi({ q: qEl.value, view: 'viajes' }, { silent: true });
    render(true);
  } else {
    updateUi({ q: qEl.value }, { silent: true });
    render();
  }
});
export function focusSearch() {
  if (drawerState.open) return;
  if (!SEARCHABLE.includes(S.ui.view)) go('viajes');
  qEl.focus();
  qEl.select();
}
