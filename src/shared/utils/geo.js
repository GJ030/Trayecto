/** Validación de coordenadas. */
export function validGeo(lat, lng) {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}
