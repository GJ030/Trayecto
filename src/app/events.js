import { go, render } from './nav';
import { PALETTE, normalize } from '@/data/schema';
import { seed } from '@/data/seed';
import { FS, FS_DIR, FS_FILE, fsAction } from '@/data/storage/file';
import { S, save, setS } from '@/data/store';
import { downloadTripPNG } from '@/features/backup/backup.card';
import { exportCSV } from '@/features/backup/backup.csv';
import { exportJSON, importJSON } from '@/features/backup/backup.json';
import { openFuelPanel } from '@/features/fuel/fuel.form';
import { deleteFuel } from '@/features/fuel/fuel.repo';
import { closePlaceMenu, togglePlaceMenu } from '@/features/places/places.actions';
import { newPlacePos } from '@/features/places/places.calc';
import { openPlacePanel } from '@/features/places/places.form';
import { deletePlace, mergePlace } from '@/features/places/places.repo';
import { openTripPanel } from '@/features/trips/trips.form';
import { deleteTrip } from '@/features/trips/trips.repo';
import { vehById } from '@/features/vehicles/vehicles.calc';
import { cancelLocate, saveLocation, startLocate } from '@/maps/placesMap';
import { Play, scrubPlay, togglePlay, updatePlayUI } from '@/maps/play';
import { applyChrome } from '@/shared/ui/chrome';
import { setErr } from '@/shared/ui/combo';
import { $, contentEl, qEl } from '@/shared/ui/dom';
import { closeDrawer, drawer, requestCloseDrawer } from '@/shared/ui/drawer';
import { confirmDialog } from '@/shared/ui/modal';
import { toast } from '@/shared/ui/toast';
import { norm } from '@/shared/utils/norm';
import { uid } from '@/shared/utils/uid';

drawer.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-dz]');
  if (!el) return;
  const a = el.dataset.dz;
  if (a === 'close') requestCloseDrawer();
  else if (a === 'delete') {
    if (await (el.dataset.kind === 'trip' ? deleteTrip : deleteFuel)(el.dataset.id)) closeDrawer();
  } else if (a === 'go-veh') {
    closeDrawer();
    go('vehiculos');
  } else if (a === 'swap') {
    const o = $('#tOrigin'),
      d = $('#tDest');
    [o.value, d.value] = [d.value, o.value];
    o.dispatchEvent(new Event('change', { bubbles: true }));
  } else if (a === 'dl-summary') {
    const t = S.trips.find((x) => x.id === el.dataset.id);
    if (t) downloadTripPNG(t);
  } else if (a === 'view-trip') {
    S.ui.selTrip = el.dataset.id;
    S.ui.tf = { tag: 'Todos', vehicle: 'all', from: '', to: '' };
    closeDrawer();
    go('viajes');
    document.getElementById('row-' + el.dataset.id)?.scrollIntoView({ block: 'nearest' });
  } else if (a === 'another') openTripPanel();
});
contentEl.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || !contentEl.contains(el) || el.disabled) return;
  const a = el.dataset.action,
    id = el.dataset.id;
  switch (a) {
    case 'go':
      go(el.dataset.view);
      break;
    case 'new-trip':
      openTripPanel();
      break;
    case 'new-fuel':
      openFuelPanel();
      break;
    case 'open-trip':
      S.ui.selTrip = id;
      go('viajes');
      break;
    case 'dash-veh':
      S.ui.dashVeh = id;
      save();
      render();
      break;
    case 'sort': {
      const k = el.dataset.key,
        s = S.ui.sort;
      S.ui.sort =
        s.key === k
          ? { key: k, dir: s.dir === 'asc' ? 'desc' : 'asc' }
          : { key: k, dir: ['route', 'tag', 'vehicle'].includes(k) ? 'asc' : 'desc' };
      save();
      render();
      break;
    }
    case 'select-trip': {
      S.ui.selTrip = S.ui.selTrip === id ? null : id;
      save();
      render();
      document.getElementById('row-' + id)?.focus({ preventScroll: true });
      break;
    }
    case 'close-detail': {
      const sid = S.ui.selTrip;
      S.ui.selTrip = null;
      save();
      render();
      document.getElementById('row-' + sid)?.focus({ preventScroll: true });
      break;
    }
    case 'filter-tag':
      S.ui.tf.tag = el.dataset.tag;
      save();
      render();
      break;
    case 'clear-filters':
      S.ui.tf = { tag: 'Todos', vehicle: 'all', from: '', to: '' };
      S.ui.q = '';
      qEl.value = '';
      save();
      render();
      break;
    case 'download-trip': {
      const t = S.trips.find((x) => x.id === id);
      if (t) downloadTripPNG(t);
      break;
    }
    case 'edit-trip': {
      const t = S.trips.find((x) => x.id === id);
      if (t) openTripPanel(t);
      break;
    }
    case 'delete-trip':
      deleteTrip(id);
      break;
    case 'fuel-veh':
      S.ui.ff = id;
      save();
      render();
      break;
    case 'edit-fuel': {
      const f = S.fuel.find((x) => x.id === id);
      if (f) openFuelPanel(f);
      break;
    }
    case 'delete-fuel':
      deleteFuel(id);
      break;
    case 'place-more':
      togglePlaceMenu(el);
      break;
    case 'place-edit': {
      const p = S.places.find((x) => x.id === id);
      closePlaceMenu(true);
      if (p) openPlacePanel(p);
      break;
    }
    case 'place-merge':
      closePlaceMenu(true);
      mergePlace(id);
      break;
    case 'place-delete':
      closePlaceMenu(true);
      deletePlace(id);
      break;
    case 'place-select':
      S.ui.selPlace = S.ui.selPlace === id ? null : id;
      S.ui.selPair = null;
      render();
      {
        const f =
          document.getElementById('pl-' + id) && e.target.closest('.row-btn')
            ? document.getElementById('pl-' + id)
            : document.getElementById('mpin-' + id) || document.getElementById('pin-' + id);
        f?.focus({ preventScroll: true });
      }
      break;
    case 'places-layer':
      S.ui.placesLayer = el.dataset.layer;
      save();
      render();
      document.getElementById('lyr-' + el.dataset.layer)?.focus({ preventScroll: true });
      break;
    case 'locate-start':
      closePlaceMenu(true);
      startLocate(id);
      break;
    case 'locate-save':
      saveLocation();
      break;
    case 'locate-cancel':
      cancelLocate();
      break;
    case 'play-toggle':
      togglePlay(id);
      break;
    case 'play-speed':
      Play.speed = +el.dataset.speed;
      updatePlayUI();
      break;
    case 'pair-select':
      S.ui.selPair = S.ui.selPair === el.dataset.key ? null : el.dataset.key;
      render();
      document.getElementById(el.id)?.focus({ preventScroll: true });
      break;
    case 'clear-place':
      S.ui.selPlace = null;
      S.ui.selPair = null;
      render();
      break;
    case 'stat-tab':
      S.ui.statTab = el.dataset.tab;
      save();
      render();
      break;
    case 'veh-default':
      S.settings.defaultVehicle = id;
      save();
      render();
      toast('Vehículo predeterminado actualizado');
      break;
    case 'veh-delete': {
      const v = vehById(id);
      if (!v) break;
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
        S.vehicles = S.vehicles.filter((x) => x.id !== id);
        S.trips = S.trips.filter((t) => t.vehicleId !== id);
        S.fuel = S.fuel.filter((f) => f.vehicleId !== id);
        if (S.settings.defaultVehicle === id) S.settings.defaultVehicle = S.vehicles[0]?.id || null;
        if (S.ui.tf.vehicle === id) S.ui.tf.vehicle = 'all';
        if (S.ui.ff === id) S.ui.ff = 'all';
        S.ui.selTrip = null;
        save();
        render();
        toast('Vehículo eliminado');
      }
      break;
    }
    case 'set-tag':
      S.settings.defaultTag = el.dataset.tag;
      save();
      render();
      break;
    case 'toggle-hints':
      S.settings.hints = !S.settings.hints;
      save();
      applyChrome();
      render();
      break;
    case 'toggle-collapse':
      S.ui.collapsed = !S.ui.collapsed;
      save();
      applyChrome();
      render();
      break;
    case 'reset-demo':
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
        const ui = { ...S.ui, selTrip: null, selPlace: null, selPair: null };
        setS(normalize(Object.assign(seed(), { ui })));
        save();
        applyChrome();
        render();
        toast('Datos de ejemplo restablecidos');
      }
      break;
    case 'wipe':
      if (
        await confirmDialog({
          title: '¿Borrar todos los datos?',
          body: `Se eliminarán ${S.trips.length} viajes, ${S.fuel.length} cargas, ${S.places.length} lugares y ${S.vehicles.length} vehículos de este equipo. Te recomendamos exportar un respaldo antes.${FS.handle ? ` También se vaciará ${FS_FILE}; la copia diaria de ${FS_DIR}/ conserva el estado anterior.` : ''}`,
          ok: 'Borrar todo',
        })
      ) {
        const ui = {
          ...S.ui,
          selTrip: null,
          selPlace: null,
          selPair: null,
          tf: { tag: 'Todos', vehicle: 'all', from: '', to: '' },
        };
        setS(normalize({ settings: { hints: S.settings.hints }, ui }));
        save();
        render();
        toast('Se borraron todos los datos');
      }
      break;
    case 'fs-pick':
    case 'fs-reconnect':
    case 'fs-forget':
    case 'fs-resolve':
    case 'fs-create':
    case 'fs-replace':
      fsAction(a);
      break; /* sin await antes: el selector de carpetas y requestPermission exigen el clic del usuario */
    case 'export-json':
      exportJSON();
      break;
    case 'import-json':
      $('#importFile')?.click();
      break;
    case 'csv-trips':
      exportCSV('trips');
      break;
    case 'csv-fuel':
      exportCSV('fuel');
      break;
  }
});
contentEl.addEventListener('change', (e) => {
  const el = e.target;
  if (el.id === 'importFile') {
    const file = el.files && el.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => importJSON(String(r.result));
    r.onerror = () => toast('No se pudo leer el archivo', 'err');
    r.readAsText(file);
    el.value = '';
    return;
  }
  const a = el.dataset.change;
  if (!a) return;
  if (a === 'f-veh') S.ui.tf.vehicle = el.value;
  else if (a === 'f-from') S.ui.tf.from = el.value;
  else if (a === 'f-to') S.ui.tf.to = el.value;
  else if (a === 'set-veh') {
    S.settings.defaultVehicle = el.value;
    toast('Vehículo predeterminado actualizado');
  }
  save();
  render();
});
contentEl.addEventListener('input', (e) => {
  const r = e.target;
  if (r.matches && r.matches('[data-play-range]')) scrubPlay(r.dataset.playRange, +r.value);
});
contentEl.addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  if (f.id === 'addPlaceForm') {
    const n = $('#plName', f).value.trim().replace(/\s+/g, ' '),
      ar = $('#plArea', f).value.trim();
    if (!n) {
      $('#plName', f).focus();
      return;
    }
    if (S.places.some((p) => norm(p.name) === norm(n))) {
      toast('Ese lugar ya existe', 'err');
      return;
    }
    const pos = newPlacePos(n),
      np = {
        id: uid('p'),
        name: n,
        area: ar,
        lat: null,
        lng: null,
        x: pos.x,
        y: pos.y,
        kind: 'other',
      },
      loc = !!$('#plLocate', f)?.checked;
    S.places.push(np);
    save();
    render();
    toast('Lugar agregado');
    if (loc) startLocate(np.id); /* ofrece ubicarlo de inmediato */
  } else if (f.id === 'addVehForm') {
    const n = $('#vName', f).value.trim();
    setErr(f, 'vName', n ? '' : 'Escribe un nombre para el vehículo.');
    if (!n) {
      $('#vName', f).focus();
      return;
    }
    const v = {
      id: uid('v'),
      name: n,
      year: +$('#vYear', f).value || '',
      plate: $('#vPlate', f).value.trim().toUpperCase(),
      fuel: $('#vFuel', f).value,
      tank: +$('#vTank', f).value || '',
      color: PALETTE[S.vehicles.length % PALETTE.length],
    };
    S.vehicles.push(v);
    if (!vehById(S.settings.defaultVehicle)) S.settings.defaultVehicle = v.id;
    save();
    render();
    toast('Vehículo agregado');
  }
});
contentEl.addEventListener('keydown', (e) => {
  const el = e.target;
  if (el.matches('tr[data-id]') && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
    e.preventDefault();
    const sib = e.key === 'ArrowDown' ? el.nextElementSibling : el.previousElementSibling;
    if (sib) {
      if (S.ui.selTrip) {
        S.ui.selTrip = sib.dataset.id;
        save();
        render();
        document.getElementById('row-' + sib.dataset.id)?.focus();
      } else sib.focus();
    }
    return;
  }
  if (
    (e.key === 'Enter' || e.key === ' ') &&
    el.matches('[data-action]:not(button):not(input):not(select)')
  ) {
    e.preventDefault();
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }
});
