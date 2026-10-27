/** Acciones de la pantalla Lugares: selección, menú ⋮, alta, edición, eliminación y fusión. */
import { S, updateUi } from '@/data/store';
import { locState, setPlacesMapData } from '@/maps/placesMap';
import { registerClick, registerSubmit } from '@/shared/ui/actions';
import { req } from '@/shared/ui/dom';
import { chooseDialog, confirmDialog, type ChoiceOption } from '@/shared/ui/modal';
import { toast } from '@/shared/ui/toast';
import { norm } from '@/shared/utils/norm';
import { nTrips, pairStats, placeVisits, tripsOf } from './places.calc';
import { mergeDialog, openPlacePanel } from './places.form';
import { cancelLocate, saveLocation, startLocate } from './places.locate';
import { placesRepo } from './places.repo';
import { closePlaceMenu, showUndo, togglePlaceMenu } from './places.ui';
import type { PlaceUndo } from './places.repo';
import type { Place } from '@/data/schema';

/* El mapa de lugares pide las visitas y los trayectos a esta funcionalidad */
setPlacesMapData(() => ({ vis: placeVisits(), pairs: pairStats() }));

/** Muestra el aviso «Deshacer» de un lugar eliminado o fusionado. */
function offerUndo(msg: string, u: PlaceUndo, name: string) {
  showUndo(msg, () => {
    if (!u.undo()) toast(`No se pudo deshacer: ya existe un lugar «${name}»`, 'err');
    else toast('Cambios deshechos');
  });
}
function removePlace(p: Place, msg: string) {
  if (locState.cur && locState.cur.id === p.id) locState.cur = null;
  const u = placesRepo.remove(p.id);
  if (u) offerUndo(msg, u, p.name);
}
async function mergePlace(srcId: string) {
  const src = placesRepo.get(srcId);
  if (!src) return;
  const dstId = await mergeDialog(src),
    dst = dstId && placesRepo.get(dstId);
  if (!dst || !placesRepo.list().includes(src)) return;
  if (locState.cur && locState.cur.id === src.id) locState.cur = null;
  const r = placesRepo.merge(src.id, dst.id);
  if (r)
    offerUndo(
      `«${src.name}» fusionado con «${dst.name}»${r.moved ? ` · ${nTrips(r.moved)}` : ''}`,
      r,
      src.name,
    );
}
async function deletePlace(id: string) {
  const p = placesRepo.get(id);
  if (!p) return;
  const n = tripsOf(p).length;
  if (!n) {
    if (
      !(await confirmDialog({
        title: `¿Eliminar «${p.name}»?`,
        body: 'No tiene viajes asociados. Podrás deshacerlo durante unos segundos.',
        ok: 'Eliminar lugar',
      }))
    )
      return;
    removePlace(p, `Lugar «${p.name}» eliminado`);
    return;
  }
  const opts: ChoiceOption<'keep' | 'merge'>[] = [
    {
      value: 'keep',
      title: 'Conservar los viajes',
      lines: [
        `${n === 1 ? 'El viaje mantiene' : `Los ${n} viajes mantienen`} su texto y su ruta.`,
        'El lugar desaparece de la lista y del mapa.',
      ],
    },
  ];
  if (S.places.length > 1)
    opts.push({
      value: 'merge',
      title: 'Fusionar con otro lugar',
      lines: [
        `${n === 1 ? 'El viaje pasa' : `Los ${n} viajes pasan`} a usar otro lugar y sus rutas automáticas se ajustan.`,
      ],
    });
  const c = await chooseDialog({
    title: `«${p.name}» tiene ${nTrips(n)}`,
    body: 'Nunca se borran viajes. Elige qué hacer con ellos.',
    options: opts,
    cancel: 'Cancelar',
  });
  if (c === 'keep') removePlace(p, `Lugar «${p.name}» eliminado · ${nTrips(n)} conservados`);
  else if (c === 'merge') mergePlace(id);
}

registerClick({
  'place-more': (el) => togglePlaceMenu(el),
  'place-edit': (el) => {
    const p = placesRepo.get(el.dataset.id!);
    closePlaceMenu(true);
    if (p) openPlacePanel(p);
  },
  'place-merge': (el) => {
    closePlaceMenu(true);
    mergePlace(el.dataset.id!);
  },
  'place-delete': (el) => {
    closePlaceMenu(true);
    deletePlace(el.dataset.id!);
  },
  'place-select': (el, e) => {
    const id = el.dataset.id!;
    updateUi({ selPlace: S.ui.selPlace === id ? null : id, selPair: null }, { persist: false });
    const f =
      document.getElementById('pl-' + id) && (e.target as HTMLElement).closest('.row-btn')
        ? document.getElementById('pl-' + id)
        : document.getElementById('mpin-' + id) || document.getElementById('pin-' + id);
    f?.focus({ preventScroll: true });
  },
  'places-layer': (el) => {
    updateUi({ placesLayer: el.dataset.layer as 'lugares' | 'rutas' | 'calor' });
    document.getElementById('lyr-' + el.dataset.layer)?.focus({ preventScroll: true });
  },
  'locate-start': (el) => {
    closePlaceMenu(true);
    startLocate(el.dataset.id!);
  },
  'locate-save': () => saveLocation(),
  'locate-cancel': () => cancelLocate(),
  'pair-select': (el) => {
    updateUi(
      { selPair: S.ui.selPair === el.dataset.key ? null : el.dataset.key! },
      { persist: false },
    );
    document.getElementById(el.id)?.focus({ preventScroll: true });
  },
  'clear-place': () => updateUi({ selPlace: null, selPair: null }, { persist: false }),
});
registerSubmit({
  addPlaceForm: (f) => {
    const n = req<HTMLInputElement>('#plName', f).value.trim().replace(/\s+/g, ' '),
      ar = req<HTMLInputElement>('#plArea', f).value.trim();
    if (!n) {
      req('#plName', f).focus();
      return;
    }
    if (placesRepo.list().some((p) => norm(p.name) === norm(n))) {
      toast('Ese lugar ya existe', 'err');
      return;
    }
    const loc = !!f.querySelector<HTMLInputElement>('#plLocate')?.checked;
    const np = placesRepo.create({ name: n, area: ar });
    toast('Lugar agregado');
    if (loc) startLocate(np.id); /* ofrece ubicarlo de inmediato */
  },
});
