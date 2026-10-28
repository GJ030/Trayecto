import { describe, expect, it } from 'vitest';
import type { LayerSpecification } from 'maplibre-gl';
import { routeAnchor } from './layers';

type L = [id: string, type: string, sourceLayer?: string];
const style = (rows: L[]) =>
  rows.map(([id, type, sl]) => ({
    id,
    type,
    ...(sl ? { 'source-layer': sl } : {}),
  })) as unknown as LayerSpecification[];

/* Forma del estilo «dark» de OpenFreeMap: una etiqueta de agua (symbol) antes de las calles, símbolos de sentido
   en medio de las calles y las etiquetas de calles y lugares después */
const OFM: L[] = [
  ['background', 'background'],
  ['water', 'fill', 'water'],
  ['waterway', 'line', 'waterway'],
  ['water_name', 'symbol', 'water_name'],
  ['building', 'fill', 'building'],
  ['aeroway-runway', 'line', 'aeroway'],
  ['road_pier', 'line', 'transportation'],
  ['highway_path', 'line', 'transportation'],
  ['highway_minor', 'line', 'transportation'],
  ['highway_major_inner', 'line', 'transportation'],
  ['highway_motorway_inner', 'line', 'transportation'],
  ['road_oneway', 'symbol', 'transportation'],
  ['highway_motorway_subtle', 'line', 'transportation'],
  ['railway', 'line', 'transportation'],
  ['highway_name_other', 'symbol', 'transportation_name'],
  ['highway_name_motorway', 'symbol', 'transportation_name'],
  ['boundary_state', 'line', 'boundary'],
  ['place_city', 'symbol', 'place'],
];

describe('routeAnchor: capa antes de la que van las rutas', () => {
  it('es la primera etiqueta posterior a la última capa de calles (no la de agua ni los sentidos de calle)', () => {
    expect(routeAnchor(style(OFM))).toBe('highway_name_other');
  });
  it('no depende de índices fijos: con más capas antes o en medio sigue encontrándola', () => {
    const more: L[] = [
      ['extra_a', 'fill', 'landuse'],
      ['extra_b', 'symbol', 'poi'],
      ...OFM.slice(1, 13),
      ['highway_extra_late', 'line', 'transportation'],
      ...OFM.slice(13),
    ];
    expect(routeAnchor(style(more))).toBe('highway_name_other');
  });
  it('reconoce las calles por el nombre si el estilo no declara source-layer', () => {
    const named: L[] = [
      ['water', 'fill'],
      ['label_water', 'symbol'],
      ['highway_minor', 'line'],
      ['highway_motorway', 'line'],
      ['label_roads', 'symbol'],
    ];
    expect(routeAnchor(style(named))).toBe('label_roads');
  });
  it('sin calles reconocibles usa highway_name_other y, si no existe, la primera etiqueta', () => {
    expect(
      routeAnchor(
        style([
          ['water', 'fill'],
          ['a', 'symbol'],
          ['highway_name_other', 'symbol'],
        ]),
      ),
    ).toBe('highway_name_other');
    expect(
      routeAnchor(
        style([
          ['water', 'fill'],
          ['a', 'symbol'],
          ['b', 'symbol'],
        ]),
      ),
    ).toBe('a');
  });
  it('sin etiquetas no hay capa de inserción: las rutas quedan encima de todo', () => {
    expect(routeAnchor(style([['water', 'fill']]))).toBeUndefined();
    expect(routeAnchor(style([]))).toBeUndefined();
  });
});
