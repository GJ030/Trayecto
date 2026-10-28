/** Mapa de un viaje con MapLibre. */
import { EMPTY_FC, boundsOf, llOf, speedGradient } from './geo';
import { routeAnchor } from './layers';
import { MapLib } from './loader';
import { buildPlacesMap } from './placesMap';
import { applyPlay } from './play';
import { failMap, revealMap, type MapEntry } from './registry';
import type { Map as MlMap } from 'maplibre-gl';
import { ROUTING } from '@/data/routing';
import type { LatLng } from '@/data/schema';
import { ACC } from '@/shared/ui/theme';
import { esc } from '@/shared/utils/format';

export function buildMap(m: MapEntry) {
  if (m.kind === 'places') return buildPlacesMap(m);
  const plan = m.plan,
    pts = m.pts!,
    reduce = matchMedia('(prefers-reduced-motion: reduce)').matches,
    live = m.mode === 'interactive';
  if (!plan) {
    failMap(m);
    return;
  }
  /* 'loading' (geometría aún sin cargar) no tiene points: se encuadran el origen y el destino */
  const bounds = boundsOf((plan.line === 'none' ? plan.ends : pts).map(llOf));
  const pad = Math.max(16, Math.min(46, Math.round((m.host.clientHeight || 160) * 0.16)));
  const fit = {
    padding: { top: pad + 12, bottom: pad, left: pad + 10, right: pad + 10 },
    maxZoom: 16,
  };
  let map: MlMap;
  try {
    map = new maplibregl.Map({
      container: m.host,
      style: structuredClone(MapLib.style!),
      bounds,
      fitBoundsOptions: fit,
      interactive: live,
      attributionControl: { compact: true, customAttribution: ROUTING.attribution },
      fadeDuration: reduce ? 0 : 200,
      maxPitch: 0,
      dragRotate: false,
      renderWorldCopies: false,
    });
  } catch (e) {
    failMap(m);
    return;
  }
  m.map = map;
  if (live) {
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.touchZoomRotate.disableRotation();
  }
  map.setMissingStyleImageResolver((id) => {
    if (!map.hasImage(id)) map.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) });
  }); /* el estilo pide un patrón que su sprite no trae */
  map.on(
    'error',
    () => {},
  ); /* un mosaico o ícono suelto que falle no invalida el mapa; si no termina de cargar, el temporizador de 5 s activa el SVG */
  map.on('load', () => {
    if (m.dead || m.state !== 'pending') return;
    clearTimeout(
      m.timer,
    ); /* 'load' = estilo y mosaicos descargados: el límite de 5 s ya no aplica, solo falta pintar */
    m.loaded = true;
    map.resize();
    map.fitBounds(bounds, { ...fit, duration: 0 });
    const at = m.host.querySelector('.maplibregl-ctrl-attrib');
    if (at) {
      at.removeAttribute('open');
      at.classList.remove('maplibregl-compact-show');
    } /* atribución compacta: solo el botón (i) hasta que se abre */
    const below = routeAnchor(map.getStyle().layers),
      cap = { 'line-cap': 'round', 'line-join': 'round' } as const;
    const solid = plan.line === 'solid';
    if (plan.line !== 'none') {
      map.addSource('route', {
        type: 'geojson',
        lineMetrics: true,
        data: {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: pts.map((p) => [p.lng, p.lat]) },
        } as GeoJSON.Feature,
      });
      /* calle por calle: halo y degradado de velocidad; recta punteada (sin ruta calculada): un solo trazo del color de acento,
         porque un degradado no se puede combinar con un patrón de rayas */
      if (solid)
        map.addLayer(
          {
            id: 'route-halo',
            type: 'line',
            source: 'route',
            layout: cap,
            paint: {
              'line-color': ACC,
              'line-width': live ? 16 : 13,
              'line-blur': 10,
              'line-opacity': 0.34,
            },
          },
          below,
        );
      map.addLayer(
        {
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: solid ? cap : { 'line-cap': 'butt', 'line-join': 'round' },
          paint: solid
            ? { 'line-width': live ? 4.2 : 3.4, 'line-gradient': speedGradient(pts) }
            : { 'line-width': live ? 4.2 : 3.4, 'line-color': ACC, 'line-dasharray': [2, 2] },
        },
        below,
      );
    }
    const pin = (cls: string, p: LatLng, name: string | undefined) => {
      const el = document.createElement('div');
      el.className = 'tm-pin ' + cls;
      el.innerHTML =
        (cls === 'tm-end' ? '<span class="tm-pulse"></span>' : '') +
        `<span class="tm-lbl">${esc(name)}</span>`;
      new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map);
    };
    pin('tm-start', plan.ends[0], m.o);
    pin('tm-end', plan.ends[1], m.d);
    if (live && solid)
      m.host.insertAdjacentHTML(
        'beforeend',
        '<div class="tm-legend"><span>0</span><i></i><span>40+ km/h</span></div>',
      );
    if (live && plan.line !== 'none') {
      /* capa de la reproducción: tramo recorrido sobre la ruta completa */
      m.ts = pts.map((p) => Date.parse(p.t));
      map.addSource('play', { type: 'geojson', data: EMPTY_FC });
      map.addLayer(
        {
          id: 'play-halo',
          type: 'line',
          source: 'play',
          layout: cap,
          paint: { 'line-color': ACC, 'line-width': 18, 'line-blur': 10, 'line-opacity': 0.5 },
        },
        below,
      );
      map.addLayer(
        {
          id: 'play-line',
          type: 'line',
          source: 'play',
          layout: cap,
          paint: { 'line-color': ACC, 'line-width': 4.8 },
        },
        below,
      );
    }
    map.once('idle', () => revealMap(m));
    setTimeout(() => revealMap(m), 2500);
    if (live) applyPlay(m);
  });
}
