/** Carga de MapLibre (desde la CDN, con SRI) y de su estilo. */
import type { StyleSpecification } from 'maplibre-gl';

/* Los mapas de ruta (Inicio, detalle del viaje, resumen) nacen como el SVG de siempre con atributos data-tmap;
   después de cada render, mountMaps() monta encima un mapa MapLibre. Si la librería, el estilo o los mosaicos
   no responden en 5 s, queda el SVG con el aviso "Mapa sin conexión". */
export const ML = {
  base: 'https://unpkg.com/maplibre-gl@5.7.0/dist/',
  style: 'https://tiles.openfreemap.org/styles/dark',
  timeout: 5000,
  firstTimeout: 8000 /* el primer mapa (aún sin librería ni estilo) espera 8 s; los siguientes 5 s */,
  jsSri: 'sha384-Blts4zGbI8Hh/NvhcxTYsF2uLBbYIwHXEhPMxN3XpadJCDgstyLfJA3opgmkfBOc',
  cssSri: 'sha384-gNYNsUmuZqDYiT3gbirWTV5K7rt71RoveS/yXAaU09d4ZUmeDVTD3XoqB6uJAIFR',
};
export const MapLib: {
  p: Promise<void> | null;
  style: StyleSpecification | null;
  failedAt: number;
} = { p: null, style: null, failedAt: 0 };
/* Al destruir un mapa con mosaicos en vuelo, MapLibre registra un AbortError inofensivo: se omite para no ensuciar la consola */
(() => {
  const ce = console.error;
  console.error = function (e: unknown, ...r: unknown[]) {
    if (e && (e as Error).name === 'AbortError') return;
    return ce.call(console, e, ...r);
  };
})();
export const mapsOffline = () => !!MapLib.failedAt && Date.now() - MapLib.failedAt < 30000;
export function mapAssets(): Promise<void> {
  if (window.maplibregl && MapLib.style) return Promise.resolve();
  if (mapsOffline()) return Promise.reject(new Error('offline'));
  if (MapLib.p) return MapLib.p;
  const lib = new Promise<void>((res, rej) => {
    if (window.maplibregl) return res();
    const l = document.createElement('link'),
      s = document.createElement('script');
    let done = false;
    l.rel = 'stylesheet';
    l.href = ML.base + 'maplibre-gl.css';
    l.integrity = ML.cssSri;
    l.crossOrigin = 'anonymous';
    s.src = ML.base + 'maplibre-gl.js';
    s.integrity = ML.jsSri;
    s.crossOrigin = 'anonymous';
    const bad = () => {
      if (done) return;
      done = true;
      l.remove();
      s.remove();
      rej(new Error('maplibre'));
    };
    s.onload = () => {
      if (done) return;
      if (window.maplibregl) {
        done = true;
        res();
      } else bad();
    };
    s.onerror = bad;
    l.onerror = bad;
    document.head.append(l, s);
  });
  const style = fetch(
    ML.style,
    typeof AbortSignal !== 'undefined' && AbortSignal.timeout
      ? { signal: AbortSignal.timeout(ML.firstTimeout) }
      : {},
  )
    .then((r) => {
      if (!r.ok) throw new Error('style');
      return r.json();
    })
    .then((j: StyleSpecification) => {
      const bg = j.layers.find((l) => l.type === 'background');
      if (bg) (bg.paint as Record<string, unknown>)['background-color'] = '#0F0F12';
      MapLib.style = j;
    });
  const p = (MapLib.p = Promise.all([lib, style]).then(
    () => {
      MapLib.p = null;
    },
    (e) => {
      MapLib.p = null;
      MapLib.failedAt = Date.now();
      throw e;
    },
  ));
  return p;
}
