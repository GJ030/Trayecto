/** Carga de MapLibre (desde la CDN, con SRI) y de su estilo. */
import type { StyleSpecification } from 'maplibre-gl';

/* Los mapas de ruta (Inicio, detalle del viaje, resumen) nacen como el SVG de siempre con atributos data-tmap;
   después de cada render, mountMaps() monta encima un mapa MapLibre. Si la librería, el estilo o los mosaicos
   no responden en 5 s, queda el SVG con el aviso "Mapa sin conexión".
   MapLibre 6 solo se distribuye como módulo ESM (ya no hay maplibre-gl.js ni el global maplibregl) y carga su
   worker desde otro archivo. `import()` y `new Worker()` no admiten SRI, así que ambos archivos se descargan con
   `fetch(…, { integrity })` y se usan como URL `blob:`; `window.maplibregl` se asigna a mano. */
export const ML = {
  base: 'https://unpkg.com/maplibre-gl@6.16.0/dist/',
  style: 'https://tiles.openfreemap.org/styles/dark',
  timeout: 5000,
  firstTimeout: 15000 /* el primer mapa (aún sin librería ni estilo) espera 15 s; los siguientes 5 s */,
  jsSri: 'sha384-uLwQnFL74rrONqIWx/ubL4wcAtA2h08tbMDZd9U4KbQ7GhaA7S1XKepHU89UkU7C',
  workerSri: 'sha384-FgyfFzov+/WGwlmjlowNT14eHNk/fCYPBsD/J2FkqC+Pef7/36bn0gdsHaB/Oso/',
  cssSri: 'sha384-S+OnE5M4U3Qc2nR0RgljGrVs06xqfRg8L7uFk/pOF5+sRuSDG4oKkqKZmFrx7w09',
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
/* Descarga un archivo de la CDN verificando su SRI; devuelve su texto */
async function verifiedText(file: string, integrity: string): Promise<string> {
  const r = await fetch(ML.base + file, {
    integrity,
    mode: 'cors',
    signal: AbortSignal.timeout(ML.firstTimeout),
  });
  if (!r.ok) throw new Error('maplibre');
  return r.text();
}
const blobUrl = (src: string) => URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
/* Desde file:// MapLibre no puede arrancar un worker de módulo (ni desde blob: ni desde data:: el origen es opaco).
   El worker es un módulo cuya única instrucción de módulo es el `export{…default}` final; sin ella es un script
   clásico, y una URL que termina en .cjs hace que MapLibre lo cargue como worker clásico. */
const WORKER_EXPORT = /export\s*\{[^}]*\};?(?=\s*(?:\/\/#[^\n]*)?\s*$)/;
function classicWorker(src: string): string {
  if (!WORKER_EXPORT.test(src)) throw new Error('maplibre');
  return blobUrl(src.replace(WORKER_EXPORT, '')) + '#maplibre-gl-worker.cjs';
}
async function loadLib(): Promise<void> {
  if (window.maplibregl) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = ML.base + 'maplibre-gl.css';
  l.integrity = ML.cssSri;
  l.crossOrigin = 'anonymous';
  const css = new Promise<void>((res, rej) => {
    l.onload = () => res();
    l.onerror = () => rej(new Error('maplibre'));
  });
  document.head.append(l);
  try {
    const [js, worker] = await Promise.all([
      verifiedText('maplibre-gl.mjs', ML.jsSri),
      verifiedText('maplibre-gl-worker.mjs', ML.workerSri),
      css,
    ]);
    const lib: typeof import('maplibre-gl') = await import(/* @vite-ignore */ blobUrl(js));
    lib.setWorkerUrl(classicWorker(worker));
    window.maplibregl = lib;
  } catch (e) {
    l.remove();
    throw e;
  }
}
export function mapAssets(): Promise<void> {
  if (window.maplibregl && MapLib.style) return Promise.resolve();
  if (mapsOffline()) return Promise.reject(new Error('offline'));
  if (MapLib.p) return MapLib.p;
  const lib = loadLib();
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
