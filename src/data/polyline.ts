/**
 * Codificación de polylines (Encoded Polyline Algorithm Format). OSRM entrega la geometría con
 * precisión 1e-6; con `precision = 6` la codificación no pierde nada y pesa varias veces menos
 * que un GeoJSON. Los puntos van como [lng, lat], el orden de GeoJSON.
 */
export type LngLatPair = [number, number];

function encodeValue(v: number, out: string[]) {
  let n = v < 0 ? ~(v << 1) : v << 1;
  while (n >= 0x20) {
    out.push(String.fromCharCode((0x20 | (n & 0x1f)) + 63));
    n >>>= 5;
  }
  out.push(String.fromCharCode(n + 63));
}
export function encodePolyline(coords: LngLatPair[], precision = 6): string {
  const f = 10 ** precision,
    out: string[] = [];
  let pLat = 0,
    pLng = 0;
  for (const [lng, lat] of coords) {
    const la = Math.round(lat * f),
      ln = Math.round(lng * f);
    encodeValue(la - pLat, out);
    encodeValue(ln - pLng, out);
    pLat = la;
    pLng = ln;
  }
  return out.join('');
}
/** Decodifica una polyline. Lanza un error si el texto está truncado o tiene caracteres inválidos. */
export function decodePolyline(text: string, precision = 6): LngLatPair[] {
  const f = 10 ** precision,
    out: LngLatPair[] = [];
  let i = 0,
    lat = 0,
    lng = 0;
  const next = () => {
    let shift = 0,
      result = 0,
      b: number;
    do {
      if (i >= text.length) throw new Error('polyline truncada');
      b = text.charCodeAt(i++) - 63;
      if (b < 0 || b > 0x3f) throw new Error('polyline inválida');
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < text.length) {
    lat += next();
    lng += next();
    out.push([lng / f, lat / f]);
  }
  return out;
}
