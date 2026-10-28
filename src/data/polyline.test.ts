import { describe, expect, it } from 'vitest';
import { decodePolyline, encodePolyline, type LngLatPair } from './polyline';

describe('polyline', () => {
  it('coincide con el ejemplo de referencia del algoritmo (precisión 5)', () => {
    const pts: LngLatPair[] = [
      [-120.2, 38.5],
      [-120.95, 40.7],
      [-126.453, 43.252],
    ];
    expect(encodePolyline(pts, 5)).toBe('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@', 5)).toEqual(pts);
  });
  it('ida y vuelta sin pérdida con precisión 6 (coordenadas ficticias, saltos grandes y chicos)', () => {
    let a = 12345;
    const rnd = () => {
      a = (a * 1664525 + 1013904223) >>> 0;
      return a / 4294967296;
    };
    const pts: LngLatPair[] = [];
    let lng = 10,
      lat = 10;
    for (let i = 0; i < 2000; i++) {
      lng = Math.round((lng + (rnd() - 0.5) * (i % 50 === 0 ? 40 : 0.002)) * 1e6) / 1e6;
      lat = Math.round((lat + (rnd() - 0.5) * (i % 50 === 0 ? 40 : 0.002)) * 1e6) / 1e6;
      lng = Math.max(-179.9, Math.min(179.9, lng));
      lat = Math.max(-89.9, Math.min(89.9, lat));
      pts.push([lng, lat]);
    }
    expect(decodePolyline(encodePolyline(pts, 6), 6)).toEqual(pts);
  });
  it('maneja negativos, cero, vacío y un solo punto', () => {
    expect(encodePolyline([])).toBe('');
    expect(decodePolyline('')).toEqual([]);
    for (const p of [
      [[0, 0]],
      [[-0.000001, 0.000001]],
      [[-179.999999, -89.999999]],
    ] as LngLatPair[][])
      expect(decodePolyline(encodePolyline(p))).toEqual(p);
  });
  it('pesa menos que el GeoJSON equivalente', () => {
    const pts: LngLatPair[] = Array.from({ length: 237 }, (_, i) => [
      10 + i * 0.00041,
      10.5 + Math.sin(i / 9) * 0.0021 + i * 0.0003,
    ]);
    const rounded = pts.map(([x, y]) => [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6]);
    expect(encodePolyline(pts).length).toBeLessThan(JSON.stringify(rounded).length / 3);
  });
  it('rechaza texto truncado o con caracteres inválidos', () => {
    const t = encodePolyline([
      [10.123456, 10.654321],
      [10.2, 10.7],
    ]);
    expect(() => decodePolyline(t.slice(0, -1))).toThrow();
    expect(() => decodePolyline('abc def')).toThrow();
    expect(() => decodePolyline('ÿÿ')).toThrow();
  });
});
