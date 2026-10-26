/** Mapa de un viaje con MapLibre. */
import { EMPTY_FC, boundsOf, llOf, speedGradient } from './geo';
import { MapLib } from './loader';
import { buildPlacesMap } from './placesMap';
import { applyPlay } from './play';
import { failMap, revealMap } from './registry';
import { ACC } from '@/shared/ui/theme';
import { esc } from '@/shared/utils/format';

export function buildMap(m) {
  if (m.kind === 'places') return buildPlacesMap(m);
  const pts = m.pts,
    reduce = matchMedia('(prefers-reduced-motion: reduce)').matches,
    live = m.mode === 'interactive';
  const bounds = boundsOf(pts.map(llOf));
  const pad = Math.max(16, Math.min(46, Math.round((m.host.clientHeight || 160) * 0.16)));
  const fit = {
    padding: { top: pad + 12, bottom: pad, left: pad + 10, right: pad + 10 },
    maxZoom: 16,
  };
  let map;
  try {
    map = new maplibregl.Map({
      container: m.host,
      style: structuredClone(MapLib.style),
      bounds,
      fitBoundsOptions: fit,
      interactive: live,
      attributionControl: { compact: true },
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
  map.on('styleimagemissing', (e) => {
    if (!map.hasImage(e.id)) map.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) });
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
    const below = map.getStyle().layers.find((l) => l.type === 'symbol')?.id,
      cap = { 'line-cap': 'round', 'line-join': 'round' };
    map.addSource('route', {
      type: 'geojson',
      lineMetrics: true,
      data: {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: pts.map((p) => [p.lng, p.lat]) },
      },
    });
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
        layout: cap,
        paint: { 'line-width': live ? 4.2 : 3.4, 'line-gradient': speedGradient(pts) },
      },
      below,
    );
    const pin = (cls, p, name) => {
      const el = document.createElement('div');
      el.className = 'tm-pin ' + cls;
      el.innerHTML =
        (cls === 'tm-end' ? '<span class="tm-pulse"></span>' : '') +
        `<span class="tm-lbl">${esc(name)}</span>`;
      new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map);
    };
    pin('tm-start', pts[0], m.o);
    pin('tm-end', pts[pts.length - 1], m.d);
    if (live) {
      m.host.insertAdjacentHTML(
        'beforeend',
        '<div class="tm-legend"><span>0</span><i></i><span>40+ km/h</span></div>',
      );
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
