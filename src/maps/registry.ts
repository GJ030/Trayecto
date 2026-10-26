/** Registro de los mapas vivos (MapReg). */
import type { Map as MlMap, Marker } from 'maplibre-gl';
import type { RoutePoint, Trip } from '@/data/schema';
import { S } from '@/data/store';
import { ML, MapLib, mapAssets, mapsOffline } from './loader';
import { refreshPlaces } from './placesMap';
import { applyPlay } from './play';
import { buildMap } from './routeMap';
import { routeMap } from './svg';
import { $$ } from '@/shared/ui/dom';
import { esc } from '@/shared/utils/format';
import { hashStr } from '@/shared/utils/math';

/** Una entrada por contenedor de mapa vivo. */
export interface MapEntry {
  root: HTMLElement;
  kind: 'places' | 'trip';
  slot: string | undefined;
  tripId: string;
  key: string | undefined;
  mode: string | undefined;
  ph: HTMLElement;
  host: HTMLElement;
  map: MlMap | null;
  state: 'pending' | 'ready' | 'failed';
  dead: boolean;
  timer: ReturnType<typeof setTimeout> | 0;
  pts: RoutePoint[] | null;
  o: string | undefined;
  d: string | undefined;
  loaded?: boolean;
  /** Marcas de tiempo (ms) de los points, para la reproducción. */
  ts?: number[];
  playOn?: boolean;
  playMarker?: Marker | null;
  markers?: Marker[];
  locMarker?: Marker | null;
  sig?: Record<string, string>;
  heatKey?: string;
  fitKey?: string;
}
export const MapReg: MapEntry[] = [];
/* Marcador de posición de un mapa de viaje; sin points válidos devuelve solo el SVG */
export function tripMapHTML(t: Trip, W: number, H: number, slot: string, mode: string) {
  const svg = routeMap(t.origin, t.destination, W, H),
    pts = Array.isArray(t.points) ? t.points : [];
  if (pts.length < 2) return `<div class="map">${svg}</div>`;
  return `<div class="map" data-tmap="${esc(t.id)}" data-key="${hashStr(JSON.stringify(pts))}" data-slot="${slot}" data-mode="${mode}">${svg}</div>`;
}
/* Antes de reemplazar el HTML de un contenedor: saca los mapas del DOM sin destruirlos (se reclaman o se eliminan en mountMaps) */
export function parkMaps(root: HTMLElement) {
  for (const m of MapReg) if (m.root === root) m.host.remove();
}
function destroyMap(m: MapEntry) {
  m.dead = true;
  clearTimeout(m.timer);
  try {
    m.map?.remove();
  } catch (_) {}
  m.map = null;
  m.host.remove();
  const i = MapReg.indexOf(m);
  if (i >= 0) MapReg.splice(i, 1);
}
/* Después de reemplazar el HTML: reutiliza la instancia si el contenedor muestra el mismo viaje y ruta, elimina las que ya no
   hacen falta (así nunca se acumulan contextos WebGL) y crea solo las nuevas */
export function mountMaps(root: HTMLElement) {
  const claimed = new Set<MapEntry>(),
    todo: HTMLElement[] = [];
  for (const ph of $$('[data-tmap],[data-pmap]', root)) {
    const m = MapReg.find(
      (x) =>
        x.root === root &&
        !x.host.isConnected &&
        !claimed.has(x) &&
        x.slot === ph.dataset.slot &&
        x.tripId === (ph.dataset.tmap || '') &&
        x.key === ph.dataset.key &&
        x.mode === ph.dataset.mode,
    );
    if (!m) {
      todo.push(ph);
      continue;
    }
    claimed.add(m);
    m.ph = ph;
    if (m.state === 'failed') mapNote(ph);
    else {
      ph.appendChild(m.host);
      if (m.map) m.map.resize();
      if (m.kind === 'places' && m.state === 'ready') hideSvgPins(ph);
      if (m.loaded) {
        /* el mapa de lugares se actualiza en su sitio, sin recrearlo */
        if (m.kind === 'places') refreshPlaces(m);
        else applyPlay(m);
      }
    }
  }
  for (const m of [...MapReg])
    if (m.root === root && !m.host.isConnected && !claimed.has(m)) destroyMap(m);
  todo.forEach((ph) => startMap(ph, root));
}
function mapNote(ph: HTMLElement) {
  if (!ph.querySelector('.map-note'))
    ph.insertAdjacentHTML('beforeend', '<span class="map-note">Mapa sin conexión</span>');
}
export function failMap(m: MapEntry) {
  if (m.dead || m.state !== 'pending') return;
  m.state = 'failed';
  clearTimeout(m.timer);
  MapLib.failedAt = Date.now();
  try {
    m.map?.remove();
  } catch (_) {}
  m.map = null;
  m.host.remove();
  if (m.ph && m.ph.isConnected) mapNote(m.ph);
}
function startMap(ph: HTMLElement, root: HTMLElement) {
  const isP = ph.hasAttribute('data-pmap'),
    t = isP ? null : S.trips.find((x) => x.id === ph.dataset.tmap);
  if (!isP && !t) return;
  const m: MapEntry = {
    root,
    kind: isP ? 'places' : 'trip',
    slot: ph.dataset.slot,
    tripId: isP ? '' : t!.id,
    key: ph.dataset.key,
    mode: ph.dataset.mode,
    ph,
    host: document.createElement('div'),
    map: null,
    state: 'pending',
    dead: false,
    timer: 0,
    pts: t ? t.points : null,
    o: t?.origin,
    d: t?.destination,
  };
  m.host.className = 'tm-host';
  MapReg.push(m);
  if (mapsOffline()) {
    m.state = 'failed';
    mapNote(ph);
    return;
  }
  ph.appendChild(m.host);
  m.timer = setTimeout(
    () => failMap(m),
    window.maplibregl && MapLib.style ? ML.timeout : ML.firstTimeout,
  );
  mapAssets().then(
    () => {
      if (!m.dead && m.state === 'pending') buildMap(m);
    },
    () => failMap(m),
  );
}
export function revealMap(m: MapEntry) {
  if (m.dead || m.state !== 'pending') return;
  clearTimeout(m.timer);
  m.state = 'ready';
  MapLib.failedAt = 0;
  m.host.classList.add('on');
  if (m.kind === 'places') hideSvgPins(m.ph);
}
function hideSvgPins(ph: HTMLElement) {
  const s = ph.querySelector('svg');
  if (!s) return;
  s.setAttribute('aria-hidden', 'true');
  s.querySelectorAll('[tabindex]').forEach((e) => e.setAttribute('tabindex', '-1'));
}
