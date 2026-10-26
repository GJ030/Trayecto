/** Reproducción de la ruta de un viaje. */
import { EMPTY_FC, llOf } from './geo';
import { MapReg } from './registry';
import { $, $$, contentEl, reduceMotion } from '@/shared/ui/dom';
import { icon } from '@/shared/ui/icons';
import { NF0, esc } from '@/shared/utils/format';

/* ---- Reproducción de ruta (detalle del viaje) ----
   El estado vive fuera del DOM (render() lo reemplaza todo): Play.t es la fracción del tiempo del viaje (0–1) */
export const Play = { id: null, t: 0, playing: false, active: false, speed: 1, raf: 0, last: 0 };
/* posición, hora y velocidad interpoladas en la fracción f del tiempo del viaje */
function playAt(m, f) {
  const pts = m.pts,
    ts = m.ts,
    tt = ts[0] + (ts[ts.length - 1] - ts[0]) * f;
  let i = 0;
  while (i < pts.length - 2 && ts[i + 1] <= tt) i++;
  const a = pts[i],
    b = pts[i + 1],
    u = ts[i + 1] > ts[i] ? Math.max(0, Math.min(1, (tt - ts[i]) / (ts[i + 1] - ts[i]))) : 0;
  return {
    i,
    lat: a.lat + (b.lat - a.lat) * u,
    lng: a.lng + (b.lng - a.lng) * u,
    speed: a.speed + (b.speed - a.speed) * u,
    time: tt,
  };
}
export function applyPlay(m) {
  if (m.kind !== 'trip' || m.mode !== 'interactive' || !m.map || !m.loaded) return;
  const src = m.map.getSource('play');
  if (!src) return;
  const on = Play.active && Play.id === m.tripId;
  if (on !== !!m.playOn) {
    /* atenúa la ruta completa mientras se dibuja el recorrido */
    m.playOn = on;
    m.map.setPaintProperty('route-line', 'line-opacity', on ? 0.28 : 1);
    m.map.setPaintProperty('route-halo', 'line-opacity', on ? 0.12 : 0.34);
  }
  if (!on) {
    src.setData(EMPTY_FC);
    if (m.playMarker) {
      m.playMarker.remove();
      m.playMarker = null;
    }
    return;
  }
  const c = playAt(m, Play.t);
  src.setData({
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: [...m.pts.slice(0, c.i + 1).map(llOf), [c.lng, c.lat]],
    },
  });
  if (!m.playMarker) {
    const el = document.createElement('div');
    el.className = 'tm-pin tm-end';
    el.innerHTML = '<span class="tm-pulse"></span>';
    m.playMarker = new maplibregl.Marker({ element: el }).setLngLat([c.lng, c.lat]).addTo(m.map);
  } else m.playMarker.setLngLat([c.lng, c.lat]);
}
const applyPlayAll = () =>
  MapReg.forEach((m) => {
    if (m.kind === 'trip') applyPlay(m);
  });
export function playBarHTML(t) {
  if (!Array.isArray(t.points) || t.points.length < 2) return '';
  const me = Play.id === t.id,
    on = me && Play.playing;
  return `<div class="play-bar" data-play="${esc(t.id)}"><div class="play-row"><button class="play-btn" data-action="play-toggle" data-id="${esc(t.id)}" aria-label="${on ? 'Pausar' : 'Reproducir'} ruta" title="${on ? 'Pausar' : 'Reproducir ruta'}">${icon(on ? 'pause' : 'play', 16)}</button><input class="play-range" type="range" min="0" max="1000" value="${me ? Math.round(Play.t * 1000) : 0}" data-play-range="${esc(t.id)}" aria-label="Progreso de la ruta"><div class="seg" role="group" aria-label="Velocidad de reproducción">${[1, 4, 16].map((s) => `<button aria-pressed="${Play.speed === s}" data-action="play-speed" data-speed="${s}">×${s}</button>`).join('')}</div></div><div class="play-info" aria-live="off">Reproduce el recorrido del viaje</div></div>`;
}
/* actualiza la barra existente sin volver a renderizar */
export function updatePlayUI() {
  const bar = $('[data-play]', contentEl);
  if (!bar) return;
  const me = Play.id === bar.dataset.play,
    on = me && Play.playing,
    btn = $('.play-btn', bar);
  btn.innerHTML = icon(on ? 'pause' : 'play', 16);
  btn.setAttribute('aria-label', (on ? 'Pausar' : 'Reproducir') + ' ruta');
  btn.title = on ? 'Pausar' : 'Reproducir ruta';
  const r = $('.play-range', bar);
  if (me && document.activeElement !== r) r.value = Math.round(Play.t * 1000);
  $$('[data-action=play-speed]', bar).forEach((b) =>
    b.setAttribute('aria-pressed', String(+b.dataset.speed === Play.speed)),
  );
  const m = MapReg.find(
    (x) => x.kind === 'trip' && x.mode === 'interactive' && x.tripId === bar.dataset.play && x.ts,
  );
  const info = $('.play-info', bar);
  if (me && Play.active && m) {
    const c = playAt(m, Play.t);
    info.textContent = `${new Date(c.time).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · ${NF0.format(c.speed)} km/h`;
  } else info.textContent = 'Reproduce el recorrido del viaje';
}
function playTick(now) {
  if (!Play.playing) return;
  Play.t = Math.min(1, Play.t + Math.min(100, now - Play.last) / (8000 / Play.speed));
  Play.last = now;
  if (Play.t >= 1) Play.playing = false;
  applyPlayAll();
  updatePlayUI();
  if (Play.playing) Play.raf = requestAnimationFrame(playTick);
}
export function togglePlay(id) {
  if (Play.id !== id) Object.assign(Play, { id, t: 0, playing: false, active: false });
  cancelAnimationFrame(Play.raf);
  if (Play.playing) Play.playing = false;
  else {
    Play.active = true;
    if (reduceMotion()) {
      Play.t = 1;
      Play.playing = false;
    } /* sin animación: salta al final */
    else {
      if (Play.t >= 1) Play.t = 0;
      Play.playing = true;
      Play.last = performance.now();
      Play.raf = requestAnimationFrame(playTick);
    }
  }
  applyPlayAll();
  updatePlayUI();
}
export function scrubPlay(id, v) {
  if (Play.id !== id) Object.assign(Play, { id });
  cancelAnimationFrame(Play.raf);
  Play.playing = false;
  Play.active = true;
  Play.t = v / 1000;
  applyPlayAll();
  updatePlayUI();
}
/* Se llama tras cada render: la reproducción se detiene y se libera si el viaje ya no está en el detalle */
export function syncPlay() {
  const bar = $('[data-play]', contentEl);
  if (Play.id && (!bar || bar.dataset.play !== Play.id)) {
    cancelAnimationFrame(Play.raf);
    Object.assign(Play, { id: null, t: 0, playing: false, active: false });
    applyPlayAll();
  }
}
