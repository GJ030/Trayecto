/** Mapa de lugares con MapLibre y modo ubicación. */
import type { GeoJSONSource, Map as MlMap, Marker, MapOptions } from 'maplibre-gl';
import { hasRealRoute } from '@/data/routes';
import { tripKey, type PairStat, type Trip } from '@/data/schema';
import { S, requestRender } from '@/data/store';
import { EMPTY_FC, boundsOf, llOf, speedGradient, type SpeedPoint } from './geo';
import { MapLib } from './loader';
import { failMap, revealMap, type MapEntry } from './registry';
import { reduceMotion } from '@/shared/ui/dom';
import { ACC } from '@/shared/ui/theme';
import { esc } from '@/shared/utils/format';
import { validGeo } from '@/shared/utils/geo';
import { norm } from '@/shared/utils/norm';

/* ---- Mapa de lugares ---- */
/** Datos que el mapa de lugares necesita pintar (visitas por lugar y trayectos); los aporta la funcionalidad de Lugares. */
export interface PlacesMapData {
  vis: Record<string, number>;
  pairs: PairStat[];
}
let placesData: () => PlacesMapData = () => ({ vis: {}, pairs: [] });
export const setPlacesMapData = (fn: () => PlacesMapData) => {
  placesData = fn;
};
/** Modo ubicación: lugar que se está colocando o moviendo. */
export interface LocState {
  id: string;
  lat: number | null;
  lng: number | null;
}
export const locState: { cur: LocState | null } = { cur: null };
/* viaje más reciente de un par origen→destino con ruta */
function latestPairTrip(pair: PairStat) {
  return S.trips
    .filter(
      (t) =>
        norm(t.origin) + '→' + norm(t.destination) === pair.key &&
        Array.isArray(t.points) &&
        t.points.length >= 2 &&
        hasRealRoute(t),
    )
    .sort((a, b) => tripKey(b).localeCompare(tripKey(a)))[0];
}
function pairLine(pair: PairStat): SpeedPoint[] | null {
  const t = latestPairTrip(pair);
  if (t) return t.points;
  const a = S.places.find((p) => norm(p.name) === norm(pair.from)),
    b = S.places.find((p) => norm(p.name) === norm(pair.to));
  return a && b && validGeo(a.lat, a.lng) && validGeo(b.lat, b.lng)
    ? [
        { lat: a.lat as number, lng: a.lng as number, speed: 20 },
        { lat: b.lat as number, lng: b.lng as number, speed: 20 },
      ]
    : null;
}
export function buildPlacesMap(m: MapEntry) {
  const reduce = reduceMotion(),
    geo = S.places.filter((p) => validGeo(p.lat, p.lng));
  const opts: MapOptions = {
    container: m.host,
    style: structuredClone(MapLib.style!),
    center: [-99.16, 19.4],
    zoom: 10,
    interactive: true,
    attributionControl: { compact: true },
    fadeDuration: reduce ? 0 : 200,
    maxPitch: 0,
    dragRotate: false,
    renderWorldCopies: false,
  };
  if (geo.length) {
    opts.bounds = boundsOf(geo.map(llOf));
    opts.fitBoundsOptions = {
      padding: { top: 50, bottom: 64, left: 60, right: 60 },
      maxZoom: 14,
    };
  }
  let map: MlMap;
  try {
    map = new maplibregl.Map(opts);
  } catch (e) {
    failMap(m);
    return;
  }
  m.map = map;
  m.markers = [];
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  map.touchZoomRotate.disableRotation();
  map.on('styleimagemissing', (e) => {
    if (!map.hasImage(e.id)) map.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) });
  });
  map.on('error', () => {});
  map.on('click', (e) => {
    /* modo ubicación: el clic coloca (o mueve) el pin */
    if (!locState.cur || (e.originalEvent.target as HTMLElement).closest('.tm-place,.tm-loc'))
      return;
    const ll = e.lngLat.wrap();
    locState.cur.lat = ll.lat;
    locState.cur.lng = ll.lng;
    requestRender();
  });
  map.on('load', () => {
    if (m.dead || m.state !== 'pending') return;
    clearTimeout(
      m.timer,
    ); /* 'load' = estilo y mosaicos descargados: el límite de 5 s ya no aplica, solo falta pintar */
    m.loaded = true;
    map.resize();
    const at = m.host.querySelector('.maplibregl-ctrl-attrib');
    if (at) {
      at.removeAttribute('open');
      at.classList.remove('maplibregl-compact-show');
    }
    const below = map.getStyle().layers.find((l) => l.type === 'symbol')?.id,
      cap = { 'line-cap': 'round', 'line-join': 'round' } as const;
    ['routes', 'heat', 'pairs'].forEach((id) =>
      map.addSource(id, { type: 'geojson', data: EMPTY_FC }),
    );
    map.addSource('pair-route', { type: 'geojson', lineMetrics: true, data: EMPTY_FC });
    map.addLayer(
      {
        id: 'heat',
        type: 'heatmap',
        source: 'heat',
        layout: { visibility: 'none' },
        paint: {
          'heatmap-weight': 1,
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 8, 0.3, 13, 1],
          'heatmap-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            8,
            7,
            12,
            16,
            15,
            34,
          ] /* se reescalan en refreshPlaces según la cantidad de points */,
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(255,176,32,0)',
            0.2,
            'rgba(255,176,32,.22)',
            0.5,
            'rgba(255,176,32,.7)',
            0.8,
            '#FFB020',
            1,
            '#FFF1D6',
          ],
          'heatmap-opacity': 0.9,
        },
      },
      below,
    );
    map.addLayer(
      {
        id: 'routes-base',
        type: 'line',
        source: 'routes',
        layout: { ...cap, visibility: 'none' },
        paint: { 'line-color': ACC, 'line-width': 2.6, 'line-opacity': 0.2 },
      },
      below,
    );
    map.addLayer(
      {
        id: 'pairs-dash',
        type: 'line',
        source: 'pairs',
        layout: cap,
        paint: {
          'line-color': '#FFFFFF',
          'line-width': 1.8,
          'line-opacity': 0.28,
          'line-dasharray': [2, 2.4],
        },
      },
      below,
    );
    map.addLayer(
      {
        id: 'routes-sel',
        type: 'line',
        source: 'routes',
        filter: ['==', ['get', 'rel'], 1],
        layout: { ...cap, visibility: 'none' },
        paint: { 'line-color': ACC, 'line-width': 3, 'line-opacity': 0.85 },
      },
      below,
    );
    map.addLayer(
      {
        id: 'pair-halo',
        type: 'line',
        source: 'pair-route',
        layout: { ...cap, visibility: 'none' },
        paint: { 'line-color': ACC, 'line-width': 16, 'line-blur': 10, 'line-opacity': 0.34 },
      },
      below,
    );
    map.addLayer(
      {
        id: 'pair-line',
        type: 'line',
        source: 'pair-route',
        layout: { ...cap, visibility: 'none' },
        paint: {
          'line-width': 4.2,
          'line-gradient': ['interpolate', ['linear'], ['line-progress'], 0, ACC, 1, ACC],
        },
      },
      below,
    );
    refreshPlaces(m, true);
    map.once('idle', () => revealMap(m));
    setTimeout(() => revealMap(m), 2500);
  });
}
const tripSig = (t: Trip) =>
  t.id +
  ':' +
  t.points.length +
  ':' +
  t.points[0].t +
  ':' +
  t.points[t.points.length - 1].t +
  ':' +
  t.points[t.points.length - 1].lat +
  ':' +
  t.points[t.points.length - 1].lng;
/* Aplica el estado actual (capa, lugar o trayecto seleccionado, modo ubicación) al mapa de lugares sin recrearlo */
export function refreshPlaces(m: MapEntry, first?: boolean) {
  const map = m.map;
  if (!map || !m.loaded || m.dead) return;
  const layer = S.ui.placesLayer || 'lugares',
    selP = S.places.find((p) => p.id === S.ui.selPlace),
    nsel = selP ? norm(selP.name) : null;
  const { vis, pairs } = placesData(),
    selPair = pairs.find((p) => p.key === S.ui.selPair);
  const rel = (t: Trip) => !!nsel && (norm(t.origin) === nsel || norm(t.destination) === nsel);
  const withPts = S.trips.filter((t) => Array.isArray(t.points) && t.points.length >= 2);
  /* el calor solo se pinta sobre geometrías reales (calculadas o importadas), no sobre rectas que atraviesan edificios */
  const realPts = withPts.filter(hasRealRoute);
  const set = (id: string, sig: string, build: () => GeoJSON.GeoJSON) => {
    if (m.sig?.[id] !== sig) {
      (m.sig || (m.sig = {}))[id] = sig;
      map.getSource<GeoJSONSource>(id)!.setData(build());
    }
  };
  set('routes', withPts.map((t) => tripSig(t) + rel(t)).join('|'), () => ({
    type: 'FeatureCollection',
    features: withPts.map((t) => ({
      type: 'Feature',
      properties: { rel: rel(t) ? 1 : 0 },
      geometry: { type: 'LineString', coordinates: t.points.map(llOf) },
    })),
  }));
  set('heat', realPts.map(tripSig).join('|'), () => ({
    type: 'FeatureCollection',
    features: realPts.flatMap((t) =>
      t.points.map((p) => ({
        type: 'Feature',
        properties: {},
        geometry: { type: 'Point', coordinates: llOf(p) },
      })),
    ),
  }));
  const freq = pairs.filter(
    (p) => p.n >= 2 && p !== selPair && !(nsel && (norm(p.from) === nsel || norm(p.to) === nsel)),
  );
  const fl = freq
    .map((p) => [p, pairLine(p)] as const)
    .filter((x): x is readonly [PairStat, SpeedPoint[]] => !!x[1]);
  set(
    'pairs',
    fl.map(([p, l]) => p.key + l.length + l[0].lat + l[l.length - 1].lng).join('|'),
    () => ({
      type: 'FeatureCollection',
      features: fl.map(([p, l]) => ({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: l.map(llOf) },
      })),
    }),
  );
  const pl = selPair && pairLine(selPair);
  set(
    'pair-route',
    selPair ? selPair.key + (pl ? pl.length + pl[0].lat + pl[pl.length - 1].lng : '') : '',
    () =>
      pl
        ? ({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: pl.map(llOf) },
          } as unknown as GeoJSON.Feature)
        : EMPTY_FC,
  );
  if (pl) map.setPaintProperty('pair-line', 'line-gradient', speedGradient(pl));
  const vs = (id: string, on: boolean) =>
    map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
  vs('heat', layer === 'calor');
  vs('routes-base', layer === 'rutas');
  vs('pairs-dash', layer === 'lugares');
  vs('routes-sel', !!selP);
  vs('pair-halo', !!pl);
  vs('pair-line', !!pl);
  /* la densidad crece con el historial: con muchos points se baja el peso y el radio, con pocos se sube; lo mismo con la opacidad de las rutas */
  const np = realPts.reduce((n, t) => n + t.points.length, 0),
    nt = withPts.length || 1,
    cl = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
  const hw = cl(Math.sqrt(500 / (np || 1)), 0.1, 1.8),
    hr = cl(Math.sqrt(1200 / (np || 1)), 0.55, 1.3),
    ro = cl(0.8 / Math.sqrt(nt), 0.03, 0.4);
  const hk = hw + '|' + hr;
  if (m.heatKey !== hk) {
    m.heatKey = hk;
    map.setPaintProperty('heat', 'heatmap-weight', hw);
    map.setPaintProperty('heat', 'heatmap-radius', [
      'interpolate',
      ['linear'],
      ['zoom'],
      8,
      7 * hr,
      12,
      16 * hr,
      15,
      34 * hr,
    ]);
  }
  map.setPaintProperty('routes-base', 'line-width', nt > 150 ? 2 : 2.6);
  map.setPaintProperty('routes-base', 'line-opacity', selP ? ro * 0.35 : ro);
  map.setPaintProperty('routes-sel', 'line-opacity', selPair ? 0.3 : 0.85);
  map.setPaintProperty('pairs-dash', 'line-opacity', selP ? 0.14 : 0.28);
  map.setPaintProperty('heat', 'heatmap-opacity', selP ? 0.4 : 0.9);
  /* pines: se recrean (pocos) con tamaño según visitas y estado de selección */
  m.markers!.forEach((k: Marker) => k.remove());
  m.markers = [];
  for (const p of S.places) {
    if (!validGeo(p.lat, p.lng) || (locState.cur && locState.cur.id === p.id)) continue;
    const v = vis[p.id] || 0,
      r = 5.5 + Math.min(9, v * 0.75);
    const sel =
      p.id === S.ui.selPlace ||
      (!!selPair && (norm(selPair.from) === norm(p.name) || norm(selPair.to) === norm(p.name)));
    const el = document.createElement('button');
    el.type = 'button';
    el.id = 'mpin-' + p.id;
    el.className = 'tm-place' + (sel ? ' sel' : '');
    el.dataset.action = 'place-select';
    el.dataset.id = p.id;
    el.style.setProperty('--r', r + 'px');
    el.setAttribute('aria-label', `${p.name}, ${v} ${v === 1 ? 'visita' : 'visitas'}`);
    el.setAttribute('aria-pressed', String(sel));
    el.innerHTML = `<span class="tm-ph"></span>${sel ? '<span class="tm-pulse"></span>' : ''}<span class="tm-pd"></span><span class="tm-pn">${esc(p.name)}</span>`;
    m.markers.push(
      new maplibregl.Marker({ element: el })
        .setLngLat([p.lng as number, p.lat as number])
        .addTo(map),
    );
  }
  /* pin de ubicación arrastrable */
  if (locState.cur && locState.cur.lat != null) {
    if (!m.locMarker) {
      const el = document.createElement('div');
      el.className = 'tm-loc';
      el.title = 'Arrastra para ajustar';
      m.locMarker = new maplibregl.Marker({ element: el, draggable: true })
        .setLngLat([locState.cur.lng as number, locState.cur.lat])
        .addTo(map);
      m.locMarker.on('dragend', () => {
        const ll = m.locMarker!.getLngLat();
        if (locState.cur) {
          locState.cur.lat = ll.lat;
          locState.cur.lng = ll.lng;
        }
      });
    } else m.locMarker.setLngLat([locState.cur.lng as number, locState.cur.lat]);
  } else if (m.locMarker) {
    m.locMarker.remove();
    m.locMarker = null;
  }
  m.host.classList.toggle('locating', !!locState.cur);
  /* encuadre: al abrir y al cambiar el trayecto seleccionado */
  const fk = selPair ? selPair.key : '';
  if (first || m.fitKey !== fk) {
    const pts = pl ? pl.map(llOf) : S.places.filter((p) => validGeo(p.lat, p.lng)).map(llOf);
    if (m.fitKey !== undefined || pl)
      if (pts.length)
        map.fitBounds(boundsOf(pts), {
          padding: { top: 50, bottom: 64, left: 60, right: 60 },
          maxZoom: pl ? 15 : 14,
          duration: first || reduceMotion() ? 0 : 700,
        });
    m.fitKey = fk;
  }
}
