import { render } from '@/app/nav';
import { tripPoints } from '@/data/routes';
import { S, save } from '@/data/store';
import { showUndo } from './places.actions';
import { nTrips, newPlacePos, tripsOf } from './places.calc';
import { mergeDialog } from './places.form';
import { locState } from '@/maps/placesMap';
import { chooseDialog, confirmDialog } from '@/shared/ui/modal';
import { toast } from '@/shared/ui/toast';
import { norm } from '@/shared/utils/norm';
import { uid } from '@/shared/utils/uid';

export function canonicalPlace(name, anchor, km) {
  const n = name.trim().replace(/\s+/g, ' ');
  const p = S.places.find((p) => norm(p.name) === norm(n));
  if (p) return p.name;
  const pos = newPlacePos(n, anchor, km);
  S.places.push({
    id: uid('p'),
    name: n,
    area: '',
    lat: null,
    lng: null,
    x: pos.x,
    y: pos.y,
    kind: 'other',
  });
  return n;
}
/* Quita la selección que dependa del lugar (mapa, tiempos de traslado, modo ubicación) */
function clearPlaceSel(p) {
  const n = norm(p.name);
  if (S.ui.selPlace === p.id) S.ui.selPlace = null;
  if (S.ui.selPair && S.ui.selPair.split('→').includes(n)) S.ui.selPair = null;
  if (locState.cur && locState.cur.id === p.id) locState.cur = null;
}
/* ---- Eliminar ---- */
export async function deletePlace(id) {
  const p = S.places.find((x) => x.id === id);
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
  const opts = [
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
function removePlace(p, msg) {
  const idx = S.places.indexOf(p),
    sel = { selPlace: S.ui.selPlace, selPair: S.ui.selPair };
  if (idx < 0) return;
  S.places.splice(idx, 1);
  clearPlaceSel(p);
  save();
  render();
  showUndo(msg, () => {
    if (S.places.some((x) => x.id === p.id || norm(x.name) === norm(p.name))) {
      toast(`No se pudo deshacer: ya existe un lugar «${p.name}»`, 'err');
      return;
    }
    S.places.splice(Math.min(idx, S.places.length), 0, p);
    Object.assign(S.ui, sel);
    save();
    render();
    toast('Cambios deshechos');
  });
}
export async function mergePlace(srcId) {
  const src = S.places.find((x) => x.id === srcId);
  if (!src) return;
  const dstId = await mergeDialog(src),
    dst = dstId && S.places.find((x) => x.id === dstId);
  if (!dst || !S.places.includes(src)) return;
  const sn = norm(src.name),
    changed = [];
  S.trips.forEach((t) => {
    const o = norm(t.origin) === sn,
      d = norm(t.destination) === sn;
    if (!o && !d) return;
    changed.push({ t, origin: t.origin, destination: t.destination, points: t.points });
    if (o) t.origin = dst.name;
    if (d) t.destination = dst.name;
  });
  /* las rutas generadas por la app se rehacen con las coordenadas del destino; si no tiene ubicación (o la ruta ya era ajena) se conservan */
  changed.forEach((c) => {
    if (c.t.pointsSource === 'auto') {
      const pts = tripPoints(c.t, S.places);
      if (pts.length) c.t.points = pts;
    }
  });
  const idx = S.places.indexOf(src),
    sel = { selPlace: S.ui.selPlace, selPair: S.ui.selPair };
  S.places.splice(idx, 1);
  clearPlaceSel(src);
  save();
  render();
  showUndo(
    `«${src.name}» fusionado con «${dst.name}»${changed.length ? ` · ${nTrips(changed.length)}` : ''}`,
    () => {
      if (S.places.some((x) => x.id === src.id || norm(x.name) === norm(src.name))) {
        toast(`No se pudo deshacer: ya existe un lugar «${src.name}»`, 'err');
        return;
      }
      changed.forEach((c) => {
        if (S.trips.includes(c.t)) {
          c.t.origin = c.origin;
          c.t.destination = c.destination;
          c.t.points = c.points;
        }
      });
      S.places.splice(Math.min(idx, S.places.length), 0, src);
      Object.assign(S.ui, sel);
      save();
      render();
      toast('Cambios deshechos');
    },
  );
}
