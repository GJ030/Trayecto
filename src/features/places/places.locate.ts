/** Modo ubicación: colocar o mover un lugar en el mapa real. */
import { requestRender } from '@/data/store';
import { locState } from '@/maps/placesMap';
import { MapReg } from '@/maps/registry';
import { reduceMotion } from '@/shared/ui/dom';
import { toast } from '@/shared/ui/toast';
import { validGeo } from '@/shared/utils/geo';
import { placesRepo } from './places.repo';

export function startLocate(id: string) {
  const p = placesRepo.get(id),
    m = MapReg.find((x) => x.kind === 'places');
  if (!p) return;
  if (!m || m.state === 'failed') {
    toast('El mapa no está disponible sin conexión', 'err');
    return;
  }
  const has = validGeo(p.lat, p.lng);
  locState.cur = { id, lat: has ? p.lat : null, lng: has ? p.lng : null };
  requestRender();
  if (has && m.map)
    m.map.easeTo({
      center: [p.lng as number, p.lat as number],
      duration: reduceMotion() ? 0 : 400,
    });
}
export function cancelLocate() {
  if (!locState.cur) return;
  locState.cur = null;
  requestRender();
}
/* Guarda la ubicación: x/y del SVG pasan a calcularse desde lat/lng y se regeneran las rutas automáticas que usan el lugar */
export function saveLocation() {
  const cur = locState.cur;
  const p = cur && placesRepo.get(cur.id);
  if (!p || !cur || !validGeo(cur.lat, cur.lng)) {
    cancelLocate();
    return;
  }
  locState.cur = null; /* el repositorio vuelve a pintar: el modo ubicación ya debe estar cerrado */
  const k = placesRepo.setLocation(p.id, cur.lat as number, cur.lng as number);
  toast(
    k
      ? `Ubicación guardada · ${k} ${k === 1 ? 'ruta actualizada' : 'rutas actualizadas'}`
      : 'Ubicación guardada',
  );
}
