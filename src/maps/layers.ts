/** Dónde insertar las capas de ruta en el estilo del mapa base. */
import type { LayerSpecification } from 'maplibre-gl';

/** Capas que dibujan calles, caminos o vías (en OpenFreeMap: líneas de `transportation`; el nombre es el respaldo). */
const isRoadLine = (l: Pick<LayerSpecification, 'type' | 'id'> & { 'source-layer'?: string }) =>
  l.type === 'line' &&
  (l['source-layer'] === 'transportation' || /^(highway|road|railway|bridge|tunnel)/.test(l.id));

/**
 * Capa antes de la que se insertan las rutas: queda encima de todas las calles y debajo de las etiquetas.
 * Es la primera capa `symbol` posterior a la última capa de calles. No depende de índices fijos: si el estilo no trae
 * calles reconocibles, se usa `highway_name_other` y, si tampoco existe, la primera capa `symbol`.
 * Devuelve `undefined` (encima de todo) si el estilo no tiene etiquetas.
 */
export function routeAnchor(layers: readonly LayerSpecification[]): string | undefined {
  const lastRoad = layers.reduce((n, l, i) => (isRoadLine(l) ? i : n), -1);
  if (lastRoad >= 0) {
    const next = layers.slice(lastRoad + 1).find((l) => l.type === 'symbol');
    if (next) return next.id;
  }
  return (
    layers.find((l) => l.id === 'highway_name_other')?.id ??
    layers.find((l) => l.type === 'symbol')?.id
  );
}
